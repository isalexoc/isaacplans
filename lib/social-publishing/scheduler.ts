import { nanoid } from "nanoid";
import { eq, and, lte, lt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialScheduledPosts } from "@/lib/db/schema";
import type { SocialPlatform, ScheduledPost, PublishStatus, PublishFormat } from "./types";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

function rowToScheduled(row: typeof socialScheduledPosts.$inferSelect): ScheduledPost {
  return {
    id:              row.id,
    userId:          row.userId,
    sanityPostId:    row.sanityPostId,
    sanityPostTitle: row.sanityPostTitle ?? null,
    platform:        row.platform as SocialPlatform,
    format:          (row.format as PublishFormat) ?? "post",
    locale:          row.locale,
    scheduledFor:    row.scheduledFor,
    publishedAt:     row.publishedAt ?? null,
    status:          row.status as PublishStatus,
    platformPostId:  row.platformPostId ?? null,
    errorMessage:    row.errorMessage ?? null,
    attemptCount:    row.attemptCount,
    nextRetryAt:     row.nextRetryAt ?? null,
    imageUrl:        row.imageUrl ?? null,
    videoUrl:        row.videoUrl ?? null,
    createdAt:       row.createdAt,
    updatedAt:       row.updatedAt,
  };
}

export async function createScheduledPost(params: {
  userId: string;
  sanityPostId: string;
  sanityPostTitle?: string;
  platform: SocialPlatform;
  format?: PublishFormat;
  locale: string;
  scheduledFor: Date;
  imageUrl?: string;
  videoUrl?: string;
  copySnapshot?: SocialPostCopy;
}): Promise<ScheduledPost> {
  const now = new Date();
  const row = {
    id:              nanoid(),
    userId:          params.userId,
    sanityPostId:    params.sanityPostId,
    sanityPostTitle: params.sanityPostTitle ?? null,
    platform:        params.platform,
    format:          params.format ?? "post",
    locale:          params.locale,
    scheduledFor:    params.scheduledFor,
    publishedAt:     null,
    status:          "pending" as PublishStatus,
    platformPostId:  null,
    errorMessage:    null,
    attemptCount:    0,
    nextRetryAt:     null,
    copySnapshot:    params.copySnapshot ?? null,
    imageUrl:        params.imageUrl ?? null,
    videoUrl:        params.videoUrl ?? null,
    createdAt:       now,
    updatedAt:       now,
  };
  await db.insert(socialScheduledPosts).values(row);
  return rowToScheduled(row as typeof socialScheduledPosts.$inferSelect);
}

/** Get posts due for processing: pending/failed posts where scheduledFor <= now and nextRetryAt <= now. */
export async function getDuePosts(limit = 10): Promise<ScheduledPost[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(socialScheduledPosts)
    .where(
      and(
        inArray(socialScheduledPosts.status, ["pending", "failed"]),
        lte(socialScheduledPosts.scheduledFor, now),
        // nextRetryAt is either null (first attempt) or in the past
      )
    )
    .limit(limit);

  // Filter in JS for the retry-at check (avoids complex OR query)
  return rows
    .filter((r) => !r.nextRetryAt || r.nextRetryAt <= now)
    .filter((r) => r.attemptCount < 3)
    .map(rowToScheduled);
}

export async function markPublishing(id: string): Promise<void> {
  await db
    .update(socialScheduledPosts)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(eq(socialScheduledPosts.id, id));
}

export async function markPublished(id: string, platformPostId: string): Promise<void> {
  await db
    .update(socialScheduledPosts)
    .set({ status: "published", publishedAt: new Date(), platformPostId, updatedAt: new Date() })
    .where(eq(socialScheduledPosts.id, id));
}

export async function markFailed(id: string, error: string, attemptCount: number): Promise<void> {
  const retryDelayMs = Math.pow(2, attemptCount) * 15 * 60 * 1000; // 15m, 30m, 60m
  const nextRetryAt  = new Date(Date.now() + retryDelayMs);
  await db
    .update(socialScheduledPosts)
    .set({
      status:       attemptCount >= 2 ? "failed" : "pending", // keep retrying until 3 attempts
      errorMessage: error,
      attemptCount: attemptCount + 1,
      nextRetryAt:  attemptCount >= 2 ? null : nextRetryAt,
      updatedAt:    new Date(),
    })
    .where(eq(socialScheduledPosts.id, id));
}

export async function cancelPost(id: string, userId: string): Promise<boolean> {
  const result = await db
    .update(socialScheduledPosts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(
      eq(socialScheduledPosts.id, id),
      eq(socialScheduledPosts.userId, userId),
      inArray(socialScheduledPosts.status, ["pending"]),
    ));
  return (result.rowCount ?? 0) > 0;
}

export async function reschedulePost(id: string, userId: string, scheduledFor: Date): Promise<boolean> {
  const result = await db
    .update(socialScheduledPosts)
    .set({ scheduledFor, status: "pending", errorMessage: null, nextRetryAt: null, updatedAt: new Date() })
    .where(and(
      eq(socialScheduledPosts.id, id),
      eq(socialScheduledPosts.userId, userId),
    ));
  return (result.rowCount ?? 0) > 0;
}

export async function listScheduledPosts(userId: string): Promise<ScheduledPost[]> {
  const rows = await db
    .select()
    .from(socialScheduledPosts)
    .where(eq(socialScheduledPosts.userId, userId));
  return rows.map(rowToScheduled);
}

export async function getScheduledPostsInRange(from: Date, to: Date): Promise<ScheduledPost[]> {
  const rows = await db
    .select()
    .from(socialScheduledPosts)
    .where(
      and(
        lte(socialScheduledPosts.scheduledFor, to),
        // scheduledFor >= from — Drizzle doesn't have gte directly, use lt inverted
      )
    );
  return rows
    .filter((r) => r.scheduledFor >= from)
    .map(rowToScheduled);
}
