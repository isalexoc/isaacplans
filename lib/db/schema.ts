import { pgTable, text, timestamp, boolean, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import type { LeaveBehindQuoteData } from "@/lib/leave-behind-clients";

// Guides table - stores all available guides
export const guides = pgTable("guides", {
  id: text("id").primaryKey(),
  category: text("category").notNull(), // 'aca' | 'shortTerm' | 'dentalVision' | 'hospitalIndemnity' | 'iul' | 'finalExpense'
  title: text("title").notNull(),
  titleEs: text("title_es"), // Spanish title
  description: text("description").notNull(),
  descriptionEs: text("description_es"), // Spanish description
  thumbnail: text("thumbnail").notNull(), // Cloudinary public ID
  pdfUrl: text("pdf_url").notNull(), // Cloudinary PDF public ID or URL
  order: integer("order").default(0).notNull(), // For sorting within category
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.category),
  activeIdx: index("active_idx").on(table.active),
}));

// Guide unlocks table - tracks which users unlocked which guides
export const guideUnlocks = pgTable("guide_unlocks", {
  id: text("id").primaryKey(), // UUID or composite key
  guideId: text("guide_id").notNull().references(() => guides.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  source: text("source"), // 'meta_ads', 'organic', 'direct', etc.
  campaign: text("campaign"), // Campaign name if from ads
}, (table) => ({
  guideIdIdx: index("guide_id_idx").on(table.guideId),
  emailIdx: index("email_idx").on(table.email),
  phoneIdx: index("phone_idx").on(table.phone),
  guideEmailIdx: index("guide_email_idx").on(table.guideId, table.email),
  guidePhoneIdx: index("guide_phone_idx").on(table.guideId, table.phone),
}));

// Analytics table - for tracking guide views/downloads
export const guideAnalytics = pgTable("guide_analytics", {
  id: text("id").primaryKey(),
  guideId: text("guide_id").notNull().references(() => guides.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'view', 'download', 'unlock_attempt'
  email: text("email"),
  phone: text("phone"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  referrer: text("referrer"),
  source: text("source"),
  campaign: text("campaign"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  guideIdIdx: index("analytics_guide_id_idx").on(table.guideId),
  eventTypeIdx: index("analytics_event_type_idx").on(table.eventType),
  createdAtIdx: index("analytics_created_at_idx").on(table.createdAt),
}));

// Blog likes table - tracks user likes on blog posts
export const blogLikes = pgTable("blog_likes", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(), // Sanity post ID
  postSlug: text("post_slug").notNull(), // For easier querying
  userId: text("user_id").notNull(), // Clerk user ID
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  postIdIdx: index("blog_likes_post_id_idx").on(table.postId),
  userIdIdx: index("blog_likes_user_id_idx").on(table.userId),
  postUserUniqueIdx: uniqueIndex("blog_likes_post_user_unique_idx").on(table.postId, table.userId), // Unique constraint to prevent duplicate likes
}));

// Blog comments table - stores comments on blog posts
export const blogComments = pgTable("blog_comments", {
  id: text("id").primaryKey(), // nanoid/uuid
  postId: text("post_id").notNull(), // Sanity post ID
  postSlug: text("post_slug").notNull(), // For easier querying
  userId: text("user_id").notNull(), // Clerk user ID
  parentId: text("parent_id"), // null = top-level comment
  body: text("body").notNull(), // sanitized HTML/markdown
  status: text("status").notNull().default("approved"), // pending | approved | hidden
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => ({
  blogCommentsPostIdx: index("blog_comments_post_idx").on(table.postId),
  blogCommentsParentIdx: index("blog_comments_parent_idx").on(table.parentId),
  blogCommentsUserIdx: index("blog_comments_user_idx").on(table.userId),
}));

// Blog comment likes - tracks likes on individual comments
export const blogCommentLikes = pgTable("blog_comment_likes", {
  id: text("id").primaryKey(),
  commentId: text("comment_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  blogCommentLikesCommentIdx: index("blog_comment_likes_comment_idx").on(table.commentId),
  blogCommentLikesUserIdx: index("blog_comment_likes_user_idx").on(table.userId),
  blogCommentLikesUniqueIdx: uniqueIndex("blog_comment_likes_unique_idx").on(table.commentId, table.userId),
}));

// Blog comment flags - allows users to report problematic comments
export const blogCommentFlags = pgTable("blog_comment_flags", {
  id: text("id").primaryKey(),
  commentId: text("comment_id").notNull(),
  userId: text("user_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  blogCommentFlagsCommentIdx: index("blog_comment_flags_comment_idx").on(table.commentId),
  blogCommentFlagsUniqueIdx: uniqueIndex("blog_comment_flags_unique_idx").on(table.commentId, table.userId),
}));

// Newsletter subscribers table
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: text("id").primaryKey(), // nanoid
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed | unsubscribed
  confirmationToken: text("confirmation_token"), // for double opt-in
  unsubscribeToken: text("unsubscribe_token"), // for unsubscribe
  source: text("source"), // 'blog', 'homepage', 'newsletter-page', 'direct', etc.
  locale: text("locale").default("en"), // en | es
  confirmedAt: timestamp("confirmed_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => ({
  emailIdx: index("newsletter_email_idx").on(table.email),
  statusIdx: index("newsletter_status_idx").on(table.status),
  confirmationTokenIdx: index("newsletter_confirmation_token_idx").on(table.confirmationToken),
  unsubscribeTokenIdx: index("newsletter_unsubscribe_token_idx").on(table.unsubscribeToken),
  emailUniqueIdx: uniqueIndex("newsletter_email_unique_idx").on(table.email), // Prevent duplicates
}));

// Final expense leave-behind: agent-saved client quote data (JSON only; images generated client-side)
export const leaveBehindClients = pgTable("leave_behind_clients", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  quoteType: text("quote_type").notNull(), // package | single | compare (legacy)
  prospectName: text("prospect_name"),
  quoteData: jsonb("quote_data").notNull().$type<LeaveBehindQuoteData>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("leave_behind_clients_user_id_idx").on(table.userId),
  userUpdatedIdx: index("leave_behind_clients_user_updated_idx").on(table.userId, table.updatedAt),
}));

/** Per-agent branding for leave-behind quote image footers. */
export const leaveBehindAgentProfiles = pgTable("leave_behind_agent_profiles", {
  userId: text("user_id").primaryKey(),
  firstName: text("first_name").default("").notNull(),
  lastName: text("last_name").default("").notNull(),
  professionalTitle: text("professional_title").default("").notNull(),
  phone: text("phone").default("").notNull(),
  email: text("email").default("").notNull(),
  profileImageUrl: text("profile_image_url").default("").notNull(),
  profileImagePublicId: text("profile_image_public_id").default("").notNull(),
  companyLogoUrl: text("company_logo_url").default("").notNull(),
  companyLogoPublicId: text("company_logo_public_id").default("").notNull(),
  logoRemoveBackground: boolean("logo_remove_background").default(true).notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Tracks Agent CRM / Kixie call summaries (idempotency + async Kixie job queue). */
export const callSummaryProcessed = pgTable("call_summary_processed", {
  messageId: text("message_id").primaryKey(),
  contactId: text("contact_id").notNull(),
  locationId: text("location_id").notNull(),
  noteId: text("note_id"),
  direction: text("direction"),
  callDurationSeconds: integer("call_duration_seconds"),
  /** pending | processing | completed | failed | skipped */
  status: text("status").notNull().default("completed"),
  errorMessage: text("error_message"),
  source: text("source"),
  recordingUrl: text("recording_url"),
  jobState: jsonb("job_state").$type<CallSummaryJobState | null>(),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contactIdIdx: index("call_summary_processed_contact_id_idx").on(table.contactId),
  statusIdx: index("call_summary_processed_status_idx").on(table.status),
  processedAtIdx: index("call_summary_processed_processed_at_idx").on(table.processedAt),
  sourceStatusIdx: index("call_summary_processed_source_status_idx").on(table.source, table.status),
}));

export type CallSummaryJobState = {
  step?: "download" | "transcribe" | "summarize" | "note";
  chunksDone?: number;
  chunksTotal?: number;
  lastError?: string;
};

export type CallSummarySource = "kixie" | "ghl_workflow" | "ghl_backfill" | "ghl_native";

// ─── Social Publishing ────────────────────────────────────────────────────────

/** One row per platform per user — OAuth connection with encrypted tokens. */
export const socialPlatformConnections = pgTable("social_platform_connections", {
  id:                  text("id").primaryKey(),
  userId:              text("user_id").notNull(),
  platform:            text("platform").notNull(), // 'facebook'|'instagram'|'threads'|'google_business'|'tiktok'
  status:              text("status").notNull().default("active"), // 'active'|'revoked'
  accessToken:         text("access_token").notNull(),   // AES-256-GCM encrypted
  refreshToken:        text("refresh_token"),             // encrypted; null for FB Page tokens
  tokenExpiresAt:      timestamp("token_expires_at"),     // null = never (FB Page tokens)
  platformUserId:      text("platform_user_id"),
  platformAccountName: text("platform_account_name"),
  platformMetadata:    jsonb("platform_metadata"),        // page ID, IG user ID, GBP location, etc.
  connectedAt:         timestamp("connected_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq:    uniqueIndex("spc_user_platform_idx").on(t.userId, t.platform),
  userIdx: index("spc_user_id_idx").on(t.userId),
}));

/** Short-lived CSRF state rows for OAuth flows (10-minute TTL, single-use). */
export const socialOauthStates = pgTable("social_oauth_states", {
  state:        text("state").primaryKey(),
  userId:       text("user_id").notNull(),
  platform:     text("platform").notNull(),
  codeVerifier: text("code_verifier"),      // TikTok PKCE only
  expiresAt:    timestamp("expires_at").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

/** One row per (sanityPostId × platform) publishing job. */
export const socialScheduledPosts = pgTable("social_scheduled_posts", {
  id:              text("id").primaryKey(),
  userId:          text("user_id").notNull(),
  sanityPostId:    text("sanity_post_id").notNull(),
  sanityPostTitle: text("sanity_post_title"),
  platform:        text("platform").notNull(),
  locale:          text("locale").notNull(),
  scheduledFor:    timestamp("scheduled_for").notNull(),
  publishedAt:     timestamp("published_at"),
  status:          text("status").notNull().default("pending"), // pending|publishing|published|failed|cancelled
  platformPostId:  text("platform_post_id"),
  errorMessage:    text("error_message"),
  attemptCount:    integer("attempt_count").notNull().default(0),
  nextRetryAt:     timestamp("next_retry_at"),
  copySnapshot:    jsonb("copy_snapshot"),   // SocialPostCopy snapshot
  imageUrl:        text("image_url"),
  videoUrl:        text("video_url"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  pendingIdx: index("ssp_pending_idx").on(t.status, t.scheduledFor),
  sanityIdx:  index("ssp_sanity_idx").on(t.sanityPostId),
  userIdx:    index("ssp_user_idx").on(t.userId, t.status),
}));

