/**
 * Secure capture links for the shared intake engine: a client types their own SSN/ITIN, ID number
 * or bank details on their own phone instead of reading them out on the call.
 *
 * The IUL intake's `lib/iul-intake/secure-capture.ts`, generalized: what a link may ask for comes
 * from the line's config (`secureCapture.groups`), and the state lives in `intake_secure_captures`.
 * The captured values never live here — they go straight into the intake session, encrypted.
 *
 * Server-only (DB access).
 */

import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { intakeSecureCaptures, intakeSessions } from "@/lib/db/schema";
import { isValidRouting } from "@/lib/iul-intake/validation";
import { groupsForKeys } from "./secure-capture-groups";
import { isValidSsn } from "./validation";
import type { IntakeData, IntakeLobConfig } from "./types";

export type SecureCaptureStatus = "pending" | "submitted" | "cancelled";

export type SecureCaptureRow = typeof intakeSecureCaptures.$inferSelect;

/** What the agent's panel renders. No values, no session token: this crosses the wire. */
export type SecureCaptureView = {
  token: string;
  status: SecureCaptureStatus;
  createdAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  /** Group keys this link asks for, derived from its frozen field keys. Display only. */
  groups: string[];
};

export function toSecureCaptureView(config: IntakeLobConfig, row: SecureCaptureRow): SecureCaptureView {
  return {
    token: row.token,
    status: row.status as SecureCaptureStatus,
    createdAt: row.createdAt.toISOString(),
    openedAt: row.openedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    groups: groupsForKeys(config, row.fieldKeys ?? []),
  };
}

/**
 * How long after a client submits the server keeps their values over the agent's. Covers the gap
 * until the agent's next poll swaps in the masks (3 s poll + 1 s autosave debounce + network).
 */
export const CAPTURE_GRACE_MS = 15_000;

/** Longer than the 24-char intake token: this one gets texted and forwarded. */
const CAPTURE_TOKEN_LENGTH = 32;

/** The CRM tag whose "tag added" trigger lets a GHL workflow text the link. One per line. */
export function secureCaptureSentTag(config: IntakeLobConfig): string {
  return `${config.slugPrefix}_secure_capture_sent`;
}

export async function getCaptureByToken(token: string): Promise<SecureCaptureRow | null> {
  const [row] = await db
    .select()
    .from(intakeSecureCaptures)
    .where(eq(intakeSecureCaptures.token, token))
    .limit(1);
  return row ?? null;
}

export async function getPendingCapture(sessionId: string): Promise<SecureCaptureRow | null> {
  const [row] = await db
    .select()
    .from(intakeSecureCaptures)
    .where(and(eq(intakeSecureCaptures.sessionId, sessionId), eq(intakeSecureCaptures.status, "pending")))
    .orderBy(desc(intakeSecureCaptures.createdAt))
    .limit(1);
  return row ?? null;
}

/** The most recent link of any status, so a submitted one still shows as "received". */
export async function getLatestCapture(sessionId: string): Promise<SecureCaptureRow | null> {
  const [row] = await db
    .select()
    .from(intakeSecureCaptures)
    .where(eq(intakeSecureCaptures.sessionId, sessionId))
    .orderBy(desc(intakeSecureCaptures.createdAt))
    .limit(1);
  return row ?? null;
}

export async function cancelPendingCaptures(sessionId: string): Promise<number> {
  const rows = await db
    .update(intakeSecureCaptures)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(intakeSecureCaptures.sessionId, sessionId), eq(intakeSecureCaptures.status, "pending")))
    .returning({ id: intakeSecureCaptures.id });
  return rows.length;
}

/**
 * Issue a link, cancelling any previous pending one: an agent who sends a new link expects the old
 * text message to stop working, and two live write credentials is a needless thing to reason about.
 */
export async function createCapture(params: {
  lob: string;
  sessionId: string;
  ownerUserId: string;
  fieldKeys: string[];
}): Promise<SecureCaptureRow> {
  await cancelPendingCaptures(params.sessionId);
  const [row] = await db
    .insert(intakeSecureCaptures)
    .values({
      id: nanoid(),
      token: nanoid(CAPTURE_TOKEN_LENGTH),
      lob: params.lob,
      sessionId: params.sessionId,
      ownerUserId: params.ownerUserId,
      status: "pending",
      fieldKeys: [...params.fieldKeys],
    })
    .returning();
  return row;
}

/** Stamped on first open, so the agent's panel can say "opened, not sent yet". */
export async function markCaptureOpened(id: string): Promise<void> {
  await db
    .update(intakeSecureCaptures)
    .set({ openedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(intakeSecureCaptures.id, id), eq(intakeSecureCaptures.status, "pending")));
}

/** Single use: the first successful submit closes the link. */
export async function markCaptureSubmitted(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(intakeSecureCaptures)
    .set({ status: "submitted", submittedAt: now, updatedAt: now })
    .where(eq(intakeSecureCaptures.id, id));
}

/** Field keys a client submitted for this session within the last `windowMs`. */
export async function recentlyCapturedKeys(sessionId: string, windowMs: number): Promise<string[]> {
  const rows = await db
    .select({ fieldKeys: intakeSecureCaptures.fieldKeys })
    .from(intakeSecureCaptures)
    .where(
      and(
        eq(intakeSecureCaptures.sessionId, sessionId),
        eq(intakeSecureCaptures.status, "submitted"),
        gte(intakeSecureCaptures.submittedAt, new Date(Date.now() - windowMs))
      )
    );
  return Array.from(new Set(rows.flatMap((r) => r.fieldKeys ?? [])));
}

/** By id, scoped to the link's line: a capture outlives a token rotation. */
export async function getIntakeSessionById(lob: string, id: string) {
  const [row] = await db
    .select()
    .from(intakeSessions)
    .where(and(eq(intakeSessions.lob, lob), eq(intakeSessions.id, id)))
    .limit(1);
  return row ?? null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Server-side checks for what a client submits. The page validates too, but that is a courtesy.
 * Every key the link asks for is required: a link must never close having collected nothing.
 */
export function validateCapture(patch: IntakeData, allowed: ReadonlySet<string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of allowed) {
    const value = str(patch[key]);
    let ok: boolean;
    switch (key) {
      case "ssn":
        ok = isValidSsn(value);
        break;
      case "routingNumber":
        ok = isValidRouting(value);
        break;
      case "accountNumber":
        ok = /^\d{4,17}$/.test(value);
        break;
      case "accountType":
        ok = value === "Checking" || value === "Savings";
        break;
      case "idDocNumber":
        // Driver's licenses, passports and green cards mix letters, digits and the odd dash.
        ok = /^[A-Za-z0-9][A-Za-z0-9 -]{2,24}$/.test(value);
        break;
      default:
        ok = value.length > 0 && value.length <= 100;
    }
    if (!ok) errors[key] = "invalid";
  }
  return errors;
}
