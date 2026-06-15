import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { publishToThreads } from "./threads";
import { publishToGoogleBusiness } from "./google-business";
import { publishToTikTok } from "./tiktok";
import type { SocialConnection, PublishResult } from "../types";
import type { FacebookMetadata, InstagramMetadata, ThreadsMetadata, GoogleBusinessMetadata, TikTokMetadata } from "../types";

export async function publishToPlatform(
  conn: SocialConnection,
  caption: string,
  imageUrl: string
): Promise<PublishResult> {
  switch (conn.platform) {
    case "facebook": {
      const meta = conn.platformMetadata as FacebookMetadata | null;
      const pageId    = meta?.pageId    ?? conn.platformUserId ?? "";
      const pageToken = meta?.pageAccessToken
        ? (() => { try { const { decryptToken } = require("../token-crypto"); return decryptToken(meta.pageAccessToken); } catch { return conn.accessToken; } })()
        : conn.accessToken;
      return publishToFacebook(pageId, pageToken, caption, imageUrl);
    }

    case "instagram": {
      const meta = conn.platformMetadata as InstagramMetadata | null;
      const igUserId = meta?.igUserId ?? conn.platformUserId ?? "";
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
      return publishToTikTok(openId, conn.accessToken, caption, imageUrl);
    }

    default:
      return { success: false, error: `Unknown platform: ${conn.platform}` };
  }
}
