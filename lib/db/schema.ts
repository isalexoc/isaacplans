import { pgTable, text, timestamp, boolean, integer, index, uniqueIndex, jsonb, date } from "drizzle-orm/pg-core";
import type { LeaveBehindQuoteData } from "@/lib/leave-behind-clients";
import type { IntakeData } from "@/lib/iul-intake/schema";
import type { AcaIntakeData } from "@/lib/aca-intake/schema";
import type { FeIntakeData } from "@/lib/fe-intake/schema";
import type { StructuredCallSummary } from "@/lib/call-summary-structured";
import type {
  SocialVideoJobState,
  SocialVideoJobInput,
  SocialVideoImagesResult,
} from "@/lib/social-media-studio/video-job-types";

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
  // Legacy: background-removal option retired (logos now uploaded final); column kept to avoid a migration.
  logoRemoveBackground: boolean("logo_remove_background").default(true).notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Sale-celebration WhatsApp stickers: one row per generated sticker (agent closes a sale).
 * The rendered image is produced client-side; only the sticker's fields are stored here.
 * dailySequence is the "sale #N of the day" counter, unique-ish per (userId, saleDate).
 */
export const saleStickers = pgTable("sale_stickers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(), // Clerk userId
  clientName: text("client_name").notNull(),
  clientTitle: text("client_title").notNull().default("mr"), // mr | mrs (El Señor / La Señora)
  leadSource: text("lead_source").notNull(), // live_transfer | facebook | organic | cold | referral | returning | other
  leadSourceCustom: text("lead_source_custom"), // free text when leadSource = other
  saleType: text("sale_type").notNull(), // in_person | telesales
  language: text("language").notNull().default("en"), // en | es (per-sticker on-image language)
  saleDate: date("sale_date", { mode: "string" }).notNull(), // agent LOCAL date, YYYY-MM-DD
  dailySequence: integer("daily_sequence").notNull(), // 1..n per (userId, saleDate)
  customPhrase: text("custom_phrase"), // optional short phrase (<= 15 chars)
  extraImageUrl: text("extra_image_url"), // optional personal image (Cloudinary delivery URL)
  extraImagePublicId: text("extra_image_public_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sale_stickers_user_id_idx").on(table.userId),
  userDateIdx: index("sale_stickers_user_date_idx").on(table.userId, table.saleDate),
}));

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
  /** disposition/lineOfBusiness/followUpDateIso/structuredSummary: the AI extraction (lib/call-summary-structured.ts), persisted so the call-dashboard/metrics views can query it instead of re-parsing GHL note text. */
  disposition: text("disposition"), // sale | quoted | follow_up | appointment_set | needs_info | not_interested | no_decision | service | voicemail | other
  lineOfBusiness: text("line_of_business"), // aca | stm | dental_vision | hospital_indemnity | iul | final_expense | other
  followUpDateIso: timestamp("follow_up_date_iso"),
  structuredSummary: jsonb("structured_summary").$type<StructuredCallSummary | null>(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contactIdIdx: index("call_summary_processed_contact_id_idx").on(table.contactId),
  statusIdx: index("call_summary_processed_status_idx").on(table.status),
  processedAtIdx: index("call_summary_processed_processed_at_idx").on(table.processedAt),
  sourceStatusIdx: index("call_summary_processed_source_status_idx").on(table.source, table.status),
  dispositionIdx: index("call_summary_processed_disposition_idx").on(table.disposition),
  lineOfBusinessIdx: index("call_summary_processed_line_of_business_idx").on(table.lineOfBusiness),
  statusProcessedAtIdx: index("call_summary_processed_status_processed_at_idx").on(table.status, table.processedAt),
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
  format:          text("format").notNull().default("post"), // post|reel
  locale:          text("locale").notNull(),
  scheduledFor:    timestamp("scheduled_for").notNull(),
  publishedAt:     timestamp("published_at"),
  status:          text("status").notNull().default("pending"), // pending|publishing|published|failed|cancelled
  platformPostId:  text("platform_post_id"),
  errorMessage:    text("error_message"),
  attemptCount:    integer("attempt_count").notNull().default(0),
  nextRetryAt:     timestamp("next_retry_at"),
  qstashMessageId: text("qstash_message_id"), // QStash scheduled-delivery id (for cancel/reschedule)
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

/**
 * Durable video-generation jobs — one row per long-running generation action
 * (image build, per-scene Veo clip, final render, music). Driven by a QStash worker
 * that advances a state machine and persists `jobState` so the browser can close/refresh
 * and reattach to a running job. Mirrors `callSummaryProcessed` (status + jobState + backoff).
 * @see lib/social-media-studio/video-job-store.ts / video-job-processor.ts
 */
export const socialVideoJobs = pgTable("social_video_jobs", {
  id:              text("id").primaryKey(), // nanoid
  userId:          text("user_id").notNull(),
  sanityPostId:    text("sanity_post_id").notNull(), // socialPost._id the job is keyed on
  kind:            text("kind").notNull(),           // images | clip | render | music
  status:          text("status").notNull().default("pending"), // pending|processing|done|failed|cancelled
  category:        text("category"),
  voiceLanguage:   text("voice_language"),
  sceneIndex:      integer("scene_index"),           // clip only
  input:           jsonb("input").$type<SocialVideoJobInput | null>(),
  jobState:        jsonb("job_state").$type<SocialVideoJobState | null>(),
  resultUrl:       text("result_url"),               // final video / clip / music URL
  resultData:      jsonb("result_data").$type<SocialVideoImagesResult | null>(), // images: storyboard + stack
  errorMessage:    text("error_message"),
  attemptCount:    integer("attempt_count").notNull().default(0),
  nextRetryAt:     timestamp("next_retry_at"),
  qstashMessageId: text("qstash_message_id"),         // last scheduled continuation tick (cancel/reschedule)
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  postIdx:   index("svj_post_idx").on(t.sanityPostId, t.kind, t.status),
  statusIdx: index("svj_status_idx").on(t.status, t.nextRetryAt),
  userIdx:   index("svj_user_idx").on(t.userId, t.status),
}));

/**
 * Cross-post library of generated scene images/clips, so a new video scene can reuse an
 * existing similar image/clip instead of always paying to generate a fresh one. One row per
 * generated image; `videoClipUrl` is filled in if a Veo cinematic clip was ever animated from
 * that same image. Matching is done in application code via cosine similarity over `embedding`
 * (an OpenAI text-embedding-3-small vector of `concept`), scoped by `category`+`locale`.
 * @see lib/social-media-studio/video-asset-library.ts
 */
export const videoAssets = pgTable("video_assets", {
  id:              text("id").primaryKey(), // nanoid
  imageUrl:        text("image_url").notNull(),
  videoClipUrl:    text("video_clip_url"),          // Veo clip animating imageUrl, if one exists
  clipDurationSec: integer("clip_duration_sec"),
  concept:         text("concept").notNull(),        // the imageConcept prompt that produced imageUrl
  category:        text("category").notNull(),
  locale:          text("locale"),                   // "en" | "es" — subject demographic differs by locale
  embedding:       jsonb("embedding").notNull().$type<number[]>(),
  sourcePostId:    text("source_post_id"),
  useCount:        integer("use_count").notNull().default(0),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  categoryLocaleIdx: index("video_assets_category_locale_idx").on(t.category, t.locale),
  imageUrlUniqueIdx: uniqueIndex("video_assets_image_url_unique_idx").on(t.imageUrl),
}));

/**
 * IUL client intake: resumable, autosaving data-collection sessions.
 * `data` holds the form answers (sensitive fields encrypted at rest). The CRM contact is
 * the system of record; this table is the live working store + audit during capture.
 */
export const iulIntakeSessions = pgTable("iul_intake_sessions", {
  id:            text("id").primaryKey(), // nanoid
  token:         text("token").notNull(), // unguessable URL slug
  ownerUserId:   text("owner_user_id").notNull(), // agent Clerk id (creator)
  clientUserId:  text("client_user_id"), // legacy: bound on first client visit when sign-in was required
  // Passwordless access — see lib/intake-shared/{device,access}.ts.
  clientDeviceId: text("client_device_id"),
  expiresAt:     timestamp("expires_at"),
  crmContactId:  text("crm_contact_id"), // Agent CRM (GHL) contact id
  contactName:   text("contact_name"),
  contactEmail:  text("contact_email"),
  contactPhone:  text("contact_phone"),
  status:        text("status").notNull().default("draft"), // draft|in_progress|completed
  reopenedForClient: boolean("reopened_for_client").notNull().default(false), // admin let the client edit after submit
  data:          jsonb("data").notNull().$type<IntakeData>().default({}),
  locale:        text("locale").default("en"), // en|es
  completedAt:   timestamp("completed_at"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("iul_intake_token_unique_idx").on(t.token),
  ownerIdx:       index("iul_intake_owner_idx").on(t.ownerUserId, t.updatedAt),
  clientIdx:      index("iul_intake_client_idx").on(t.clientUserId),
  deviceIdx:      index("iul_intake_device_idx").on(t.clientDeviceId),
  contactIdx:     index("iul_intake_contact_idx").on(t.crmContactId),
}));

/**
 * ACA client intake: resumable, autosaving data-collection sessions.
 * Same shape as `iulIntakeSessions` but a separate table — the ACA `data` payload is
 * household-shaped (a `householdMembers` array with per-member documents) and the two
 * dashboards are independent, so keeping them apart avoids mixing product lines in one row.
 */
export const acaIntakeSessions = pgTable("aca_intake_sessions", {
  id:            text("id").primaryKey(), // nanoid
  token:         text("token").notNull(), // unguessable URL slug
  ownerUserId:   text("owner_user_id").notNull(), // agent Clerk id (creator)
  clientUserId:  text("client_user_id"), // legacy: bound on first client visit when sign-in was required
  // Passwordless access — see lib/intake-shared/{device,access}.ts.
  clientDeviceId: text("client_device_id"),
  expiresAt:     timestamp("expires_at"),
  crmContactId:  text("crm_contact_id"), // Agent CRM (GHL) contact id
  contactName:   text("contact_name"),
  contactEmail:  text("contact_email"),
  contactPhone:  text("contact_phone"),
  status:        text("status").notNull().default("draft"), // draft|in_progress|completed
  reopenedForClient: boolean("reopened_for_client").notNull().default(false), // admin let the client edit after submit
  data:          jsonb("data").notNull().$type<AcaIntakeData>().default({}),
  locale:        text("locale").default("en"), // en|es
  completedAt:   timestamp("completed_at"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("aca_intake_token_unique_idx").on(t.token),
  ownerIdx:       index("aca_intake_owner_idx").on(t.ownerUserId, t.updatedAt),
  clientIdx:      index("aca_intake_client_idx").on(t.clientUserId),
  deviceIdx:      index("aca_intake_device_idx").on(t.clientDeviceId),
  contactIdx:     index("aca_intake_contact_idx").on(t.crmContactId),
}));

/**
 * Final Expense client intake: resumable, autosaving data-collection sessions.
 * Same shape as `iulIntakeSessions`/`acaIntakeSessions` but a separate table, kept independent
 * so writing one line's intake can never overwrite what another line captured on the same
 * contact. Deliberately lite — see lib/fe-intake/fields.ts.
 */
export const feIntakeSessions = pgTable("fe_intake_sessions", {
  id:            text("id").primaryKey(), // nanoid
  token:         text("token").notNull(), // unguessable URL slug
  ownerUserId:   text("owner_user_id").notNull(), // agent Clerk id (creator)
  clientUserId:  text("client_user_id"), // legacy: bound on first client visit when Clerk sign-in was required
  // Passwordless access: the unguessable token is the credential, and the first browser to open
  // it claims the session via an httpOnly cookie. A forwarded/leaked link then opens to nothing.
  clientDeviceId: text("client_device_id"),
  expiresAt:     timestamp("expires_at"), // capability links shouldn't live forever
  crmContactId:  text("crm_contact_id"), // Agent CRM (GHL) contact id
  contactName:   text("contact_name"),
  contactEmail:  text("contact_email"),
  contactPhone:  text("contact_phone"),
  status:        text("status").notNull().default("draft"), // draft|in_progress|completed
  reopenedForClient: boolean("reopened_for_client").notNull().default(false), // admin let the client edit after submit
  data:          jsonb("data").notNull().$type<FeIntakeData>().default({}),
  locale:        text("locale").default("en"), // en|es
  completedAt:   timestamp("completed_at"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("fe_intake_token_unique_idx").on(t.token),
  ownerIdx:       index("fe_intake_owner_idx").on(t.ownerUserId, t.updatedAt),
  clientIdx:      index("fe_intake_client_idx").on(t.clientUserId),
  deviceIdx:      index("fe_intake_device_idx").on(t.clientDeviceId),
  contactIdx:     index("fe_intake_contact_idx").on(t.crmContactId),
}));

// ─── Leads the Way (Senior Life) email → GHL sync ─────────────────────────────

/**
 * Idempotency + async job queue for inbound "Leads the Way" order-confirmation emails.
 * One row per lead (keyed by the app's Lead Id when present, else a stable content hash).
 * Mirrors {@link callSummaryProcessed}: webhook inserts `pending`, QStash consumer claims
 * by `leadKey`, and never re-claims `completed` so duplicate deliveries are safe.
 */
export const leadsTheWayProcessed = pgTable("leads_the_way_processed", {
  leadKey: text("lead_key").primaryKey(), // "ltw_<leadId>" or "ltw_<sha256(from|subject|text)>"
  contactId: text("contact_id"), // GHL contact id once upserted
  locationId: text("location_id"),
  phone: text("phone"), // normalized E.164, for observability/lookup
  email: text("email"),
  leadId: text("lead_id"), // raw Leads the Way "Lead Id" when present
  /** pending | processing | completed | failed | skipped */
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  jobState: jsonb("job_state").$type<LeadsTheWayJobState | null>(), // raw email + parsed fields
  attemptCount: integer("attempt_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("leads_the_way_processed_status_idx").on(table.status),
  phoneIdx: index("leads_the_way_processed_phone_idx").on(table.phone),
  leadIdIdx: index("leads_the_way_processed_lead_id_idx").on(table.leadId),
}));

export type LeadsTheWayJobState = {
  step?: "parse" | "resolve" | "update" | "tag";
  /** Raw inbound email captured by the webhook so the consumer can (re)parse it. */
  rawText?: string;
  from?: string;
  subject?: string;
  /** Structured fields parsed from the email (best-effort snapshot). */
  parsed?: Record<string, string | undefined>;
  lastError?: string;
};

// ─── Missed-call SMS/WhatsApp draft notes ─────────────────────────────────────

/**
 * One row per contact per local calendar day a missed/no-answer call was drafted for.
 * `draftKey` IS the dedup mechanism: a triple-dial within the same day claims the
 * same row (attemptCount bumped, no new note); the next calendar day drafts fresh.
 */
export const missedCallDrafts = pgTable("missed_call_drafts", {
  draftKey: text("draft_key").primaryKey(), // "mcd_<contactId>_<YYYY-MM-DD local>"
  contactId: text("contact_id").notNull(),
  locationId: text("location_id").notNull(),
  noteId: text("note_id"),
  reason: text("reason"), // gate reason that triggered this, e.g. "call_status_no-answer"
  source: text("source"), // 'ghl' | 'kixie'
  lineOfBusiness: text("line_of_business"),
  language: text("language"), // en | es
  smsDraft: text("sms_draft"),
  whatsappDraft: text("whatsapp_draft"),
  /** pending | completed | failed */
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  contactIdIdx: index("missed_call_drafts_contact_id_idx").on(table.contactId),
  statusIdx: index("missed_call_drafts_status_idx").on(table.status),
  createdAtIdx: index("missed_call_drafts_created_at_idx").on(table.createdAt),
}));

// Generic admin-editable key/value settings (small config the admin can change without a
// deploy — e.g. the final-expense get-covered hero image override for A/B testing).
// Reads on public pages must be cached (unstable_cache + revalidateTag) so this does NOT
// wake Neon on every ad click; writes revalidate the tag. See lib/get-covered-fast/hero-setting.ts.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Mailing labels (printed folder/envelope labels for final expense mailers) ──

/**
 * One row per prospect we intend to mail something to. Rows arrive either by hand (admin
 * types them) or automatically the moment a lead's home address is captured — see
 * `upsertMailingLabelFromLead` in lib/mailing-labels/server.ts.
 *
 * `(source, sourceRef)` is the idempotency key for auto-created rows: re-submitting the same
 * lead updates the existing label instead of queueing a duplicate. Manual rows leave
 * `sourceRef` null, and Postgres treats NULLs as distinct, so they never collide.
 *
 * PII: name + mailing address are stored in PLAINTEXT here, because a label has to be
 * printable — unlike lib/fe-intake, which encrypts at rest. Deliberately no DOB, no health
 * answers, no SSN. Admin-only access (Clerk publicMetadata.role === "admin").
 */
export const mailingLabels = pgTable("mailing_labels", {
  id: text("id").primaryKey(), // nanoid
  source: text("source").notNull().default("manual"), // manual | fe_get_covered | fe_intake | leads_the_way
  sourceRef: text("source_ref"), // CRM contactId / intake token / leadKey — dedup key
  createdByUserId: text("created_by_user_id"), // Clerk id for manual rows; null for auto-created
  /**
   * Agent CRM (GHL) contact id, when we know it. Distinct from `sourceRef`, which is only the
   * contact id for the get-covered source. This is what lets the letter generator read the
   * contact's call-summary notes for personalization; null just means a generic letter.
   */
  crmContactId: text("crm_contact_id"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"), // apt / unit / suite
  city: text("city").notNull(),
  state: text("state").notNull(), // 2-letter
  postalCode: text("postal_code").notNull(),
  language: text("language").notNull().default("en"), // en | es — picks the tagline
  phone: text("phone"), // search/reference only; never printed on the label
  email: text("email"),
  status: text("status").notNull().default("pending"), // pending | printed | archived
  printedAt: timestamp("printed_at"),
  notes: text("notes"),
  /**
   * The personal letter that goes inside the envelope: AI-drafted from the contact's call
   * summaries, then hand-editable. Stored as plain text (one paragraph per blank-line-separated
   * block) so the agent can edit it in a textarea without fighting markup.
   */
  letterBody: text("letter_body"),
  /**
   * Which letter this person gets: `prospect` (still deciding) or `welcome` (they bought).
   * Final expense is an emotional sale and the weeks after it are when buyer's remorse and
   * chargebacks happen, so a new client gets a warm welcome rather than another pitch.
   */
  letterKind: text("letter_kind").notNull().default("prospect"), // prospect | welcome
  letterGeneratedAt: timestamp("letter_generated_at"),
  letterEditedAt: timestamp("letter_edited_at"),
  /** Human-readable note of what informed the draft, e.g. "3 call notes" or "no call history". */
  letterContext: text("letter_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("mailing_labels_status_idx").on(table.status, table.createdAt),
  sourceRefIdx: uniqueIndex("mailing_labels_source_ref_idx").on(table.source, table.sourceRef),
}));

// ─── Referral partners (co-branded landing pages + partner commission dashboards) ──

/**
 * A business that sends us clients — e.g. an immigration office whose clients need proof of
 * health coverage. Each partner owns one co-branded landing page at /partners/<slug> and one
 * read-only dashboard at /partner showing the clients we closed for them and what they earned.
 *
 * `email` is the login key: whoever signs in with Clerk using this address owns the dashboard.
 * That deliberately avoids a second source of truth — no Clerk metadata to edit per partner,
 * no invite table. Stored lowercased; matching is exact.
 *
 * The copy columns (headline/intro/audience) are what make the shared landing template feel
 * hand-built per partner. Blank falls back to the generic copy in lib/referral-partners/content.ts,
 * so a partner added in a hurry still gets a complete page.
 */
export const referralPartners = pgTable("referral_partners", {
  id: text("id").primaryKey(), // nanoid
  slug: text("slug").notNull(), // URL segment: /partners/<slug>, /socios/<slug>
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull().default(""), // the person we deal with
  contactTitle: text("contact_title").notNull().default(""), // e.g. "CEO"
  email: text("email").notNull(), // lowercased; matched against the Clerk sign-in email
  phone: text("phone"),
  website: text("website"),
  logoUrl: text("logo_url"), // shown next to ours in the co-branded header
  /**
   * Landing-page art. Both are admin-editable so swapping the photography never needs a deploy;
   * blank falls back to the placeholders in lib/referral-partners/images.ts.
   */
  heroImageUrl: text("hero_image_url"), // beside the hero headline
  sectionImageUrl: text("section_image_url"), // beside the "what they look at" block
  /**
   * Social share preview (og:image). Partners share their link on WhatsApp and Facebook, which is
   * exactly where this decides whether anyone clicks. Any https URL works — it gets normalized to
   * 1200×630 through Cloudinary fetch, so it does not have to be pre-cropped.
   */
  ogImageUrl: text("og_image_url"),
  accentColor: text("accent_color").notNull().default("#0077B6"), // hex, tints the partner page
  /**
   * Commission in basis points rather than a float — 500 = 5%. Integer math end to end means
   * a partner statement never drifts by a cent.
   */
  commissionBps: integer("commission_bps").notNull().default(500),
  defaultLocale: text("default_locale").notNull().default("es"), // en | es — page + dashboard language
  headlineEn: text("headline_en"),
  headlineEs: text("headline_es"),
  introEn: text("intro_en"),
  introEs: text("intro_es"),
  /** Why THIS partner's clients specifically need coverage (immigration, work visa, school…). */
  audienceEn: text("audience_en"),
  audienceEs: text("audience_es"),
  /**
   * Which extra sections the landing page shows. `immigration` adds the "when this matters"
   * situations block and the cost-of-being-uninsured block, both written for someone with a
   * pending case. Kept as a column rather than inferred, because the next partner might be a
   * realtor or a tax preparer and that copy would be wrong for their clients.
   */
  audienceKind: text("audience_kind").notNull().default("general"), // general | immigration
  status: text("status").notNull().default("active"), // active | paused — paused 404s the page
  notes: text("notes"), // internal only, never shown to the partner
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  slugIdx: uniqueIndex("referral_partners_slug_idx").on(t.slug),
  emailIdx: index("referral_partners_email_idx").on(t.email),
}));

/**
 * Every form submission from a partner's landing page. This is a thin mirror of what already
 * went to Agent CRM — the CRM stays the system of record for working the lead — kept here only
 * so the partner can see referral volume and conversion without being given CRM access.
 *
 * PII: name/email/phone in plaintext, same posture as mailingLabels. No health answers.
 */
export const referralPartnerLeads = pgTable("referral_partner_leads", {
  id: text("id").primaryKey(), // nanoid
  partnerId: text("partner_id")
    .notNull()
    .references(() => referralPartners.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  locale: text("locale").notNull().default("es"), // en | es
  status: text("status").notNull().default("new"), // new | contacted | closed | lost
  crmContactId: text("crm_contact_id"), // Agent CRM contact id when the push succeeded
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  partnerIdx: index("referral_partner_leads_partner_idx").on(t.partnerId, t.createdAt),
  partnerStatusIdx: index("referral_partner_leads_status_idx").on(t.partnerId, t.status),
}));

/**
 * A closed, paying client credited to a partner. Rows are created BY HAND in the admin tool
 * once the policy is actually issued — a submitted form is not a sale, and the partner is paid
 * on real premium.
 *
 * `commissionBps` is snapshotted from the partner at insert time so that changing a partner's
 * future rate never silently rewrites what past months were worth.
 * `monthlyPremiumCents` is an integer for the same reason floats are avoided above.
 */
export const referralPartnerClients = pgTable("referral_partner_clients", {
  id: text("id").primaryKey(), // nanoid
  partnerId: text("partner_id")
    .notNull()
    .references(() => referralPartners.id, { onDelete: "cascade" }),
  leadId: text("lead_id").references(() => referralPartnerLeads.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  memberCount: integer("member_count").notNull().default(1), // people on the policy
  monthlyPremiumCents: integer("monthly_premium_cents").notNull().default(0),
  commissionBps: integer("commission_bps").notNull().default(500), // snapshot of the partner rate
  status: text("status").notNull().default("active"), // active | pending | cancelled
  effectiveDate: date("effective_date", { mode: "string" }), // YYYY-MM-DD, coverage start
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  partnerIdx: index("referral_partner_clients_partner_idx").on(t.partnerId, t.createdAt),
  partnerStatusIdx: index("referral_partner_clients_status_idx").on(t.partnerId, t.status),
}));

