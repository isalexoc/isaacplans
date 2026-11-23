import { pgTable, text, timestamp, boolean, integer, index, uniqueIndex, jsonb, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { LeaveBehindQuoteData } from "@/lib/leave-behind-clients";
import type { IntakeData } from "@/lib/iul-intake/schema";
import type { AcaIntakeData } from "@/lib/aca-intake/schema";
import type { FeIntakeData } from "@/lib/fe-intake/schema";
import type { IntakeData as EngineIntakeData } from "@/lib/intake-core/types";
import type { StructuredCallSummary } from "@/lib/call-summary-structured";
import type {
  CallAnalysis,
  CallMetrics,
  SpeakerMap,
  Turn,
} from "@/lib/call-study/types";
import type { SensitiveSpan, UnmaskedRun } from "@/lib/call-study/sensitive";
import type {
  SocialVideoJobState,
  SocialVideoJobInput,
  SocialVideoImagesResult,
} from "@/lib/social-media-studio/video-job-types";
import type {
  IllustrationExtraction,
  PresentationData,
} from "@/lib/illustration-studio/types";
import type { PhoneFinderRunSummary } from "@/lib/phone-finder/pipeline";
import type { AcaConfirmationSnapshot, SignatureStroke } from "@/lib/aca-confirmation/types";

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
  /**
   * When a client last submitted SSN/bank details through a secure capture link.
   *
   * Lives on the session rather than on `iulSecureCaptures` so the autosave hot path can read it
   * for free — `getIntakeByToken` already selects this row, and the PATCH handler needs it on
   * every save to know whether it is inside the grace window that stops a half-typed agent value
   * from overwriting what the client just sent.
   */
  sensitiveCapturedAt: timestamp("sensitive_captured_at"),
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
 * One-shot links that let a client type their own SSN and bank details on their own phone.
 *
 * Exists because some clients will read those numbers out loud on a call and some will not, and
 * the second group used to be a dead end. The agent generates a link, sends it through the CRM,
 * and watches the last four digits appear on their screen as the client fills it in.
 *
 * **Separate table, not a column on the session, for two independent reasons.** The capture link
 * must be a different credential from the intake link — reusing the session token would hand the
 * client's phone read/write access to the whole application. And `iulIntakeSessions.data` is
 * rewritten wholesale on every ~1s autosave, so capture state living there would race the
 * agent's own typing, which is the exact bug this feature exists to avoid.
 *
 * **No `data` column** — captured values go straight into the session, encrypted. One system of
 * record; a second encrypted copy of an SSN is a second thing to protect and forget to purge.
 *
 * **No `expiresAt`** — validity is `status = 'pending'` AND the parent session not being
 * completed. That is "valid until the application is finished" expressed structurally rather
 * than as a date somebody has to keep renewing.
 */
export const iulSecureCaptures = pgTable("iul_secure_captures", {
  id:           text("id").primaryKey(), // nanoid
  /** Its own credential — longer than the intake token because this one gets texted. */
  token:        text("token").notNull(),
  /**
   * `iulIntakeSessions.id`, deliberately not the session token: `resetIntakeLink` rotates that
   * token, and keying on it would orphan every live capture the moment an agent reset a link.
   */
  sessionId:    text("session_id").notNull(),
  ownerUserId:  text("owner_user_id").notNull(),
  status:       text("status").notNull().default("pending"), // pending|submitted|cancelled
  /**
   * The field keys this link may write, snapshotted when it was issued. Frozen on purpose — a
   * later code change must not retroactively widen what an already-sent link can do.
   */
  fieldKeys:    jsonb("field_keys").notNull().$type<string[]>().default([]),
  openedAt:     timestamp("opened_at"),
  submittedAt:  timestamp("submitted_at"),
  cancelledAt:  timestamp("cancelled_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("iul_capture_token_unique_idx").on(t.token),
  sessionIdx:     index("iul_capture_session_idx").on(t.sessionId, t.status),
}));

/**
 * Links that let a client photograph or upload their own documents from their phone.
 *
 * A sibling of `iulSecureCaptures` rather than a `kind` column on it, and the difference in
 * lifecycle is the whole reason. That table's link is **single use**: the first successful submit
 * closes it, which is exactly right for four numbers typed once. A document link is the opposite —
 * the agent does not know upfront whether they need a driver's licence, a green card, both sides of
 * one card, or a page the client forgot — so this one **stays open until it is revoked or the
 * application completes**, and accepts as many files as the client sends across as many visits as
 * they need.
 *
 * Threading two lifecycles through one table would mean an `if (kind === …)` inside the single-use
 * check that protects an SSN link, which is the last place in this feature that should grow a
 * branch.
 *
 * **No file contents and no URLs here.** Uploads land in the intake session's existing
 * `attachmentOther` list, the same place a document dropped into the agent's own Documents step
 * goes, so there is one list of a client's documents rather than two that have to be reconciled.
 * This table holds only the state machine: who issued the link, whether it is live, and enough
 * counters for the agent's panel to say "3 documents received".
 */
export const iulDocumentCaptures = pgTable("iul_document_captures", {
  id:           text("id").primaryKey(), // nanoid
  /** Its own credential, as long as the secure-capture token: this one gets texted too. */
  token:        text("token").notNull(),
  /** `iulIntakeSessions.id`, not the session token, which `resetIntakeLink` rotates. */
  sessionId:    text("session_id").notNull(),
  ownerUserId:  text("owner_user_id").notNull(),
  /** pending|cancelled. There is deliberately no "submitted": the link stays open. */
  status:       text("status").notNull().default("pending"),
  /** How many files have arrived, so the panel can report progress without reading the session. */
  uploadCount:  integer("upload_count").notNull().default(0),
  openedAt:     timestamp("opened_at"),
  lastUploadAt: timestamp("last_upload_at"),
  cancelledAt:  timestamp("cancelled_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("iul_doc_capture_token_unique_idx").on(t.token),
  sessionIdx:     index("iul_doc_capture_session_idx").on(t.sessionId, t.status),
}));

/**
 * CrankWheel meeting links minted from inside this app.
 *
 * Exists because CrankWheel's own in-page CRM button does not render on LeadConnector custom
 * domains, so the agent cannot start a screen share from a contact page. Pressing a button here
 * instead sidesteps the whole problem: the domain is ours.
 *
 * **Not a column on `iul_intake_sessions`.** A meeting can be started for any CRM contact, with or
 * without an intake — that is the point of the standalone launcher — so `sessionId` is nullable and
 * `crmContactId` is the anchor that is always present.
 *
 * **`hookSecret` is a credential, not an id.** CrankWheel calls `create_hook` / `viewer_hook` as
 * plain unauthenticated GETs with no signature, so the unguessable secret in the path is the only
 * thing standing between the callback and the open internet. The blast radius of a forged hit is
 * deliberately tiny: it can stamp two timestamps and nothing else.
 *
 * **`cwSessionId` is uniquely indexed** because the post-meeting note matches a CrankWheel session
 * to a row by presenter and time. Uniqueness is what stops two meetings from both claiming the same
 * session and posting the same note to two different contacts.
 */
export const crankwheelMeetings = pgTable("crankwheel_meetings", {
  id:            text("id").primaryKey(), // nanoid
  /** "now" = noauth link, joins with no handshake. "scheduled" = durable link, agent admits. */
  kind:          text("kind").notNull(),
  /** `iul_intake_sessions.id`, not its token, which `resetIntakeLink` rotates. Null from the launcher. */
  sessionId:     text("session_id"),
  crmContactId:  text("crm_contact_id"),
  ownerUserId:   text("owner_user_id").notNull(), // agent Clerk id
  // Snapshot so the launcher can list past meetings without re-reading the CRM.
  contactName:   text("contact_name"),
  contactEmail:  text("contact_email"),
  contactPhone:  text("contact_phone"),
  locale:        text("locale").default("en"), // en|es — sets the viewer page language via hl=
  /** The viewer URL, with `hl` already rewritten to the client's language. */
  url:           text("url").notNull(),
  /** The `c=` parameter, needed to revoke the link. */
  uid:           text("uid"),
  hookSecret:    text("hook_secret").notNull(),
  /** active | superseded | revoked | ended */
  status:        text("status").notNull().default("active"),
  /** When a "now" link stops skipping the handshake. Null for scheduled links, which do not expire. */
  expiresAt:     timestamp("expires_at"),
  /** Stamped by create_hook — the agent actually started sharing. */
  sessionStartedAt: timestamp("session_started_at"),
  /** Stamped by viewer_hook — the client actually turned up. */
  viewerJoinedAt:   timestamp("viewer_joined_at"),
  sentAt:        timestamp("sent_at"),
  cwSessionId:   integer("cw_session_id"),
  durationSeconds: integer("duration_seconds"),
  /** Set once the CRM note lands, which is what makes the note job idempotent. */
  notePostedAt:  timestamp("note_posted_at"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  hookSecretUniqueIdx: uniqueIndex("crankwheel_hook_secret_unique_idx").on(t.hookSecret),
  cwSessionUniqueIdx:  uniqueIndex("crankwheel_cw_session_unique_idx").on(t.cwSessionId),
  sessionIdx:          index("crankwheel_session_idx").on(t.sessionId, t.status),
  contactIdx:          index("crankwheel_contact_idx").on(t.crmContactId, t.createdAt),
  ownerIdx:            index("crankwheel_owner_idx").on(t.ownerUserId, t.createdAt),
}));

/**
 * Recorded sales calls uploaded to be studied and mined for script material.
 *
 * The artifact this table exists to produce is a **readable dialogue** — "Will: ... / Dennis: ..." —
 * not a subtitle file. Everything about the shape follows from that.
 *
 * **`turns`, not the raw word stream.** ElevenLabs returns one object per word; a two-hour call is
 * roughly 20,000 of them and several megabytes of JSON. Merged into speaker turns the same content
 * is a fraction of the size and still carries the timings every metric needs, so the word stream is
 * converted on arrival and never stored.
 *
 * **`speakerMap` kept apart from `turns`.** Renaming a speaker rewrites a two-entry object instead
 * of every line of the transcript: instant, and structurally incapable of corrupting the dialogue.
 *
 * **`elevenRequestId` is uniquely indexed** because it is the only thing the inbound webhook has to
 * find this row by.
 */
export const callStudyRecordings = pgTable("call_study_recordings", {
  id:              text("id").primaryKey(), // nanoid
  ownerUserId:     text("owner_user_id").notNull(), // agent Clerk id
  title:           text("title").notNull(),
  sourceFilename:  text("source_filename"),
  /** Cloudinary id of the uploaded original; audio and video both land as resource_type "video". */
  cloudinaryPublicId: text("cloudinary_public_id"),
  /** The audio-only delivery URL handed to Scribe — an .mp3 even when the upload was an mp4. */
  audioUrl:        text("audio_url"),
  durationSeconds: integer("duration_seconds"),
  sizeBytes:       integer("size_bytes"),
  languageCode:    text("language_code"),
  /** ElevenLabs request/transcription id. The webhook's only way back to this row. */
  elevenRequestId: text("eleven_request_id"),
  /**
   * The OTHER id ElevenLabs returns, and the only one `GET /speech-to-text/transcripts/{id}` accepts.
   *
   * The async ack carries both — a 32-hex `request_id` (which is what the webhook body echoes, so
   * it is what the inbound lookup must key on) and a 20-character `transcription_id`. They are not
   * interchangeable: fetching by the request id returns 404, which silently made the reconcile
   * backstop incapable of recovering anything at all.
   */
  elevenTranscriptionId: text("eleven_transcription_id"),
  /** uploaded | transcribing | transcribed | analyzing | ready | failed */
  status:          text("status").notNull().default("uploaded"),
  errorMessage:    text("error_message"),
  speakerMap:      jsonb("speaker_map").$type<SpeakerMap | null>(),
  turns:           jsonb("turns").$type<Turn[] | null>(),
  metrics:         jsonb("metrics").$type<CallMetrics | null>(),
  analysis:        jsonb("analysis").$type<CallAnalysis | null>(),
  /* ── Shareable copy ──────────────────────────────────────────────────────
   * A second rendering of the recording with the sensitive moments replaced by a tone, so a call
   * can be handed to another agent. The ORIGINAL in `cloudinary_public_id` is never altered: this
   * is an additional asset, uploaded `type: "authenticated"` so it cannot be fetched without a
   * signed URL. */
  /** Cloudinary id of the beeped copy. Null until one has been built. */
  shareableAudioId:   text("shareable_audio_id"),
  shareableAudioAt:   timestamp("shareable_audio_at"),
  /** idle | building | ready | failed */
  shareableStatus:    text("shareable_status").notNull().default("idle"),
  shareableError:     text("shareable_error"),
  /** Exactly what was beeped, so the agent can audit it before sending the file to anyone. */
  redactionSpans:     jsonb("redaction_spans").$type<SensitiveSpan[] | null>(),
  /**
   * Dictated numbers that detection deliberately let through, kept so the review panel can show
   * them. Context-gating trades recall for precision; hiding what it skipped would turn that
   * trade-off into a false guarantee.
   */
  unmaskedRuns:       jsonb("unmasked_runs").$type<UnmaskedRun[] | null>(),
  /** When the stored transcript text was scrubbed to match the beeped audio. */
  transcriptScrubbedAt: timestamp("transcript_scrubbed_at"),

  /** sold | not_sold | follow_up | unknown — set by the agent after listening. */
  outcome:         text("outcome").notNull().default("unknown"),
  lineOfBusiness:  text("line_of_business"),
  transcribedAt:   timestamp("transcribed_at"),
  analyzedAt:      timestamp("analyzed_at"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  requestUniqueIdx: uniqueIndex("call_study_request_unique_idx").on(t.elevenRequestId),
  ownerIdx:         index("call_study_owner_idx").on(t.ownerUserId, t.createdAt),
  statusIdx:        index("call_study_status_idx").on(t.status, t.createdAt),
}));

/**
 * Quotable lines pulled out of analysed calls — the cross-call library.
 *
 * This is the table that actually serves the goal. One call's analysis is interesting; twenty
 * calls' worth of tagged rebuttals filtered down to "price objections on IUL calls that closed" is
 * how a script gets written.
 *
 * **Outcome and line of business are deliberately NOT copied here.** They live on the recording and
 * are set after the fact, when the agent has listened and knows how it went — a denormalised copy
 * would quietly go stale the moment a call was re-tagged. The library joins instead, which at this
 * row count costs nothing.
 */
export const callStudySnippets = pgTable("call_study_snippets", {
  id:            text("id").primaryKey(), // nanoid
  recordingId:   text("recording_id").notNull(),
  ownerUserId:   text("owner_user_id").notNull(),
  /** opening | discovery | rapport | presentation | objection | rebuttal | price | trial_close | close | story */
  category:      text("category").notNull(),
  /** For objections and rebuttals: price, spouse, trust, timing, already_covered… */
  objectionType: text("objection_type"),
  speakerName:   text("speaker_name"),
  /** agent | client | other */
  speakerRole:   text("speaker_role"),
  /** Verbatim. A paraphrase would be useless as script material. */
  quote:         text("quote").notNull(),
  why:           text("why"),
  startSec:      integer("start_sec"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  recordingIdx: index("call_snippet_recording_idx").on(t.recordingId),
  ownerIdx:     index("call_snippet_owner_idx").on(t.ownerUserId, t.category),
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

/**
 * Client intake for every line of business added after the shared engine (Short Term Medical,
 * Dental & Vision, Hospital Indemnity, Life Insurance, Health Coverage Alternative).
 *
 * One table with a `lob` discriminator rather than the five more this codebase's convention would
 * have produced. The three tables above stayed separate because each grew its own bespoke `data`
 * shape and dashboard; here every line is driven by `lib/intake-configs/<lob>.ts` through one
 * engine, so the rows are structurally identical and splitting them would only multiply migrations.
 * Every query is scoped by `lob`, so one line still can never read or overwrite another's rows.
 */
export const intakeSessions = pgTable("intake_sessions", {
  id:            text("id").primaryKey(), // nanoid
  lob:           text("lob").notNull(), // LobSlug — see lib/intake-configs/index.ts
  token:         text("token").notNull(), // unguessable URL slug
  ownerUserId:   text("owner_user_id").notNull(), // agent Clerk id (creator)
  clientUserId:  text("client_user_id"), // parity with the older tables; unused by new sessions
  // Passwordless access — see lib/intake-shared/{device,access}.ts.
  clientDeviceId: text("client_device_id"),
  expiresAt:     timestamp("expires_at"), // capability links shouldn't live forever
  crmContactId:  text("crm_contact_id"), // Agent CRM (GHL) contact id
  contactName:   text("contact_name"),
  contactEmail:  text("contact_email"),
  contactPhone:  text("contact_phone"),
  status:        text("status").notNull().default("draft"), // draft|in_progress|completed
  reopenedForClient: boolean("reopened_for_client").notNull().default(false),
  data:          jsonb("data").notNull().$type<EngineIntakeData>().default({}),
  locale:        text("locale").default("en"), // en|es
  completedAt:   timestamp("completed_at"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  // Unique on token alone, not (lob, token): the token is the credential in a URL, and a
  // collision across lines would be as bad as one within a line.
  tokenUniqueIdx: uniqueIndex("intake_token_unique_idx").on(t.token),
  ownerIdx:       index("intake_owner_idx").on(t.lob, t.ownerUserId, t.updatedAt),
  deviceIdx:      index("intake_device_idx").on(t.lob, t.clientDeviceId),
  contactIdx:     index("intake_contact_idx").on(t.lob, t.crmContactId),
  statusIdx:      index("intake_status_idx").on(t.lob, t.status),
}));

/**
 * One-shot links that let a client type their own SSN/ITIN, ID number or bank details on their own
 * phone, for the shared intake engine. The IUL intake's `iulSecureCaptures`, one table over.
 *
 * Same reasoning as that table: a separate credential from the intake link (reusing the session
 * token would hand the phone the whole application), no `data` column (captured values go straight
 * into `intake_sessions.data`, encrypted, so there is one system of record), and no `expiresAt`
 * (valid while `pending` and the intake is not completed).
 *
 * **Nothing was added to `intake_sessions`.** Every engine line reads that table on every request,
 * so a new column there would break all of them if the code shipped before the migration ran. The
 * IUL table keeps a `sensitiveCapturedAt` stamp on its session for the post-capture grace window;
 * here the window is read from `submittedAt` on this table, and only when an agent's save would
 * actually change a captured value.
 */
export const intakeSecureCaptures = pgTable("intake_secure_captures", {
  id:           text("id").primaryKey(), // nanoid
  /** Its own credential — longer than the intake token because this one gets texted. */
  token:        text("token").notNull(),
  lob:          text("lob").notNull(),
  /** `intake_sessions.id`, not its token: `resetIntakeLink` rotates the token. */
  sessionId:    text("session_id").notNull(),
  ownerUserId:  text("owner_user_id").notNull(),
  status:       text("status").notNull().default("pending"), // pending|submitted|cancelled
  /** The field keys this link may write, frozen when it was issued. */
  fieldKeys:    jsonb("field_keys").notNull().$type<string[]>().default([]),
  openedAt:     timestamp("opened_at"),
  submittedAt:  timestamp("submitted_at"),
  cancelledAt:  timestamp("cancelled_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("intake_capture_token_unique_idx").on(t.token),
  sessionIdx:     index("intake_capture_session_idx").on(t.sessionId, t.status),
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

// ─── Telegram inbound IUL leads (Empiregrowth provider) ──────────────────────

/**
 * Idempotency + async job queue for IUL leads delivered over Telegram.
 *
 * Keyed `tg_<chatId>_<messageId>` so Telegram's redeliveries (which carry a NEW update_id)
 * and message edits (same message_id) both land on the same row. Mirrors
 * {@link leadsTheWayProcessed}, with two deliberate differences:
 *
 *  - The webhook persists BEFORE its feature-flag / parse gates. Telegram has no history API
 *    and discards undelivered updates after 24h, so a 200 that stores nothing loses the lead
 *    for good — unlike the email path, where the mailbox still holds the message.
 *  - `needsReview` is a BOOLEAN orthogonal to `status`, not a terminal status. A lead can be
 *    `completed` (synced, tagged, money made) and still imperfect (no email, unmatched lines).
 *    Overloading status forces a false choice between "silently dropped" and "blocked", which
 *    is how Leads the Way loses paid leads to its permanent `skipped`.
 */
export const telegramLeads = pgTable("telegram_leads", {
  leadKey: text("lead_key").primaryKey(), // "tg_<chatId>_<messageId>"
  chatId: text("chat_id"),
  messageId: text("message_id"),
  updateId: text("update_id"),
  contactId: text("contact_id"), // GHL contact id once upserted
  locationId: text("location_id"),
  phone: text("phone"), // normalized E.164
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  stateCode: text("state_code"), // 2-letter
  /** pending | processing | completed | failed | needs_review | ignored | dismissed */
  status: text("status").notNull().default("pending"),
  /** Orthogonal to status — see the note above. */
  needsReview: boolean("needs_review").notNull().default(false),
  reviewReason: text("review_reason"),
  errorMessage: text("error_message"),
  parseSource: text("parse_source"), // deterministic | openai | merged | manual
  matchedBy: text("matched_by"), // phone | email | created
  tagsAdded: jsonb("tags_added").$type<string[] | null>(),
  /** True only when this run added the tag that starts the follow-up cadence. */
  cadenceStarted: boolean("cadence_started").notNull().default(false),
  jobState: jsonb("job_state").$type<TelegramLeadJobState | null>(),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  messageAt: timestamp("message_at"), // Telegram message date
  reviewedAt: timestamp("reviewed_at"),
  reviewedByUserId: text("reviewed_by_user_id"), // Clerk id
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("telegram_leads_status_idx").on(table.status),
  needsReviewIdx: index("telegram_leads_needs_review_idx").on(table.needsReview, table.createdAt),
  phoneIdx: index("telegram_leads_phone_idx").on(table.phone),
  createdAtIdx: index("telegram_leads_created_at_idx").on(table.createdAt),
}));

export type TelegramLeadJobState = {
  step?: "parse" | "resolve" | "update" | "tag";
  /** Verbatim message text. Only ever set for allowlisted chats. */
  rawText?: string;
  /** The whole Telegram update, so a parser fix can be replayed over past leads. */
  rawUpdate?: unknown;
  /** Structured fields parsed from the message (best-effort snapshot). */
  parsed?: Record<string, string | undefined>;
  diagnostics?: {
    matchedFields?: string[];
    unmatchedLines?: string[];
    warnings?: string[];
  };
  /** Raw OpenAI JSON when the fallback ran, so the review screen can show what it proposed. */
  aiRaw?: string;
  dryRun?: boolean;
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
   * Social share preview (og:image), per language — the card usually carries text, so a Spanish
   * share and an English share need different art. Partners paste their link into WhatsApp and
   * Facebook, which is exactly where this decides whether anyone taps.
   *
   * Any https URL works; it gets normalized to 1200×630 through Cloudinary fetch, so it does not
   * have to be pre-cropped. Blank falls back to the other language, then the hero image.
   */
  ogImageUrlEn: text("og_image_url_en"),
  ogImageUrlEs: text("og_image_url_es"),
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

// ─── Illustration Studio (carrier illustration → NLG-style two-page summary) ──

/**
 * One summary per uploaded carrier illustration. The PDF itself is never stored — the browser
 * reads its text and only the result lands here: `extraction` is what the AI pulled out (grounded
 * against the PDF text, kept so the editor can re-pick chart ages), `presentation` is what the two
 * pages render and what the agent edits. The client/carrier/product columns duplicate fields of
 * `presentation` so the recent list never parses jsonb.
 */
export const illustrationSummaries = pgTable("illustration_summaries", {
  id: text("id").primaryKey(), // nanoid
  createdByUserId: text("created_by_user_id").notNull(), // Clerk id
  carrierKey: text("carrier_key").notNull(), // americo | american_amicable | fg | mutual_of_omaha | transamerica | national_life | other
  clientName: text("client_name").notNull().default(""),
  productName: text("product_name").notNull().default(""),
  sourceFileName: text("source_file_name").notNull().default(""),
  extraction: jsonb("extraction").notNull().$type<IllustrationExtraction>(),
  presentation: jsonb("presentation").notNull().$type<PresentationData>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userUpdatedIdx: index("illustration_summaries_user_updated_idx").on(t.createdByUserId, t.updatedAt),
}));


// ─── Phone Finder (other phone numbers for a GHL contact) ────────────────────

/**
 * ONE ROW PER GHL CONTACT: that contact's latest Phone Finder run.
 *
 * Keyed by contact so "one search per contact at a time" is a single
 * INSERT … ON CONFLICT (contact_id) DO UPDATE … WHERE <previous run finished> RETURNING
 * (the Neon HTTP driver has no transactions). A re-tick re-arms the row with a new runId.
 *
 * `attempt_count` is the claim's fencing token: every write after the claim matches on it, so a
 * worker presumed dead can never overwrite the one that replaced it.
 *
 * `result_text` holds the field value between the paid lookups and the CRM write, so a failed
 * write retries without paying the vendors again. It is cleared when the run finishes; `summary`
 * keeps only PII-free counts. `last_input_hash` / `last_searched_at` survive re-arms: a re-tick
 * with the same search inputs inside the cooldown does nothing.
 *
 * Status: pending | running | completed | failed | skipped
 */
export const phoneFinderRuns = pgTable("phone_finder_runs", {
  contactId: text("contact_id").primaryKey(),
  runId: text("run_id").notNull(), // "pf_<nanoid>"; QStash messages carry it
  status: text("status").notNull().default("pending"),
  /** found | none | no_match | not_enough_info | daily_limit | failed | recently_searched | contact_gone | wrong_location */
  outcome: text("outcome"),
  attemptCount: integer("attempt_count").notNull().default(0),
  resultText: text("result_text"),
  resultTags: jsonb("result_tags").$type<string[] | null>(),
  summary: jsonb("summary").$type<PhoneFinderRunSummary | null>(),
  costMills: integer("cost_mills").notNull().default(0), // estimated vendor spend, 1/1000 USD
  dailySlotDay: text("daily_slot_day"), // YYYY-MM-DD (agent tz) whose daily slot this run used
  errorMessage: text("error_message"),
  lastInputHash: text("last_input_hash"),
  lastSearchedAt: timestamp("last_searched_at"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  statusIdx: index("phone_finder_runs_status_idx").on(t.status, t.updatedAt),
}));

/** Daily spend guard: one row per agent-local day. */
export const phoneFinderDailyUsage = pgTable("phone_finder_daily_usage", {
  day: text("day").primaryKey(), // "YYYY-MM-DD" in AGENT_LOCAL_TIMEZONE
  runs: integer("runs").notNull().default(0), // searches that reached a paid vendor call
  costMills: integer("cost_mills").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Impact Health Sharing post-sale welcome ─────────────────────────────────

/**
 * ONE ROW PER GHL CONTACT: the Impact enrollment details last sent to that client.
 *
 * The values deliberately do not live on the CRM contact. They travel only in the welcome email
 * (sent by the app) and the inbound-webhook body of the texts/WhatsApp workflow run, so this row
 * (plus the note posted on the contact) is the record of what was sent. A resend overwrites the
 * values and bumps `send_count`; the card URLs let a resend reuse the card already uploaded.
 */
export const impactEnrollments = pgTable("impact_enrollments", {
  crmContactId: text("crm_contact_id").primaryKey(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  memberId: text("member_id").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(), // YYYY-MM-DD, membership start
  monthlyAmountCents: integer("monthly_amount_cents").notNull(),
  paymentDay: integer("payment_day").notNull(), // 1–31, day the monthly share is drafted
  language: text("language").notNull().default("es"), // en | es: which workflow ran
  cardPdfUrl: text("card_pdf_url"), // ID card PDF in the CRM media library (email attachment)
  cardImageUrl: text("card_image_url"), // front-over-back JPG of the card (SMS / WhatsApp)
  sendCount: integer("send_count").notNull().default(0),
  lastSentAt: timestamp("last_sent_at"),
  lastSentByUserId: text("last_sent_by_user_id"), // Clerk id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── ACA application review confirmation (CMS e-signature) ───────────────────

/**
 * ONE ROW PER SIGNING REQUEST: the record CMS requires (45 CFR 155.220(j)(2)(ii)(A)) that the
 * consumer reviewed their Marketplace eligibility application and confirmed it is accurate before
 * it was submitted. Kept at least 10 years and produced on request, so rows are append-only: every
 * new application, update or plan change gets a NEW row, and nothing here is ever overwritten
 * once signed, or deleted.
 *
 * Everything the signed document shows is snapshotted on the row (names, agent, NPN, and at
 * signing the exact text), so a later code or env change cannot alter a past record.
 *
 * `token` is the client's only credential (nanoid(32), sent to their email). The link works while
 * `status = 'pending'` and `expires_at` is in the future. Signing closes it with ONE conditional
 * UPDATE (… WHERE status = 'pending' AND expires_at > now): the Neon HTTP driver has no
 * transactions, and two taps on "Sign" must not both win.
 *
 * The post-signing steps (PDF archive, CRM Documents file, note, tag) each stamp their own
 * column, so the QStash job and the daily reconcile can resume exactly where a failure stopped.
 */
export const acaConfirmations = pgTable("aca_confirmations", {
  id: text("id").primaryKey(), // nanoid, printed on the PDF as the document ID
  token: text("token").notNull(),
  crmContactId: text("crm_contact_id").notNull(),
  acaIntakeSessionId: text("aca_intake_session_id"), // the intake row the dialog was opened from
  status: text("status").notNull().default("pending"), // pending | signed | cancelled
  language: text("language").notNull().default("es"), // en | es: the email and the link's first language
  formVersion: text("form_version").notNull(), // lib/aca-confirmation/form-text.ts
  // ── Snapshots taken when the request is issued ──
  consumerName: text("consumer_name").notNull(), // legal name as the agent entered it
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  agentName: text("agent_name").notNull(),
  agentNpn: text("agent_npn").notNull(),
  agentPhone: text("agent_phone").notNull(),
  agentEmail: text("agent_email").notNull(),
  agency: text("agency").notNull(),
  // ── The request ──
  createdByUserId: text("created_by_user_id").notNull(), // Clerk id
  requestIp: text("request_ip"),
  requestCity: text("request_city"),
  requestRegion: text("request_region"),
  requestCountry: text("request_country"),
  requestUserAgent: text("request_user_agent"),
  sendCount: integer("send_count").notNull().default(0),
  lastSentAt: timestamp("last_sent_at"),
  expiresAt: timestamp("expires_at").notNull(),
  firstViewedAt: timestamp("first_viewed_at"),
  lastViewedAt: timestamp("last_viewed_at"),
  viewCount: integer("view_count").notNull().default(0),
  // ── The signature ──
  signedAt: timestamp("signed_at"),
  signedLanguage: text("signed_language"), // en | es: the language shown when signed
  signerIp: text("signer_ip"),
  signerCity: text("signer_city"),
  signerRegion: text("signer_region"),
  signerCountry: text("signer_country"),
  signerUserAgent: text("signer_user_agent"),
  // The signer's IP matched an IP the agent used for this request: flagged on the dialog and the PDF,
  // because CMS enforcement targets agents signing for consumers. Flag only, never a refusal.
  signerIpMatchesAgent: boolean("signer_ip_matches_agent").notNull().default(false),
  signatureMethod: text("signature_method"), // drawn | typed
  signaturePng: text("signature_png"), // data:image/png;base64,… (≤300 KB)
  signatureStrokes: jsonb("signature_strokes").$type<SignatureStroke[]>(), // drawn only
  typedName: text("typed_name"), // typed only
  signedSnapshot: jsonb("signed_snapshot").$type<AcaConfirmationSnapshot>(), // the exact text signed
  evidenceSha256: text("evidence_sha256"),
  // ── After signing ──
  pdfPublicId: text("pdf_public_id"), // Cloudinary, raw + authenticated: never readable unsigned
  pdfSha256: text("pdf_sha256"),
  pdfBytes: integer("pdf_bytes"),
  pdfStoredAt: timestamp("pdf_stored_at"),
  crmFileUrl: text("crm_file_url"), // the copy in the contact's File Upload field (Documents tab)
  crmFileSavedAt: timestamp("crm_file_saved_at"),
  notePostedAt: timestamp("note_posted_at"),
  taggedAt: timestamp("tagged_at"),
  // One finalize run at a time (QStash can deliver twice; reconcile can overlap a retry).
  finalizeLeaseUntil: timestamp("finalize_lease_until"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledByUserId: text("cancelled_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("aca_confirmation_token_unique_idx").on(t.token),
  contactIdx: index("aca_confirmation_contact_idx").on(t.crmContactId, t.createdAt),
  statusIdx: index("aca_confirmation_status_idx").on(t.status, t.signedAt),
  // At most one request waiting for a signature per contact. The check in createAndSend is a
  // courtesy; this is the guarantee (two tabs or two admins sending at once).
  onePendingPerContact: uniqueIndex("aca_confirmation_one_pending_idx")
    .on(t.crmContactId)
    .where(sql`status = 'pending'`),
}));

/**
 * The signature trail: one row per thing that happened to a confirmation (created, emailed,
 * viewed, signed, cancelled, and each post-signing step). Append-only. The PDF's second page is
 * printed from it, and it records the IP, location and browser of whoever acted.
 */
export const acaConfirmationEvents = pgTable("aca_confirmation_events", {
  id: text("id").primaryKey(), // nanoid
  confirmationId: text("confirmation_id").notNull(),
  type: text("type").notNull(), // AcaConfirmationEventType
  at: timestamp("at").defaultNow().notNull(),
  ip: text("ip"),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  userAgent: text("user_agent"),
  actorUserId: text("actor_user_id"), // Clerk id for agent actions; null for the client
  detail: jsonb("detail").$type<Record<string, unknown>>(),
}, (t) => ({
  confirmationIdx: index("aca_confirmation_events_confirmation_idx").on(t.confirmationId, t.at),
}));

// ─── AI Setter (answers leads over the CRM's SMS/WhatsApp, books calls with Isaac) ──

type AiSetterLeadRecord = import("@/lib/ai-setter/types").LeadRecord;
type AiSetterMessageRecord = import("@/lib/ai-setter/types").MessageRecord;

/**
 * ONE ROW PER GHL CONTACT the AI Setter has seen: conversation state, the slots it offered, the
 * appointment it booked, and the turn fencing. lib/ai-setter/store.ts maps rows to `LeadRecord`.
 *
 * Turn fencing copies `phone_finder_runs`: the webhook arms a turn with one
 * INSERT … ON CONFLICT (contact_id) DO UPDATE … WHERE idle OR stale RETURNING run_id (only the
 * caller that armed publishes the QStash job), the consumer claims it with attempt_count + 1, and
 * every write after the claim matches (contact_id, run_id, attempt_count, turn_state = 'running'),
 * so a worker presumed dead can never overwrite the one that replaced it. The Neon HTTP driver has
 * no interactive transactions, so each guard is one statement.
 *
 * PII: only the first name is copied out of GHL (for the admin list). No phone, no message text.
 */
export const aiSetterLeads = pgTable("ai_setter_leads", {
  contactId: text("contact_id").primaryKey(),
  firstName: text("first_name"),
  status: text("status").notNull().default("active"), // active | paused | handoff | booked | stopped | opted_out
  language: text("language"), // en | es
  register: text("register"), // usted | tu
  product: text("product"), // ProductLine (lib/ai-setter/types.ts)
  leadTimezone: text("lead_timezone"), // IANA
  stateCode: text("state_code"), // 2-letter
  runId: text("run_id"), // "ais_<nanoid>"; QStash turn messages carry it
  attemptCount: integer("attempt_count").notNull().default(0), // the claim's fencing token
  turnState: text("turn_state").notNull().default("idle"), // idle | armed | running
  /** A webhook poke arrived while a turn was running: the finishing turn re-arms instead of idling. */
  pokePending: boolean("poke_pending").notNull().default(false),
  armedAt: timestamp("armed_at"),
  /** Watermark: the newest inbound GHL message id a finished turn has handled. */
  lastHandledInboundId: text("last_handled_inbound_id"),
  lastHandledInboundAt: timestamp("last_handled_inbound_at"),
  lastInboundAt: timestamp("last_inbound_at"),
  lastAiOutboundAt: timestamp("last_ai_outbound_at"),
  /** channel → ISO time the AI disclosure last went out on it. */
  disclosedChannels: jsonb("disclosed_channels").notNull().$type<AiSetterLeadRecord["disclosedChannels"]>().default({}),
  pausedUntil: timestamp("paused_until"),
  pauseReason: text("pause_reason"),
  offeredSlots: jsonb("offered_slots").notNull().$type<AiSetterLeadRecord["offeredSlots"]>().default([]),
  offeredAt: timestamp("offered_at"),
  rejectionsCount: integer("rejections_count").notNull().default(0),
  appointmentId: text("appointment_id"),
  appointmentAt: timestamp("appointment_at"),
  calendarId: text("calendar_id"),
  /** Saved BEFORE the booking POST, so a retried turn never books twice. */
  bookingIntent: jsonb("booking_intent").$type<AiSetterLeadRecord["bookingIntent"]>(),
  callNowState: text("call_now_state"), // waiting | calling | declined | timeout
  callNowRequestedAt: timestamp("call_now_requested_at"),
  turnsDay: text("turns_day"), // YYYY-MM-DD (agent tz) that turns_today counts
  turnsToday: integer("turns_today").notNull().default(0),
  threadTurns: integer("thread_turns").notNull().default(0),
  optOutPending: boolean("opt_out_pending").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  statusIdx: index("ai_setter_leads_status_idx").on(t.status, t.updatedAt),
  turnStateIdx: index("ai_setter_leads_turn_state_idx").on(t.turnState, t.updatedAt),
}));

/**
 * Every message the AI Setter drafted, sent, held or blocked, with the decision that produced it.
 *
 * Status machine: draft → approved → sending → sent | send_unknown | failed, plus the dead ends
 * stale | rejected | superseded | blocked | shadow. Every transition is one conditional UPDATE
 * (… WHERE id AND status IN (from)), so a late approval or a duplicate send job can never win twice.
 *
 * Retention: `body` / `original_body` are cleared after 90 days; the metadata (decision, tokens,
 * cost, who approved) is kept 5 years.
 */
export const aiSetterMessages = pgTable("ai_setter_messages", {
  id: text("id").primaryKey(), // "aim_<nanoid>"
  contactId: text("contact_id").notNull(),
  channel: text("channel").notNull(), // SMS | WhatsApp
  kind: text("kind").notNull(), // template | free_text
  templateId: text("template_id"),
  templateHash: text("template_hash"),
  body: text("body"), // null after the 90-day purge
  originalBody: text("original_body"), // the AI's text when Isaac edited it
  status: text("status").notNull(), // MessageStatus (lib/ai-setter/types.ts)
  intent: text("intent"),
  inReplyToInboundId: text("in_reply_to_inbound_id"),
  turnRunId: text("turn_run_id"),
  ghlMessageId: text("ghl_message_id"),
  /** Compliance decision snapshot: rule inputs + outcome. Never message text. */
  decision: jsonb("decision").$type<AiSetterMessageRecord["decision"]>(),
  guardFlags: jsonb("guard_flags").notNull().$type<string[]>().default([]),
  model: text("model"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  costMicros: integer("cost_micros").notNull().default(0), // 1/1,000,000 USD
  usedFallback: boolean("used_fallback").notNull().default(false),
  approvedBy: text("approved_by"), // Clerk id, or "telegram"
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  notBefore: timestamp("not_before"), // held for the lead's window
  expiresAt: timestamp("expires_at"), // drafts only; then → stale
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  contactIdx: index("ai_setter_messages_contact_idx").on(t.contactId, t.createdAt),
  statusIdx: index("ai_setter_messages_status_idx").on(t.status, t.createdAt),
  ghlMessageIdx: index("ai_setter_messages_ghl_message_idx").on(t.ghlMessageId),
}));

/** Append-only audit trail per lead (turns, pauses, bookings, opt-outs). `detail` never holds message text. */
export const aiSetterEvents = pgTable("ai_setter_events", {
  id: text("id").primaryKey(), // "aie_<nanoid>"
  contactId: text("contact_id").notNull(),
  type: text("type").notNull(), // "turn" rows feed the global hourly cap
  detail: jsonb("detail").$type<Record<string, unknown> | null>(),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => ({
  contactIdx: index("ai_setter_events_contact_idx").on(t.contactId, t.at),
  typeIdx: index("ai_setter_events_type_idx").on(t.type, t.at),
}));

/**
 * Opt-outs, BY PHONE (E.164) and forever: a STOP keeps that number out even if the CRM contact is
 * deleted or recreated. START / UNSTOP lifts it, stamping `lifted_at` + `lift_reason` instead of
 * deleting the row. Never purged.
 */
export const aiSetterSuppressions = pgTable("ai_setter_suppressions", {
  e164: text("e164").primaryKey(),
  scope: text("scope").notNull().default("all"), // all | sms | whatsapp
  source: text("source").notNull(), // what detected it, e.g. "stop_keyword" | "phrase" | "admin"
  rawText: text("raw_text"), // the opt-out message itself, kept as evidence
  contactId: text("contact_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  liftedAt: timestamp("lifted_at"),
  liftReason: text("lift_reason"),
});

/** Daily Claude spend guard: one row per agent-local day (same pattern as `phone_finder_daily_usage`). */
export const aiSetterDailyUsage = pgTable("ai_setter_daily_usage", {
  day: text("day").primaryKey(), // "YYYY-MM-DD" in the agent's time zone
  turns: integer("turns").notNull().default(0),
  reservedMicros: integer("reserved_micros").notNull().default(0), // in-flight reservations
  costMicros: integer("cost_micros").notNull().default(0), // settled spend
  sends: integer("sends").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Agent platform (pilot, gated off: lib/tenancy/) ──────────────────────────
//
// Migration 0046 adds these three tables and nothing else. Every read of them goes through
// lib/tenancy/, which treats a missing table as "no agent", so code that ships before
// `pnpm db:migrate 0046` behaves exactly as the single-tenant app did. Nothing was added to
// `intake_sessions`: `owner_user_id` already scopes it (see the note on `intakeSecureCaptures`).

/**
 * One row per agent (an Impact IBO using the platform): one agent = one Clerk user. Agents are
 * never Clerk `role: "admin"`; what they may do comes from this row (status, is_test) and the launch
 * gates in lib/tenancy/gates.ts.
 *
 * `clerk_user_id` is null while an invitation is pending and filled when the account is linked.
 * Postgres allows any number of NULLs under a unique index. `email` is stored lowercased (the app
 * normalizes it). `slug` follows lib/tenancy/slugs.ts.
 */
export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // nanoid
  clerkUserId: text("clerk_user_id"),
  email: text("email").notNull(), // login email, lowercased
  slug: text("slug").notNull(), // the guide's address on the product domain
  status: text("status").notNull().default("invited"), // invited | active | paused
  /** Test agents use fake data and may operate while the launch gates are off. */
  isTest: boolean("is_test").notNull().default(false),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  whatsappE164: text("whatsapp_e164"),
  contactEmail: text("contact_email"), // shown to clients; may differ from the login email
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`), // en | es
  licensed: boolean("licensed").notNull().default(false),
  licensedStates: text("licensed_states").array().notNull().default(sql`'{}'::text[]`), // 2-letter codes
  iboNumber: text("ibo_number"), // the agent's own ACN Business ID, never Isaac's
  impactReferralUrl: text("impact_referral_url"),
  defaultLocale: text("default_locale").notNull().default("en"), // en | es
  alertEmail: text("alert_email"), // where alerts go; carries no client details
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  clerkUserIdUniqueIdx: uniqueIndex("agents_clerk_user_id_unique_idx").on(t.clerkUserId),
  emailUniqueIdx: uniqueIndex("agents_email_unique_idx").on(t.email),
  slugUniqueIdx: uniqueIndex("agents_slug_unique_idx").on(t.slug),
}));

/**
 * The agreements an agent accepted (terms of service, data processing agreement), one row per
 * document version: the exact text's sha256 plus when, from where and in which browser. Evidence,
 * so deleting an agent who accepted anything is refused rather than cascading.
 */
export const agentAgreements = pgTable("agent_agreements", {
  id: text("id").primaryKey(), // nanoid
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  doc: text("doc").notNull(), // tos | dpa
  version: text("version").notNull(),
  sha256: text("sha256").notNull(), // of the exact text accepted
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
}, (t) => ({
  agentDocVersionUniqueIdx: uniqueIndex("agent_agreements_agent_doc_version_unique_idx").on(
    t.agentId,
    t.doc,
    t.version
  ),
}));

/**
 * Who touched a client's sensitive data, or tried to: reveals, decrypted views, secure-link submits,
 * exports, purges, and denials (a signed-in operator who is not the session's owner). Append-only,
 * written best-effort by lib/tenancy/audit.ts.
 *
 * Field NAMES only, never values. `session_id` is `intake_sessions.id`, not its token: the token is
 * a live credential and "Reset link" rotates it, while the id stays the same. The IP is stored as a
 * keyed hash. `impersonator_user_id` is the Clerk impersonation actor, so an impersonated session
 * is never recorded as the agent's own action.
 */
export const sensitiveAccessLog = pgTable("sensitive_access_log", {
  id: text("id").primaryKey(), // nanoid
  at: timestamp("at").defaultNow().notNull(),
  actorUserId: text("actor_user_id"), // Clerk id; null for an anonymous client
  actorRole: text("actor_role").notNull(), // admin | agent | client | system | unknown
  impersonatorUserId: text("impersonator_user_id"),
  ownerUserId: text("owner_user_id").notNull(), // the session owner's Clerk id
  sessionId: text("session_id"),
  action: text("action").notNull(), // reveal | view_decrypted | secure_submit | export | purge | denied
  fields: text("fields").array().notNull().default(sql`'{}'::text[]`), // names only
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
}, (t) => ({
  ownerAtIdx: index("sensitive_access_log_owner_at_idx").on(t.ownerUserId, t.at),
}));
