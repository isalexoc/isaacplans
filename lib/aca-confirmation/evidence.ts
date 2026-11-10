/**
 * Signing evidence: who asked, from where, with what, and a hash that ties it all together.
 * Server code only (Node crypto, Buffer, Vercel request headers). No `import "server-only"`: it
 * holds no secrets, `node:crypto` already keeps it out of browser bundles, and the offline test
 * (`pnpm test:aca-confirmation`) must be able to import it outside Next.
 *
 * Location comes from Vercel's edge headers, read through `@vercel/functions`. Off Vercel
 * (`pnpm dev`) those headers don't exist, so city/region/country are null locally. That's expected.
 */

import { createHash } from "node:crypto";
import { geolocation, ipAddress } from "@vercel/functions";
import type {
  AcaConfirmationAgent,
  AcaConfirmationSnapshot,
  SignatureMethod,
} from "./types";

export type RequestEvidence = {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
};

function clip(value: string | null | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}

/** IP, city/state/country and user-agent of the request. Never throws. */
export function readRequestEvidence(request: Request): RequestEvidence {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  let geo: { city?: string; countryRegion?: string; country?: string } = {};
  try {
    geo = geolocation(request);
  } catch {
    /* no geo headers */
  }
  return {
    ip: clip(ipAddress(request) || forwarded || headers.get("x-real-ip"), 64),
    city: clip(geo.city, 120),
    region: clip(geo.countryRegion, 16),
    country: clip(geo.country, 8),
    userAgent: clip(headers.get("user-agent"), 512),
  };
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export const MAX_SIGNATURE_PNG_BYTES = 300 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type DecodedSignaturePng = { bytes: Buffer; width: number; height: number; sha256: string };

/**
 * Decode and check the signature image by its bytes, not by what the data URL claims: PNG magic,
 * an IHDR chunk, plausible dimensions, a size cap. Null means "reject".
 */
export function decodeSignaturePng(dataUrl: string): DecodedSignaturePng | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 100 || bytes.length > MAX_SIGNATURE_PNG_BYTES) return null;
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return null;
  if (bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 50 || height < 20 || width > 4000 || height > 2000) return null;
  return { bytes, width, height, sha256: sha256Hex(bytes) };
}

/** JSON with object keys sorted at every level, so the same evidence always hashes the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export type EvidenceHashInput = {
  id: string;
  formVersion: string;
  snapshot: AcaConfirmationSnapshot;
  consumerName: string;
  contactEmail: string;
  agent: AcaConfirmationAgent;
  signatureMethod: SignatureMethod;
  signaturePngSha256: string;
  /** sha256 of stableStringify(strokes), or null for a typed signature. */
  strokesSha256: string | null;
  typedName: string | null;
  /** The signer's request, plus whether their IP matched one the agent used. */
  signer: RequestEvidence & { ipMatchesAgent?: boolean };
  signedAtIso: string;
};

/**
 * One hash over everything the signature stands for: the exact text, the names, the agent, the
 * signature image, the strokes, the signer's IP/device and the time. Stored on the row and printed
 * on the PDF's trail page, so any later change to any of it is detectable.
 */
export function computeEvidenceSha256(input: EvidenceHashInput): string {
  return sha256Hex(stableStringify({ schema: "aca-confirmation-evidence/v1", ...input }));
}
