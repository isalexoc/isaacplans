import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callSummaryProcessed } from "@/lib/db/schema";
import {
  createCallSummaryLogger,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

export type ProcessedCallStatus = "completed" | "failed" | "skipped";

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

export async function markCallProcessed(params: {
  messageId: string;
  contactId: string;
  locationId: string;
  noteId?: string | null;
  direction?: string | null;
  callDurationSeconds?: number | null;
  status: ProcessedCallStatus;
  errorMessage?: string | null;
}, log: CallSummaryLogger = createCallSummaryLogger()) {
  log.debug("DB mark processed", {
    messageId: params.messageId,
    status: params.status,
    contactId: params.contactId,
    noteId: params.noteId,
    errorMessage: params.errorMessage,
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
    })
    .onConflictDoUpdate({
      target: callSummaryProcessed.messageId,
      set: {
        noteId: params.noteId ?? null,
        status: params.status,
        errorMessage: params.errorMessage ?? null,
        processedAt: new Date(),
      },
    });
}
