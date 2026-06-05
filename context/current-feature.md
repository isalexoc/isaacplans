# Current Feature

Blog Post to Newsletter — Phase 1

## Status

Not Started

## Goals

Build the complete server-side infrastructure for sending a blog post as a newsletter email to confirmed subscribers, segmented by locale (EN/ES). Full spec: `context/features/blogpost-to-newsletter/blogpost-to-newsletter-spec-phase-1.md`

**Deliverables:**
1. `newsletterSentAt` readonly field added to `sanity/schemaTypes/postType.ts`
2. `lib/email/portable-text-to-html.ts` — Sanity portable text → inline-styled email HTML
3. `lib/email/newsletter-post.ts` — email template builder + `sendNewsletterPost()` orchestrator
4. `GET /api/newsletter/subscriber-counts` — confirmed subscriber counts by locale (Clerk-auth)
5. `POST /api/newsletter/send-post` — main send endpoint (Clerk-auth, duplicate prevention via `newsletterSentAt`, `force` override)

## Notes

- Uses existing Nodemailer SMTP setup and existing `newsletterSubscribers` Neon table — no new services
- Posts are separate Sanity documents per language, linked via `relatedPost` reference
- New dependency: `@portabletext/to-html`

## History

- 2026-06-04: **Blog Generation from YouTube — Phase 1** completed. YouTube data extraction service (`lib/blog-generator/`), Clerk-authenticated API route (`/api/admin/blog-generator/extract`), shared TypeScript types, and CLAUDE.md. Merged to main on branch `feature/blog-generation-youtube`.
- 2026-06-04: **Blog Generation from YouTube — Phase 2** completed. OpenAI content generation service (`lib/blog-generator/content-generator.ts`), portable-text utilities extracted to `lib/blog-generator/portable-text.ts`, API route (`/api/admin/blog-generator/generate`), `openai` package added. Merged to main on branch `feature/blog-generation-phase-2`.
- 2026-06-04: **Blog Generation from YouTube — Phase 3** completed. OpenAI EN→ES translation service (`lib/blog-generator/translator.ts`), Sanity thumbnail upload + bilingual post creation (`lib/blog-generator/sanity-publisher.ts`), API route (`/api/admin/blog-generator/publish`). Posts published as drafts with `relatedPost` linking. Merged to main on branch `feature/blog-generation-phase-3`.
- 2026-06-04: **Blog Generation from YouTube — Phase 4** completed. Protected admin page at `/en/admin/blog-generator` with 6-stage pipeline UI (URL input → extract → generate → review/edit → publish → success). Middleware updated to protect `/admin` routes. Merged to main on branch `feature/blog-generation-phase-4`.
- 2026-06-04: **Blog Generation from YouTube — Phase 5** completed. Field-level regeneration (title/excerpt/body), CTA auto-suggestion with category mapping, publish status control (draft/published), and batch mode (up to 10 URLs). TypeScript check passes. Merged to main on branch `feature/blog-generation-phase-5`.
- 2026-06-04: **Blog Generation from YouTube — Phase 6** completed. DALL-E 3 image generation — 1 featured (1792×1024) + 3 body images (1024×1024) per post. GPT-4o generates prompts, images uploaded to Sanity, body images inserted at 25/50/75% of body blocks. Skippable step with YouTube thumbnail fallback. Committed directly to main.
