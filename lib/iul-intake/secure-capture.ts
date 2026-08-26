/**
 * Secure capture links: the data layer for letting a client type their own SSN and bank details.
 *
 * Some clients read those numbers out loud without hesitating; some will not, and that used to be
 * where the call ended. The agent generates a link here, sends it through the CRM, and the client
 * fills the four sensitive fields on their own phone while the agent's screen shows only the last
 * four digits of each.
 *
 * The values themselves never live in this module's table — they go straight into the intake
 * session, encrypted, so there is exactly one system of record for an SSN. This table only holds
 * the state machine: who issued the link, what it is allowed to write, and whether it has been
 * used yet.
 *
 * Server-only (DB access).
 */

import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { iulIntakeSessions, iulSecureCaptures } from "@/lib/db/schema";
import { captureScopeKeys, scopeFromFieldKeys, type CaptureScope } from "./fields";

export type SecureCaptureStatus = "pending" | "submitted" | "cancelled";

export type SecureCaptureRow = typeof iulSecureCaptures.$inferSelect;

/**
 * What the agent's panel needs to render. Deliberately carries no values and no session token —
 * this shape crosses the wire to a browser.
 */
export type SecureCaptureView = {
  token: string;
  status: SecureCaptureStatus;
  createdAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  /**
   * What this link asks for, derived from the frozen snapshot rather than stored twice.
   *
   * Display only. The agent's panel needs it to say what a link already in someone's text messages
   * is waiting on; the write endpoint always reads `fieldKeys` itself, so a wrong value here could
   * never widen what the link can do.
   */
  scope: CaptureScope;
};

export function toSecureCaptureView(row: SecureCaptureRow): SecureCaptureView {
  return {
    token: row.token,
    status: row.status as SecureCaptureStatus,
    createdAt: row.createdAt.toISOString(),
    openedAt: row.openedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    scope: scopeFromFieldKeys(row.fieldKeys ?? []),
  };
}

/**
 * How long after a client submits the server keeps forcing their values back over the agent's.
 *
 * Covers the gap between the client pressing Save and the agent's next poll landing (3s poll +
 * 1s autosave debounce + network). Inside this window a half-typed agent value loses; outside it,
 * the agent is deliberately correcting and wins. See the PATCH handler in
 * `app/api/iul-intake/[token]/route.ts`.
 */
export const CAPTURE_GRACE_MS = 15_000;

/** Longer than the 24-char intake token: this one gets sent to a phone and forwarded around. */
const CAPTURE_TOKEN_LENGTH = 32;

export async function getCaptureByToken(token: string): Promise<SecureCaptureRow | null> {
  const [row] = await db
    .select()
    .from(iulSecureCaptures)
    .where(eq(iulSecureCaptures.token, token))
    .limit(1);
  return row ?? null;
}

/** The live link for a session, if there is one. */
export async function getPendingCapture(sessionId: string): Promise<SecureCaptureRow | null> {
  const [row] = await db
    .select()
    .from(iulSecureCaptures)
    .where(and(eq(iulSecureCaptures.sessionId, sessionId), eq(iulSecureCaptures.status, "pending")))
    .orderBy(desc(iulSecureCaptures.createdAt))
    .limit(1);
  return row ?? null;
}

/** The most recent capture of any status — so a submitted one still shows as "received". */
export async function getLatestCapture(sessionId: string): Promise<SecureCaptureRow | null> {
  const [row] = await db
    .select()
    .from(iulSecureCaptures)
    .where(eq(iulSecureCaptures.sessionId, sessionId))
    .orderBy(desc(iulSecureCaptures.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Issue a link, cancelling any previous pending one.
 *
 * One live link per session on purpose: an agent who regenerates after a typo expects the old
 * text message to stop working, and two live write credentials for the same four fields is a
 * needless second thing to reason about.
 */
export async function createCapture(params: {
  sessionId: string;
  ownerUserId: string;
  /** Which of the sensitive values to ask for. Defaults to all of them. */
  scope?: CaptureScope;
}): Promise<SecureCaptureRow> {
  await cancelPendingCaptures(params.sessionId);

  const [row] = await db
    .insert(iulSecureCaptures)
    .values({
      id: nanoid(),
      token: nanoid(CAPTURE_TOKEN_LENGTH),
      sessionId: params.sessionId,
      ownerUserId: params.ownerUserId,
      status: "pending",
      // Snapshot, not a live read of the constant — see the schema comment. Narrowing it to the
      // chosen scope is also what makes a scoped link safe rather than merely tidy: a link that
      // only asks for an SSN also physically cannot write a bank account number.
      fieldKeys: [...captureScopeKeys(params.scope ?? "both")],
    })
    .returning();
  return row;
}

export async function cancelPendingCaptures(sessionId: string): Promise<number> {
  const rows = await db
    .update(iulSecureCaptures)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(iulSecureCaptures.sessionId, sessionId), eq(iulSecureCaptures.status, "pending")))
    .returning({ id: iulSecureCaptures.id });
  return rows.length;
}

/** Stamped on first open so the agent's panel can say "opened, not sent yet". */
export async function markCaptureOpened(id: string): Promise<void> {
  await db
    .update(iulSecureCaptures)
    .set({ openedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(iulSecureCaptures.id, id), eq(iulSecureCaptures.status, "pending")));
}

/** Single use: the first successful submit closes the link. */
export async function markCaptureSubmitted(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(iulSecureCaptures)
    .set({ status: "submitted", submittedAt: now, updatedAt: now })
    .where(eq(iulSecureCaptures.id, id));
}

/** Records when the client's values landed, for the grace window. */
export async function markSensitiveCaptured(sessionId: string): Promise<void> {
  await db
    .update(iulIntakeSessions)
    .set({ sensitiveCapturedAt: new Date(), updatedAt: new Date() })
    .where(eq(iulIntakeSessions.id, sessionId));
}

/** Sessions are looked up by id here because a capture outlives a token rotation. */
export async function getIntakeById(id: string) {
  const [row] = await db
    .select()
    .from(iulIntakeSessions)
    .where(eq(iulIntakeSessions.id, id))
    .limit(1);
  return row ?? null;
}
