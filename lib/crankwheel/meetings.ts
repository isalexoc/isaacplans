/**
 * Data layer for CrankWheel meeting links.
 *
 * Mirrors `lib/iul-intake/secure-capture.ts`: the table holds the state machine — who minted the
 * link, whether it is still live, and whether the client turned up — and nothing CrankWheel is
 * already the system of record for.
 *
 * Server-only (DB access).
 */

import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, ne, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { crankwheelMeetings } from "@/lib/db/schema";
import type { CrankwheelMeetingKind } from "./types";

export type MeetingStatus = "active" | "superseded" | "revoked" | "ended";

export type MeetingRow = typeof crankwheelMeetings.$inferSelect;

/**
 * What the agent's panel renders. Carries no hook secret — this shape crosses the wire to a
 * browser, and the secret is the credential CrankWheel's callbacks authenticate with.
 */
export type MeetingView = {
  id: string;
  kind: CrankwheelMeetingKind;
  status: MeetingStatus;
  url: string;
  locale: string;
  contactName: string | null;
  createdAt: string;
  expiresAt: string | null;
  sessionStartedAt: string | null;
  viewerJoinedAt: string | null;
  sentAt: string | null;
  durationSeconds: number | null;
};

export function toMeetingView(row: MeetingRow): MeetingView {
  return {
    id: row.id,
    kind: row.kind as CrankwheelMeetingKind,
    status: row.status as MeetingStatus,
    url: row.url,
    locale: row.locale ?? "en",
    contactName: row.contactName,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
    viewerJoinedAt: row.viewerJoinedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    durationSeconds: row.durationSeconds,
  };
}

/** Long, because it is the only thing guarding an unauthenticated callback. */
const HOOK_SECRET_LENGTH = 32;

export function newHookSecret(): string {
  return nanoid(HOOK_SECRET_LENGTH);
}

export async function createMeeting(input: {
  id?: string;
  kind: CrankwheelMeetingKind;
  sessionId?: string | null;
  crmContactId?: string | null;
  ownerUserId: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string;
  url: string;
  uid?: string | null;
  hookSecret: string;
  expiresAt?: Date | null;
}): Promise<MeetingRow> {
  const [row] = await db
    .insert(crankwheelMeetings)
    .values({
      id: input.id ?? nanoid(),
      kind: input.kind,
      sessionId: input.sessionId ?? null,
      crmContactId: input.crmContactId ?? null,
      ownerUserId: input.ownerUserId,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      locale: input.locale === "es" ? "es" : "en",
      url: input.url,
      uid: input.uid ?? null,
      hookSecret: input.hookSecret,
      status: "active",
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return row;
}

export async function getMeetingById(id: string): Promise<MeetingRow | null> {
  const [row] = await db
    .select()
    .from(crankwheelMeetings)
    .where(eq(crankwheelMeetings.id, id))
    .limit(1);
  return row ?? null;
}

export async function getMeetingByHookSecret(secret: string): Promise<MeetingRow | null> {
  const [row] = await db
    .select()
    .from(crankwheelMeetings)
    .where(eq(crankwheelMeetings.hookSecret, secret))
    .limit(1);
  return row ?? null;
}

/** The live link for an intake session, if there is one. */
export async function getActiveMeetingForSession(sessionId: string): Promise<MeetingRow | null> {
  const [row] = await db
    .select()
    .from(crankwheelMeetings)
    .where(and(eq(crankwheelMeetings.sessionId, sessionId), eq(crankwheelMeetings.status, "active")))
    .orderBy(desc(crankwheelMeetings.createdAt))
    .limit(1);
  return row ?? null;
}

/** The live link for a CRM contact — the launcher's lookup, which has no intake session. */
export async function getActiveMeetingForContact(crmContactId: string): Promise<MeetingRow | null> {
  const [row] = await db
    .select()
    .from(crankwheelMeetings)
    .where(
      and(eq(crankwheelMeetings.crmContactId, crmContactId), eq(crankwheelMeetings.status, "active"))
    )
    .orderBy(desc(crankwheelMeetings.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listRecentMeetings(ownerUserId: string, limit = 20): Promise<MeetingRow[]> {
  return db
    .select()
    .from(crankwheelMeetings)
    .where(eq(crankwheelMeetings.ownerUserId, ownerUserId))
    .orderBy(desc(crankwheelMeetings.createdAt))
    .limit(limit);
}

/**
 * Retire every other live "meet now" link.
 *
 * This is bookkeeping that mirrors what CrankWheel has already done: `truncate_older_links` ends
 * the validity of older noauth links account-wide the moment a new one is minted. Without this the
 * panel for an earlier client would keep advertising a link that silently stopped working.
 *
 * Scheduled links are untouched — they are not noauth and stay valid until revoked.
 */
export async function supersedeActiveNowLinks(exceptId: string): Promise<number> {
  const rows = await db
    .update(crankwheelMeetings)
    .set({ status: "superseded", updatedAt: new Date() })
    .where(
      and(
        eq(crankwheelMeetings.kind, "now"),
        eq(crankwheelMeetings.status, "active"),
        ne(crankwheelMeetings.id, exceptId)
      )
    )
    .returning({ id: crankwheelMeetings.id });
  return rows.length;
}

export async function markMeetingRevoked(id: string): Promise<void> {
  await db
    .update(crankwheelMeetings)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(crankwheelMeetings.id, id));
}

export async function markMeetingSent(id: string): Promise<void> {
  await db
    .update(crankwheelMeetings)
    .set({ sentAt: new Date(), updatedAt: new Date() })
    .where(eq(crankwheelMeetings.id, id));
}

/** Stamped by `create_hook`: the agent started sharing. First write wins. */
export async function markSessionStarted(id: string): Promise<void> {
  await db
    .update(crankwheelMeetings)
    .set({ sessionStartedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(crankwheelMeetings.id, id), isNull(crankwheelMeetings.sessionStartedAt)));
}

/** Stamped by `viewer_hook`: the client turned up. First write wins. */
export async function markViewerJoined(id: string): Promise<void> {
  await db
    .update(crankwheelMeetings)
    .set({ viewerJoinedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(crankwheelMeetings.id, id), isNull(crankwheelMeetings.viewerJoinedAt)));
}

/**
 * Attach the CrankWheel session that turned out to be this meeting, and close it out.
 *
 * `cwSessionId` is uniquely indexed, so a second meeting trying to claim the same session raises
 * rather than quietly posting a duplicate note about one call to two different contacts. Callers
 * treat a throw here as "another meeting already claimed it" and skip.
 */
export async function markNotePosted(
  id: string,
  data: { cwSessionId: number | null; durationSeconds: number | null }
): Promise<void> {
  await db
    .update(crankwheelMeetings)
    .set({
      cwSessionId: data.cwSessionId,
      durationSeconds: data.durationSeconds,
      notePostedAt: new Date(),
      status: "ended",
      updatedAt: new Date(),
    })
    .where(eq(crankwheelMeetings.id, id));
}

/**
 * Meetings still owed a CRM note — the daily reconcile's work list.
 *
 * Bounded to the recent past because `usage_new` is queried over the same window: a meeting old
 * enough to have fallen out of it can no longer be matched, and retrying forever would be a query
 * that never succeeds.
 *
 * A link nobody ever used is not a meeting, so "now" links qualify only once `create_hook` has
 * stamped `sessionStartedAt`. Scheduled links have no hook to stamp it and qualify on having been
 * sent instead.
 */
export async function listMeetingsAwaitingNote(since: Date): Promise<MeetingRow[]> {
  return db
    .select()
    .from(crankwheelMeetings)
    .where(
      and(
        gte(crankwheelMeetings.createdAt, since),
        isNull(crankwheelMeetings.notePostedAt),
        or(
          isNotNull(crankwheelMeetings.sessionStartedAt),
          and(eq(crankwheelMeetings.kind, "scheduled"), isNotNull(crankwheelMeetings.sentAt))
        )
      )
    )
    .orderBy(desc(crankwheelMeetings.createdAt))
    .limit(100);
}
