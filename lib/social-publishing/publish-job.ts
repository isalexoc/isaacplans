import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialScheduledPosts } from "@/lib/db/schema";
import { getConnection, refreshTokenIfNeeded } from "./connection-manager";
import { publishToPlatform } from "./publishers";
import type { SocialPlatform } from "./types";

interface PublishJobParams {
  userId: string;
  sanityPostId: string;
  platform: SocialPlatform;
  caption: string;
  imageUrl: string;
  scheduledPostId?: string; // present for scheduled-post runs
}

interface PublishJobResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export async function runPublishJob(params: PublishJobParams): Promise<PublishJobResult> {
  const conn = await getConnection(params.userId, params.platform);
  if (!conn) {
    return { success: false, error: `No active ${params.platform} connection found` };
  }

  let freshConn = conn;
  try {
    freshConn = await refreshTokenIfNeeded(conn);
  } catch {
    // Use existing token — publish attempt will surface the auth error
  }

  const result = await publishToPlatform(freshConn, params.caption, params.imageUrl);

  if (params.scheduledPostId) {
    const now = new Date();
    if (result.success) {
      await db
        .update(socialScheduledPosts)
        .set({ status: "published", publishedAt: now, platformPostId: result.platformPostId ?? null, updatedAt: now })
        .where(eq(socialScheduledPosts.id, params.scheduledPostId));
    } else {
      await db
        .update(socialScheduledPosts)
        .set({
          status:       "failed",
          errorMessage: result.error ?? "Unknown error",
          updatedAt:    now,
        })
        .where(eq(socialScheduledPosts.id, params.scheduledPostId));
    }
  }

  return result;
}
