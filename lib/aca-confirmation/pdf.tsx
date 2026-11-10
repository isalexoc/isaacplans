/** @jsxRuntime automatic */
/**
 * The signed ACA application review confirmation as a PDF: page 1 is the one-page form exactly as
 * the client signed it (the frozen snapshot plus their signature), page 2 is the signature trail
 * (who did what, when, from which IP, place and device) with the evidence hash.
 *
 * This is the copy kept for 10 years and produced to CMS on request, so it is rendered once, after
 * signing, from the row's snapshot, never from the live form text.
 *
 * Built-in Helvetica only (no Font.register, nothing to fetch but the logo), the way
 * lib/illustration-studio/pdf does it. Helvetica only has WinAnsi glyphs, so every string goes
 * through winAnsiSafe and the check mark is drawn as a vector.
 *
 * Not `server-only`: scripts/test-aca-confirmation.ts renders it offline.
 */

import {
  Document,
  Font,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { formatLocalDateTime, formatUtc } from "./format";
import type {
  AcaConfirmationFormBlock,
  AcaConfirmationLanguage,
  AcaConfirmationSnapshot,
  AcaConfirmationTrailEntry,
  SignatureMethod,
} from "./types";

// Never hyphenate: a split "Rodrí-guez" on a legal record reads as broken (lib/mailing-labels/pdf.tsx).
Font.registerHyphenationCallback((word) => [word]);

export type AcaConfirmationPdfInput = {
  /** Document ID printed on both pages. */
  id: string;
  /** The exact text signed; language and timeZone inside. */
  snapshot: AcaConfirmationSnapshot;
  signerName: string;
  /** data:image/png;base64,… */
  signaturePng: string;
  signatureMethod: SignatureMethod;
  /** Chronological, at most 14 rows. */
  trail: AcaConfirmationTrailEntry[];
  evidenceSha256: string;
  /** Printed on the trail page when true: the signer's IP matched one the agent used. */
  signerIpMatchesAgent?: boolean;
  /** undefined: fetch the logo (cached per instance). null: no logo (the offline test). */
  logo?: Buffer | null;
};

const BLUE = "#0077B6";
const INK = "#111827";
const MUTED = "#4b5563";
const RULE = "#d1d5db";
const LOGO_URL = "https://res.cloudinary.com/isaacdev/image/upload/f_png,q_auto:best,h_88,c_fit/isaacplanslogo_tkraak";
const LOGO_TIMEOUT_MS = 8000;

// ─── Text safety ─────────────────────────────────────────────────────────────

/** cp1252's printable characters above 0xFF (copied from lib/presentation-scripts/format.ts). */
const WIN_ANSI_HIGH = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

const isWinAnsi = (ch: string) => (ch.codePointAt(0) ?? 0) <= 0xff || WIN_ANSI_HIGH.includes(ch);

/** Letters with no Unicode decomposition to a Latin base. */
const TRANSLITERATE: Record<string, string> = { Ł: "L", ł: "l", Đ: "D", đ: "d", Ħ: "H", ħ: "h", ı: "i", Ŀ: "L", ŀ: "l" };

/**
 * Make text drawable in Helvetica (WinAnsi only). Names are legal data, so a letter Helvetica lacks
 * is transliterated, not dropped: "Nguyễn" prints "Nguyen", "Łukasz" prints "Lukasz". Only what
 * has no Latin form at all (emoji, CJK) is removed. The exact name is kept in the snapshot.
 */
function winAnsiSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    if (isWinAnsi(ch)) {
      out += ch;
      continue;
    }
    out += [...toLatinBase(ch)].filter(isWinAnsi).join("");
  }
  return out;
}

/** "ễ" → "e", "Ł" → "L": the plain Latin letter, the way US documents spell such names. */
function toLatinBase(text: string): string {
  return [...text]
    .map((ch) => TRANSLITERATE[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const t = (value: string | null | undefined): string => winAnsiSafe(value?.trim() ? value : "—");

// ─── Labels ──────────────────────────────────────────────────────────────────

const LABELS = {
  en: {
    signedBy: "Signed by",
    signedOn: "Signed on",
    signature: "Signature",
    drawn: "drawn by hand",
    typed: "typed name",
    document: "Document ID",
    page: "Page",
    of: "of",
    trailTitle: "Signature trail",
    summaryConsumer: "Consumer or authorized representative",
    summarySigned: "Signed",
    summaryVersion: "Form version",
    colTime: "Date and time",
    colAction: "Action",
    colWho: "Who",
    colWhere: "IP / Location",
    colDevice: "Device",
    created: "Requested by the agent",
    email_sent: "Sent by email to",
    resent: "Re-sent by email to",
    viewed: "Viewed",
    signed: "Signed",
    hash: "Evidence hash (SHA-256)",
    ipMatch: "Note: the signature came from the same IP address the agent used for this request.",
    explain:
      "This confirmation was signed electronically at isaacplans.com, through a single-use link sent to the " +
      "consumer's email address. The IP address, approximate location and device of each step were recorded " +
      "automatically. The evidence hash is a fingerprint of the signed text, the names, the signature, the " +
      "signer's details and the time of signing: if any of them were changed, it would no longer match.",
  },
  es: {
    signedBy: "Firmado por",
    signedOn: "Firmado el",
    signature: "Firma",
    drawn: "dibujada a mano",
    typed: "nombre escrito",
    document: "Documento",
    page: "Página",
    of: "de",
    trailTitle: "Registro de firma",
    summaryConsumer: "Consumidor o representante autorizado",
    summarySigned: "Firmado",
    summaryVersion: "Versión del formulario",
    colTime: "Fecha y hora",
    colAction: "Acción",
    colWho: "Quién",
    colWhere: "IP / Ubicación",
    colDevice: "Dispositivo",
    created: "Solicitado por el agente",
    email_sent: "Enviado por correo a",
    resent: "Reenviado por correo a",
    viewed: "Visto",
    signed: "Firmado",
    hash: "Huella de evidencia (SHA-256)",
    ipMatch: "Nota: la firma se hizo desde la misma dirección IP que usó el agente para esta solicitud.",
    explain:
      "Esta confirmación se firmó electrónicamente en isaacplans.com, mediante un enlace de un solo uso enviado " +
      "al correo electrónico del consumidor. La dirección IP, la ubicación aproximada y el dispositivo de cada " +
      "paso se registraron automáticamente. La huella de evidencia identifica el texto firmado, los nombres, " +
      "la firma, los datos del firmante y la hora de la firma: si alguno de ellos cambiara, ya no coincidiría.",
  },
} satisfies Record<AcaConfirmationLanguage, Record<string, string>>;

type Labels = (typeof LABELS)["en"];

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: INK, paddingTop: 34, paddingBottom: 52, paddingHorizontal: 50 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: BLUE,
    paddingBottom: 8,
    marginBottom: 16,
  },
  logo: { height: 30, maxWidth: 170, objectFit: "contain" },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 13, color: BLUE },
  site: { fontSize: 8.5, color: MUTED },
  title: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "center", marginBottom: 13, lineHeight: 1.3 },
  paragraph: { fontSize: 10, lineHeight: 1.45, marginBottom: 9 },
  fields: { borderWidth: 0.75, borderColor: RULE, borderRadius: 3, marginTop: 2, marginBottom: 10 },
  fieldRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 4, paddingHorizontal: 7 },
  fieldRowLast: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 7 },
  fieldLabel: { width: "44%", fontSize: 8.5, color: MUTED, paddingRight: 8, lineHeight: 1.3 },
  fieldValue: { width: "56%", fontFamily: "Helvetica-Bold", fontSize: 9.5, lineHeight: 1.3 },
  fine: { fontSize: 8, color: MUTED, lineHeight: 1.35, marginBottom: 5 },
  consent: { flexDirection: "row", alignItems: "flex-start", marginTop: 4, marginBottom: 10 },
  consentText: { flex: 1, fontSize: 9, lineHeight: 1.35, marginLeft: 6 },
  signatureBox: { marginTop: 2, width: 280 },
  signatureImageArea: { height: 64, justifyContent: "flex-end", alignItems: "flex-start" },
  signatureImage: { maxHeight: 62, maxWidth: 270, objectFit: "contain" },
  signatureLine: { borderTopWidth: 0.75, borderTopColor: INK, marginTop: 2, marginBottom: 4 },
  caption: { fontSize: 8.5, lineHeight: 1.4 },
  captionLabel: { color: MUTED },
  footer: { position: "absolute", bottom: 24, left: 50, right: 50, fontSize: 7.5, color: "#6b7280", textAlign: "center" },
  // Page 2
  h2: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 10 },
  summary: { borderWidth: 0.75, borderColor: RULE, borderRadius: 3, marginBottom: 12 },
  table: { borderWidth: 0.75, borderColor: RULE, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE },
  trLast: { flexDirection: "row" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: MUTED, paddingVertical: 4, paddingHorizontal: 4, backgroundColor: "#f3f4f6" },
  td: { fontSize: 7.5, lineHeight: 1.3, paddingVertical: 4, paddingHorizontal: 4 },
  tdSub: { fontSize: 6.5, color: MUTED },
  hashLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, marginTop: 12, marginBottom: 2 },
  hash: { fontFamily: "Courier", fontSize: 8, lineHeight: 1.3 },
  explain: { fontSize: 8, color: MUTED, lineHeight: 1.4, marginTop: 10 },
  ipMatch: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#92400e", marginTop: 8 },
});

const COLS = { time: "24%", action: "27%", who: "17%", where: "18%", device: "14%" } as const;

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Header({ logo }: { logo: Buffer | null }) {
  return (
    <View style={s.header} fixed>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img
        <Image style={s.logo} src={{ data: logo, format: "png" }} />
      ) : (
        <Text style={s.wordmark}>Isaac Plans Insurance</Text>
      )}
      <Text style={s.site}>isaacplans.com</Text>
    </View>
  );
}

function Footer({ id, version, labels }: { id: string; version: string; labels: Labels }) {
  return (
    <Text
      style={s.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        winAnsiSafe(`${labels.document} ${id} · ${version} · ${labels.page} ${pageNumber} ${labels.of} ${totalPages}`)
      }
    />
  );
}

function CheckedBox() {
  return (
    <Svg viewBox="0 0 12 12" style={{ width: 10, height: 10, marginTop: 1 }}>
      <Rect x="0.6" y="0.6" width="10.8" height="10.8" rx="1.5" stroke={BLUE} strokeWidth={1} fill="#ffffff" />
      <Path d="M2.8 6.3 L5.1 8.5 L9.3 3.6" stroke={BLUE} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

function Block({ block }: { block: AcaConfirmationFormBlock }) {
  if (block.kind === "paragraph") return <Text style={s.paragraph}>{t(block.text)}</Text>;
  if (block.kind === "fine") return <Text style={s.fine}>{t(block.text)}</Text>;
  return (
    <View style={s.fields}>
      {block.rows.map((row, i) => (
        <View key={row.label} style={i === block.rows.length - 1 ? s.fieldRowLast : s.fieldRow} wrap={false}>
          <Text style={s.fieldLabel}>{t(row.label)}</Text>
          <Text style={s.fieldValue}>{t(row.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function pngBuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  return match ? Buffer.from(match[1], "base64") : null;
}

function SignatureBlock({
  input,
  labels,
}: {
  input: AcaConfirmationPdfInput;
  labels: Labels;
}) {
  const png = pngBuffer(input.signaturePng);
  return (
    <View style={s.signatureBox} wrap={false}>
      <View style={s.signatureImageArea}>
        {png ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img
          <Image style={s.signatureImage} src={{ data: png, format: "png" }} />
        ) : null}
      </View>
      <View style={s.signatureLine} />
      <Text style={s.caption}>
        <Text style={s.captionLabel}>{labels.signedBy}: </Text>
        {t(input.signerName)}
      </Text>
      <Text style={s.caption}>
        <Text style={s.captionLabel}>{labels.signedOn}: </Text>
        {t(input.snapshot.signedAtLocal)}
      </Text>
      <Text style={s.caption}>
        <Text style={s.captionLabel}>{labels.signature}: </Text>
        {input.signatureMethod === "drawn" ? labels.drawn : labels.typed}
      </Text>
    </View>
  );
}

function actionLabel(entry: AcaConfirmationTrailEntry, labels: Labels): string {
  if (entry.type === "email_sent" || entry.type === "resent") {
    return `${labels[entry.type]} ${entry.email ?? ""}`.trim();
  }
  return labels[entry.type];
}

function TrailTable({
  trail,
  snapshot,
  labels,
}: {
  trail: AcaConfirmationTrailEntry[];
  snapshot: AcaConfirmationSnapshot;
  labels: Labels;
}) {
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        <Text style={[s.th, { width: COLS.time }]}>{labels.colTime}</Text>
        <Text style={[s.th, { width: COLS.action }]}>{labels.colAction}</Text>
        <Text style={[s.th, { width: COLS.who }]}>{labels.colWho}</Text>
        <Text style={[s.th, { width: COLS.where }]}>{labels.colWhere}</Text>
        <Text style={[s.th, { width: COLS.device }]}>{labels.colDevice}</Text>
      </View>
      {trail.map((entry, i) => (
        <View key={`${entry.type}-${entry.at}-${i}`} style={i === trail.length - 1 ? s.trLast : s.tr} wrap={false}>
          <View style={[s.td, { width: COLS.time }]}>
            <Text>{t(formatLocalDateTime(entry.at, snapshot.language, snapshot.timeZone))}</Text>
            <Text style={s.tdSub}>{t(formatUtc(entry.at))}</Text>
          </View>
          <Text style={[s.td, { width: COLS.action }]}>{t(actionLabel(entry, labels))}</Text>
          <Text style={[s.td, { width: COLS.who }]}>{t(entry.who)}</Text>
          <View style={[s.td, { width: COLS.where }]}>
            <Text>{t(entry.ip)}</Text>
            {entry.location ? <Text style={s.tdSub}>{t(entry.location)}</Text> : null}
          </View>
          <Text style={[s.td, { width: COLS.device }]}>{t(entry.device)}</Text>
        </View>
      ))}
    </View>
  );
}

function AcaConfirmationDocument({ input, logo }: { input: AcaConfirmationPdfInput; logo: Buffer | null }) {
  const { snapshot } = input;
  const labels = LABELS[snapshot.language];
  const summaryRows: Array<[string, string]> = [
    [labels.summaryConsumer, input.signerName],
    [labels.summarySigned, `${snapshot.signedAtLocal} (${formatUtc(snapshot.signedAtIso)})`],
    [labels.document, input.id],
    [labels.summaryVersion, snapshot.version],
  ];

  return (
    <Document
      title={winAnsiSafe(`${snapshot.title} - ${input.signerName}`)}
      author="Isaac Plans Insurance"
      creator="Isaac Plans Insurance"
      producer="isaacplans.com"
      language={snapshot.language}
    >
      <Page size="LETTER" style={s.page}>
        <Header logo={logo} />
        <Text style={s.title}>{t(snapshot.title)}</Text>
        {snapshot.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
        <View style={s.consent} wrap={false}>
          <CheckedBox />
          <Text style={s.consentText}>{t(snapshot.consent)}</Text>
        </View>
        <SignatureBlock input={input} labels={labels} />
        <Footer id={input.id} version={snapshot.version} labels={labels} />
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header logo={logo} />
        <Text style={s.h2}>{labels.trailTitle}</Text>
        <View style={s.summary}>
          {summaryRows.map(([label, value], i) => (
            <View key={label} style={i === summaryRows.length - 1 ? s.fieldRowLast : s.fieldRow} wrap={false}>
              <Text style={s.fieldLabel}>{t(label)}</Text>
              <Text style={s.fieldValue}>{t(value)}</Text>
            </View>
          ))}
        </View>
        <TrailTable trail={input.trail} snapshot={snapshot} labels={labels} />
        <Text style={s.hashLabel}>{labels.hash}</Text>
        <Text style={s.hash}>{input.evidenceSha256}</Text>
        {input.signerIpMatchesAgent ? <Text style={s.ipMatch}>{t(labels.ipMatch)}</Text> : null}
        <Text style={s.explain}>{t(labels.explain)}</Text>
        <Footer id={input.id} version={snapshot.version} labels={labels} />
      </Page>
    </Document>
  );
}

// ─── Logo ────────────────────────────────────────────────────────────────────

let logoCache: Promise<Buffer | null> | null = null;

/** Fetched once per server instance. A failure isn't cached and never fails the render. */
function fetchLogo(): Promise<Buffer | null> {
  if (logoCache) return logoCache;
  logoCache = (async () => {
    try {
      const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      console.warn("[aca-confirmation] logo unavailable:", error);
      logoCache = null;
      return null;
    }
  })();
  return logoCache;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function renderAcaConfirmationPdf(input: AcaConfirmationPdfInput): Promise<Buffer> {
  const logo = input.logo === undefined ? await fetchLogo() : input.logo;
  const document = createElement(AcaConfirmationDocument, { input, logo });
  return renderToBuffer(document as unknown as ReactElement<DocumentProps>);
}

/**
 * "Confirmacion-solicitud-ACA-Camila-Avila-Diaz-2026-11-10-<id>.pdf" — ASCII only, because GHL and some
 * mail clients mangle accented file names. The date is the UTC date of signing.
 */
export function acaConfirmationPdfFilename(p: {
  /** The document ID: two confirmations signed the same day by the same client must not share a name. */
  id: string;
  consumerName: string;
  signedAtIso: string;
  language: AcaConfirmationLanguage;
}): string {
  const name =
    toLatinBase(p.consumerName)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "client";
  const date = /^\d{4}-\d{2}-\d{2}/.test(p.signedAtIso) ? p.signedAtIso.slice(0, 10) : "undated";
  const prefix = p.language === "es" ? "Confirmacion-solicitud-ACA" : "ACA-application-confirmation";
  const id = p.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "doc";
  return `${prefix}-${name}-${date}-${id}.pdf`;
}
