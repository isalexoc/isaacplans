import type { GhlCallWebhookPayload } from "@/lib/agent-crm-call-summary";
import { completeCallSummaryFromTranscript } from "@/lib/agent-crm-call-summary";
import {
  claimKixieJobByMessageId,
  claimNextKixieJob,
  kixieRetryBackoffMs,
  MAX_KIXIE_ATTEMPTS,
  updateKixieJobProgress,
  type CallSummaryRow,
} from "@/lib/agent-crm-call-summary-store";
import { createCallSummaryLogger } from "@/lib/agent-crm-call-summary-log";
import { getKixieCallSummaryConfig } from "@/lib/kixie-call-summary-config";
import { isCallSummaryConfigured } from "@/lib/agent-crm-call-summary-config";
import { transcribeRecordingLong } from "@/lib/whisper-transcribe-long";

function rowToPayload(row: CallSummaryRow): GhlCallWebhookPayload {
  return {
    contactId: row.contactId,
    locationId: row.locationId,
    messageId: row.messageId,
    messageType: "CALL",
    direction: row.direction ?? "unknown",
    callDuration: row.callDurationSeconds ?? undefined,
    callStatus: "answered",
    dateAdded: row.processedAt?.toISOString(),
    attachments: row.recordingUrl ? [row.recordingUrl] : undefined,
  };
}

export type ProcessKixieQueueResult = {
  processed: boolean;
  messageId?: string;
  ok?: boolean;
  reason?: string;
  noteId?: string | null;
};

/**
 * Process the next queued Kixie job (FIFO claim). Used by the daily reconcile
 * backstop to drain anything QStash never delivered.
 */
export async function processOneKixieCallJob(): Promise<ProcessKixieQueueResult> {
  const kixieConfig = getKixieCallSummaryConfig();
  const log = createCallSummaryLogger(kixieConfig.callSummary.debug);

  if (!kixieConfig.enabled || !isCallSummaryConfigured(kixieConfig.callSummary)) {
    log.warn("Kixie processor skipped: not configured");
    return { processed: false, reason: "not_configured" };
  }

  const row = await claimNextKixieJob(log);
  if (!row) {
    log.debug("Kixie processor: no jobs in queue");
    return { processed: false };
  }

  return processClaimedKixieJob(row, log);
}

/**
 * Process a SPECIFIC Kixie job by id — the QStash delivery path. Returns
 * `{ processed: false }` when the job is missing/already done/not claimable
 * (duplicate delivery), which the endpoint maps to a 200 (no retry).
 */
export async function processKixieJobById(messageId: string): Promise<ProcessKixieQueueResult> {
  const kixieConfig = getKixieCallSummaryConfig();
  const log = createCallSummaryLogger(kixieConfig.callSummary.debug);

  if (!kixieConfig.enabled || !isCallSummaryConfigured(kixieConfig.callSummary)) {
    log.warn("Kixie processor skipped: not configured");
    return { processed: false, reason: "not_configured" };
  }

  const row = await claimKixieJobByMessageId(messageId, log);
  if (!row) {
    log.info("Kixie processor: job not claimable", { messageId });
    return { processed: false, messageId, reason: "not_claimable" };
  }

  return processClaimedKixieJob(row, log);
}

/** Run the download → Whisper → summary → note pipeline for an already-claimed job. */
async function processClaimedKixieJob(
  row: CallSummaryRow,
  log: ReturnType<typeof createCallSummaryLogger>
): Promise<ProcessKixieQueueResult> {
  const kixieConfig = getKixieCallSummaryConfig();

  const recordingUrl = row.recordingUrl?.trim();
  if (!recordingUrl) {
    await failKixieJob(row, "missing_recording_url", log);
    return { processed: true, messageId: row.messageId, ok: false, reason: "missing_recording_url" };
  }

  const payload = rowToPayload(row);
  log.info("Kixie processor: job started", {
    messageId: row.messageId,
    contactId: row.contactId,
    callDurationSeconds: row.callDurationSeconds,
  });

  try {
    await updateKixieJobProgress(row.messageId, {
      jobState: { step: "transcribe", chunksDone: 0, chunksTotal: 0 },
    });

    const { transcript, chunksTotal } = await transcribeRecordingLong(
      recordingUrl,
      kixieConfig.callSummary,
      kixieConfig,
      log,
      (chunksDone, total) => {
        void updateKixieJobProgress(row.messageId, {
          jobState: { step: "transcribe", chunksDone, chunksTotal: total },
        });
      }
    );

    await updateKixieJobProgress(row.messageId, {
      jobState: { step: "summarize", chunksDone: chunksTotal, chunksTotal },
    });

    const result = await completeCallSummaryFromTranscript(
      payload,
      transcript,
      "whisper",
      { skipIdempotency: true }
    );

    if (!result.ok) {
      await failKixieJob(row, result.reason ?? "summary_failed", log);
      return {
        processed: true,
        messageId: row.messageId,
        ok: false,
        reason: result.reason,
      };
    }

    log.info("Kixie processor: job completed", {
      messageId: row.messageId,
      noteId: result.noteId,
      chunksTotal,
    });
    return {
      processed: true,
      messageId: row.messageId,
      ok: true,
      noteId: result.noteId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failKixieJob(row, message, log);
    return { processed: true, messageId: row.messageId, ok: false, reason: message };
  }
}

async function failKixieJob(
  row: CallSummaryRow,
  message: string,
  log: ReturnType<typeof createCallSummaryLogger>
) {
  const attemptCount = (row.attemptCount ?? 0) + 1;
  const backoff = kixieRetryBackoffMs(attemptCount - 1);
  const nextRetryAt = attemptCount < MAX_KIXIE_ATTEMPTS ? new Date(Date.now() + backoff) : null;

  log.error("Kixie processor: job failed", {
    messageId: row.messageId,
    attemptCount,
    error: message,
    nextRetryAt: nextRetryAt?.toISOString(),
  });

  await updateKixieJobProgress(row.messageId, {
    status: "failed",
    errorMessage: message,
    attemptCount,
    nextRetryAt,
    jobState: {
      ...(row.jobState ?? {}),
      step: row.jobState?.step ?? "download",
      lastError: message,
    },
  });
}

/** Fire-and-forget kick to start processing soon after enqueue. */
export async function triggerKixieProcessorKick(baseUrl: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !baseUrl) return;

  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/kixie-call-summary`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-fatal; cron will pick up the job
  }
}
