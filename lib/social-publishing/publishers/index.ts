import { publishToFacebook, publishFacebookReel } from "./facebook";
import { publishToInstagram, publishInstagramReel } from "./instagram";
import { publishToThreads } from "./threads";
import { publishToGoogleBusiness } from "./google-business";
import { publishToTikTok } from "./tiktok";
import { publishToYouTube } from "./youtube";
import type { SocialConnection, PublishResult, PublishFormat } from "../types";
import type { FacebookMetadata, InstagramMetadata, ThreadsMetadata, GoogleBusinessMetadata, TikTokMetadata, YoutubeMetadata } from "../types";

export async function publishToPlatform(
  conn: SocialConnection,
  caption: string,
  imageUrl: string,
  videoUrl?: string,
  format: PublishFormat = "post"
): Promise<PublishResult> {
  const asReel = format === "reel";
  switch (conn.platform) {
    case "facebook": {
      const meta = conn.platformMetadata as FacebookMetadata | null;
      const pageId    = meta?.pageId    ?? conn.platformUserId ?? "";
      const pageToken = meta?.pageAccessToken
        ? (() => { try { const { decryptToken } = require("../token-crypto"); return decryptToken(meta.pageAccessToken); } catch { return conn.accessToken; } })()
        : conn.accessToken;
      if (asReel) {
        if (!videoUrl) return { success: false, error: "A video URL is required to publish a Facebook reel" };
        return publishFacebookReel(pageId, pageToken, caption, videoUrl);
      }
      return publishToFacebook(pageId, pageToken, caption, imageUrl);
    }

    case "instagram": {
      const meta = conn.platformMetadata as InstagramMetadata | null;
      const igUserId = meta?.igUserId ?? conn.platformUserId ?? "";
      if (asReel) {
        if (!videoUrl) return { success: false, error: "A video URL is required to publish an Instagram reel" };
        return publishInstagramReel(igUserId, conn.accessToken, caption, videoUrl);
      }
      return publishToInstagram(igUserId, conn.accessToken, caption, imageUrl);
    }

    case "threads": {
      const meta = conn.platformMetadata as ThreadsMetadata | null;
      const threadsUserId = meta?.threadsUserId ?? conn.platformUserId ?? "";
      return publishToThreads(threadsUserId, conn.accessToken, caption, imageUrl);
    }

    case "google_business": {
      const meta = conn.platformMetadata as GoogleBusinessMetadata | null;
      const locationId = meta?.locationId ?? conn.platformUserId ?? "";
      return publishToGoogleBusiness(locationId, conn.accessToken, caption, imageUrl);
    }

    case "tiktok": {
      const meta = conn.platformMetadata as TikTokMetadata | null;
      const openId = meta?.openId ?? conn.platformUserId ?? "";
      return publishToTikTok(openId, conn.accessToken, caption, imageUrl, videoUrl);
    }

    case "youtube": {
      const meta = conn.platformMetadata as YoutubeMetadata | null;
      const channelId = meta?.channelId ?? conn.platformUserId ?? "";
      return publishToYouTube(channelId, conn.accessToken, caption, videoUrl ?? "");
    }

    default:
      return { success: false, error: `Unknown platform: ${conn.platform}` };
  }
}
