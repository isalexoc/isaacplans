/** Pure helpers for the GHL-facing webhook: bearer check and contact-id parsing. */

import { createHash, timingSafeEqual } from "crypto";

/**
 * Timing-safe bearer check. Both sides are hashed first so the comparison never reveals the
 * secret's length. Header only — a `?token=` secret ends up in request logs.
 */
export function isAuthorizedBearer(authorization: string | null, expected: string): boolean {
  if (!expected) return false;
  const header = (authorization ?? "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  const given = header.slice(7).trim();
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** GHL contact ids are ~20 alphanumerics; this also rejects an unrendered "{{contact.id}}". */
const CONTACT_ID_RE = /^[A-Za-z0-9]{10,40}$/;

function pick(value: unknown): string | null {
  return typeof value === "string" && CONTACT_ID_RE.test(value.trim()) ? value.trim() : null;
}

/** Accepts the documented `{"contactId": "{{contact.id}}"}` plus the shapes GHL's other webhook actions send. */
export function parseWebhookContactId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const nested = (key: string) => (b[key] && typeof b[key] === "object" ? (b[key] as Record<string, unknown>) : {});
  return (
    pick(b.contactId) ??
    pick(b.contact_id) ??
    pick(nested("data").contactId) ??
    pick(nested("customData").contactId) ??
    pick(nested("contact").id)
  );
}
