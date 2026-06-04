# Current Feature

Blog Generation from YouTube — Phase 5

## Status

In Progress

## Goals

Polish the blog generator with four enhancements: field-level regeneration, CTA auto-suggestion, publish status control, and batch mode.

**Phases:**

- [x] Phase 1: YouTube data extraction (transcript + metadata)
- [x] Phase 2: OpenAI content generation (transcript → structured English blog post)
- [x] Phase 3: Spanish translation + Sanity publishing (bilingual pair, thumbnail → Sanity asset)
- [x] Phase 4: Admin UI (URL input, review/edit, one-click publish)
- [x] Phase 5: Polish (regeneration controls, CTA auto-detection, batch processing)

## Notes

Full spec in `context/features/blog-generation-spec-phase-5.md`.

Phase 5 deliverables:

- `lib/blog-generator/cta-config.ts` — NEW: category → CTA mapping
- `lib/blog-generator/types.ts` — add `CTASettings`, update `PublishRequest`
- `lib/blog-generator/content-generator.ts` — add `regenerateField()` export
- `lib/blog-generator/sanity-publisher.ts` — add `cta` + `status` params to `publishBilingualPost`
- `app/api/admin/blog-generator/regenerate/route.ts` — NEW: field regeneration endpoint
- `app/api/admin/blog-generator/publish/route.ts` — pass `cta` + `status` through
- `app/[locale]/admin/blog-generator/page.tsx` — add regenerate buttons, CTA card, status toggle, batch tab

## History

- 2026-06-04: **Blog Generation from YouTube — Phase 1** completed. YouTube data extraction service (`lib/blog-generator/`), Clerk-authenticated API route (`/api/admin/blog-generator/extract`), shared TypeScript types, and CLAUDE.md. Merged to main on branch `feature/blog-generation-youtube`.
- 2026-06-04: **Blog Generation from YouTube — Phase 2** completed. OpenAI content generation service (`lib/blog-generator/content-generator.ts`), portable-text utilities extracted to `lib/blog-generator/portable-text.ts`, API route (`/api/admin/blog-generator/generate`), `openai` package added. Merged to main on branch `feature/blog-generation-phase-2`.
- 2026-06-04: **Blog Generation from YouTube — Phase 3** completed. OpenAI EN→ES translation service (`lib/blog-generator/translator.ts`), Sanity thumbnail upload + bilingual post creation (`lib/blog-generator/sanity-publisher.ts`), API route (`/api/admin/blog-generator/publish`). Posts published as drafts with `relatedPost` linking. Merged to main on branch `feature/blog-generation-phase-3`.
- 2026-06-04: **Blog Generation from YouTube — Phase 4** completed. Protected admin page at `/en/admin/blog-generator` with 6-stage pipeline UI (URL input → extract → generate → review/edit → publish → success). Middleware updated to protect `/admin` routes. Merged to main on branch `feature/blog-generation-phase-4`.
- 2026-06-04: Phase 5 spec written.
- 2026-06-04: **Blog Generation from YouTube — Phase 5** completed. Field-level regeneration (title/excerpt/body), CTA auto-suggestion with category mapping, publish status control (draft/published), and batch mode (up to 10 URLs). TypeScript check passes.
