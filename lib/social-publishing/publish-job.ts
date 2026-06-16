import { eq } from "drizzle-orm";
import { createClient } from "next-sanity";
import { db } from "@/lib/db";
import { socialPlatformConnections, socialScheduledPosts } from "@/lib/db/schema";
import { getConnection, refreshTokenIfNeeded } from "./connection-manager";
import { getGbpLocation } from "./oauth/google";
import { publishToPlatform } from "./publishers";
import type { SocialPlatform, GoogleBusinessMetadata } from "./types";

function getSanityWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) return null;
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

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
  } catch (err) {
    console.error(`[publish-job] Token refresh failed for ${params.platform}:`, err);
    // Continue with existing token; publish will return an auth error if it's expired
  }

  // If the GBP location was not resolved during OAuth, attempt to resolve it now
  if (params.platform === "google_business") {
    const meta = freshConn.platformMetadata as GoogleBusinessMetadata | null;
    const locationId = meta?.locationId ?? freshConn.platformUserId ?? "";
    if (!locationId || locationId === "pending" || (meta as Record<string, unknown> | null)?.locationPending) {
      try {
        const loc = await getGbpLocation(freshConn.accessToken);
        await db
          .update(socialPlatformConnections)
          .set({
            platformUserId:      loc.locationId,
            platformAccountName: loc.locationName,
            platformMetadata:    loc,
            updatedAt:           new Date(),
          })
          .where(eq(socialPlatformConnections.id, freshConn.id));
        freshConn = { ...freshConn, platformUserId: loc.locationId, platformAccountName: loc.locationName, platformMetadata: loc };
        console.log("[publish-job] Resolved pending GBP location:", loc.locationId);
      } catch (err) {
        const msg = (err as Error)?.message ?? "";
        console.error("[publish-job] Failed to resolve GBP location:", err);
        if (msg.includes("Quota exceeded") || msg.includes("quota")) {
          return { success: false, error: "Google Business API rate limit hit. Wait 1–2 minutes and try publishing again." };
        }
        return { success: false, error: "Could not find your Google Business location. Please disconnect and reconnect in Connections." };
      }
    }
  }

  const result = await publishToPlatform(freshConn, params.caption, params.imageUrl);

  if (result.success && params.sanityPostId) {
    try {
      const sanity = getSanityWriteClient();
      if (sanity) {
        await sanity
          .patch(params.sanityPostId)
          .setIfMissing({ publishedPlatforms: [] })
          .insert("after", "publishedPlatforms[-1]", [params.platform])
          .set({ updatedAt: new Date().toISOString() })
          .commit({ returnDocuments: false });
      }
    } catch (err) {
      console.error("[publish-job] Failed to update publishedPlatforms in Sanity:", err);
    }
  }

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
