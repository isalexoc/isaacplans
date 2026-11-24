import "server-only";

import { randomBytes } from "node:crypto";

import { hmac, hmacAll, safeEqual } from "./keys";

/**
 * The form token: proof that the submission came from a page we rendered, and when.
 *
 * Stateless (no DB): base64url(JSON {v, iat, n}) + "." + base64url(HMAC-SHA256 truncated to 16 bytes).
 * The root layout renders one into <body data-lgt> on every page view, so a real browser always has
 * it — no network call, and its timestamp is the page render (a click queued before hydration is
 * not "instant"). Tabs older than a few hours fetch a fresh one from LEAD_TOKEN_PATH.
 *
 * NOT single-use and NOT a secret: a script can GET a page and read it. It is a HOLD signal only
 * (never a reason to drop a lead): no token, a forged one, or an instant submit get a human look.
 */

export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Serverless instances share NTP time; a token "from the future" beyond this is not ours. */
const CLOCK_SKEW_MS = 60_000;
const SIG_BYTES = 16;

export type LeadTokenCheck =
  | { state: "valid"; ageMs: number }
  | { state: "missing" }
  | { state: "forged" }
  | { state: "stale"; ageMs: number }
  | { state: "unavailable" };

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function mintLeadToken(nowMs: number = Date.now()): string | null {
  const payload = b64url(Buffer.from(JSON.stringify({ v: 1, iat: nowMs, n: b64url(randomBytes(9)) }), "utf8"));
  const mac = hmac("token", `lt1.${payload}`);
  return mac ? `${payload}.${b64url(mac.subarray(0, SIG_BYTES))}` : null;
}

export function verifyLeadToken(raw: unknown, nowMs: number = Date.now()): LeadTokenCheck {
  if (typeof raw !== "string" || raw.trim() === "") return { state: "missing" };
  const token = raw.trim();
  if (token.length > 256) return { state: "forged" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return { state: "forged" };
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const candidates = hmacAll("token", `lt1.${payloadB64}`);
  if (candidates.length === 0) return { state: "unavailable" };
  if (!candidates.some((mac) => safeEqual(sigB64, b64url(mac.subarray(0, SIG_BYTES))))) return { state: "forged" };

  let iat: unknown;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { v?: unknown; iat?: unknown };
    if (parsed.v !== 1) return { state: "forged" };
    iat = parsed.iat;
  } catch {
    return { state: "forged" };
  }
  if (typeof iat !== "number" || !Number.isFinite(iat)) return { state: "forged" };
  const ageMs = nowMs - iat;
  if (ageMs < -CLOCK_SKEW_MS) return { state: "forged" };
  if (ageMs > TOKEN_MAX_AGE_MS) return { state: "stale", ageMs };
  return { state: "valid", ageMs: Math.max(0, ageMs) };
}
