/**
 * Reads over the structured call-summary data persisted by the call-summary
 * pipeline (lib/agent-crm-call-summary.ts). Powers the Callback Priority and
 * Call Metrics admin dashboards.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { callSummaryProcessed } from "@/lib/db/schema";
import type {
  CallDisposition,
  LineOfBusiness,
  StructuredCallSummary,
} from "@/lib/call-summary-structured";

export const OPEN_LOOP_DISPOSITIONS: CallDisposition[] = [
  "follow_up",
  "appointment_set",
  "needs_info",
  "no_decision",
];

export type OpenLoopCall = {
  contactId: string;
  locationId: string;
  noteId: string | null;
  disposition: CallDisposition;
  lineOfBusiness: LineOfBusiness;
  followUpDate: string | null;
  followUpDateIso: Date | null;
  processedAt: Date;
  structuredSummary: StructuredCallSummary | null;
};

const DEFAULT_LOOKBACK_DAYS = 90;

/**
 * One row per contact (their most recent COMPLETED call), filtered to open-loop
 * dispositions, sorted by soonest promised follow-up (nulls last, falling back
 * to most-recently-processed first).
 */
export async function getOpenLoopCalls(opts?: { lookbackDays?: number }): Promise<OpenLoopCall[]> {
  const cutoff = new Date(Date.now() - (opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS) * 24 * 60 * 60 * 1000);

  const rows = await db
    .selectDistinctOn([callSummaryProcessed.contactId])
    .from(callSummaryProcessed)
    .where(and(eq(callSummaryProcessed.status, "completed"), gte(callSummaryProcessed.processedAt, cutoff)))
    .orderBy(callSummaryProcessed.contactId, desc(callSummaryProcessed.processedAt));

  const openLoop = rows.filter(
    (row): row is typeof row & { disposition: CallDisposition } =>
      row.disposition !== null && OPEN_LOOP_DISPOSITIONS.includes(row.disposition as CallDisposition)
  );

  return openLoop
    .map((row) => ({
      contactId: row.contactId,
      locationId: row.locationId,
      noteId: row.noteId,
      disposition: row.disposition as CallDisposition,
      lineOfBusiness: (row.lineOfBusiness as LineOfBusiness) ?? "other",
      followUpDate: row.structuredSummary?.followUpDate ?? null,
      followUpDateIso: row.followUpDateIso,
      processedAt: row.processedAt,
      structuredSummary: row.structuredSummary,
    }))
    .sort((a, b) => {
      if (a.followUpDateIso && b.followUpDateIso) {
        return a.followUpDateIso.getTime() - b.followUpDateIso.getTime();
      }
      if (a.followUpDateIso) return -1;
      if (b.followUpDateIso) return 1;
      return b.processedAt.getTime() - a.processedAt.getTime();
    });
}

/** Most recent completed call for a single contact — used to personalize missed-call drafts. */
export async function getMostRecentCompletedCall(
  contactId: string
): Promise<OpenLoopCall | (Omit<OpenLoopCall, "disposition"> & { disposition: CallDisposition | null }) | null> {
  const rows = await db
    .select()
    .from(callSummaryProcessed)
    .where(and(eq(callSummaryProcessed.contactId, contactId), eq(callSummaryProcessed.status, "completed")))
    .orderBy(desc(callSummaryProcessed.processedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    contactId: row.contactId,
    locationId: row.locationId,
    noteId: row.noteId,
    disposition: (row.disposition as CallDisposition | null) ?? null,
    lineOfBusiness: (row.lineOfBusiness as LineOfBusiness) ?? "other",
    followUpDate: row.structuredSummary?.followUpDate ?? null,
    followUpDateIso: row.followUpDateIso,
    processedAt: row.processedAt,
    structuredSummary: row.structuredSummary,
  };
}
