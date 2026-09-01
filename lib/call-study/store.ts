/**
 * Data layer for Call Study recordings and the snippet library.
 *
 * Server-only (DB access).
 */

import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { callStudyRecordings, callStudySnippets } from "@/lib/db/schema";
import type {
  CallAnalysis,
  CallMetrics,
  CallOutcome,
  CallStudyStatus,
  ExtractedSnippet,
  SpeakerMap,
  Turn,
} from "./types";

export type RecordingRow = typeof callStudyRecordings.$inferSelect;
export type SnippetRow = typeof callStudySnippets.$inferSelect;

/**
 * What the list view needs. Deliberately omits `turns` — a list of twenty calls would otherwise
 * ship twenty full transcripts to the browser to render twenty titles.
 */
export type RecordingSummary = {
  id: string;
  title: string;
  status: CallStudyStatus;
  outcome: CallOutcome;
  lineOfBusiness: string | null;
  durationSeconds: number | null;
  languageCode: string | null;
  errorMessage: string | null;
  turnCount: number;
  createdAt: string;
  transcribedAt: string | null;
  analyzedAt: string | null;
};

/** The detail view: everything, including the dialogue itself. */
export type RecordingDetail = RecordingSummary & {
  speakerMap: SpeakerMap | null;
  turns: Turn[];
  metrics: CallMetrics | null;
  analysis: CallAnalysis | null;
  audioUrl: string | null;
};

export function toSummary(row: RecordingRow): RecordingSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status as CallStudyStatus,
    outcome: row.outcome as CallOutcome,
    lineOfBusiness: row.lineOfBusiness,
    durationSeconds: row.durationSeconds,
    languageCode: row.languageCode,
    errorMessage: row.errorMessage,
    turnCount: row.turns?.length ?? 0,
    createdAt: row.createdAt.toISOString(),
    transcribedAt: row.transcribedAt?.toISOString() ?? null,
    analyzedAt: row.analyzedAt?.toISOString() ?? null,
  };
}

export function toDetail(row: RecordingRow): RecordingDetail {
  return {
    ...toSummary(row),
    speakerMap: row.speakerMap ?? null,
    turns: row.turns ?? [],
    metrics: row.metrics ?? null,
    analysis: row.analysis ?? null,
    audioUrl: row.audioUrl,
  };
}

export async function createRecording(input: {
  ownerUserId: string;
  title: string;
  sourceFilename?: string | null;
  cloudinaryPublicId?: string | null;
  audioUrl?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  languageCode?: string | null;
}): Promise<RecordingRow> {
  const [row] = await db
    .insert(callStudyRecordings)
    .values({
      id: nanoid(),
      ownerUserId: input.ownerUserId,
      title: input.title,
      sourceFilename: input.sourceFilename ?? null,
      cloudinaryPublicId: input.cloudinaryPublicId ?? null,
      audioUrl: input.audioUrl ?? null,
      durationSeconds: input.durationSeconds ?? null,
      sizeBytes: input.sizeBytes ?? null,
      languageCode: input.languageCode ?? null,
      status: "uploaded",
    })
    .returning();
  return row;
}

export async function getRecording(id: string): Promise<RecordingRow | null> {
  const [row] = await db
    .select()
    .from(callStudyRecordings)
    .where(eq(callStudyRecordings.id, id))
    .limit(1);
  return row ?? null;
}

/** The webhook's only way in. */
export async function getRecordingByRequestId(requestId: string): Promise<RecordingRow | null> {
  const [row] = await db
    .select()
    .from(callStudyRecordings)
    .where(eq(callStudyRecordings.elevenRequestId, requestId))
    .limit(1);
  return row ?? null;
}

export async function listRecordings(ownerUserId: string, limit = 50): Promise<RecordingRow[]> {
  return db
    .select()
    .from(callStudyRecordings)
    .where(eq(callStudyRecordings.ownerUserId, ownerUserId))
    .orderBy(desc(callStudyRecordings.createdAt))
    .limit(limit);
}

export async function markTranscribing(id: string, requestId: string): Promise<void> {
  await db
    .update(callStudyRecordings)
    .set({ status: "transcribing", elevenRequestId: requestId, errorMessage: null, updatedAt: new Date() })
    .where(eq(callStudyRecordings.id, id));
}

/**
 * Store the finished dialogue.
 *
 * Guarded on the row not already being transcribed, so a duplicate webhook delivery — which
 * ElevenLabs will send if our first response was slow — is a no-op rather than a second write.
 * The returned count tells the caller whether this delivery was the one that landed.
 */
export async function saveTranscript(
  id: string,
  data: {
    turns: Turn[];
    speakerMap: SpeakerMap;
    metrics: CallMetrics;
    languageCode?: string | null;
    durationSeconds?: number | null;
  }
): Promise<boolean> {
  const rows = await db
    .update(callStudyRecordings)
    .set({
      turns: data.turns,
      speakerMap: data.speakerMap,
      metrics: data.metrics,
      languageCode: data.languageCode ?? null,
      durationSeconds: data.durationSeconds ?? null,
      status: "transcribed",
      transcribedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(callStudyRecordings.id, id), eq(callStudyRecordings.status, "transcribing")))
    .returning({ id: callStudyRecordings.id });
  return rows.length > 0;
}

export async function updateSpeakerMap(id: string, speakerMap: SpeakerMap): Promise<void> {
  await db
    .update(callStudyRecordings)
    .set({ speakerMap, updatedAt: new Date() })
    .where(eq(callStudyRecordings.id, id));
}

export async function updateRecordingMeta(
  id: string,
  patch: { title?: string; outcome?: CallOutcome; lineOfBusiness?: string | null }
): Promise<void> {
  await db
    .update(callStudyRecordings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(callStudyRecordings.id, id));
}

export async function setStatus(
  id: string,
  status: CallStudyStatus,
  errorMessage?: string | null
): Promise<void> {
  await db
    .update(callStudyRecordings)
    .set({ status, errorMessage: errorMessage ?? null, updatedAt: new Date() })
    .where(eq(callStudyRecordings.id, id));
}

export async function saveAnalysis(id: string, analysis: CallAnalysis): Promise<void> {
  await db
    .update(callStudyRecordings)
    .set({ analysis, status: "ready", analyzedAt: new Date(), errorMessage: null, updatedAt: new Date() })
    .where(eq(callStudyRecordings.id, id));
}

export async function deleteRecording(id: string, ownerUserId: string): Promise<boolean> {
  // Snippets first: they carry no foreign key, so nothing else would clean them up and they would
  // outlive the call they quote.
  await db.delete(callStudySnippets).where(eq(callStudySnippets.recordingId, id));
  const rows = await db
    .delete(callStudyRecordings)
    .where(and(eq(callStudyRecordings.id, id), eq(callStudyRecordings.ownerUserId, ownerUserId)))
    .returning({ id: callStudyRecordings.id });
  return rows.length > 0;
}

/* ─── Snippets ───────────────────────────────────────────────────────────── */

/** Replace a recording's snippets. Re-analysing should not double the library. */
export async function replaceSnippets(
  recordingId: string,
  ownerUserId: string,
  snippets: ExtractedSnippet[],
  speakerMap: SpeakerMap | null
): Promise<number> {
  await db.delete(callStudySnippets).where(eq(callStudySnippets.recordingId, recordingId));
  if (snippets.length === 0) return 0;

  const nameForRole = (role: string): string | null => {
    if (!speakerMap) return null;
    const hit = Object.values(speakerMap).find((s) => s.role === role);
    return hit?.name ?? null;
  };

  const rows = await db
    .insert(callStudySnippets)
    .values(
      snippets.map((s) => ({
        id: nanoid(),
        recordingId,
        ownerUserId,
        category: s.category,
        objectionType: s.objectionType ?? null,
        speakerName: nameForRole(s.speakerRole),
        speakerRole: s.speakerRole,
        quote: s.quote,
        why: s.why,
        startSec: s.startSec == null ? null : Math.round(s.startSec),
      }))
    )
    .returning({ id: callStudySnippets.id });
  return rows.length;
}

export type SnippetWithCall = SnippetRow & {
  callTitle: string;
  callOutcome: CallOutcome;
  callLineOfBusiness: string | null;
};

/**
 * The library query — the screen a script actually gets written from.
 *
 * Joins to the recording for outcome and line of business rather than storing copies on the
 * snippet, because the agent tags outcome after listening and a copy would go stale the moment a
 * call was re-tagged.
 */
export async function listSnippets(
  ownerUserId: string,
  filters: {
    category?: string;
    objectionType?: string;
    outcome?: CallOutcome;
    lineOfBusiness?: string;
    limit?: number;
  } = {}
): Promise<SnippetWithCall[]> {
  const conditions = [eq(callStudySnippets.ownerUserId, ownerUserId)];
  if (filters.category) conditions.push(eq(callStudySnippets.category, filters.category));
  if (filters.objectionType) conditions.push(eq(callStudySnippets.objectionType, filters.objectionType));
  if (filters.outcome) conditions.push(eq(callStudyRecordings.outcome, filters.outcome));
  if (filters.lineOfBusiness) conditions.push(eq(callStudyRecordings.lineOfBusiness, filters.lineOfBusiness));

  const rows = await db
    .select({
      snippet: callStudySnippets,
      callTitle: callStudyRecordings.title,
      callOutcome: callStudyRecordings.outcome,
      callLineOfBusiness: callStudyRecordings.lineOfBusiness,
    })
    .from(callStudySnippets)
    .innerJoin(callStudyRecordings, eq(callStudySnippets.recordingId, callStudyRecordings.id))
    .where(and(...conditions))
    .orderBy(desc(callStudySnippets.createdAt))
    .limit(Math.min(filters.limit ?? 200, 500));

  return rows.map((r) => ({
    ...r.snippet,
    callTitle: r.callTitle,
    callOutcome: r.callOutcome as CallOutcome,
    callLineOfBusiness: r.callLineOfBusiness,
  }));
}

/** Distinct objection types present in the library, for the filter dropdown. */
export async function listObjectionTypes(ownerUserId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ objectionType: callStudySnippets.objectionType })
    .from(callStudySnippets)
    .where(eq(callStudySnippets.ownerUserId, ownerUserId));
  return rows.map((r) => r.objectionType).filter((v): v is string => Boolean(v)).sort();
}

/**
 * Transcriptions that have been in flight too long — the daily reconcile's work list.
 *
 * A webhook that never arrives would otherwise leave a row spinning forever with no way for the
 * agent to tell a slow call from a lost one.
 */
export async function listStuckTranscriptions(olderThan: Date, limit = 25): Promise<RecordingRow[]> {
  return db
    .select()
    .from(callStudyRecordings)
    .where(
      and(
        eq(callStudyRecordings.status, "transcribing"),
        lt(callStudyRecordings.updatedAt, olderThan),
        sql`${callStudyRecordings.elevenRequestId} is not null`
      )
    )
    .orderBy(desc(callStudyRecordings.updatedAt))
    .limit(limit);
}

export async function countSnippetsForRecordings(recordingIds: string[]): Promise<Record<string, number>> {
  if (recordingIds.length === 0) return {};
  const rows = await db
    .select({ recordingId: callStudySnippets.recordingId, count: sql<number>`count(*)::int` })
    .from(callStudySnippets)
    .where(inArray(callStudySnippets.recordingId, recordingIds))
    .groupBy(callStudySnippets.recordingId);
  return Object.fromEntries(rows.map((r) => [r.recordingId, r.count]));
}
