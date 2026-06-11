# Social Media Content Studio — Phase 1 Spec

## Full Feature Overview (All Phases)

The **Social Media Content Studio** allows an authenticated admin user to select any existing piece of content (blog post or lead magnet from Sanity) or enter a topic directly, and automatically generate a complete social media post package — platform-specific copy in English and Spanish for Facebook, Instagram, TikTok, Threads, and Google Business Profile; branded creative images (1:1 square and 9:16 vertical); and a TikTok/Reel video script. The entire package is designed to copy-paste directly into Metricool for scheduling across all platforms at once. No design tools, no manual copywriting, no translation effort.

**Content cascade model:** one blog post or lead magnet → one click → full post package for all 5 platforms in both languages with images and script.

**Planned phases:**
- **Phase 1 (this doc):** TypeScript types + Sanity `socialPost` schema — the data model all other phases depend on
- **Phase 2:** Content source API — fetch blog posts and lead magnets from Sanity as source options; extract + normalize content for AI input
- **Phase 3:** AI copy generation — GPT-4o generates platform-specific post copy (Facebook, Instagram, TikTok, Threads, Google Business) in EN + ES
- **Phase 4:** AI image generation — branded 1:1 (1080×1080) and 9:16 (1080×1920) creatives via DALL-E 3 + Cloudinary transformation overlays
- **Phase 5:** Video script generator — 30–60 second TikTok/Reel scripts with timing marks, on-screen text, and b-roll suggestions
- **Phase 6:** Admin UI wizard — multi-step page at `/admin/social-media-studio/` covering source picker → copy editor → image preview → video script → export
- **Phase 7:** Sanity publish + content history — save generated packages to Sanity, view history list, basic content calendar

---

## Phase 1: TypeScript Types + Sanity Schema

### Goal

Define the complete data model for the Social Media Content Studio. No AI calls, no API routes, no UI — only the TypeScript contracts and the Sanity schema that all later phases depend on.

### What to Build

1. **`lib/social-media-studio/types.ts`** — all TypeScript interfaces and types used across all 7 phases
2. **`sanity/schemaTypes/socialPostType.ts`** — Sanity document schema for saved social post packages
3. Register the new schema type in **`sanity/schemaTypes/index.ts`** and **`sanity/structure.ts`**

---

### TypeScript Contract (`lib/social-media-studio/types.ts`)

```ts
// ─── Enums ────────────────────────────────────────────────────────────────────

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "threads"
  | "google_business";

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
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook:        "Facebook",
  instagram:       "Instagram",
  tiktok:          "TikTok",
  threads:         "Threads",
  google_business: "Google Business",
};

export const ALL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "threads",
  "google_business",
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
  sourceTitle?: string;          // used for DALL-E prompt context
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
  status: SocialPostStatus;
  tags?: string[];               // optional manual tags for Sanity filtering
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
```

---

### Sanity Schema (`sanity/schemaTypes/socialPostType.ts`)

Model the schema after `leadMagnetType.ts`. Use `defineType`, `defineField`, and `defineArrayMember` from `sanity`.

#### Field groups

Organize into these groups for the Sanity Studio sidebar:
- `source` — source type, title, URL, image URL, category
- `copies` — generatedCopies array (all platform × locale combinations)
- `images` — square and vertical Cloudinary URLs, image headline
- `video` — video script object
- `meta` — status, tags, createdAt, updatedAt

#### Full field definitions

```ts
import { defineType, defineField, defineArrayMember } from "sanity";

export const socialPostType = defineType({
  name: "socialPost",
  title: "Social Media Post",
  type: "document",
  groups: [
    { name: "source",  title: "Source Content" },
    { name: "copies",  title: "Generated Copy" },
    { name: "images",  title: "Creative Images" },
    { name: "video",   title: "Video Script" },
    { name: "meta",    title: "Status & Tags" },
  ],
  fields: [
    // ─── SOURCE ───────────────────────────────────────────────────────────────
    defineField({
      name: "sourceType",
      title: "Source Type",
      type: "string",
      group: "source",
      options: {
        list: [
          { title: "Blog Post",     value: "blog_post" },
          { title: "Lead Magnet",   value: "lead_magnet" },
          { title: "Direct Topic",  value: "direct_topic" },
        ],
      },
      validation: (R) => R.required(),
    }),
    defineField({
      name: "sourceId",
      title: "Source Document ID",
      type: "string",
      group: "source",
      description: "Sanity _id of the source document (blog post or lead magnet)",
      readOnly: true,
    }),
    defineField({
      name: "sourceTitle",
      title: "Source Title",
      type: "string",
      group: "source",
      validation: (R) => R.required(),
    }),
    defineField({
      name: "sourceSlug",
      title: "Source Slug",
      type: "string",
      group: "source",
      readOnly: true,
    }),
    defineField({
      name: "sourceUrl",
      title: "Source Public URL",
      type: "url",
      group: "source",
      description: "Public URL of the source content — used in post CTAs",
    }),
    defineField({
      name: "sourceImageUrl",
      title: "Source Image URL",
      type: "url",
      group: "source",
      description: "Original image URL used as base for creative generation",
      readOnly: true,
    }),
    defineField({
      name: "sourceCategory",
      title: "Insurance Category",
      type: "string",
      group: "source",
      readOnly: true,
    }),

    // ─── GENERATED COPIES ─────────────────────────────────────────────────────
    defineField({
      name: "generatedCopies",
      title: "Generated Copies",
      type: "array",
      group: "copies",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "platform", type: "string",
              options: { list: ["facebook","instagram","tiktok","threads","google_business"] } }),
            defineField({ name: "locale",   type: "string",
              options: { list: ["en","es"] } }),
            defineField({ name: "hook",     type: "text", rows: 2 }),
            defineField({ name: "body",     type: "text", rows: 4 }),
            defineField({ name: "cta",      type: "text", rows: 2 }),
            defineField({ name: "hashtags", type: "array", of: [defineArrayMember({ type: "string" })] }),
            defineField({ name: "fullPost", type: "text", rows: 8,
              description: "Assembled post ready to paste into Metricool" }),
            defineField({ name: "characterCount", type: "number" }),
          ],
          preview: {
            select: { platform: "platform", locale: "locale" },
            prepare({ platform, locale }) {
              return { title: `${platform} / ${locale}` };
            },
          },
        }),
      ],
    }),

    // ─── IMAGES ───────────────────────────────────────────────────────────────
    defineField({
      name: "squareImageUrl",
      title: "Square Image (1:1)",
      type: "url",
      group: "images",
      description: "Cloudinary URL — 1080×1080 branded image",
    }),
    defineField({
      name: "verticalImageUrl",
      title: "Vertical Image (9:16)",
      type: "url",
      group: "images",
      description: "Cloudinary URL — 1080×1920 branded image",
    }),
    defineField({
      name: "imageHeadline",
      title: "Image Headline",
      type: "string",
      group: "images",
      description: "Text overlaid on both images",
    }),

    // ─── VIDEO SCRIPT ─────────────────────────────────────────────────────────
    defineField({
      name: "videoScript",
      title: "Video Script",
      type: "object",
      group: "video",
      fields: [
        defineField({ name: "duration",         type: "number", description: "30 or 60 seconds" }),
        defineField({ name: "hookScript",       type: "text", rows: 3 }),
        defineField({ name: "fullScript",       type: "text", rows: 12 }),
        defineField({ name: "onScreenText",     type: "array", of: [defineArrayMember({ type: "string" })] }),
        defineField({ name: "brollSuggestions", type: "array", of: [defineArrayMember({ type: "string" })] }),
        defineField({ name: "voiceoverTips",    type: "text", rows: 3 }),
        defineField({ name: "suggestedCaption", type: "text", rows: 3 }),
      ],
    }),

    // ─── META ─────────────────────────────────────────────────────────────────
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      group: "meta",
      options: { list: ["draft", "published", "archived"] },
      initialValue: "draft",
      validation: (R) => R.required(),
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      group: "meta",
      of: [defineArrayMember({ type: "string" })],
    }),
    defineField({
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      group: "meta",
      readOnly: true,
    }),
    defineField({
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      group: "meta",
      readOnly: true,
    }),
  ],

  preview: {
    select: {
      title: "sourceTitle",
      subtitle: "sourceType",
    },
    prepare({ title, subtitle }) {
      const typeLabel: Record<string, string> = {
        blog_post:    "Blog Post",
        lead_magnet:  "Lead Magnet",
        direct_topic: "Topic",
      };
      return {
        title: title ?? "Untitled Social Post",
        subtitle: typeLabel[subtitle] ?? subtitle,
      };
    },
  },
});
```

---

### Register the Schema

**`sanity/schemaTypes/index.ts`** — add `socialPostType`:
```ts
import { socialPostType } from './socialPostType'

export const schemaTypes = [postType, leadMagnetType, socialPostType, stateType]
```

**`sanity/structure.ts`** — add a Social Media Posts list item using the same pattern as Lead Magnets:
```ts
S.listItem()
  .title('Social Media Posts')
  .icon(/* ShareIcon from @sanity/icons */)
  .child(
    S.documentTypeList('socialPost')
      .title('Social Media Posts')
      .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
  )
```

---

### File Structure After Phase 1

```
lib/
  social-media-studio/
    types.ts                  ← NEW
sanity/
  schemaTypes/
    socialPostType.ts         ← NEW
    index.ts                  ← updated (add socialPostType)
  structure.ts                ← updated (add Social Media Posts sidebar entry)
```

---

### Success Criteria

Phase 1 is complete when:

1. `lib/social-media-studio/types.ts` exports all types without TypeScript errors: `pnpm tsc --noEmit`
2. Sanity Studio loads without errors and shows "Social Media Posts" in the left sidebar
3. Creating a new `socialPost` document in Studio shows all 5 field groups with all fields correctly rendered
4. A `socialPost` document can be saved in Studio with `sourceTitle` and `status` populated
5. `pnpm build` passes with no new errors

---

## References

**Existing files to read before implementing:**
- `sanity/schemaTypes/leadMagnetType.ts` — field group pattern, defineType/defineField/defineArrayMember usage, readOnly fields, preview config
- `sanity/schemaTypes/index.ts` — where to register the new type
- `sanity/structure.ts` — where to add the sidebar entry; replicate the Lead Magnets pattern
- `lib/lead-magnet-generator/types.ts` — type file structure to follow (enums, interfaces, API response shapes)
