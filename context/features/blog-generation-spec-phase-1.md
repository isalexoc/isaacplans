# Blog Generation from YouTube — Phase 1 Spec

## Full Feature Overview (All Phases)

The complete feature allows an authenticated admin user to paste a YouTube video URL and have the system automatically generate a professional, bilingual (English + Spanish) blog post and publish it to Sanity CMS.

**Planned phases:**
- **Phase 1 (this doc):** YouTube data extraction — transcript + video metadata
- **Phase 2:** OpenAI content generation — turn transcript into a structured English blog post matching the Sanity schema
- **Phase 3:** Spanish translation + Sanity publishing — create both language documents, linked via `relatedPost`, with thumbnail uploaded to Cloudinary
- **Phase 4:** Admin UI — protected page with URL input, loading states, content review/edit, and one-click publish
- **Phase 5:** Polish — regeneration controls, CTA auto-detection, batch processing

---

## Phase 1: YouTube Data Extraction

### Goal

Build the data extraction layer that accepts a YouTube URL and returns a structured payload containing the video transcript and metadata. This is the foundation all other phases depend on. No OpenAI, no UI, no Sanity writes yet — just a reliable extraction service with a clear TypeScript contract.

### What to Build

1. A TypeScript service module `lib/blog-generator/youtube-extractor.ts` that extracts:
   - Full transcript (cleaned plain text, English preferred)
   - Video metadata: title, description, thumbnail URL, channel name, duration (seconds), published date, video ID
2. An internal API route `app/api/admin/blog-generator/extract/route.ts` that calls the service and returns the structured payload — used for testing and later consumed by Phase 2
3. Auth guard on the route using Clerk's `auth()` — only signed-in users (admin) can call it

### TypeScript Contract

Define these types in `lib/blog-generator/types.ts`. All subsequent phases will import from here.

```ts
export interface YouTubeMetadata {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  thumbnailUrl: string; // highest resolution available (maxresdefault)
  durationSeconds: number;
  publishedAt: string; // ISO date string
  url: string;
}

export interface YouTubeExtractionResult {
  metadata: YouTubeMetadata;
  transcript: string; // clean plain text, newlines between segments
  transcriptLanguage: string; // e.g. "en"
  extractedAt: string; // ISO timestamp
}

// API route response
export interface ExtractResponse {
  success: true;
  data: YouTubeExtractionResult;
}

export interface ExtractErrorResponse {
  success: false;
  error: string;
}
```

### Implementation Details

**Transcript extraction:**
Use the `youtube-transcript` npm package (`pnpm add youtube-transcript`). It scrapes auto-generated or manual captions without requiring a YouTube API key. Call `YoutubeTranscript.fetchTranscript(videoId)` and join the segments into clean plain text. Prefer English (`lang: 'en'`); fall back to the first available language if English is not found. Strip timestamps — only the text matters.

**Metadata extraction:**
Use the YouTube Data API v3 (requires `YOUTUBE_API_KEY` env var). Call the `videos.list` endpoint with `part=snippet,contentDetails` and the extracted video ID. Parse:
- `snippet.title` → title
- `snippet.description` → description (truncate to 500 chars for the payload)
- `snippet.channelTitle` → channelName
- `snippet.thumbnails.maxres.url` (fall back to `high.url`) → thumbnailUrl
- `snippet.publishedAt` → publishedAt
- `contentDetails.duration` → parse ISO 8601 duration (e.g. `PT12M34S`) to seconds

**Video ID extraction:**
Support all common YouTube URL formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

Use a regex or URL parsing utility to extract the ID. Return a clear error if the URL is not a valid YouTube URL.

**Error handling:**
Return descriptive errors for these cases:
- Invalid or non-YouTube URL
- Video not found (404 from YouTube API)
- No transcript available (private video, transcripts disabled)
- YouTube API quota exceeded

### API Route Spec

`POST /api/admin/blog-generator/extract`

**Request body:**
```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "metadata": { ... },
    "transcript": "Full transcript text...",
    "transcriptLanguage": "en",
    "extractedAt": "2026-06-04T12:00:00.000Z"
  }
}
```

**Error response (400 / 500):**
```json
{ "success": false, "error": "No transcript available for this video." }
```

### New Environment Variable

Add to `.env`:
```
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
```

Document it in `CLAUDE.md` under "Key Env Vars & Secrets".

### File Structure After Phase 1

```
lib/
  blog-generator/
    types.ts               ← shared TypeScript types for all phases
    youtube-extractor.ts   ← extraction logic (service, no HTTP)
app/
  api/
    admin/
      blog-generator/
        extract/
          route.ts         ← POST endpoint, Clerk auth guard
```

### Success Criteria

Phase 1 is complete when:
- `POST /api/admin/blog-generator/extract` with a valid YouTube URL returns a full `ExtractResponse` with non-empty transcript and all metadata fields populated
- Invalid URLs return `{ success: false, error: "..." }` with a clear message
- Videos without transcripts return a clear error (not a 500)
- The route returns 401 if the user is not authenticated via Clerk
- The `YouTubeExtractionResult` type is exported from `lib/blog-generator/types.ts` and ready to be consumed by Phase 2

---

## References

**Existing files to understand before implementing:**
- `lib/db/schema.ts` — database schema (not used in Phase 1 but context for later phases)
- `sanity/schemaTypes/postType.ts` — full blog post schema; Phase 2 will map generated content to these fields
- `scripts/create-blog-post.ts` — existing blog post creation logic; Phase 3 will adapt this
- `middleware.ts` — Clerk + next-intl middleware; ensure `/api/admin/*` routes are handled correctly (should not be blocked by locale middleware)
- `CLAUDE.md` — project overview and env var documentation to update

**External docs:**
- `youtube-transcript` npm package: https://www.npmjs.com/package/youtube-transcript
- YouTube Data API v3 `videos.list`: https://developers.google.com/youtube/v3/docs/videos/list
- YouTube API Console (to create API key): https://console.cloud.google.com/
