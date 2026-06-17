// ─── Enums ────────────────────────────────────────────────────────────────────

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "threads"
  | "google_business"
  | "youtube";

export type SocialLocale = "en" | "es";

export type SourceType = "blog_post" | "lead_magnet" | "direct_topic";

export type SocialPostStatus = "draft" | "published" | "archived";

// ─── Platform Limits (reference constants) ────────────────────────────────────

export const PLATFORM_COPY_LIMITS: Record<SocialPlatform, { min: number; max: number }> = {
  facebook:        { min: 300, max: 600 },
  instagram:       { min: 150, max: 300 },
  tiktok:          { min: 80,  max: 150 },
  threads:         { min: 150, max: 400 },
  google_business: { min: 200, max: 350 },
  youtube:         { min: 80,  max: 200 },
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook:        "Facebook",
  instagram:       "Instagram",
  tiktok:          "TikTok",
  threads:         "Threads",
  google_business: "Google Business",
  youtube:         "YouTube",
};

export const ALL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "threads",
  "google_business",
  "youtube",
];

export const ALL_LOCALES: SocialLocale[] = ["en", "es"];

// ─── Source Content ───────────────────────────────────────────────────────────

/**
 * Normalized representation of the content piece used as input for AI generation.
 * Populated by the Phase 2 source-fetcher from Sanity blog posts, lead magnets,
 * or from a direct topic form the user types.
 */
export interface SocialPostSource {
  type: SourceType;
  id?: string;           // Sanity document _id (blog_post / lead_magnet only)
  slug?: string;         // Sanity slug.current
  title: string;
  subtitle?: string;     // blog excerpt or lead magnet subtitle
  bodyText?: string;     // extracted plain text body (max 3,000 chars — AI input)
  category?: string;     // insurance category slug (aca, final-expense, etc.)
  imageUrl?: string;     // source featured/cover image URL (Sanity CDN or Cloudinary)
  publicUrl?: string;    // public-facing URL for CTA links in posts
  locale?: SocialLocale; // source locale — determines default copy language
}

// List items returned by the Phase 2 source-list API
export interface BlogPostSummary {
  _id: string;
  title: string;
  slug: string;
  locale?: SocialLocale;
  excerpt?: string;
  category?: string;
  featuredImageUrl?: string;
  publishedAt?: string;
}

export interface LeadMagnetSummary {
  _id: string;
  title: string;
  subtitle?: string;
  slug: string;
  locale?: SocialLocale;
  category?: string;
  coverImageUrl?: string;
  publishedAt?: string;
}

// ─── Generated Copy ───────────────────────────────────────────────────────────

export interface SocialPostCopy {
  platform: SocialPlatform;
  locale: SocialLocale;
  hook: string;          // scroll-stopping first 1–2 sentences (shown before "more")
  body: string;          // main value delivery — story, stat, or education
  cta: string;           // call-to-action sentence
  hashtags: string[];    // 5–8 tags without '#' prefix (Threads/Google Business: [])
  fullPost: string;      // assembled: hook + "\n\n" + body + "\n\n" + cta + hashtags
  characterCount: number;
}

// ─── Creative Images ──────────────────────────────────────────────────────────

export interface SocialCreativeImages {
  square: string;          // Cloudinary URL — 1080×1080 (1:1) with brand overlay
  vertical: string;        // Cloudinary URL — 1080×1920 (9:16) with brand overlay
  sourceImageUrl: string;  // original image used as base before overlay
  headline: string;        // text overlaid on the images
  generatedByAI: boolean;  // true = DALL-E background; false = source image used
}

// ─── Video Script ─────────────────────────────────────────────────────────────

export interface VideoScript {
  duration: 30 | 60;
  hookScript: string;                // 0:00–0:05 opening hook lines
  fullScript: string;                // timed script with [MM:SS] scene marks
  onScreenTextSuggestions: string[]; // text graphics to display per scene
  brollSuggestions: string[];        // visual/footage suggestions for editor
  voiceoverTips: string;             // delivery coaching for recording
  suggestedCaption: string;          // TikTok/Reel caption to pair with the video
}

// ─── Generated Video (faceless assembly: images + voiceover + captions) ───────

/**
 * A single scene in the auto-generated YouTube Short. Produced by the GPT
 * "video director" step from the existing video script + creative images.
 */
export interface VideoScene {
  narration: string;       // clean spoken text for this scene (no [MM:SS] markers)
  onScreenText: string;    // short caption/headline burned over the scene
  imageConcept: string;    // photographic scene description → drives this scene's image
  imageUrl: string;        // portrait background image (Cloudinary) — filled in Phase A
}

/**
 * Render-ready storyboard handed to the JSON2Video assembly step.
 */
export interface VideoStoryboard {
  scenes: VideoScene[];
  voiceLanguage: SocialLocale; // "en" | "es" — drives ElevenLabs voice + caption lang
  durationSeconds: 30 | 60;    // target length (from the source video script)
  category?: string;           // insurance category → music + Cloudinary folder
  presenter?: boolean;         // true → composite a HeyGen AI presenter in the corner
  presenterPlacement?: "bottom-right" | "bottom-left"; // corner for the presenter (default bottom-right)
}

/**
 * A portrait image generated specifically for a video (stacked in Sanity `videoImages`).
 */
export interface VideoImage {
  url: string;
  concept: string;
  createdAt: string;
}

/**
 * Result of a completed render — the canonical Cloudinary-hosted Short.
 */
export interface GeneratedVideo {
  url: string;                 // Cloudinary mp4 URL (stable, used for YouTube upload)
  durationSeconds: number;
  projectId: string;           // JSON2Video render project id
  voiceLanguage: SocialLocale;
}

/** Status of an async JSON2Video render job. */
export type VideoRenderStatus = "running" | "done" | "error";

// ─── Full Generated Package ───────────────────────────────────────────────────

export interface GeneratedSocialPackage {
  source: SocialPostSource;
  copies: SocialPostCopy[];     // 5 platforms × 2 locales = 10 items
  images: SocialCreativeImages;
  videoScript?: VideoScript;
}

// ─── API Request Bodies ───────────────────────────────────────────────────────

export interface CopyGenerationRequest {
  source: SocialPostSource;
  platforms?: SocialPlatform[];  // default: ALL_PLATFORMS
  locales?: SocialLocale[];      // default: ALL_LOCALES
}

export interface ImageGenerationRequest {
  sourceImageUrl?: string;       // if omitted or generateNew=true, DALL-E generates
  generateNew?: boolean;         // force DALL-E even if sourceImageUrl provided
  headline: string;              // text to overlay on both image sizes
  category?: string;             // used for DALL-E prompt scene selection
  sourceTitle?: string;          // post/lead magnet title for visual concept generation
  subtitle?: string;             // post excerpt or lead magnet subtitle
  bodyText?: string;             // plain text body excerpt (first ~500 chars) for concept
  locale?: string;               // "en" = diverse American subjects; "es" = Hispanic/Latino subjects
}

export interface VideoScriptRequest {
  source: SocialPostSource;
  duration: 30 | 60;
}

export interface SocialPostPublishRequest {
  source: SocialPostSource;
  copies: SocialPostCopy[];
  images: SocialCreativeImages;
  videoScript?: VideoScript;
  videoUrl?: string;             // generated YouTube Short URL (Cloudinary mp4)
  videoImages?: VideoImage[];    // portrait images generated for the video (stacks)
  videoStoryboard?: VideoStoryboard; // active scene set used to render the video
  status: SocialPostStatus;
  tags?: string[];               // optional manual tags for Sanity filtering
}

// ─── Video generation request bodies ──────────────────────────────────────────

// Phase A — generate portrait scene images: builds the storyboard + N images.
export interface VideoImagesRequest {
  source: SocialPostSource;
  videoScript: VideoScript;
  locale?: SocialLocale;         // voice/subject language; defaults to source locale
}

export interface VideoImagesResult {
  storyboard: VideoStoryboard;   // scenes now carry imageUrl
  images: VideoImage[];
}

// Phase B — render the video from a ready storyboard.
export interface VideoRenderRequest {
  storyboard: VideoStoryboard;
  presenterVideoUrl?: string;    // HeyGen presenter clip (green bg) to chroma-key into the corner
  presenterDurationSec?: number; // presenter clip length → drives scene timing when presenter is on
}

// Regenerate a single scene image (quick re-roll or an edited concept).
export interface SingleVideoImageRequest {
  concept: string;
  category?: string;
  locale?: SocialLocale;
  sceneIndex?: number;   // history: which storyboard scene to update
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface SocialStudioSuccess<T> {
  success: true;
  data: T;
  warnings?: string[];
}

export interface SocialStudioError {
  success: false;
  error: string;
}

export type SocialStudioResponse<T> = SocialStudioSuccess<T> | SocialStudioError;

// ─── Publish Output ───────────────────────────────────────────────────────────

export interface PublishedSocialPost {
  sanityDocumentId: string;
  slug: string;
}
