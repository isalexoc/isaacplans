/**
 * Offline checks for the ACA application review confirmation:
 *   pnpm test:aca-confirmation
 *
 * No network, no database, no env. Renders the signed PDF (en + es, drawn + typed, and a
 * worst-case long name), the request email, and exercises the validators and the evidence hash.
 * Artifacts go to <os tmp>/aca-confirmation-test/ so they can be opened and eyeballed.
 *
 * Doesn't import config.ts or storage.ts: "server-only" only resolves inside Next.
 */

import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { deflateSync } from "zlib";
import { extractText, getDocumentProxy } from "unpdf";
import { renderAcaConfirmationRequestEmail } from "../lib/aca-confirmation/email";
import { computeEvidenceSha256, decodeSignaturePng, sha256Hex } from "../lib/aca-confirmation/evidence";
import { CURRENT_FORM_VERSION, renderConfirmationForm } from "../lib/aca-confirmation/form-text";
import {
  MIN_DRAWN_POINTS,
  acaConfirmationSignSchema,
  confirmationState,
  describeDevice,
  formatLocalDateTime,
} from "../lib/aca-confirmation/format";
import type {
  AcaConfirmationAgent,
  AcaConfirmationLanguage,
  AcaConfirmationSnapshot,
  AcaConfirmationTrailEntry,
  SignatureMethod,
} from "../lib/aca-confirmation/types";

const OUT = join(tmpdir(), "aca-confirmation-test");
const TZ = "America/New_York";
const AGENT: AcaConfirmationAgent = {
  name: "Isaac Orraiz",
  npn: "0000000",
  phone: "(540) 426-1804",
  email: "info@isaacplans.com",
  agency: "Isaac Plans Insurance",
};

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// ─── A dependency-free PNG encoder for sample signatures ─────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A transparent PNG with a dark squiggle: stands in for a drawn signature. */
function samplePng(width = 600, height = 180, waves = 3): Buffer {
  const rows: Buffer[] = [];
  const ink = new Set<number>();
  for (let x = 20; x < width - 20; x++) {
    const y = Math.round(height / 2 + Math.sin((x / width) * Math.PI * 2 * waves) * (height / 3));
    for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) ink.add((y + dy) * width + (x + dx));
  }
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4); // filter byte 0, then RGBA
    for (let x = 0; x < width; x++) {
      if (ink.has(y * width + x)) row.set([15, 23, 42, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SIGNED_AT = "2026-11-10T02:28:13.000Z";

function fixture(language: AcaConfirmationLanguage, name: string, email: string) {
  const signedAtLocal = formatLocalDateTime(SIGNED_AT, language, TZ);
  const snapshot: AcaConfirmationSnapshot = {
    ...renderConfirmationForm(CURRENT_FORM_VERSION, language, {
      consumerName: name,
      consumerEmail: email,
      agent: AGENT,
      reviewedAt: signedAtLocal,
    }),
    signedAtIso: SIGNED_AT,
    signedAtLocal,
    timeZone: TZ,
  };
  const trail: AcaConfirmationTrailEntry[] = [
    { at: "2026-11-10T02:25:01.000Z", type: "created", who: AGENT.name, email: null, ip: "108.48.51.246", location: "Montgomery Village, MD, US", device: "Chrome · Windows" },
    { at: "2026-11-10T02:25:03.000Z", type: "email_sent", who: AGENT.name, email, ip: "108.48.51.246", location: "Montgomery Village, MD, US", device: "Chrome · Windows" },
    { at: "2026-11-10T02:26:40.000Z", type: "viewed", who: name, email: null, ip: "172.58.130.197", location: "Miami, FL, US", device: "Safari · iPhone" },
    { at: "2026-11-10T02:27:55.000Z", type: "viewed", who: name, email: null, ip: "172.58.130.197", location: "Miami, FL, US", device: "Safari · iPhone" },
    { at: SIGNED_AT, type: "signed", who: name, email: null, ip: "172.58.130.197", location: "Miami, FL, US", device: "Safari · iPhone" },
  ];
  return { snapshot, trail, signedAtLocal };
}

function evidenceFor(snapshot: AcaConfirmationSnapshot, name: string, email: string, method: SignatureMethod, pngSha: string) {
  return {
    id: "testDocId123",
    formVersion: CURRENT_FORM_VERSION,
    snapshot,
    consumerName: name,
    contactEmail: email,
    agent: AGENT,
    signatureMethod: method,
    signaturePngSha256: pngSha,
    strokesSha256: method === "drawn" ? sha256Hex("strokes") : null,
    typedName: method === "typed" ? name : null,
    signer: { ip: "172.58.130.197", city: "Miami", region: "FL", country: "US", userAgent: "UA" },
    signedAtIso: SIGNED_AT,
  };
}

const squash = (s: string) => s.replace(/\s+/g, "");

// ─── PDF ─────────────────────────────────────────────────────────────────────

async function checkPdf(
  render: typeof import("../lib/aca-confirmation/pdf").renderAcaConfirmationPdf,
  filename: typeof import("../lib/aca-confirmation/pdf").acaConfirmationPdfFilename,
  language: AcaConfirmationLanguage,
  method: SignatureMethod,
  name: string,
  email: string,
  label: string,
  opts: { logo?: Buffer | null; ipMatch?: boolean; expectName?: string } = {}
) {
  const { snapshot, trail, signedAtLocal } = fixture(language, name, email);
  const png = samplePng(method === "drawn" ? 600 : 900, method === "drawn" ? 180 : 220, method === "drawn" ? 3 : 5);
  const evidenceSha256 = computeEvidenceSha256(evidenceFor(snapshot, name, email, method, sha256Hex(png)));
  const pdf = await render({
    id: "testDocId123",
    snapshot,
    signerName: name,
    signaturePng: dataUrl(png),
    signatureMethod: method,
    trail,
    evidenceSha256,
    signerIpMatchesAgent: opts.ipMatch ?? false,
    logo: opts.logo === undefined ? null : opts.logo,
  });
  const file = join(OUT, `${label}-${filename({ id: "testDocId123", consumerName: name, signedAtIso: SIGNED_AT, language })}`);
  await writeFile(file, pdf);
  console.log(`      wrote ${file}`);

  check(`${label}: starts with %PDF-`, pdf.subarray(0, 5).toString("ascii") === "%PDF-");
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(doc, { mergePages: false });
  check(`${label}: exactly 2 pages`, totalPages === 2, `got ${totalPages}`);
  const page1 = squash(text[0] ?? "");
  const page2 = squash(text[1] ?? "");
  const expected1: Array<[string, string]> = [
    ["consumer name", opts.expectName ?? name],
    ["agent name", AGENT.name],
    ["NPN", AGENT.npn],
    ["reviewed date", signedAtLocal],
    ["attestations", language === "es" ? "certificaciones" : "attestations"],
    ["consent text", snapshot.consent],
  ];
  for (const [what, value] of expected1) {
    check(`${label}: page 1 has the ${what}`, page1.includes(squash(value)), value);
  }
  check(`${label}: page 2 has the evidence hash`, page2.includes(evidenceSha256));
  if (opts.ipMatch !== undefined) {
    const flagged = page2.includes(squash(language === "es" ? "misma dirección IP" : "same IP address"));
    check(`${label}: IP-match note ${opts.ipMatch ? "printed" : "absent"}`, flagged === opts.ipMatch);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT, { recursive: true });
  const { renderAcaConfirmationPdf, acaConfirmationPdfFilename } = await import("../lib/aca-confirmation/pdf");

  console.log("PDF");
  for (const language of ["en", "es"] as const) {
    for (const method of ["drawn", "typed"] as const) {
      await checkPdf(renderAcaConfirmationPdf, acaConfirmationPdfFilename, language, method, "Camila Avila Díaz", "camila@example.com", `${language}-${method}`);
    }
  }
  const longName = "María de los Ángeles Guadalupe Fernández-Villalobos de la Torre y Santa Cruz Montenegro Castellanos Ruiz".padEnd(120, "x").slice(0, 120);
  const longEmail = `${"maria.de.los.angeles.fernandez.villalobos".padEnd(48, "z")}@example.com`.slice(0, 60);
  check("long name is 120 characters", longName.length === 120);
  for (const language of ["en", "es"] as const) {
    await checkPdf(renderAcaConfirmationPdf, acaConfirmationPdfFilename, language, "drawn", longName, longEmail, `${language}-long`);
    // Same worst case with the real header height (a logo image instead of the text wordmark).
    await checkPdf(renderAcaConfirmationPdf, acaConfirmationPdfFilename, language, "drawn", longName, longEmail, `${language}-long-logo`, {
      logo: samplePng(340, 88, 2),
    });
  }
  // A name outside WinAnsi is transliterated, not dropped; and the IP-match note.
  await checkPdf(renderAcaConfirmationPdf, acaConfirmationPdfFilename, "en", "drawn", "Nguyễn Văn Łukasz", "n@example.com", "en-translit", {
    expectName: "Nguyen Van Lukasz",
    ipMatch: true,
  });
  await checkPdf(renderAcaConfirmationPdf, acaConfirmationPdfFilename, "es", "drawn", "Camila Avila Díaz", "camila@example.com", "es-no-ipmatch", {
    ipMatch: false,
  });
  const fname = acaConfirmationPdfFilename({ id: "Ab_c-12345678", consumerName: "Ñandú José-María <b>", signedAtIso: SIGNED_AT, language: "es" });
  check("PDF filename carries the document id", fname.endsWith("-Abc12345.pdf"), fname);
  check("PDF filename is ASCII and ends with .pdf", /^[\x20-\x7e]+\.pdf$/.test(fname), fname);

  console.log("Email");
  for (const language of ["en", "es"] as const) {
    const input = {
      language,
      firstName: `<script>alert(1)</script> & "Q"`,
      url: "https://www.isaacplans.com/es/aca/confirmacion/AbCdEfGhIjKlMnOpQrStUvWxYz012345",
      expiresAtLocal: formatLocalDateTime("2026-11-17T02:25:01.000Z", language, TZ),
      agent: AGENT,
    };
    const first = renderAcaConfirmationRequestEmail(input);
    const resend = renderAcaConfirmationRequestEmail({ ...input, isResend: true });
    await writeFile(join(OUT, `email-${language}.html`), first.html);
    check(`email ${language}: no raw <script>`, !first.html.includes("<script>"));
    check(`email ${language}: name escaped`, first.html.includes("&lt;script&gt;") && first.html.includes("&quot;Q&quot;"));
    check(`email ${language}: link present`, first.html.includes(input.url));
    check(`email ${language}: NPN in the sign-off`, first.html.includes(AGENT.npn));
    check(`email ${language}: resend subject differs`, first.subject !== resend.subject);
  }
  console.log(`      wrote ${join(OUT, "email-en.html")} / email-es.html`);

  console.log("Evidence hash");
  const { snapshot } = fixture("es", "Camila Avila Díaz", "camila@example.com");
  const base = evidenceFor(snapshot, "Camila Avila Díaz", "camila@example.com", "drawn", sha256Hex("png"));
  const h1 = computeEvidenceSha256(base);
  check("hash is deterministic", h1 === computeEvidenceSha256({ ...base, snapshot: JSON.parse(JSON.stringify(snapshot)) }));
  check("hash changes with the signature", h1 !== computeEvidenceSha256({ ...base, signaturePngSha256: sha256Hex("png2") }));
  check(
    "hash changes with the text",
    h1 !== computeEvidenceSha256({ ...base, snapshot: { ...snapshot, consent: `${snapshot.consent}.` } })
  );
  check("hash is 64 hex chars", /^[0-9a-f]{64}$/.test(h1));

  console.log("Signature PNG");
  const good = samplePng();
  check("accepts a real PNG", decodeSignaturePng(dataUrl(good)) !== null);
  check("rejects non-PNG base64", decodeSignaturePng(`data:image/png;base64,${Buffer.from("x".repeat(500)).toString("base64")}`) === null);
  check("rejects a truncated PNG", decodeSignaturePng(dataUrl(good.subarray(0, 40))) === null);
  check("rejects a PNG over 300 KB", decodeSignaturePng(dataUrl(Buffer.concat([good, Buffer.alloc(310 * 1024)]))) === null);
  check("rejects a 1x1 PNG", decodeSignaturePng(dataUrl(samplePng(1, 1, 1))) === null);

  console.log("Sign schema");
  const points = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i, y: i, time: 1000 + i }));
  const png = dataUrl(good);
  check(
    `rejects fewer than ${MIN_DRAWN_POINTS} drawn points`,
    !acaConfirmationSignSchema.safeParse({ language: "es", agreed: true, method: "drawn", png, strokes: [{ points: points(MIN_DRAWN_POINTS - 1) }] }).success
  );
  check(
    "rejects typed without typedName",
    !acaConfirmationSignSchema.safeParse({ language: "es", agreed: true, method: "typed", png }).success
  );
  check(
    "rejects agreed !== true",
    !acaConfirmationSignSchema.safeParse({ language: "es", agreed: false, method: "drawn", png, strokes: [{ points: points(40) }] }).success
  );
  check(
    "accepts a valid drawn signature",
    acaConfirmationSignSchema.safeParse({ language: "es", agreed: true, method: "drawn", png, strokes: [{ points: points(40) }] }).success
  );
  check(
    "accepts a valid typed signature",
    acaConfirmationSignSchema.safeParse({ language: "en", agreed: true, method: "typed", png, typedName: "Camila Avila" }).success
  );

  console.log("Format");
  const local = formatLocalDateTime(SIGNED_AT, "es", TZ);
  check("local time has no U+202F/U+00A0", !/[\u202f\u00a0]/.test(local), JSON.stringify(local));
  check("local time names the zone", /\b(EST|EDT)\b/.test(local), local);
  check("describeDevice iPhone", describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1") === "Safari · iPhone");
  check("describeDevice Android Chrome", describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36") === "Chrome · Android phone");
  check("describeDevice Edge Windows", describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0") === "Edge · Windows");
  check("confirmationState expired", confirmationState("pending", new Date(Date.now() - 1000)) === "expired");
  check("confirmationState pending", confirmationState("pending", new Date(Date.now() + 60_000)) === "pending");
  check("confirmationState signed stays signed", confirmationState("signed", new Date(0)) === "signed");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
