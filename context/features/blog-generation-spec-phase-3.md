# Blog Generation from YouTube — Phase 3 Spec

## Context

This is Phase 3 of a multi-phase feature that allows an admin user to paste a YouTube URL and generate a professional bilingual blog post published to Sanity CMS.

**Phase 1 (complete):** YouTube data extraction — `lib/blog-generator/youtube-extractor.ts`
**Phase 2 (complete):** OpenAI content generation — `lib/blog-generator/content-generator.ts`
**Phase 3 (this doc):** Spanish translation + Sanity publishing
**Remaining phases:**
- Phase 4: Admin UI (URL input, review/edit, one-click publish)
- Phase 5: Polish (regeneration controls, CTA auto-detection, batch processing)

---

## Phase 3: Spanish Translation + Sanity Publishing

### Goal

Take the `GeneratedBlogContent` (English) from Phase 2 and the `YouTubeExtractionResult` from Phase 1, translate all content fields to Spanish, upload the YouTube thumbnail to Sanity as an image asset, and publish both language posts to Sanity CMS as drafts — linked to each other via `relatedPost`. Return the resulting post IDs and slugs.

> **Note on thumbnail storage:** The Phase 1 overview mentioned "thumbnail → Cloudinary." After reviewing the existing codebase, blog post images are stored as Sanity assets (not Cloudinary URLs), which is required for Sanity's `image` type with hotspot support. Cloudinary is only used for the leave-behind package. Phase 3 uploads the thumbnail directly to Sanity's media library.

---

### What to Build

1. **`lib/blog-generator/translator.ts`** — OpenAI translation service: English `GeneratedBlogContent` → Spanish `TranslatedBlogContent` in a single API call.
2. **`lib/blog-generator/sanity-publisher.ts`** — Uploads thumbnail to Sanity, creates both posts, links them via `relatedPost`.
3. **`app/api/admin/blog-generator/publish/route.ts`** — `POST /api/admin/blog-generator/publish`, Clerk-authenticated.
4. **New types** appended to `lib/blog-generator/types.ts`.

---

### New Types (`lib/blog-generator/types.ts`)

```ts
export interface TranslatedBlogContent {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  bodyBlocks: PortableTextBlock[];
  tags: string[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    keywords: string[];
  };
}

export interface SanityPublishResult {
  enPostId: string;
  esPostId: string;
  enSlug: string;
  esSlug: string;
}

export interface PublishRequest {
  content: GeneratedBlogContent;
  extraction: YouTubeExtractionResult;
}

export interface PublishResponse {
  success: true;
  data: SanityPublishResult;
}

export interface PublishErrorResponse {
  success: false;
  error: string;
}
```

Note: `TranslatedBlogContent` omits `category`, `readingTime`, and `bodyBlocks` from `GeneratedBlogContent` — `category` is language-agnostic, `readingTime` is reused from the English version, and `bodyBlocks` is generated from `bodyMarkdown` after translation using `textToBlocks`.

---

### Translator (`lib/blog-generator/translator.ts`)

#### Overview

Translate all user-facing text fields from English to Spanish in a single OpenAI API call using `response_format: { type: "json_object" }`. Use Latin American Spanish, matching the brand's tone (professional, clear, empathetic).

#### Model

Use `process.env.OPENAI_MODEL ?? "gpt-4o"` — same as Phase 2.

#### System Prompt

```
You are a professional translator specializing in insurance content for a U.S.-based bilingual insurance agency targeting Spanish-speaking clients.

Translate the provided English insurance blog post fields into Latin American Spanish.

Rules:
- Maintain the exact same tone: professional, clear, empathetic, helpful.
- Preserve all markdown formatting (##, ###, **bold**, - bullets) exactly as-is in the body.
- Translate insurance terminology accurately — use terms familiar to U.S. Latino audiences (e.g., "seguro de salud", "deducible", "prima", "cobertura").
- Do NOT translate proper nouns: "ACA", "Obamacare", "Medicaid", "Medicare", "Isaac Plans Insurance", "Isaac Orraiz", plan tier names (Bronze, Silver, Gold, Platinum).
- Do NOT translate SEO keywords that are better kept in English (e.g., brand names, program names).
- Return only the JSON object with translated fields. No explanation.
```

#### User Prompt

Pass all translatable fields as a single JSON input:

```
Translate these English insurance blog post fields to Latin American Spanish:

{
  "title": "...",
  "excerpt": "...",
  "body": "...",
  "tags": [...],
  "seo": {
    "metaTitle": "...",
    "metaDescription": "...",
    "focusKeyword": "...",
    "keywords": [...]
  }
}

Return JSON with the same structure and all fields translated.
```

#### Post-Translation Processing

After receiving the translation:
1. Parse JSON — throw with raw response on failure
2. Enforce constraints (same as Phase 2):
   - `title` → truncate to 70 chars
   - `seo.metaTitle` → truncate to 60 chars
   - `excerpt` → truncate to 200 chars
3. Call `textToBlocks(body)` to generate `bodyBlocks`
4. Return `TranslatedBlogContent`

---

### Sanity Publisher (`lib/blog-generator/sanity-publisher.ts`)

#### Sanity Write Client

Create a write-enabled Sanity client inside this module (do NOT use `sanity/lib/client.ts` — that client has no write token):

```ts
import { createClient } from "next-sanity";

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});
```

Throw early if `SANITY_API_WRITE_TOKEN` is not set.

#### Thumbnail Upload

Fetch the YouTube thumbnail and upload it to Sanity's media library:

```ts
async function uploadThumbnail(thumbnailUrl: string, videoTitle: string) {
  const res = await fetch(thumbnailUrl);
  if (!res.ok) throw new Error(`Failed to fetch thumbnail: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `blog-${createSlug(videoTitle)}.jpg`;
  const asset = await writeClient.assets.upload("image", buffer, {
    filename,
    contentType: "image/jpeg",
  });
  return asset._id; // e.g. "image-abc123-1280x720-jpg"
}
```

The returned `_id` is used as the Sanity image asset reference on both posts.

#### Publishing Flow

Run in this order (thumbnail upload and translation happen in parallel in Phase 3's API route — see below):

```ts
export async function publishBilingualPost(
  enContent: GeneratedBlogContent,
  esContent: TranslatedBlogContent,
  thumbnailAssetId: string,
  extraction: YouTubeExtractionResult
): Promise<SanityPublishResult>
```

Steps inside `publishBilingualPost`:

1. Build `imageField` from the asset ID:
   ```ts
   const imageField = {
     _type: "image",
     asset: { _type: "reference", _ref: thumbnailAssetId },
     alt: enContent.title,
   };
   ```

2. Create English post (status `"draft"`):
   ```ts
   const postEn = await writeClient.create({
     _type: "post",
     locale: "en",
     title: enContent.title,
     slug: { _type: "slug", current: createSlug(enContent.title) },
     category: enContent.category,
     excerpt: enContent.excerpt,
     body: enContent.bodyBlocks,
     image: imageField,
     author: "Isaac Orraiz",
     publishedAt: new Date().toISOString(),
     status: "draft",
     featured: false,
     tags: enContent.tags,
     readingTime: enContent.readingTime,
     seo: {
       metaTitle: enContent.seo.metaTitle,
       metaDescription: enContent.seo.metaDescription,
       focusKeyword: enContent.seo.focusKeyword,
       keywords: enContent.seo.keywords,
     },
   });
   ```

3. Create Spanish post (same structure, `locale: "es"`, Spanish fields):
   ```ts
   const postEs = await writeClient.create({ /* same pattern, es fields */ });
   ```

4. Link both posts via `relatedPost` using two `.patch().set().commit()` calls in parallel:
   ```ts
   await Promise.all([
     writeClient.patch(postEn._id).set({ relatedPost: { _type: "reference", _ref: postEs._id } }).commit(),
     writeClient.patch(postEs._id).set({ relatedPost: { _type: "reference", _ref: postEn._id } }).commit(),
   ]);
   ```

5. Return:
   ```ts
   return {
     enPostId: postEn._id,
     esPostId: postEs._id,
     enSlug: createSlug(enContent.title),
     esSlug: createSlug(esContent.title),
   };
   ```

---

### API Route (`app/api/admin/blog-generator/publish/route.ts`)

`POST /api/admin/blog-generator/publish`

**Request body:**
```json
{
  "content": { ... },    // GeneratedBlogContent from Phase 2
  "extraction": { ... }  // YouTubeExtractionResult from Phase 1
}
```

**Internal flow (parallel where possible):**
```ts
// Run translation and thumbnail upload in parallel
const [esContent, thumbnailAssetId] = await Promise.all([
  translateBlogContent(content),
  uploadThumbnail(extraction.metadata.thumbnailUrl, extraction.metadata.title),
]);

// Then publish both posts
const result = await publishBilingualPost(content, esContent, thumbnailAssetId, extraction);
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "enPostId": "...",
    "esPostId": "...",
    "enSlug": "...",
    "esSlug": "..."
  }
}
```

**Error response (400/500):**
```json
{ "success": false, "error": "..." }
```

Set `export const maxDuration = 60`. Auth via Clerk `auth()` — return 401 if no `userId`.

---

### File Structure After Phase 3

```
lib/
  blog-generator/
    types.ts                ← updated with TranslatedBlogContent, SanityPublishResult, PublishRequest/Response
    youtube-extractor.ts    ← Phase 1 (unchanged)
    portable-text.ts        ← Phase 2 (unchanged)
    content-generator.ts    ← Phase 2 (unchanged)
    translator.ts           ← NEW: OpenAI translation service
    sanity-publisher.ts     ← NEW: thumbnail upload + Sanity post creation
app/
  api/
    admin/
      blog-generator/
        extract/route.ts    ← Phase 1 (unchanged)
        generate/route.ts   ← Phase 2 (unchanged)
        publish/route.ts    ← NEW: POST endpoint
```

---

### Success Criteria

Phase 3 is complete when:

- `POST /api/admin/blog-generator/publish` with valid `content` + `extraction` creates two linked Sanity posts (EN + ES) both with `status: "draft"` and returns their IDs and slugs
- Both posts appear in Sanity Studio under `/studio` as drafts
- Both posts have the YouTube thumbnail set as the featured image
- The `relatedPost` reference on each post points to the other language version
- The Spanish post has a properly translated slug (generated from the Spanish title)
- Route returns 401 if unauthenticated
- `SANITY_API_WRITE_TOKEN` not set → clear error before any API calls
- `OPENAI_API_KEY` not set → clear error before any API calls
- TypeScript check passes: `pnpm tsc --noEmit`

---

## References

**Files to read before implementing:**

- `lib/blog-generator/types.ts` — existing types; append new ones
- `lib/blog-generator/content-generator.ts` — translation follows the same OpenAI call pattern
- `lib/blog-generator/portable-text.ts` — import `textToBlocks` and `createSlug`
- `scripts/create-blog-post.ts` — reference for Sanity write client setup and post structure
- `sanity/schemaTypes/postType.ts` — full post schema; all fields set in `publishBilingualPost` must match
- `app/api/admin/blog-generator/generate/route.ts` — auth + error handling pattern to replicate

**Environment variables (already in project):**
- `OPENAI_API_KEY`, `OPENAI_MODEL` — for translation
- `SANITY_API_WRITE_TOKEN` — for Sanity writes
- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` — for Sanity client config
