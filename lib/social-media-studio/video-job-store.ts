import { nanoid } from "nanoid";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialVideoJobs } from "@/lib/db/schema";
import type {
  SocialVideoJobKind,
  SocialVideoJobStatus,
  SocialVideoJobState,
  SocialVideoJobInput,
  SocialVideoImagesResult,
  SocialVideoJobView,
} from "./video-job-types";
import { ACTIVE_VIDEO_JOB_STATUSES } from "./video-job-types";
import type { SocialLocale } from "./types";

export type VideoJobRow = typeof socialVideoJobs.$inferSelect;

/** Retry ceiling before a job is marked terminally `failed`. */
export const MAX_VIDEO_JOB_ATTEMPTS = 4;
/** A `processing` row untouched for this long is presumed crashed → reclaimable. */
const STALE_MS = 10 * 60 * 1000;

function toView(row: VideoJobRow): SocialVideoJobView {
  return {
    id:           row.id,
    kind:         row.kind as SocialVideoJobKind,
    status:       row.status as SocialVideoJobStatus,
    sceneIndex:   row.sceneIndex ?? null,
    jobState:     (row.jobState as SocialVideoJobState | null) ?? null,
    resultUrl:    row.resultUrl ?? null,
    resultData:   (row.resultData as SocialVideoImagesResult | null) ?? null,
    errorMessage: row.errorMessage ?? null,
  };
}

export async function createVideoJob(params: {
  userId: string;
  sanityPostId: string;
  kind: SocialVideoJobKind;
  category?: string | null;
  voiceLanguage?: SocialLocale | null;
  sceneIndex?: number | null;
  input?: SocialVideoJobInput | null;
  jobState?: SocialVideoJobState | null;
}): Promise<VideoJobRow> {
  const now = new Date();
  const row: VideoJobRow = {
    id:              nanoid(),
    userId:          params.userId,
    sanityPostId:    params.sanityPostId,
    kind:            params.kind,
    status:          "pending",
    category:        params.category ?? null,
    voiceLanguage:   params.voiceLanguage ?? null,
    sceneIndex:      params.sceneIndex ?? null,
    input:           params.input ?? null,
    jobState:        params.jobState ?? { step: "queued", progress: 0 },
    resultUrl:       null,
    resultData:      null,
    errorMessage:    null,
    attemptCount:    0,
    nextRetryAt:     null,
    qstashMessageId: null,
    createdAt:       now,
    updatedAt:       now,
  };
  await db.insert(socialVideoJobs).values(row);
  return row;
}

export async function getVideoJob(id: string): Promise<VideoJobRow | null> {
  const rows = await db.select().from(socialVideoJobs).where(eq(socialVideoJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getVideoJobView(id: string): Promise<SocialVideoJobView | null> {
  const row = await getVideoJob(id);
  return row ? toView(row) : null;
}

/** Active (pending|processing) jobs for a post — powers resume-on-mount. */
export async function getActiveJobsForPost(sanityPostId: string): Promise<SocialVideoJobView[]> {
  const rows = await db
    .select()
    .from(socialVideoJobs)
    .where(
      and(
        eq(socialVideoJobs.sanityPostId, sanityPostId),
        inArray(socialVideoJobs.status, ACTIVE_VIDEO_JOB_STATUSES),
      ),
    )
    .orderBy(socialVideoJobs.createdAt);
  return rows.map(toView);
}

export async function setJobQstashMessageId(id: string, qstashMessageId: string | null): Promise<void> {
  await db
    .update(socialVideoJobs)
    .set({ qstashMessageId, updatedAt: new Date() })
    .where(eq(socialVideoJobs.id, id));
}

/**
 * Claim a pending (or stale-processing / retryable-failed) job → `processing`.
 * Returns the refreshed row, or null when the job is missing or not claimable
 * (already done/cancelled, or another worker holds a fresh `processing` lease).
 * Continuation ticks of an in-flight job do NOT call this — see the processor.
 */
export async function claimVideoJob(id: string): Promise<VideoJobRow | null> {
  const now = new Date();
  const staleBefore = new Date(Date.now() - STALE_MS);
  const existing = await getVideoJob(id);
  if (!existing) return null;

  const claimable =
    existing.status === "pending" ||
    (existing.status === "processing" && existing.updatedAt <= staleBefore) ||
    (existing.status === "failed" &&
      existing.attemptCount < MAX_VIDEO_JOB_ATTEMPTS &&
      (existing.nextRetryAt == null || existing.nextRetryAt <= now));

  if (!claimable) return null;

  await db
    .update(socialVideoJobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(socialVideoJobs.id, id));

  return getVideoJob(id);
}

/** Incrementally persist progress/step (mirrors updateKixieJobProgress). */
export async function updateJobProgress(
  id: string,
  patch: {
    jobState?: SocialVideoJobState | null;
    status?: SocialVideoJobStatus;
    resultUrl?: string | null;
    resultData?: SocialVideoImagesResult | null;
    errorMessage?: string | null;
    attemptCount?: number;
    nextRetryAt?: Date | null;
  },
): Promise<void> {
  await db
    .update(socialVideoJobs)
    .set({
      ...(patch.jobState !== undefined ? { jobState: patch.jobState } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.resultUrl !== undefined ? { resultUrl: patch.resultUrl } : {}),
      ...(patch.resultData !== undefined ? { resultData: patch.resultData } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.attemptCount !== undefined ? { attemptCount: patch.attemptCount } : {}),
      ...(patch.nextRetryAt !== undefined ? { nextRetryAt: patch.nextRetryAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(socialVideoJobs.id, id));
}

export async function markJobDone(
  id: string,
  resultUrl?: string | null,
  resultData?: SocialVideoImagesResult | null,
  jobState?: SocialVideoJobState | null,
): Promise<void> {
  await db
    .update(socialVideoJobs)
    .set({
      status: "done",
      ...(resultUrl !== undefined ? { resultUrl } : {}),
      ...(resultData !== undefined ? { resultData } : {}),
      ...(jobState !== undefined ? { jobState } : {}),
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(socialVideoJobs.id, id));
}

function retryBackoffMs(attemptCount: number): number {
  const schedule = [10_000, 30_000, 60_000, 120_000];
  return schedule[Math.min(attemptCount, schedule.length - 1)] ?? schedule[0]!;
}

/**
 * Record a failure with exponential backoff. Stays `failed`-but-retryable until
 * MAX attempts, then terminal. Returns whether the job may still be retried.
 */
export async function markJobFailed(
  id: string,
  error: string,
  attemptCount: number,
  jobState?: SocialVideoJobState | null,
): Promise<{ retryable: boolean; nextRetryAt: Date | null }> {
  const nextAttempt = attemptCount + 1;
  const retryable = nextAttempt < MAX_VIDEO_JOB_ATTEMPTS;
  const nextRetryAt = retryable ? new Date(Date.now() + retryBackoffMs(attemptCount)) : null;
  await db
    .update(socialVideoJobs)
    .set({
      status: "failed",
      errorMessage: error,
      attemptCount: nextAttempt,
      nextRetryAt,
      ...(jobState !== undefined ? { jobState } : {}),
      updatedAt: new Date(),
    })
    .where(eq(socialVideoJobs.id, id));
  return { retryable, nextRetryAt };
}

/** User-initiated cancel (guarded by ownership + still-active status). */
export async function cancelVideoJob(id: string, userId: string): Promise<{ cancelled: boolean; qstashMessageId: string | null }> {
  const existing = await getVideoJob(id);
  if (!existing || existing.userId !== userId) return { cancelled: false, qstashMessageId: null };
  const result = await db
    .update(socialVideoJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(socialVideoJobs.id, id),
        eq(socialVideoJobs.userId, userId),
        inArray(socialVideoJobs.status, ACTIVE_VIDEO_JOB_STATUSES),
      ),
    );
  return { cancelled: (result.rowCount ?? 0) > 0, qstashMessageId: existing.qstashMessageId ?? null };
}

/**
 * Stale/stuck jobs the reconcile backstop should nudge back onto QStash:
 * pending that never ticked, or processing/failed past their retry gate.
 */
export async function getStaleJobs(limit = 25): Promise<VideoJobRow[]> {
  const now = new Date();
  const staleBefore = new Date(Date.now() - STALE_MS);
  return db
    .select()
    .from(socialVideoJobs)
    .where(
      or(
        and(eq(socialVideoJobs.status, "pending"), lte(socialVideoJobs.updatedAt, staleBefore)),
        and(eq(socialVideoJobs.status, "processing"), lte(socialVideoJobs.updatedAt, staleBefore)),
        and(
          eq(socialVideoJobs.status, "failed"),
          sql`${socialVideoJobs.attemptCount} < ${MAX_VIDEO_JOB_ATTEMPTS}`,
          or(sql`${socialVideoJobs.nextRetryAt} IS NULL`, lte(socialVideoJobs.nextRetryAt, now)),
        ),
      ),
    )
    .orderBy(socialVideoJobs.createdAt)
    .limit(limit);
}

export { toView as videoJobToView };
