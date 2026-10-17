/**
 * Run rows for Phone Finder. Every guard is ONE SQL statement: the Neon HTTP driver has no
 * transactions, and two webhook deliveries (or a delivery racing the daily reconcile) must never
 * both pay for the same search.
 */

import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { phoneFinderDailyUsage, phoneFinderRuns } from "@/lib/db/schema";

import type { PhoneFinderRunSummary } from "./pipeline";

export type PhoneFinderRunRow = typeof phoneFinderRuns.$inferSelect;

const t = phoneFinderRuns;
const u = phoneFinderDailyUsage;

/** A `running` row untouched for longer than the queue route's maxDuration (300 s) has died. */
const STALE_RUNNING_MS = 6 * 60_000;
/** A re-tick may replace an in-flight run that has been stuck this long. */
const STALE_ARM_MS = 15 * 60_000;
/** The daily reconcile picks up runs nobody has touched for this long. */
const RECONCILE_AFTER_MS = 10 * 60_000;

/**
 * Start a run for the contact unless one is already in flight. Re-arming wipes the previous run's
 * state but keeps `last_input_hash` / `last_searched_at` for the cooldown.
 */
export async function armPhoneFinderRun(contactId: string, now = new Date()): Promise<{ armed: boolean; runId: string | null }> {
  const runId = `pf_${nanoid(16)}`;
  const staleBefore = new Date(now.getTime() - STALE_ARM_MS);
  const rows = await db
    .insert(t)
    .values({ contactId, runId, status: "pending", requestedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: t.contactId,
      set: {
        runId,
        status: "pending",
        outcome: null,
        attemptCount: 0,
        resultText: null,
        resultTags: null,
        summary: null,
        costMills: 0,
        dailySlotDay: null,
        errorMessage: null,
        requestedAt: now,
        startedAt: null,
        finishedAt: null,
        updatedAt: now,
      },
      where: or(inArray(t.status, ["completed", "failed", "skipped"]), lte(t.updatedAt, staleBefore)),
    })
    .returning({ runId: t.runId });
  const got = rows[0]?.runId ?? null;
  return { armed: got === runId, runId: got };
}

/** Claim a run for this attempt. Null = already running elsewhere, finished, or replaced. */
export async function claimPhoneFinderRun(contactId: string, runId: string, now = new Date()): Promise<PhoneFinderRunRow | null> {
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_MS);
  const rows = await db
    .update(t)
    .set({ status: "running", attemptCount: sql`${t.attemptCount} + 1`, startedAt: now, updatedAt: now })
    .where(
      and(
        eq(t.contactId, contactId),
        eq(t.runId, runId),
        or(eq(t.status, "pending"), and(eq(t.status, "running"), lte(t.updatedAt, staleBefore)))
      )
    )
    .returning();
  return rows[0] ?? null;
}

/** Matches only the worker holding this attempt's claim. */
function fenced(contactId: string, runId: string, attempt: number) {
  return and(eq(t.contactId, contactId), eq(t.runId, runId), eq(t.attemptCount, attempt), eq(t.status, "running"));
}

export async function markPhoneFinderDailySlot(contactId: string, runId: string, attempt: number, day: string): Promise<boolean> {
  const rows = await db
    .update(t)
    .set({ dailySlotDay: day, updatedAt: new Date() })
    .where(fenced(contactId, runId, attempt))
    .returning({ runId: t.runId });
  return rows.length > 0;
}

/** Persist the field text BEFORE writing it to the CRM, so a failed write retries for free. */
export async function savePhoneFinderResult(
  contactId: string,
  runId: string,
  attempt: number,
  data: {
    resultText: string;
    resultTags: string[];
    outcome: string;
    summary: PhoneFinderRunSummary;
    costMills: number;
    lastInputHash?: string | null;
    lastSearchedAt?: Date;
  }
): Promise<boolean> {
  const rows = await db
    .update(t)
    .set({ ...data, updatedAt: new Date() })
    .where(fenced(contactId, runId, attempt))
    .returning({ runId: t.runId });
  return rows.length > 0;
}

/** Put the run back to `pending` for QStash / the reconcile to try again. */
export async function releasePhoneFinderRun(
  contactId: string,
  runId: string,
  attempt: number,
  data: { errorMessage: string; costMills: number }
): Promise<boolean> {
  const rows = await db
    .update(t)
    .set({ status: "pending", errorMessage: data.errorMessage.slice(0, 300), costMills: data.costMills, updatedAt: new Date() })
    .where(fenced(contactId, runId, attempt))
    .returning({ runId: t.runId });
  return rows.length > 0;
}

/** Terminal state. Drops `result_text` (phone numbers) — only the PII-free summary is kept. */
export async function finishPhoneFinderRun(
  contactId: string,
  runId: string,
  attempt: number,
  data: {
    status: "completed" | "failed" | "skipped";
    outcome: string;
    costMills: number;
    summary?: PhoneFinderRunSummary;
    errorMessage?: string | null;
  }
): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(t)
    .set({
      status: data.status,
      outcome: data.outcome,
      costMills: data.costMills,
      ...(data.summary ? { summary: data.summary } : {}),
      errorMessage: data.errorMessage?.slice(0, 300) ?? null,
      resultText: null,
      resultTags: null,
      finishedAt: now,
      updatedAt: now,
    })
    .where(fenced(contactId, runId, attempt))
    .returning({ runId: t.runId });
  return rows.length > 0;
}

/** Take one of today's search slots. False once the day's limit is reached. */
export async function reservePhoneFinderDailySlot(day: string, limit: number): Promise<boolean> {
  if (limit <= 0) return false;
  const now = new Date();
  const rows = await db
    .insert(u)
    .values({ day, runs: 1, costMills: 0, updatedAt: now })
    .onConflictDoUpdate({
      target: u.day,
      set: { runs: sql`${u.runs} + 1`, updatedAt: now },
      where: sql`${u.runs} < ${limit}`,
    })
    .returning({ runs: u.runs });
  return rows.length > 0;
}

export async function addPhoneFinderDailyCost(day: string, mills: number): Promise<void> {
  if (mills <= 0) return;
  await db
    .update(u)
    .set({ costMills: sql`${u.costMills} + ${mills}`, updatedAt: new Date() })
    .where(eq(u.day, day));
}

/** Runs QStash never finished: pending or dead `running` rows untouched for 10+ minutes. */
export async function findReconcilablePhoneFinderRuns(limit = 20, now = new Date()): Promise<PhoneFinderRunRow[]> {
  const before = new Date(now.getTime() - RECONCILE_AFTER_MS);
  return db
    .select()
    .from(t)
    .where(and(inArray(t.status, ["pending", "running"]), lte(t.updatedAt, before)))
    .orderBy(t.updatedAt)
    .limit(limit);
}
