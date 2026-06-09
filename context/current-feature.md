# Current Feature: Lead Magnet Generator — Phase 4

## Status

In Progress

## Goals

- `POST /api/admin/lead-magnet-generator/generate-images` with a valid `LeadMagnetOutline` returns `LeadMagnetImages` with a non-empty `coverImage` Cloudinary URL
- `sectionImages` array length always matches `selectSectionIndices(outline.sections.length)` — 3–4 items
- All returned URLs are Cloudinary HTTPS URLs (not temporary DALL-E URLs)
- If DALL-E fails for a section image, route returns 200 with `""` for that image and the error in `warnings`
- If ALL image generation fails, route still returns `{ success: true, data: { coverImage: "", sectionImages: [...] }, warnings: [...] }` — never 500 for image failures
- Route returns 401 if unauthenticated
- `pnpm tsc --noEmit` passes

## Notes

**2 new files:**

1. `lib/lead-magnet-generator/image-generator.ts` — `generateLeadMagnetImages(outline)`: cover image (DALL-E 3, `1792x1024`, `quality: "standard"`) + 3–4 section images (`1024x1024`) at strategic positions; each step is non-fatal (try/catch, empty string on failure, warnings array); upload via `cloudinary.uploader.upload(dalleUrl, { folder, public_id, resource_type: "image" })` returning `secure_url`
2. `app/api/admin/lead-magnet-generator/generate-images/route.ts` — Clerk auth, `maxDuration = 120`, always `success: true` unless 401 or bad body

**Key implementation details:**
- Cloudinary client: `import cloudinary from "@/config/cloudinary"` (already configured, v2 SDK)
- DALL-E 3 API: `client.images.generate({ model: "dall-e-3", size, quality: "standard", n: 1 })` — returns `data[0].url`
- Cover folder: `lead-magnets/{category}/`, public_id: `cover-{Date.now()}`
- Section folder: `lead-magnets/{category}/sections/`, public_id: `section-{index}-{Date.now()}`
- Section selection: `selectSectionIndices(n)` → indices at ~20%, 45%, 70%, 90% (or all if ≤4)
- `LeadMagnetSuccessResponse<LeadMagnetImages>` shape includes `warnings?: string[]`

## History

- 2026-06-09: **Lead Magnet Generator — Phase 3** completed. `lib/lead-magnet-generator/prompts.ts` — extended with `SECTION_GENERATION_SYSTEM_PROMPT` + `buildSectionPrompt()` (passes full outline + all prior completed sections as context to prevent repetition) and `INTRO_CONCLUSION_SYSTEM_PROMPT` + `buildIntroConclusionPrompt()`. `lib/lead-magnet-generator/section-generator.ts` — `generateSection()` (plain completion, `max_tokens: 2000`, throws if `wordCount < 500`, markdown → Portable Text via `textToBlocks()`) + `generateIntroConclusion()` (JSON mode, validates both fields, both → Portable Text). `app/api/admin/lead-magnet-generator/generate-section/route.ts` + `generate-intro-conclusion/route.ts` — Clerk-authenticated POSTs, `maxDuration = 60`. Merged to main on branch `feature/lead-magnet-generator-phase-3`.
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
