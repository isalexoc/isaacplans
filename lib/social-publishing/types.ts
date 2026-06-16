export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "threads"
  | "google_business"
  | "tiktok"
  | "youtube";

export const ALL_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "threads",
  "google_business",
  "tiktok",
  "youtube",
];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook:        "Facebook",
  instagram:       "Instagram",
  threads:         "Threads",
  google_business: "Google Business",
  tiktok:          "TikTok",
  youtube:         "YouTube",
};

// ─── Platform metadata shapes ────────────────────────────────────────────────

export type FacebookMetadata = {
  pageId: string;
  pageName: string;
  pageAccessToken: string; // encrypted separately
};

export type InstagramMetadata = {
  igUserId: string;
  igUsername: string;
};

export type ThreadsMetadata = {
  threadsUserId: string;
};

export type GoogleBusinessMetadata = {
  accountId: string;
  locationId: string;
  locationName: string;
};

export type TikTokMetadata = {
  openId: string;
  displayName: string;
};

export type YoutubeMetadata = {
  channelId: string;
  channelTitle: string;
};

export type PlatformMetadata =
  | FacebookMetadata
  | InstagramMetadata
  | ThreadsMetadata
  | GoogleBusinessMetadata
  | TikTokMetadata
  | YoutubeMetadata;

// ─── Connection ───────────────────────────────────────────────────────────────

export interface SocialConnection {
  id: string;
  userId: string;
  platform: SocialPlatform;
  status: "active" | "revoked";
  accessToken: string;          // decrypted
  refreshToken: string | null;  // decrypted
  tokenExpiresAt: Date | null;
  platformUserId: string | null;
  platformAccountName: string | null;
  platformMetadata: PlatformMetadata | null;
  connectedAt: Date;
  updatedAt: Date;
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export type PublishStatus = "pending" | "publishing" | "published" | "failed" | "cancelled";

export interface ScheduledPost {
  id: string;
  userId: string;
  sanityPostId: string;
  sanityPostTitle: string | null;
  platform: SocialPlatform;
  locale: string;
  scheduledFor: Date;
  publishedAt: Date | null;
  status: PublishStatus;
  platformPostId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  nextRetryAt: Date | null;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}
