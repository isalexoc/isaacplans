# Current Feature

Blog Generation from YouTube — Phase 3

## Status

In Progress

## Goals

Translate the `GeneratedBlogContent` (English) to Spanish, upload the YouTube thumbnail to Sanity as an image asset, and publish both language posts to Sanity CMS as drafts linked via `relatedPost`.

**Phases:**

- [x] Phase 1: YouTube data extraction (transcript + metadata)
- [x] Phase 2: OpenAI content generation (transcript → structured English blog post)
- [ ] Phase 3: Spanish translation + Sanity publishing (bilingual pair, thumbnail → Sanity asset)
- [ ] Phase 4: Admin UI (URL input, review/edit, one-click publish)
- [ ] Phase 5: Polish (regeneration controls, CTA auto-detection, batch processing)

## Notes

Full spec in `context/features/blog-generation-spec-phase-3.md`.

Phase 3 deliverables:

- `lib/blog-generator/types.ts` — append `TranslatedBlogContent`, `SanityPublishResult`, `PublishRequest/Response`
- `lib/blog-generator/translator.ts` — OpenAI translation service (EN → ES, single API call)
- `lib/blog-generator/sanity-publisher.ts` — thumbnail upload to Sanity + bilingual post creation
- `app/api/admin/blog-generator/publish/route.ts` — POST endpoint with Clerk auth guard

## History

- 2026-06-04: **Blog Generation from YouTube — Phase 1** completed. YouTube data extraction service (`lib/blog-generator/`), Clerk-authenticated API route (`/api/admin/blog-generator/extract`), shared TypeScript types, and CLAUDE.md. Merged to main on branch `feature/blog-generation-youtube`.
- 2026-06-04: **Blog Generation from YouTube — Phase 2** completed. OpenAI content generation service (`lib/blog-generator/content-generator.ts`), portable-text utilities extracted to `lib/blog-generator/portable-text.ts`, API route (`/api/admin/blog-generator/generate`), `openai` package added. Merged to main on branch `feature/blog-generation-phase-2`.
- 2026-06-04: Phase 3 spec written.
