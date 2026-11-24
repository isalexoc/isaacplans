import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, min, sql } from "drizzle-orm";

import { decryptString, encryptString } from "@/lib/crypto/field-encryption";
import { db } from "@/lib/db";
import { leadGuardEvents, leadHoldAppends, leadHolds } from "@/lib/db/schema";

import { EVENT_TTL_DAYS, HOLD_TTL_DAYS } from "./config";
import type { LeadGuardSurface } from "./constants";
import { newGuardRecordId } from "./pseudo-id";

/**
 * Lead Guard persistence (Neon). Written only for ALLOWED and HELD leads — real work — never for
 * blocked bot posts. Every reader here is either a lead submission or Isaac opening the admin page;
 * nothing polls.
 */

export type LeadHoldStatus = "held" | "releasing" | "released" | "discarded";

export type LeadHoldPreview = {
  firstName: string | null;
  phoneLast4: string | null;
  emailDomain: string | null;
  language: string | null;
};

/** What Release replays: the exact JSON the route would have received, minus guard fields. */
export type LeadHoldPayload = {
  body: Record<string, unknown>;
  /** Visitor context captured at submit time (IP, user agent) for the replay's CAPI event. */
  ctx: { ip?: string; ua?: string };
};

export type LeadHoldRow = typeof leadHolds.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

export function holdPreview(input: {
  firstName?: unknown;
  phone?: unknown;
  email?: unknown;
  language?: unknown;
}): LeadHoldPreview {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const first = str(input.firstName);
  const digits = (str(input.phone) ?? "").replace(/\D/g, "");
  const email = str(input.email);
  const at = email ? email.lastIndexOf("@") : -1;
  return {
    firstName: first ? first.slice(0, 40) : null,
    phoneLast4: digits.length >= 4 ? digits.slice(-4) : null,
    emailDomain: email && at > 0 ? email.slice(at + 1).toLowerCase().slice(0, 80) : null,
    language: str(input.language)?.slice(0, 5) ?? null,
  };
}

export async function insertLeadHold(input: {
  id: string;
  surface: LeadGuardSurface;
  leadType: string | null;
  route: string;
  reasons: string[];
  payload: LeadHoldPayload;
  preview: LeadHoldPreview;
}): Promise<void> {
  // created_at comes from the DB clock: it is the consent time Release replays.
  await db.insert(leadHolds).values({
    id: input.id,
    surface: input.surface,
    leadType: input.leadType,
    route: input.route,
    reasons: input.reasons,
    status: "held",
    payloadEnc: encryptString(JSON.stringify(input.payload)),
    preview: input.preview,
  });
}

/**
 * At most this many step-2 saves per hold, each at most this big (a stand-in id is not a key to Neon).
 * The IUL funnel saves per answer and per edit; its closing `final: true` snapshot is always kept.
 */
const MAX_APPENDS_PER_HOLD = 40;
const MAX_APPEND_BYTES = 16 * 1024;

export type AppendOutcome =
  | { kind: "filed" }
  | { kind: "released"; contactId: string }
  | { kind: "ignored"; why: "gone" | "discarded" | "full" | "too_big" };

/**
 * File step-2 data with a hold. A hold already released forwards the data to its real contact
 * (the caller continues with that id); a discarded or missing hold ignores it.
 */
export async function appendToLeadHold(holdId: string, route: string, body: Record<string, unknown>): Promise<AppendOutcome> {
  const [hold] = await db
    .select({ status: leadHolds.status, releasedContactId: leadHolds.releasedContactId })
    .from(leadHolds)
    .where(eq(leadHolds.id, holdId))
    .limit(1);
  if (!hold) return { kind: "ignored", why: "gone" };
  if (hold.status === "released" && hold.releasedContactId) return { kind: "released", contactId: hold.releasedContactId };
  if (hold.status !== "held" && hold.status !== "releasing") return { kind: "ignored", why: "discarded" };
  const json = JSON.stringify(body);
  if (json.length > MAX_APPEND_BYTES) return { kind: "ignored", why: "too_big" };
  const [row] = await db
    .select({ n: count() })
    .from(leadHoldAppends)
    .where(eq(leadHoldAppends.holdId, holdId));
  if (Number(row?.n ?? 0) >= MAX_APPENDS_PER_HOLD && body.final !== true) return { kind: "ignored", why: "full" };
  await db.insert(leadHoldAppends).values({ id: newGuardRecordId(), holdId, route, bodyEnc: encryptString(json) });
  return { kind: "filed" };
}

/** Never throws: an audit row must not fail a lead. */
export async function recordLeadGuardEvent(
  surface: LeadGuardSurface,
  verdict: "allow" | "hold" | "block",
  reasons: string[],
  shadow: boolean,
  subject: string | null = null
): Promise<void> {
  try {
    await db.insert(leadGuardEvents).values({ id: newGuardRecordId(), surface, verdict, reasons, shadow, subject });
  } catch (err) {
    console.error("[lead-guard] event insert failed:", err instanceof Error ? err.message : String(err));
  }
}

/** Distinct people (phone subjects) ALLOWED on these surfaces since `since`. Throws on DB errors. */
export async function countAllowedSince(surfaces: LeadGuardSurface[], since: Date): Promise<number> {
  {
    const [row] = await db
      .select({ n: sql<number>`count(distinct coalesce(${leadGuardEvents.subject}, ${leadGuardEvents.id}))` })
      .from(leadGuardEvents)
      .where(
        and(
          inArray(leadGuardEvents.surface, surfaces),
          eq(leadGuardEvents.verdict, "allow"),
          eq(leadGuardEvents.shadow, false),
          gte(leadGuardEvents.createdAt, since)
        )
      );
    return Number(row?.n ?? 0);
  }
}

export async function listLeadHolds(status: LeadHoldStatus | "all", limit = 100): Promise<LeadHoldRow[]> {
  const q = db.select().from(leadHolds);
  const rows = await (status === "all" ? q : q.where(eq(leadHolds.status, status)))
    .orderBy(desc(leadHolds.createdAt))
    .limit(limit);
  return rows;
}

export type LeadHoldDetail = {
  hold: LeadHoldRow;
  payload: LeadHoldPayload | null;
  appends: Array<{ id: string; route: string; body: Record<string, unknown>; createdAt: Date }>;
};

export async function getLeadHoldDetail(id: string): Promise<LeadHoldDetail | null> {
  const [hold] = await db.select().from(leadHolds).where(eq(leadHolds.id, id)).limit(1);
  if (!hold) return null;
  let payload: LeadHoldPayload | null = null;
  if (hold.payloadEnc) {
    try {
      payload = JSON.parse(decryptString(hold.payloadEnc)) as LeadHoldPayload;
    } catch (err) {
      console.error("[lead-guard] hold payload unreadable:", err instanceof Error ? err.message : String(err));
    }
  }
  const rows = await db
    .select()
    .from(leadHoldAppends)
    .where(eq(leadHoldAppends.holdId, id))
    .orderBy(asc(leadHoldAppends.createdAt), asc(leadHoldAppends.id));
  const appends = rows.flatMap((r) => {
    try {
      return [{ id: r.id, route: r.route, body: JSON.parse(decryptString(r.bodyEnc)) as Record<string, unknown>, createdAt: r.createdAt }];
    } catch {
      return [];
    }
  });
  return { hold, payload, appends };
}

/** held → releasing, atomically: a second click (or tab) gets null and does nothing. */
export async function claimLeadHoldForRelease(id: string): Promise<LeadHoldRow | null> {
  const rows = await db
    .update(leadHolds)
    .set({ status: "releasing", releaseError: null, releaseStartedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(leadHolds.id, id), eq(leadHolds.status, "held")))
    .returning();
  return rows[0] ?? null;
}

/**
 * releasing → released, BEFORE the step-2 drain: from here on a funnel's step-2 save is forwarded
 * live to the real contact (appendToLeadHold answers "released"), so nothing can slip between the
 * drain and the end of the release. The payload is erased: the lead now lives in the CRM.
 */
export async function markLeadHoldReleased(id: string, result: { contactId: string | null; by: string }): Promise<void> {
  const now = new Date();
  await db
    .update(leadHolds)
    .set({
      status: "released",
      releasedAt: now,
      releasedBy: result.by,
      releasedContactId: result.contactId,
      releaseError: null,
      payloadEnc: null,
      expiresAt: new Date(now.getTime() + HOLD_TTL_DAYS * DAY_MS),
      updatedAt: now,
    })
    .where(and(eq(leadHolds.id, id), eq(leadHolds.status, "releasing")));
}

/** After the drain: report step-2 replays that failed (shown on /admin/lead-holds). */
export async function recordLeadHoldReleaseWarnings(id: string, warnings: string | null): Promise<void> {
  await db.update(leadHolds).set({ releaseError: warnings, updatedAt: new Date() }).where(eq(leadHolds.id, id));
}

/** Delete exactly the step-2 rows that were replayed (never one that wasn't seen). */
export async function deleteLeadHoldAppends(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(leadHoldAppends).where(inArray(leadHoldAppends.id, ids));
}

/**
 * A hold insert that timed out may still commit after the lead was quarantined in the CRM. That row
 * must not become a second, releasable copy: mark it discarded, payload erased.
 */
export async function supersedeLeadHold(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(leadHolds)
    .set({
      status: "discarded",
      discardedAt: now,
      releaseError: "Superseded: the lead went to the CRM as web_review (the hold was stored too late).",
      payloadEnc: null,
      expiresAt: new Date(now.getTime() + HOLD_TTL_DAYS * DAY_MS),
      updatedAt: now,
    })
    .where(and(eq(leadHolds.id, id), eq(leadHolds.status, "held")));
  await db.delete(leadHoldAppends).where(eq(leadHoldAppends.holdId, id));
}

/** Step-2 rows filed after the release read them (the replay loop picks these up). */
export async function listAppendsAfter(holdId: string, seenIds: string[]) {
  const rows = await db
    .select()
    .from(leadHoldAppends)
    .where(eq(leadHoldAppends.holdId, holdId))
    .orderBy(asc(leadHoldAppends.createdAt), asc(leadHoldAppends.id));
  return rows
    .filter((r) => !seenIds.includes(r.id))
    .flatMap((r) => {
      try {
        return [{ id: r.id, route: r.route, body: JSON.parse(decryptString(r.bodyEnc)) as Record<string, unknown> }];
      } catch {
        return [];
      }
    });
}

/** The create step failed: back to held with the error, so Isaac can retry or discard. */
export async function failLeadHoldRelease(id: string, error: string): Promise<void> {
  await db
    .update(leadHolds)
    .set({ status: "held", releaseError: error.slice(0, 500), updatedAt: new Date() })
    .where(and(eq(leadHolds.id, id), eq(leadHolds.status, "releasing")));
}

export async function discardLeadHold(id: string, by: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(leadHolds)
    .set({ status: "discarded", discardedAt: now, releasedBy: by, payloadEnc: null, expiresAt: new Date(now.getTime() + HOLD_TTL_DAYS * DAY_MS), updatedAt: now })
    .where(and(eq(leadHolds.id, id), eq(leadHolds.status, "held")))
    .returning({ id: leadHolds.id });
  if (rows.length === 0) return false;
  await db.delete(leadHoldAppends).where(eq(leadHoldAppends.holdId, id));
  return true;
}

/** Hold alerts sent in the last `windowMs` (flood cap: past it, only the daily digest reports). */
export async function holdAlertsSentSince(windowMs: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leadHolds)
    .where(gte(leadHolds.notifiedAt, new Date(Date.now() - windowMs)));
  return Number(row?.n ?? 0);
}

export async function markHoldNotified(id: string): Promise<void> {
  await db.update(leadHolds).set({ notifiedAt: new Date() }).where(eq(leadHolds.id, id));
}

export type LeadGuardStats = Array<{ surface: string; verdict: string; n: number }>;

export async function leadGuardStatsSince(since: Date): Promise<LeadGuardStats> {
  const rows = await db
    .select({ surface: leadGuardEvents.surface, verdict: leadGuardEvents.verdict, n: count() })
    .from(leadGuardEvents)
    .where(gte(leadGuardEvents.createdAt, since))
    .groupBy(leadGuardEvents.surface, leadGuardEvents.verdict);
  return rows.map((r) => ({ surface: r.surface, verdict: r.verdict, n: Number(r.n) }));
}

/**
 * Daily reconcile: return releases stuck in "releasing" (a crash mid-release) to "held", delete
 * REVIEWED holds 30 days after review (appends go with them by cascade), and old events. A held
 * row is never deleted unreviewed: the digest keeps reminding Isaac instead.
 */
export async function purgeLeadGuardData(now: Date = new Date()): Promise<{ holds: number; events: number; unstuck: number }> {
  const unstuck = await db
    .update(leadHolds)
    .set({ status: "held", releaseError: "The release was interrupted; try again.", updatedAt: now })
    .where(and(eq(leadHolds.status, "releasing"), lt(leadHolds.releaseStartedAt, new Date(now.getTime() - 15 * 60_000))))
    .returning({ id: leadHolds.id });
  const expired = await db
    .delete(leadHolds)
    .where(and(isNotNull(leadHolds.expiresAt), lt(leadHolds.expiresAt, now)))
    .returning({ id: leadHolds.id });
  const events = await db
    .delete(leadGuardEvents)
    .where(lt(leadGuardEvents.createdAt, new Date(now.getTime() - EVENT_TTL_DAYS * DAY_MS)))
    .returning({ id: leadGuardEvents.id });
  return { holds: expired.length, events: events.length, unstuck: unstuck.length };
}

/** For the daily digest: how many leads wait for review, and since when. */
export async function heldLeadsSummary(): Promise<{ held: number; oldest: Date | null }> {
  const [row] = await db
    .select({ n: count(), oldest: min(leadHolds.createdAt) })
    .from(leadHolds)
    .where(eq(leadHolds.status, "held"));
  return { held: Number(row?.n ?? 0), oldest: row?.oldest ? new Date(row.oldest) : null };
}
