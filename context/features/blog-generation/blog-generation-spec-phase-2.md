# Blog Generation from YouTube — Phase 2 Spec

## Context

This is Phase 2 of a multi-phase feature that allows an admin user to paste a YouTube URL and generate a professional bilingual blog post published to Sanity CMS.

**Phase 1 (complete):** YouTube data extraction — `lib/blog-generator/youtube-extractor.ts` returns a `YouTubeExtractionResult` with transcript + metadata.

**Phase 2 (this doc):** OpenAI content generation — take the `YouTubeExtractionResult` from Phase 1 and produce a fully structured English blog post that maps directly to the Sanity schema.

**Remaining phases:**
- Phase 3: Spanish translation + Sanity publishing
- Phase 4: Admin UI
- Phase 5: Polish

---

## Phase 2: OpenAI Content Generation (English)

### Goal

Build the AI content generation layer. Accept a `YouTubeExtractionResult`, call OpenAI GPT, and return a `GeneratedBlogContent` object that is completely ready for Sanity publishing (all fields populated, body converted to Portable Text blocks). No Sanity writes yet — pure generation.

### What to Build

1. **`lib/blog-generator/portable-text.ts`** — Extract and clean up the Portable Text utilities that currently live in `scripts/create-blog-post.ts` into a reusable shared module. This avoids duplication when Phase 3 writes to Sanity.

2. **`lib/blog-generator/content-generator.ts`** — OpenAI service that accepts a `YouTubeExtractionResult` and returns `GeneratedBlogContent`.

3. **`app/api/admin/blog-generator/generate/route.ts`** — `POST /api/admin/blog-generator/generate`, Clerk-authenticated, calls the content generator.

4. **New types** added to `lib/blog-generator/types.ts`.

---

### New Types (`lib/blog-generator/types.ts`)

Append these to the existing types file:

```ts
import type { PortableTextBlock } from "@portabletext/types";

export type BlogCategory =
  | "aca"
  | "temporary-health-insurance"
  | "dental-vision"
  | "hospital-indemnity"
  | "iul"
  | "final-expense"
  | "cancer-plans"
  | "heart-stroke"
  | "general"
  | "tips-guides"
  | "news";

export interface GeneratedBlogContent {
  title: string;           // max 70 chars
  excerpt: string;         // 150–160 chars
  bodyMarkdown: string;    // markdown source (stored for debugging/re-use)
  bodyBlocks: PortableTextBlock[];  // converted Portable Text for Sanity
  category: BlogCategory;
  tags: string[];          // 6–12 tags
  readingTime: number;     // minutes
  seo: {
    metaTitle: string;     // max 60 chars
    metaDescription: string; // 120–160 chars
    focusKeyword: string;
    keywords: string[];    // 5–10 keywords
  };
}

export interface GenerateRequest {
  extraction: YouTubeExtractionResult;
}

export interface GenerateResponse {
  success: true;
  data: GeneratedBlogContent;
}

export interface GenerateErrorResponse {
  success: false;
  error: string;
}
```

`PortableTextBlock` is from the `@portabletext/types` package (already installed as a transitive dep via Sanity). If not available, define a minimal local type:

```ts
// Minimal Portable Text block type if @portabletext/types is unavailable
export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: string;
  children: Array<{ _type: "span"; _key: string; text: string; marks: string[] }>;
  markDefs: unknown[];
  listItem?: "bullet" | "number";
}
```

---

### Portable Text Utilities (`lib/blog-generator/portable-text.ts`)

Extract the following functions verbatim from `scripts/create-blog-post.ts` (lines ~14–276) and export them as named exports. Do not alter logic — just relocate:

- `generateKey(): string`
- `textToBlocks(text: string): PortableTextBlock[]`
- `createTextBlock(text: string): PortableTextBlock`
- `createHeadingBlock(text: string, level: number): PortableTextBlock`
- `createListBlocks(items: string[]): PortableTextBlock[]`
- `createSlug(title: string): string`

After extracting, update `scripts/create-blog-post.ts` to import from `@/lib/blog-generator/portable-text` instead of defining them inline, so there is no duplication:

```ts
import { textToBlocks, createSlug, generateKey } from "@/lib/blog-generator/portable-text";
```

---

### Content Generator (`lib/blog-generator/content-generator.ts`)

#### Overview

Call OpenAI with a carefully engineered prompt and parse the JSON response into `GeneratedBlogContent`. Use `response_format: { type: "json_object" }` for reliable structured output.

#### OpenAI Model

Use `process.env.OPENAI_MODEL` (already set in the project). If unset, fall back to `"gpt-4o"`.

#### System Prompt

The system prompt must instruct the model to act as a professional insurance content writer for an insurance agent's bilingual website. Key directives:

```
You are a professional insurance content writer for Isaac Plans Insurance, a bilingual insurance agency.
Your job is to transform YouTube video transcripts into authoritative, SEO-optimized blog posts that educate readers and convert them into insurance leads.

Tone: Professional, clear, empathetic. Use "you" to address the reader directly.
Brand voice: Helpful expert who simplifies insurance. Trustworthy, not salesy.
Structure: Every post must have a compelling intro, well-organized H2/H3 sections, bullet points for key info, and a soft CTA at the end (encourage readers to reach out for a free consultation — no hard sells).

Content rules:
- Only use facts explicitly stated in the transcript. Do not invent statistics, dates, or quotes.
- If the transcript is vague on a topic, write generally about that topic without fabricating specifics.
- Always relate content back to the insurance category it belongs to.
- Target U.S. readers; use USD for any dollar amounts mentioned.

Markdown format rules (will be converted to Portable Text):
- Use ## for H2, ### for H3, #### for H4 — these become Sanity heading blocks.
- Use **text** for bold — becomes a "strong" mark in Sanity spans.
- Use - for bullet lists — each item becomes a listItem block.
- Do NOT use numbered lists, blockquotes, tables, or inline code.
- Separate sections with a blank line.
- Body length: 800–1200 words.
```

#### User Prompt

Construct dynamically from `YouTubeExtractionResult`:

```
Video title: {metadata.title}
Channel: {metadata.channelName}
Published: {metadata.publishedAt}
Duration: {metadata.durationSeconds} seconds

Transcript:
{transcript}

---

Generate a complete blog post JSON with this exact structure:
{
  "title": "...",         // Compelling, SEO-optimized title, max 70 chars
  "excerpt": "...",       // 150–160 char summary for search results and cards
  "body": "...",          // Full post in the markdown format described above
  "category": "...",      // One of: aca | temporary-health-insurance | dental-vision | hospital-indemnity | iul | final-expense | cancer-plans | heart-stroke | general | tips-guides | news
  "tags": ["...", ...],   // 6–12 specific tags relevant to this post
  "readingTime": 0,       // Estimated reading time in minutes (integer)
  "seo": {
    "metaTitle": "...",       // max 60 chars, different from post title
    "metaDescription": "...", // 120–160 chars for Google snippet
    "focusKeyword": "...",    // primary keyword phrase
    "keywords": ["...", ...]  // 5–10 additional keywords
  }
}

Return only the JSON object. No markdown wrapper, no explanation.
```

#### Parsing & Conversion

After receiving the OpenAI response:

1. Parse the JSON — if parsing fails, throw a descriptive error (do not silently swallow)
2. Validate that all required fields are present
3. Enforce field constraints programmatically (do not trust the model):
   - Truncate `title` to 70 chars if over limit
   - Truncate `seo.metaTitle` to 60 chars if over limit
   - Truncate `excerpt` to 200 chars if over limit (Sanity schema limit)
   - Ensure `category` is one of the valid enum values; fall back to `"general"` if not
4. Call `textToBlocks(body)` from `lib/blog-generator/portable-text.ts` to convert the markdown body to Portable Text blocks
5. Return the full `GeneratedBlogContent` object

#### Error Handling

- `OPENAI_API_KEY` not set → throw clear config error
- OpenAI API error (rate limit, quota, network) → surface the message with context
- JSON parse failure → include the raw response in the error message for debugging
- Validation failure → throw with which field failed and what value was returned

---

### API Route (`app/api/admin/blog-generator/generate/route.ts`)

`POST /api/admin/blog-generator/generate`

**Request body:**
```json
{
  "extraction": { ... }  // YouTubeExtractionResult from Phase 1
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "title": "...",
    "excerpt": "...",
    "bodyMarkdown": "...",
    "bodyBlocks": [...],
    "category": "aca",
    "tags": [...],
    "readingTime": 7,
    "seo": { ... }
  }
}
```

**Error response (400/500):**
```json
{ "success": false, "error": "..." }
```

Set `export const maxDuration = 60` — generation typically takes 15–30 seconds.

Auth: `const { userId } = await auth()` — return 401 if missing (same pattern as other admin routes).

---

### File Structure After Phase 2

```
lib/
  blog-generator/
    types.ts                ← updated with GeneratedBlogContent + new types
    youtube-extractor.ts    ← Phase 1 (unchanged)
    portable-text.ts        ← NEW: extracted from scripts/create-blog-post.ts
    content-generator.ts    ← NEW: OpenAI generation service
app/
  api/
    admin/
      blog-generator/
        extract/
          route.ts          ← Phase 1 (unchanged)
        generate/
          route.ts          ← NEW: POST endpoint
scripts/
  create-blog-post.ts       ← updated to import from lib/blog-generator/portable-text
```

---

### Success Criteria

Phase 2 is complete when:

- `POST /api/admin/blog-generator/generate` with a valid `YouTubeExtractionResult` returns a `GenerateResponse` with all fields populated and `bodyBlocks` containing valid Portable Text
- `category` is always one of the 11 valid enum values
- `title` ≤ 70 chars, `seo.metaTitle` ≤ 60 chars, `excerpt` ≤ 200 chars (enforced post-generation)
- Route returns 401 if unauthenticated
- A short transcript (< 500 chars) returns an error rather than generating content with hallucinated details — add a minimum transcript length check (500 chars) before calling OpenAI
- `scripts/create-blog-post.ts` still compiles and works after the portable-text extraction
- TypeScript check passes: `pnpm tsc --noEmit`

---

## References

**Files to read before implementing:**

- `lib/blog-generator/types.ts` — existing types from Phase 1; append new types here
- `lib/blog-generator/youtube-extractor.ts` — Phase 1 service; `YouTubeExtractionResult` is the input to Phase 2
- `scripts/create-blog-post.ts` — contains `textToBlocks`, `createSlug`, and the `BlogPostData` interface; extract utilities to `portable-text.ts` and update imports
- `sanity/schemaTypes/postType.ts` — full Sanity blog post schema; all generated fields must align with this
- `app/api/admin/blog-generator/extract/route.ts` — auth pattern to replicate
- `middleware.ts` — `/api/admin` routes are already in the matcher from Phase 1

**Environment variables (already in project):**
- `OPENAI_API_KEY` — used for content generation
- `OPENAI_MODEL` — model ID (e.g. `gpt-4o`); fall back to `"gpt-4o"` if unset
