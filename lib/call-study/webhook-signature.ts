/**
 * ElevenLabs webhook signature verification.
 *
 * Pure and dependency-free so it can be tested directly — this function is the only thing standing
 * between a public endpoint and anyone who wants to write a transcript into the database, and
 * "probably correct" is not good enough for that.
 *
 * Format: `ElevenLabs-Signature: t=<unix seconds>,v0=<hex>` where the hex is
 * HMAC-SHA256 of `"<t>.<rawBody>"` keyed with the webhook secret.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** Reject anything older than this so a captured payload cannot be replayed later. */
export const TIMESTAMP_TOLERANCE_SECONDS = 30 * 60;

export function parseSignatureHeader(header: string | null): { timestamp: string; signature: string } | null {
  if (!header) return null;
  let timestamp = "";
  let signature = "";
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v0") signature = value;
  }
  return timestamp && signature ? { timestamp, signature } : null;
}

/** The exact string ElevenLabs signs. Exposed so tests can build a valid header. */
export function signedPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function computeSignature(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(signedPayload(timestamp, rawBody)).digest("hex");
}

export function verifyElevenLabsSignature(params: {
  rawBody: string;
  header: string | null;
  secret: string;
  /** Injectable for tests. Seconds since epoch. */
  nowSeconds?: number;
}): boolean {
  if (!params.secret) return false;

  const parsed = parseSignatureHeader(params.header);
  if (!parsed) return false;

  const sentAt = Number(parsed.timestamp);
  if (!Number.isFinite(sentAt)) return false;

  const now = params.nowSeconds ?? Date.now() / 1000;
  // Bounded in both directions: a far-future timestamp is as suspicious as a stale one.
  if (Math.abs(now - sentAt) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const expected = computeSignature(parsed.timestamp, params.rawBody, params.secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.signature, "utf8");
  // timingSafeEqual throws on a length mismatch, and that throw would itself leak information.
  return a.length === b.length && timingSafeEqual(a, b);
}
