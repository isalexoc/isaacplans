import { and, eq, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  callSummaryProcessed,
  type CallSummaryJobState,
  type CallSummarySource,
} from "@/lib/db/schema";
import type {
  CallDisposition,
  LineOfBusiness,
  StructuredCallSummary,
} from "@/lib/call-summary-structured";
import {
  createCallSummaryLogger,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

export type ProcessedCallStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

const MAX_KIXIE_ATTEMPTS = 5;

export type CallSummaryRow = typeof callSummaryProcessed.$inferSelect;

export async function getProcessedCall(
  messageId: string,
  log: CallSummaryLogger = createCallSummaryLogger()
) {
  log.debug("DB lookup processed call", { messageId });
  const rows = await db
    .select()
    .from(callSummaryProcessed)
    .where(eq(callSummaryProcessed.messageId, messageId))
    .limit(1);
  const row = rows[0] ?? null;
  log.debug("DB lookup result", {
    messageId,
    found: Boolean(row),
    status: row?.status,
    noteId: row?.noteId,
  });
  return row;
}

export async function markCallProcessed(
  params: {
    messageId: string;
    contactId: string;
    locationId: string;
    noteId?: string | null;
    direction?: string | null;
    callDurationSeconds?: number | null;
    status: ProcessedCallStatus;
    errorMessage?: string | null;
    source?: CallSummarySource | null;
    recordingUrl?: string | null;
    jobState?: CallSummaryJobState | null;
    attemptCount?: number;
    nextRetryAt?: Date | null;
    disposition?: CallDisposition | null;
    lineOfBusiness?: LineOfBusiness | null;
    followUpDateIso?: Date | null;
    structuredSummary?: StructuredCallSummary | null;
  },
  log: CallSummaryLogger = createCallSummaryLogger()
) {
  log.debug("DB mark processed", {
    messageId: params.messageId,
    status: params.status,
    contactId: params.contactId,
    noteId: params.noteId,
    errorMessage: params.errorMessage,
    source: params.source,
    attemptCount: params.attemptCount,
    disposition: params.disposition,
    lineOfBusiness: params.lineOfBusiness,
  });
  await db
    .insert(callSummaryProcessed)
    .values({
      messageId: params.messageId,
      contactId: params.contactId,
      locationId: params.locationId,
      noteId: params.noteId ?? null,
      direction: params.direction ?? null,
      callDurationSeconds: params.callDurationSeconds ?? null,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      source: params.source ?? null,
      recordingUrl: params.recordingUrl ?? null,
      jobState: params.jobState ?? null,
      attemptCount: params.attemptCount ?? 0,
      nextRetryAt: params.nextRetryAt ?? null,
      disposition: params.disposition ?? null,
      lineOfBusiness: params.lineOfBusiness ?? null,
      followUpDateIso: params.followUpDateIso ?? null,
      structuredSummary: params.structuredSummary ?? null,
    })
    .onConflictDoUpdate({
      target: callSummaryProcessed.messageId,
      set: {
        noteId: params.noteId ?? null,
        status: params.status,
        errorMessage: params.errorMessage ?? null,
        ...(params.source !== undefined ? { source: params.source } : {}),
        ...(params.recordingUrl !== undefined ? { recordingUrl: params.recordingUrl } : {}),
        ...(params.jobState !== undefined ? { jobState: params.jobState } : {}),
        ...(params.attemptCount !== undefined ? { attemptCount: params.attemptCount } : {}),
        ...(params.nextRetryAt !== undefined ? { nextRetryAt: params.nextRetryAt } : {}),
        ...(params.disposition !== undefined ? { disposition: params.disposition } : {}),
        ...(params.lineOfBusiness !== undefined ? { lineOfBusiness: params.lineOfBusiness } : {}),
        ...(params.followUpDateIso !== undefined ? { followUpDateIso: params.followUpDateIso } : {}),
        ...(params.structuredSummary !== undefined ? { structuredSummary: params.structuredSummary } : {}),
        processedAt: new Date(),
      },
    });
}

/** Queue a Kixie End Call for async processing (webhook returns immediately). */
export async function enqueueKixieCallJob(
  params: {
    messageId: string;
    contactId: string;
    locationId: string;
    recordingUrl: string;
    direction?: string | null;
    callDurationSeconds?: number | null;
    callStatus?: string | null;
  },
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<{ queued: boolean; reason?: string }> {
  const existing = await getProcessedCall(params.messageId, log);
  if (existing?.status === "completed") {
    return { queued: false, reason: "already_processed" };
  }
  if (existing?.status === "pending" || existing?.status === "processing") {
    return { queued: false, reason: "already_queued" };
  }

  await markCallProcessed(
    {
      messageId: params.messageId,
      contactId: params.contactId,
      locationId: params.locationId,
      direction: params.direction ?? null,
      callDurationSeconds: params.callDurationSeconds ?? null,
      status: "pending",
      source: "kixie",
      recordingUrl: params.recordingUrl,
      jobState: { step: "download" },
      attemptCount: existing?.attemptCount ?? 0,
      errorMessage: null,
    },
    log
  );
  return { queued: true };
}

/** Claim the next Kixie job ready to run (pending or failed with backoff elapsed). */
export async function claimNextKixieJob(
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<CallSummaryRow | null> {
  const now = new Date();
  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(callSummaryProcessed)
    .where(
      and(
        eq(callSummaryProcessed.source, "kixie"),
        or(
          eq(callSummaryProcessed.status, "pending"),
          and(
            eq(callSummaryProcessed.status, "processing"),
            lte(callSummaryProcessed.processedAt, staleBefore)
          ),
          and(
            eq(callSummaryProcessed.status, "failed"),
            sql`${callSummaryProcessed.attemptCount} < ${MAX_KIXIE_ATTEMPTS}`,
            or(
              sql`${callSummaryProcessed.nextRetryAt} IS NULL`,
              lte(callSummaryProcessed.nextRetryAt, now)
            )
          )
        )
      )
    )
    .orderBy(callSummaryProcessed.createdAt)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db
    .update(callSummaryProcessed)
    .set({
      status: "processing",
      processedAt: new Date(),
      jobState: { ...(row.jobState ?? {}), step: row.jobState?.step ?? "download" },
    })
    .where(eq(callSummaryProcessed.messageId, row.messageId));

  log.info("Claimed Kixie job", {
    messageId: row.messageId,
    contactId: row.contactId,
    attemptCount: row.attemptCount,
    priorStatus: row.status,
  });

  const updated = await getProcessedCall(row.messageId, log);
  return updated;
}

/**
 * Claim a SPECIFIC Kixie job by id — used when QStash delivers one job.
 * Applies the same claimability guards as {@link claimNextKixieJob} (never
 * re-claims a `completed` job, so duplicate QStash deliveries are safe).
 * Returns null when the job is missing or not claimable.
 */
export async function claimKixieJobByMessageId(
  messageId: string,
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<CallSummaryRow | null> {
  const now = new Date();
  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const existing = await getProcessedCall(messageId, log);
  if (!existing) {
    log.warn("Kixie claim-by-id: job not found", { messageId });
    return null;
  }

  const claimable =
    existing.status === "pending" ||
    (existing.status === "processing" &&
      existing.processedAt != null &&
      existing.processedAt <= staleBefore) ||
    (existing.status === "failed" &&
      (existing.attemptCount ?? 0) < MAX_KIXIE_ATTEMPTS &&
      (existing.nextRetryAt == null || existing.nextRetryAt <= now));

  if (!claimable) {
    log.info("Kixie claim-by-id: not claimable", {
      messageId,
      status: existing.status,
      attemptCount: existing.attemptCount,
    });
    return null;
  }

  await db
    .update(callSummaryProcessed)
    .set({
      status: "processing",
      processedAt: new Date(),
      jobState: { ...(existing.jobState ?? {}), step: existing.jobState?.step ?? "download" },
    })
    .where(eq(callSummaryProcessed.messageId, messageId));

  log.info("Claimed Kixie job by id", {
    messageId,
    priorStatus: existing.status,
    attemptCount: existing.attemptCount,
  });

  return getProcessedCall(messageId, log);
}

export async function updateKixieJobProgress(
  messageId: string,
  patch: {
    jobState?: CallSummaryJobState | null;
    status?: ProcessedCallStatus;
    noteId?: string | null;
    errorMessage?: string | null;
    attemptCount?: number;
    nextRetryAt?: Date | null;
  },
  log: CallSummaryLogger = createCallSummaryLogger()
) {
  log.debug("DB update Kixie job", { messageId, ...patch });
  await db
    .update(callSummaryProcessed)
    .set({
      ...(patch.jobState !== undefined ? { jobState: patch.jobState } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.noteId !== undefined ? { noteId: patch.noteId } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.attemptCount !== undefined ? { attemptCount: patch.attemptCount } : {}),
      ...(patch.nextRetryAt !== undefined ? { nextRetryAt: patch.nextRetryAt } : {}),
      processedAt: new Date(),
    })
    .where(eq(callSummaryProcessed.messageId, messageId));
}

export function kixieRetryBackoffMs(attemptCount: number): number {
  const schedule = [5 * 60_000, 15 * 60_000, 60 * 60_000, 2 * 60 * 60_000, 4 * 60 * 60_000];
  return schedule[Math.min(attemptCount, schedule.length - 1)] ?? schedule[0]!;
}

export { MAX_KIXIE_ATTEMPTS };
