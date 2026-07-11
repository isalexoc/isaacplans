/**
 * Idempotency + async job store for Leads the Way lead emails.
 * Mirrors `lib/agent-crm-call-summary-store.ts`: the webhook inserts a `pending` row, the QStash
 * consumer claims by `leadKey`, and a `completed` row is never re-claimed so duplicate deliveries
 * (or re-sent emails) are safe.
 */

import { and, eq, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadsTheWayProcessed, type LeadsTheWayJobState } from "@/lib/db/schema";
import { createLeadsTheWayLogger, type LeadsTheWayLogger } from "@/lib/leads-the-way/log";

export type LeadStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

export type LeadRow = typeof leadsTheWayProcessed.$inferSelect;

const MAX_LEAD_ATTEMPTS = 5;
/** A `processing` row older than this is considered stale and reclaimable (crash recovery). */
const STALE_PROCESSING_MS = 30 * 60 * 1000;

export async function getProcessedLead(
  leadKey: string,
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<LeadRow | null> {
  const rows = await db
    .select()
    .from(leadsTheWayProcessed)
    .where(eq(leadsTheWayProcessed.leadKey, leadKey))
    .limit(1);
  const row = rows[0] ?? null;
  log.debug("DB lookup lead", { leadKey, found: Boolean(row), status: row?.status });
  return row;
}

export async function markLeadProcessed(
  params: {
    leadKey: string;
    status: LeadStatus;
    contactId?: string | null;
    locationId?: string | null;
    phone?: string | null;
    email?: string | null;
    leadId?: string | null;
    errorMessage?: string | null;
    jobState?: LeadsTheWayJobState | null;
    attemptCount?: number;
    nextRetryAt?: Date | null;
  },
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<void> {
  log.debug("DB mark lead", {
    leadKey: params.leadKey,
    status: params.status,
    contactId: params.contactId,
    attemptCount: params.attemptCount,
  });
  await db
    .insert(leadsTheWayProcessed)
    .values({
      leadKey: params.leadKey,
      status: params.status,
      contactId: params.contactId ?? null,
      locationId: params.locationId ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      leadId: params.leadId ?? null,
      errorMessage: params.errorMessage ?? null,
      jobState: params.jobState ?? null,
      attemptCount: params.attemptCount ?? 0,
      nextRetryAt: params.nextRetryAt ?? null,
    })
    .onConflictDoUpdate({
      target: leadsTheWayProcessed.leadKey,
      set: {
        status: params.status,
        ...(params.contactId !== undefined ? { contactId: params.contactId } : {}),
        ...(params.locationId !== undefined ? { locationId: params.locationId } : {}),
        ...(params.phone !== undefined ? { phone: params.phone } : {}),
        ...(params.email !== undefined ? { email: params.email } : {}),
        ...(params.leadId !== undefined ? { leadId: params.leadId } : {}),
        errorMessage: params.errorMessage ?? null,
        ...(params.jobState !== undefined ? { jobState: params.jobState } : {}),
        ...(params.attemptCount !== undefined ? { attemptCount: params.attemptCount } : {}),
        ...(params.nextRetryAt !== undefined ? { nextRetryAt: params.nextRetryAt } : {}),
        processedAt: new Date(),
      },
    });
}

/** Queue a lead email for async processing (webhook returns immediately). */
export async function enqueueLead(
  params: {
    leadKey: string;
    phone?: string | null;
    email?: string | null;
    leadId?: string | null;
    jobState: LeadsTheWayJobState;
  },
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<{ queued: boolean; reason?: string }> {
  const existing = await getProcessedLead(params.leadKey, log);
  if (existing?.status === "completed") return { queued: false, reason: "already_processed" };
  if (existing?.status === "skipped") return { queued: false, reason: "already_skipped" };
  if (existing?.status === "pending" || existing?.status === "processing") {
    return { queued: false, reason: "already_queued" };
  }

  await markLeadProcessed(
    {
      leadKey: params.leadKey,
      status: "pending",
      phone: params.phone ?? null,
      email: params.email ?? null,
      leadId: params.leadId ?? null,
      jobState: { step: "parse", ...params.jobState },
      attemptCount: existing?.attemptCount ?? 0,
      errorMessage: null,
    },
    log
  );
  return { queued: true };
}

function isClaimable(row: LeadRow, now: Date): boolean {
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  return (
    row.status === "pending" ||
    (row.status === "processing" && row.processedAt != null && row.processedAt <= staleBefore) ||
    (row.status === "failed" &&
      (row.attemptCount ?? 0) < MAX_LEAD_ATTEMPTS &&
      (row.nextRetryAt == null || row.nextRetryAt <= now))
  );
}

/**
 * Claim a SPECIFIC lead by key (QStash delivers one job). Applies the same claimability guards
 * everywhere — never re-claims a `completed`/`skipped` job, so duplicate deliveries are safe.
 */
export async function claimLeadByMessageId(
  leadKey: string,
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<LeadRow | null> {
  const now = new Date();
  const existing = await getProcessedLead(leadKey, log);
  if (!existing) {
    log.warn("Lead claim-by-id: not found", { leadKey });
    return null;
  }
  if (!isClaimable(existing, now)) {
    log.info("Lead claim-by-id: not claimable", { leadKey, status: existing.status });
    return null;
  }

  await db
    .update(leadsTheWayProcessed)
    .set({
      status: "processing",
      processedAt: new Date(),
      jobState: { ...(existing.jobState ?? {}), step: existing.jobState?.step ?? "parse" },
    })
    .where(eq(leadsTheWayProcessed.leadKey, leadKey));

  log.info("Claimed lead by id", { leadKey, priorStatus: existing.status, attemptCount: existing.attemptCount });
  return getProcessedLead(leadKey, log);
}

/** Return claimable rows for the daily reconcile safety net (pending / stale / retryable-failed). */
export async function findClaimableLeads(
  limit = 25,
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<LeadRow[]> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const rows = await db
    .select()
    .from(leadsTheWayProcessed)
    .where(
      or(
        eq(leadsTheWayProcessed.status, "pending"),
        and(
          eq(leadsTheWayProcessed.status, "processing"),
          lte(leadsTheWayProcessed.processedAt, staleBefore)
        ),
        and(
          eq(leadsTheWayProcessed.status, "failed"),
          sql`${leadsTheWayProcessed.attemptCount} < ${MAX_LEAD_ATTEMPTS}`,
          or(
            sql`${leadsTheWayProcessed.nextRetryAt} IS NULL`,
            lte(leadsTheWayProcessed.nextRetryAt, now)
          )
        )
      )
    )
    .orderBy(leadsTheWayProcessed.createdAt)
    .limit(limit);
  log.debug("Reconcile: claimable leads", { count: rows.length });
  return rows;
}

export function leadRetryBackoffMs(attemptCount: number): number {
  const schedule = [2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000, 2 * 60 * 60_000];
  return schedule[Math.min(attemptCount, schedule.length - 1)] ?? schedule[0]!;
}

export { MAX_LEAD_ATTEMPTS };
