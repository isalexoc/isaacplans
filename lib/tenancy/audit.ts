/**
 * The sensitive-data access log (`sensitive_access_log`, migration 0046). Server-only.
 *
 * Best-effort by design: `logSensitiveAccess` never throws, and before 0046 is applied it does
 * nothing (silently, since that is expected); it says whether the row was written, so a reveal can
 * refuse rather than happen unlogged. It records field NAMES only; anything that doesn't
 * look like a field key is dropped, so a value can't be logged by mistake. The IP is stored as an
 * HMAC keyed from `INTAKE_ENCRYPTION_KEY` (no key, no hash), so the table can be read without
 * revealing where anyone was.
 */

import "server-only";
import crypto from "crypto";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { sensitiveAccessLog } from "@/lib/db/schema";
import { isMissingTableError } from "./db-errors";

export type SensitiveAccessAction =
  | "reveal"
  | "view_decrypted"
  | "secure_submit"
  | "export"
  | "purge"
  | "denied";

/** "unknown": signed in, but whether they are an operator couldn't be established. */
export type SensitiveAccessActorRole = "admin" | "agent" | "client" | "system" | "unknown";

export type SensitiveAccessEntry = {
  action: SensitiveAccessAction;
  actorUserId: string | null;
  actorRole: SensitiveAccessActorRole;
  /** The Clerk impersonation actor (`actor.sub`), when the session is impersonated. */
  impersonatorUserId?: string | null;
  ownerUserId: string;
  /** `intake_sessions.id` (never the token). */
  sessionId?: string | null;
  /** Field keys, e.g. ["ssn", "routingNumber"]. */
  fields?: readonly string[];
};

const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;

let ipKey: Buffer | null | undefined;

/** A key for IP hashes only, derived from the field-encryption key so the two never coincide. */
function ipHashKey(): Buffer | null {
  if (ipKey !== undefined) return ipKey;
  const raw = process.env.INTAKE_ENCRYPTION_KEY;
  ipKey = raw
    ? crypto.createHmac("sha256", Buffer.from(raw, "base64")).update("sensitive_access_log.ip.v1").digest()
    : null;
  return ipKey;
}

function hashIp(ip: string | null): string | null {
  const key = ipHashKey();
  return ip && key ? crypto.createHmac("sha256", key).update(ip).digest("hex") : null;
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
  } catch {
    // Outside a request (a script, a test): nothing to record.
    return { ip: null, userAgent: null };
  }
}

/**
 * Write one row. True when it was written; false when it wasn't (before 0046, or a failed insert),
 * so a caller that must not act unlogged (a reveal) can refuse instead.
 */
export async function logSensitiveAccess(entry: SensitiveAccessEntry): Promise<boolean> {
  try {
    const { ip, userAgent } = await requestMeta();
    await db.insert(sensitiveAccessLog).values({
      id: nanoid(),
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole,
      impersonatorUserId: entry.impersonatorUserId ?? null,
      ownerUserId: entry.ownerUserId,
      sessionId: entry.sessionId ?? null,
      action: entry.action,
      fields: (entry.fields ?? []).filter((f) => FIELD_KEY.test(f)),
      ipHash: hashIp(ip),
      userAgent,
    });
    return true;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[tenancy] access log write failed:", error instanceof Error ? error.message : error);
    }
    return false;
  }
}
