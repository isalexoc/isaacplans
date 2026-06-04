# Current Feature

Blog Generation from YouTube phase 1

## Status

Completed

## Goals

Allow an authenticated admin user to paste a YouTube video URL and have the system automatically generate a professional, bilingual (English + Spanish) blog post and publish it to Sanity CMS.

**Phases:**

- [x] Phase 1: YouTube data extraction (transcript + metadata)
- [ ] Phase 2: OpenAI content generation (transcript → structured English blog post)
- [ ] Phase 3: Spanish translation + Sanity publishing (bilingual pair, thumbnail → Cloudinary)
- [ ] Phase 4: Admin UI (URL input, review/edit, one-click publish)
- [ ] Phase 5: Polish (regeneration controls, CTA auto-detection, batch processing)

## Notes

Full phase specs in `context/features/`. Phase 1 complete. Next: Phase 2 (OpenAI content generation).

Phase 1 deliverables (done):

- `lib/blog-generator/types.ts` — shared TypeScript types for all phases
- `lib/blog-generator/youtube-extractor.ts` — extraction service
- `app/api/admin/blog-generator/extract/route.ts` — POST endpoint with Clerk auth guard
- `middleware.ts` — updated matcher + passthrough for `/api/admin` routes
- New env var: `YOUTUBE_API_KEY` (fill in `.env` with YouTube Data API v3 key)

## History

- 2026-06-04: Feature scoped and phased. Phase 1 spec written.
- 2026-06-04: Phase 1 implemented. Branch: feature/blog-generation-youtube.
