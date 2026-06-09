# Current Feature: Lead Magnet Generator — Phase 3

## Status

In Progress

## Goals

- `POST /api/admin/lead-magnet-generator/generate-section` with valid `outline`, `sectionIndex: 0`, and `completedSections: []` returns section content with `wordCount >= 500`
- Each subsequent call with `completedSections` populated does not repeat topics from earlier sections
- `POST /api/admin/lead-magnet-generator/generate-intro-conclusion` returns both `introduction` and `conclusion` as non-empty strings with `introductionBlocks` and `conclusionBlocks` arrays
- `contentBlocks` from both routes are valid Portable Text (each block has `_type`, `_key`, `style`, `children`)
- Both routes return 401 if unauthenticated
- `pnpm tsc --noEmit` passes
- Calling `generate-section` per section (6–8 calls) + `generate-intro-conclusion` produces a fully populated `GeneratedLeadMagnet`

## Notes

**Files to create/update:**

1. `lib/lead-magnet-generator/prompts.ts` — **extend** with: `SECTION_GENERATION_SYSTEM_PROMPT`, `buildSectionPrompt()`, `INTRO_CONCLUSION_SYSTEM_PROMPT`, `buildIntroConclusionPrompt()`
2. `lib/lead-magnet-generator/section-generator.ts` — `generateSection()` (single section, markdown → Portable Text, `wordCount >= 500` enforced) + `generateIntroConclusion()` (JSON mode, both fields → Portable Text)
3. `app/api/admin/lead-magnet-generator/generate-section/route.ts` — Clerk auth, `maxDuration = 60`, validates `outline`/`sectionIndex`/`completedSections`
4. `app/api/admin/lead-magnet-generator/generate-intro-conclusion/route.ts` — Clerk auth, `maxDuration = 60`, validates `generatedContent.outline` and `generatedContent.sections`

**Key implementation details:**
- `generateSection()`: no `response_format` JSON mode — plain completion, `max_tokens: 2000`; use `textToBlocks()` from `lib/blog-generator/portable-text.ts`
- `generateIntroConclusion()`: use `response_format: { type: "json_object" }`; parse `{ introduction, conclusion }` then convert both to Portable Text
- Reuse `textToBlocks()` — do not duplicate logic
- OpenAI model: `process.env.OPENAI_MODEL ?? "gpt-4o"`

## History

- 2026-06-09: **Lead Magnet Generator — Phase 2** completed. `lib/lead-magnet-generator/prompts.ts` — `LEAD_MAGNET_SYSTEM_PROMPT` + `buildOutlinePrompt()` user prompt builder. `lib/lead-magnet-generator/outline-generator.ts` — `generateLeadMagnetOutline()` calls OpenAI with `response_format: { type: "json_object" }`, validates and normalizes all fields (title ≤80 chars, subtitle ≤160 chars, category override from input, keyBenefits sliced to 5, sections 6–8 enforced, word/page counts recomputed locally). `app/api/admin/lead-magnet-generator/generate-outline/route.ts` — Clerk-authenticated POST, `maxDuration = 30`, returns 401 for unauthenticated and 400 for missing `OPENAI_API_KEY`. Merged to main on branch `feature/lead-magnet-generator-phase-2`.
- 2026-06-09: **Lead Magnet Generator — Phase 1** completed. `sanity/schemaTypes/leadMagnetType.ts` — full Sanity document schema with 6 field groups (identity, content, leadForm, seo, generation, dates) and 18 fields; registered in `sanity/schemaTypes/index.ts`; custom sidebar entry added to `sanity/structure.ts` with `defaultOrdering` by `publishedAt` desc. `lib/lead-magnet-generator/types.ts` — all TypeScript contracts for phases 1–8 (`LeadMagnetPromptInput`, `LeadMagnetOutline`, `GeneratedLeadMagnet`, `LeadMagnetImages`, `PublishedLeadMagnet`, `LeadMagnetApiResponse`, etc.). `/lead-magnets/[slug]` + `es: /imanes-de-leads/[slug]` added to `i18n/routing.ts`. Merged to main on branch `feature/lead-magnet-generator-phase-1`.
- 2026-06-05: **Blog Post to Newsletter — Phase 2** completed. `sanity/actions/sendNewsletterAction.tsx` — custom Studio document action with confirmation dialog (live EN/ES subscriber counts, already-sent warning, success/error states); registered in `sanity.config.ts` for `post` type only; added `@sanity/ui` and `@sanity/icons` as direct deps. Merged to main on branch `feature/blogpost-to-newsletter-phase-2`.
- 2026-06-05: **Blog Post to Newsletter — Phase 1** completed. `newsletterSentAt` field added to Sanity post schema; `@portabletext/to-html` installed; `lib/email/portable-text-to-html.ts` (portable text → inline email HTML); `lib/email/newsletter-post.ts` (bilingual email template + `sendNewsletterPost()` orchestrator); `GET /api/newsletter/subscriber-counts` (Clerk-auth); `POST /api/newsletter/send-post` (locale-segmented send, duplicate prevention, force override). Merged to main on branch `feature/blogpost-to-newsletter-phase-1`.
- 2026-06-04: **Blog Generation from YouTube — Phase 1** completed. YouTube data extraction service (`lib/blog-generator/`), Clerk-authenticated API route (`/api/admin/blog-generator/extract`), shared TypeScript types, and CLAUDE.md. Merged to main on branch `feature/blog-generation-youtube`.
- 2026-06-04: **Blog Generation from YouTube — Phase 2** completed. OpenAI content generation service (`lib/blog-generator/content-generator.ts`), portable-text utilities extracted to `lib/blog-generator/portable-text.ts`, API route (`/api/admin/blog-generator/generate`), `openai` package added. Merged to main on branch `feature/blog-generation-phase-2`.
- 2026-06-04: **Blog Generation from YouTube — Phase 3** completed. OpenAI EN→ES translation service (`lib/blog-generator/translator.ts`), Sanity thumbnail upload + bilingual post creation (`lib/blog-generator/sanity-publisher.ts`), API route (`/api/admin/blog-generator/publish`). Posts published as drafts with `relatedPost` linking. Merged to main on branch `feature/blog-generation-phase-3`.
- 2026-06-04: **Blog Generation from YouTube — Phase 4** completed. Protected admin page at `/en/admin/blog-generator` with 6-stage pipeline UI (URL input → extract → generate → review/edit → publish → success). Middleware updated to protect `/admin` routes. Merged to main on branch `feature/blog-generation-phase-4`.
- 2026-06-04: **Blog Generation from YouTube — Phase 5** completed. Field-level regeneration (title/excerpt/body), CTA auto-suggestion with category mapping, publish status control (draft/published), and batch mode (up to 10 URLs). TypeScript check passes. Merged to main on branch `feature/blog-generation-phase-5`.
- 2026-06-04: **Blog Generation from YouTube — Phase 6** completed. DALL-E 3 image generation — 1 featured (1792×1024) + 3 body images (1024×1024) per post. GPT-4o generates prompts, images uploaded to Sanity, body images inserted at 25/50/75% of body blocks. Skippable step with YouTube thumbnail fallback. Committed directly to main.
