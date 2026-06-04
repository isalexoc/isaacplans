# Current Feature

Blog Generation from YouTube — Phase 4

## Status

In Progress

## Goals

Build a protected admin page that orchestrates the full Phase 1→2→3 pipeline with a multi-stage UI: URL input → extraction → generation → review & edit → publish → success.

**Phases:**

- [x] Phase 1: YouTube data extraction (transcript + metadata)
- [x] Phase 2: OpenAI content generation (transcript → structured English blog post)
- [x] Phase 3: Spanish translation + Sanity publishing (bilingual pair, thumbnail → Sanity asset)
- [ ] Phase 4: Admin UI (URL input, review/edit, one-click publish)
- [ ] Phase 5: Polish (regeneration controls, CTA auto-detection, batch processing)

## Notes

Full spec in `context/features/blog-generation-spec-phase-4.md`.

Phase 4 deliverables:

- `app/[locale]/admin/blog-generator/page.tsx` — `"use client"` page with full 6-stage pipeline UI
- `middleware.ts` — add `/admin(.*)` to `isProtectedRoute`
- `i18n/routing.ts` — add `/admin/blog-generator` pathname
- `lib/blog-generator/sanity-publisher.ts` — fix: re-convert `bodyMarkdown → bodyBlocks` at publish time so admin edits are respected

## History

- 2026-06-04: **Blog Generation from YouTube — Phase 1** completed. YouTube data extraction service (`lib/blog-generator/`), Clerk-authenticated API route (`/api/admin/blog-generator/extract`), shared TypeScript types, and CLAUDE.md. Merged to main on branch `feature/blog-generation-youtube`.
- 2026-06-04: **Blog Generation from YouTube — Phase 2** completed. OpenAI content generation service (`lib/blog-generator/content-generator.ts`), portable-text utilities extracted to `lib/blog-generator/portable-text.ts`, API route (`/api/admin/blog-generator/generate`), `openai` package added. Merged to main on branch `feature/blog-generation-phase-2`.
- 2026-06-04: **Blog Generation from YouTube — Phase 3** completed. OpenAI EN→ES translation service (`lib/blog-generator/translator.ts`), Sanity thumbnail upload + bilingual post creation (`lib/blog-generator/sanity-publisher.ts`), API route (`/api/admin/blog-generator/publish`). Posts published as drafts with `relatedPost` linking. Merged to main on branch `feature/blog-generation-phase-3`.
- 2026-06-04: Phase 4 spec written.
