import "server-only";

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Keys for Lead Guard's HMACs (form token, stand-in contact ids).
 *
 * A key RING: tokens and ids are signed with the first key and accepted under any of them, so
 * adding LEAD_GUARD_SECRET later (or rotating it, keeping the old value in
 * LEAD_GUARD_SECRET_PREVIOUS for a week) never turns an open tab's token or a held lead's id into
 * garbage. Masters, in order: LEAD_GUARD_SECRET, LEAD_GUARD_SECRET_PREVIOUS, INTAKE_ENCRYPTION_KEY
 * (already set wherever intakes run, so the guard works with no new variable). Each purpose gets its
 * own HKDF-SHA256 subkey, so no derived key equals the intake AES key or another purpose's key.
 * The repo is public: nothing secret lives in code.
 *
 * No master at all → the guard turns itself off (leads flow as before) rather than holding every
 * lead because a variable is missing. See `leadGuardKeysAvailable`.
 */

export type LeadGuardKeyPurpose = "token" | "pseudo-id" | "subject";

const SALT = Buffer.from("isaacplans-lead-guard-v1", "utf8");
const cache = new Map<LeadGuardKeyPurpose, Buffer[]>();

function masters(): Buffer[] {
  const out: Buffer[] = [];
  for (const name of ["LEAD_GUARD_SECRET", "LEAD_GUARD_SECRET_PREVIOUS"] as const) {
    const v = process.env[name]?.trim();
    if (v && v.length >= 16) out.push(Buffer.from(v, "utf8"));
  }
  const intake = process.env.INTAKE_ENCRYPTION_KEY?.trim();
  if (intake) {
    const raw = Buffer.from(intake, "base64");
    if (raw.length >= 16) out.push(raw);
  }
  return out;
}

export function leadGuardKeysAvailable(): boolean {
  return masters().length > 0;
}

function keys(purpose: LeadGuardKeyPurpose): Buffer[] {
  const hit = cache.get(purpose);
  if (hit) return hit;
  const derived = masters().map((m) =>
    Buffer.from(hkdfSync("sha256", m, SALT, Buffer.from(`lead-guard:${purpose}`, "utf8"), 32))
  );
  cache.set(purpose, derived);
  return derived;
}

/** HMAC under the signing (first) key; null when no key exists. */
export function hmac(purpose: LeadGuardKeyPurpose, message: string): Buffer | null {
  const [primary] = keys(purpose);
  return primary ? createHmac("sha256", primary).update(message, "utf8").digest() : null;
}

/** HMAC under every key in the ring, signing key first (for verification). */
export function hmacAll(purpose: LeadGuardKeyPurpose, message: string): Buffer[] {
  return keys(purpose).map((k) => createHmac("sha256", k).update(message, "utf8").digest());
}

/** Constant-time compare of two strings (false on any length mismatch). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
