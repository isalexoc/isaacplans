/**
 * Document capture links: the data layer for letting a client send their own documents.
 *
 * The agent does not always know what they will need — a driver's licence, a green card, both
 * sides of one card, a page the client forgot — so this link is deliberately open-ended. It asks
 * for "whatever is needed" rather than a named document, and it stays live until it is revoked or
 * the application completes.
 *
 * ─── How this differs from `secure-capture.ts`, and why it is a separate module ───
 *
 * That link is **single use**: the first successful submit closes it, which is exactly right for
 * four numbers typed once. This one accepts many files across many visits. Sharing a table would
 * put an `if (kind === …)` inside the single-use check that protects an SSN link, and that check
 * should stay boring.
 *
 * The files themselves are not stored here. They land in the intake session's existing
 * `attachmentOther` list — the same place a document dropped into the agent's own Documents step
 * goes — so a client's documents are one list, not two that have to be reconciled. This table is
 * only the state machine.
 *
 * Server-only (DB access).
 */

import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { iulDocumentCaptures } from "@/lib/db/schema";

/** No "submitted": unlike the secure-capture link, receiving a file does not close this one. */
export type DocumentCaptureStatus = "pending" | "cancelled";

export type DocumentCaptureRow = typeof iulDocumentCaptures.$inferSelect;

/**
 * What the agent's panel needs. Carries no file contents, no URLs and no session token — this
 * shape crosses the wire to a browser.
 */
export type DocumentCaptureView = {
  token: string;
  status: DocumentCaptureStatus;
  uploadCount: number;
  createdAt: string;
  openedAt: string | null;
  lastUploadAt: string | null;
};

export function toDocumentCaptureView(row: DocumentCaptureRow): DocumentCaptureView {
  return {
    token: row.token,
    status: row.status as DocumentCaptureStatus,
    uploadCount: row.uploadCount ?? 0,
    createdAt: row.createdAt.toISOString(),
    openedAt: row.openedAt?.toISOString() ?? null,
    lastUploadAt: row.lastUploadAt?.toISOString() ?? null,
  };
}

/** Longer than the intake token: this one gets sent to a phone and forwarded around. */
const CAPTURE_TOKEN_LENGTH = 32;

export async function getDocumentCaptureByToken(
  token: string
): Promise<DocumentCaptureRow | null> {
  const [row] = await db
    .select()
    .from(iulDocumentCaptures)
    .where(eq(iulDocumentCaptures.token, token))
    .limit(1);
  return row ?? null;
}

/** The live link for a session, if there is one. */
export async function getPendingDocumentCapture(
  sessionId: string
): Promise<DocumentCaptureRow | null> {
  const [row] = await db
    .select()
    .from(iulDocumentCaptures)
    .where(
      and(eq(iulDocumentCaptures.sessionId, sessionId), eq(iulDocumentCaptures.status, "pending"))
    )
    .orderBy(desc(iulDocumentCaptures.createdAt))
    .limit(1);
  return row ?? null;
}

/** The most recent link of any status, so a revoked one still reports what it collected. */
export async function getLatestDocumentCapture(
  sessionId: string
): Promise<DocumentCaptureRow | null> {
  const [row] = await db
    .select()
    .from(iulDocumentCaptures)
    .where(eq(iulDocumentCaptures.sessionId, sessionId))
    .orderBy(desc(iulDocumentCaptures.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Issue a link, cancelling any previous live one.
 *
 * One live link per session, matching the secure-capture rule: an agent who regenerates after a
 * typo expects the old text message to stop working, and two live upload credentials for the same
 * application is a needless second thing to reason about.
 */
export async function createDocumentCapture(params: {
  sessionId: string;
  ownerUserId: string;
}): Promise<DocumentCaptureRow> {
  await cancelPendingDocumentCaptures(params.sessionId);

  const [row] = await db
    .insert(iulDocumentCaptures)
    .values({
      id: nanoid(),
      token: nanoid(CAPTURE_TOKEN_LENGTH),
      sessionId: params.sessionId,
      ownerUserId: params.ownerUserId,
      status: "pending",
    })
    .returning();
  return row;
}

export async function cancelPendingDocumentCaptures(sessionId: string): Promise<number> {
  const rows = await db
    .update(iulDocumentCaptures)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(iulDocumentCaptures.sessionId, sessionId), eq(iulDocumentCaptures.status, "pending"))
    )
    .returning({ id: iulDocumentCaptures.id });
  return rows.length;
}

/** Stamped on first open so the agent's panel can say "opened" rather than "sent". */
export async function markDocumentCaptureOpened(id: string): Promise<void> {
  await db
    .update(iulDocumentCaptures)
    .set({ openedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(iulDocumentCaptures.id, id), eq(iulDocumentCaptures.status, "pending")));
}

/**
 * Count one received file. Deliberately does NOT close the link.
 *
 * Incremented in SQL rather than read-then-write: a client selecting three photos at once fires
 * three uploads that can land together, and `count = count + 1` in the database is the only
 * version of this that does not lose one.
 */
export async function recordDocumentUpload(id: string): Promise<void> {
  await db
    .update(iulDocumentCaptures)
    .set({
      uploadCount: sql`${iulDocumentCaptures.uploadCount} + 1`,
      lastUploadAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(iulDocumentCaptures.id, id));
}
