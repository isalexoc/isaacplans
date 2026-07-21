import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { missedCallDrafts } from "@/lib/db/schema";
import {
  createCallSummaryLogger,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

export type MissedCallDraftRow = typeof missedCallDrafts.$inferSelect;

export function missedCallDraftKey(contactId: string, localDayKey: string): string {
  return `mcd_${contactId}_${localDayKey}`;
}

/**
 * Insert-or-detect-existing for today's draft key. Returns `claimed: true` only
 * for the FIRST call this contact+day (the one that should actually generate a
 * draft); repeat triggers (triple-dialing) see `claimed: false` and should just
 * bump the attempt counter.
 */
export async function claimMissedCallDraft(
  params: { draftKey: string; contactId: string; locationId: string; reason: string; source: "ghl" | "kixie" },
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<{ claimed: boolean; existing: MissedCallDraftRow | null }> {
  const inserted = await db
    .insert(missedCallDrafts)
    .values({
      draftKey: params.draftKey,
      contactId: params.contactId,
      locationId: params.locationId,
      reason: params.reason,
      source: params.source,
      status: "pending",
      attemptCount: 1,
    })
    .onConflictDoNothing({ target: missedCallDrafts.draftKey })
    .returning();

  if (inserted.length > 0) {
    log.info("Missed-call draft claimed (new)", { draftKey: params.draftKey, contactId: params.contactId });
    return { claimed: true, existing: null };
  }

  const rows = await db.select().from(missedCallDrafts).where(eq(missedCallDrafts.draftKey, params.draftKey)).limit(1);
  const existing = rows[0] ?? null;
  log.info("Missed-call draft already exists today", {
    draftKey: params.draftKey,
    contactId: params.contactId,
    priorStatus: existing?.status,
  });
  return { claimed: false, existing };
}

export async function bumpMissedCallDraftAttempt(
  draftKey: string,
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<void> {
  await db
    .update(missedCallDrafts)
    .set({ attemptCount: sql`${missedCallDrafts.attemptCount} + 1`, updatedAt: new Date() })
    .where(eq(missedCallDrafts.draftKey, draftKey));
  log.debug("Missed-call draft attempt bumped", { draftKey });
}

export async function completeMissedCallDraft(
  draftKey: string,
  patch: {
    noteId: string | null;
    smsDraft: string;
    whatsappDraft: string;
    lineOfBusiness: string;
    language: string;
  },
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<void> {
  await db
    .update(missedCallDrafts)
    .set({
      status: "completed",
      noteId: patch.noteId,
      smsDraft: patch.smsDraft,
      whatsappDraft: patch.whatsappDraft,
      lineOfBusiness: patch.lineOfBusiness,
      language: patch.language,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(missedCallDrafts.draftKey, draftKey));
  log.info("Missed-call draft completed", { draftKey, noteId: patch.noteId });
}

export async function failMissedCallDraft(
  draftKey: string,
  errorMessage: string,
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<void> {
  await db
    .update(missedCallDrafts)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(missedCallDrafts.draftKey, draftKey));
  log.warn("Missed-call draft failed", { draftKey, errorMessage });
}
