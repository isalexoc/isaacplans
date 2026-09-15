/**
 * Idempotency + job store for Telegram IUL leads.
 *
 * Mirrors `lib/leads-the-way/store.ts` with one correctness fix: the claim is a single conditional
 * UPDATE rather than a read-then-write. The email pipeline's `claimLeadByMessageId` checks
 * `isClaimable` in JS and then issues an UPDATE with no status predicate, so two concurrent
 * deliveries of the same key can both claim it. Telegram delivers in bursts and retries on any
 * non-2xx, so that race is materially likelier here.
 */

import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { telegramLeads, type TelegramLeadJobState } from "@/lib/db/schema";
import { createTelegramLogger, type TelegramLogger } from "@/lib/telegram/log";

export type TelegramLeadStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_review"
  | "ignored"
  | "dismissed";

export type TelegramLeadRow = typeof telegramLeads.$inferSelect;

export const MAX_TELEGRAM_ATTEMPTS = 5;
/** A `processing` row older than this is presumed crashed and may be reclaimed. */
const STALE_PROCESSING_MS = 30 * 60 * 1000;

/** 2m, 10m, 30m, 1h, 2h — same ladder as the email pipeline. */
export function telegramRetryBackoffMs(attemptCount: number): number {
  const schedule = [2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000, 2 * 60 * 60_000];
  return schedule[Math.min(attemptCount, schedule.length - 1)] ?? schedule[0]!;
}

export async function getTelegramLead(
  leadKey: string,
  log: TelegramLogger = createTelegramLogger()
): Promise<TelegramLeadRow | null> {
  const rows = await db
    .select()
    .from(telegramLeads)
    .where(eq(telegramLeads.leadKey, leadKey))
    .limit(1);
  const row = rows[0] ?? null;
  log.debug("DB lookup lead", { leadKey, found: Boolean(row), status: row?.status });
  return row;
}

export type MarkTelegramLeadParams = {
  leadKey: string;
  status: TelegramLeadStatus;
  chatId?: string | null;
  messageId?: string | null;
  updateId?: string | null;
  messageAt?: Date | null;
  needsReview?: boolean;
  reviewReason?: string | null;
  contactId?: string | null;
  locationId?: string | null;
  matchedBy?: string | null;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  stateCode?: string | null;
  parseSource?: string | null;
  tagsAdded?: string[] | null;
  cadenceStarted?: boolean;
  errorMessage?: string | null;
  jobState?: TelegramLeadJobState | null;
  attemptCount?: number;
  nextRetryAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedByUserId?: string | null;
};

/** Atomic upsert on the primary key — safe to call from any path. */
export async function markTelegramLead(
  params: MarkTelegramLeadParams,
  log: TelegramLogger = createTelegramLogger()
): Promise<void> {
  const {
    leadKey,
    status,
    attemptCount = 0,
    needsReview = false,
    cadenceStarted = false,
    ...rest
  } = params;

  log.debug("DB mark lead", { leadKey, status, contactId: rest.contactId, attemptCount });

  const setOnConflict: Record<string, unknown> = {
    status,
    needsReview,
    cadenceStarted,
    processedAt: new Date(),
  };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) setOnConflict[key] = value;
  }
  if (params.attemptCount !== undefined) setOnConflict.attemptCount = params.attemptCount;

  await db
    .insert(telegramLeads)
    .values({
      leadKey,
      status,
      needsReview,
      cadenceStarted,
      attemptCount,
      ...rest,
    })
    .onConflictDoUpdate({ target: telegramLeads.leadKey, set: setOnConflict });
}

export type EnqueueTelegramLeadParams = {
  leadKey: string;
  chatId?: string | null;
  messageId?: string | null;
  updateId?: string | null;
  phone?: string | null;
  email?: string | null;
  messageAt?: Date | null;
  status?: TelegramLeadStatus;
  needsReview?: boolean;
  reviewReason?: string | null;
  jobState: TelegramLeadJobState;
};

/**
 * Insert the inbound message. Terminal rows are never re-queued, so Telegram's redeliveries and a
 * provider re-send of the same message are both free.
 */
export async function enqueueTelegramLead(
  params: EnqueueTelegramLeadParams,
  log: TelegramLogger = createTelegramLogger()
): Promise<{ queued: boolean; reason?: string }> {
  const existing = await getTelegramLead(params.leadKey, log);

  if (existing) {
    if (existing.status === "completed") return { queued: false, reason: "already_processed" };
    if (existing.status === "dismissed") return { queued: false, reason: "already_dismissed" };
    if (existing.status === "processing") return { queued: false, reason: "already_queued" };
    if (existing.status === "pending") return { queued: false, reason: "already_queued" };
  }

  await markTelegramLead(
    {
      leadKey: params.leadKey,
      status: params.status ?? "pending",
      needsReview: params.needsReview ?? false,
      reviewReason: params.reviewReason ?? null,
      chatId: params.chatId ?? null,
      messageId: params.messageId ?? null,
      updateId: params.updateId ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      messageAt: params.messageAt ?? null,
      jobState: params.jobState,
      attemptCount: existing?.attemptCount ?? 0,
    },
    log
  );

  return { queued: (params.status ?? "pending") === "pending" };
}

/**
 * Claim a lead for processing. Single conditional UPDATE: only a row that is genuinely claimable
 * transitions to `processing`, so concurrent deliveries cannot both win.
 */
export async function claimTelegramLead(
  leadKey: string,
  log: TelegramLogger = createTelegramLogger()
): Promise<TelegramLeadRow | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  const claimed = await db
    .update(telegramLeads)
    .set({ status: "processing", processedAt: now })
    .where(
      and(
        eq(telegramLeads.leadKey, leadKey),
        or(
          eq(telegramLeads.status, "pending"),
          and(eq(telegramLeads.status, "processing"), lte(telegramLeads.processedAt, staleBefore)),
          and(
            eq(telegramLeads.status, "failed"),
            sql`${telegramLeads.attemptCount} < ${MAX_TELEGRAM_ATTEMPTS}`,
            or(isNull(telegramLeads.nextRetryAt), lte(telegramLeads.nextRetryAt, now))
          )
        )
      )
    )
    .returning();

  const row = claimed[0] ?? null;
  if (!row) {
    log.info("Lead not claimable", { leadKey });
    return null;
  }
  log.info("Claimed lead", { leadKey, attemptCount: row.attemptCount });
  return row;
}

/** Rows the daily reconcile should drain. */
export async function findClaimableTelegramLeads(
  limit = 25,
  log: TelegramLogger = createTelegramLogger()
): Promise<TelegramLeadRow[]> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  const rows = await db
    .select()
    .from(telegramLeads)
    .where(
      or(
        eq(telegramLeads.status, "pending"),
        and(eq(telegramLeads.status, "processing"), lte(telegramLeads.processedAt, staleBefore)),
        and(
          eq(telegramLeads.status, "failed"),
          sql`${telegramLeads.attemptCount} < ${MAX_TELEGRAM_ATTEMPTS}`,
          or(isNull(telegramLeads.nextRetryAt), lte(telegramLeads.nextRetryAt, now))
        )
      )
    )
    .orderBy(telegramLeads.createdAt)
    .limit(limit);

  log.debug("Claimable leads", { count: rows.length });
  return rows;
}

/** Admin listing. `needsAttention` is the default view: anything a human should look at. */
export async function listTelegramLeads(options?: {
  needsAttention?: boolean;
  status?: TelegramLeadStatus[];
  limit?: number;
}): Promise<TelegramLeadRow[]> {
  const limit = Math.min(options?.limit ?? 100, 500);

  if (options?.needsAttention) {
    return db
      .select()
      .from(telegramLeads)
      .where(
        or(
          eq(telegramLeads.needsReview, true),
          inArray(telegramLeads.status, ["needs_review", "failed"])
        )
      )
      .orderBy(desc(telegramLeads.createdAt))
      .limit(limit);
  }

  if (options?.status?.length) {
    return db
      .select()
      .from(telegramLeads)
      .where(inArray(telegramLeads.status, options.status))
      .orderBy(desc(telegramLeads.createdAt))
      .limit(limit);
  }

  return db.select().from(telegramLeads).orderBy(desc(telegramLeads.createdAt)).limit(limit);
}
