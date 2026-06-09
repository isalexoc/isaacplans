# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Isaac Plans Insurance** is a Next.js 15 SaaS platform for insurance consultation and sales, featuring bilingual (English/Spanish) support, multiple product lines (ACA, Short-term Medical, Dental/Vision, Hospital Indemnity, IUL, Final Expense), and deep CRM integrations.

### Key Tech Stack
- Framework: Next.js 15 (App Router, Server Components)
- Frontend: React 19, TypeScript, Tailwind CSS, Radix UI (shadcn/ui)
- Backend: Node.js, Next.js API routes
- Database: PostgreSQL (Neon) via Drizzle ORM
- CMS: Sanity.io (blog, presentation scripts)
- Auth: Clerk
- Integrations: Agent CRM (LeadConnector), Meta CAPI, Facebook Pixel, Kixie Dialer, OpenAI (Whisper + GPT), Nodemailer
- i18n: next-intl (en, es locales)
- Deployment: Vercel

## Build & Development Commands

pnpm install - Install dependencies (uses pnpm)
pnpm dev - Start dev server (http://localhost:3000)
pnpm build - Production build
pnpm start - Start production server
pnpm lint - Linting

Database commands:
pnpm db:generate - Generate Drizzle migrations from schema.ts
pnpm db:migrate - Apply migrations to Neon database
pnpm db:studio - Open Drizzle Studio (web GUI for DB)

Sanity CMS:
pnpm add:states - Sync US states to Sanity from lib/licensed-states.ts

Blog & content generation (TypeScript scripts in /scripts):
pnpm create:post - Create a single blog post in Sanity

Note: postinstall hook auto-runs ffmpeg-static install for video processing.

## Architecture

### Multi-Locale Routing
- Structure: app/[locale]/ with Next.js dynamic routing
- Config: i18n/routing.ts defines locale paths for 30+ routes (en/es dual URLs)
- Middleware: middleware.ts enforces localization, handles legacy redirects, protects /presentations/* routes with Clerk auth
- Fallback: Default locale is English; invalid locales return 404

### Database Schema (Drizzle ORM)
Located in lib/db/schema.ts; uses Neon PostgreSQL (serverless):
- guides: Consumer guides (PDF downloads); categories: aca, shortTerm, dentalVision, hospitalIndemnity, iul, finalExpense
- guideUnlocks: Tracks unlock events by email/phone with fast lookup indices
- guideAnalytics: Event tracking (view/download/unlock_attempt) with source/campaign attribution
- blogLikes: Per-post likes by Clerk user; unique constraint prevents duplicates
- blogComments: Nested comments on blog posts (parentId for replies); status field for moderation
- blogCommentLikes: Likes on individual comments

Migrations in drizzle/ folder; apply with pnpm db:migrate.

### CMS & Content
Sanity.io (sanity/) handles:
- Blog posts (postType.ts): Rich text, categories, featured image, publishing workflow
- Presentation scripts (presentationScriptType.ts): Sales materials by line of business; bilingual content
- States (stateType.ts): Licensed states for agent compliance

Studio mounted at /studio/[[...tool]]/. Live sync via <SanityLive /> in root layout.

### CRM & Call Processing
Agent CRM (LeadConnector) integrations:

1. Call summaries: Webhook receives InboundMessage/OutboundMessage, fetches GHL transcript or transcribes with OpenAI Whisper, generates summary with GPT, posts to contact notes
   - Config: lib/agent-crm-call-summary-config.ts, lib/agent-crm-call-summary.ts
   - Store: lib/agent-crm-call-summary-store.ts tracks processed calls (prevents duplicates)
   - Backfill cron: /api/cron/call-summary-backfill (daily 6 AM UTC per vercel.json)
   - Kixie dialer support: /api/cron/kixie-call-summary (every 3 minutes)

2. Contact sync: Clerk webhooks upsert contacts in Agent CRM via lib/clerk-agent-crm-sync.ts

3. Webhook verification: lib/agent-crm-webhook-verify.ts

Env vars: AGENT_CRM_API_KEY, AGENT_CRM_LOCATION_ID, AGENT_CRM_PI, OPENAI_API_KEY, KIXIE_* for dialer

### Analytics & Attribution
- Facebook Pixel: lib/facebook-pixel.ts + <MetaPixelWrapper> in root layout
- Meta CAPI: lib/meta-capi.ts for server-side event deduplication (hashes PII, matches by eventId)
- Agent CRM external tracking: <AgentCrmExternalTracking> script (disabled on paid landing pages)
- Google Analytics: <GoogleAnalytics gaId="G-5SDTGH29ER" /> in root layout

### Leave-Behind Package (Final Expense)
Interactive quote builder (lib/leave-behind-package.ts):
- Tier model: bronze/silver/gold with natural/accidental death coverage and premium
- Quote types: single plan, multi-tier comparison, presentation package
- Generates share-friendly images via html2canvas + jsPDF
- Cloudinary image hosting

### Key Directories
- app/[locale]/: Page routes (aca, short-term-medical, final-expense, blog, etc.)
- components/: 199 .tsx files; Radix UI + shadcn/ui patterns
- lib/: 76 .ts files; business logic, integrations, config
- sanity/: CMS config (schema types, structure, client)
- actions/: Server actions for contact forms, guide unlocks, comments
- hooks/: Custom React hooks (autosave, toast, mobile detection)
- messages/: next-intl translation files (JSON)
- drizzle/: SQL migration files

### Authentication & Protected Routes
- Clerk (@clerk/nextjs): User sign-up/login, email verification
- Middleware protection: Routes like /presentations/* require auth.protect() before access
- No explicit role system; relies on Clerk user IDs and Agent CRM contact syncing

## Configuration Files

- tsconfig.json: Path alias @/* for imports
- next.config.mjs: Image remotePatterns for Cloudinary, Sanity, Google Places API
- tailwind.config.ts: Brand colors (blue #0077B6, accent #00B4D8), custom animations
- drizzle.config.ts: Points to lib/db/schema.ts, outputs to drizzle/
- components.json: shadcn/ui config (Tailwind, Lucide icons)
- .env: All secrets and API keys

## Common Workflows

### Adding a New Route
1. Create app/[locale]/my-route/page.tsx (or folder with layout)
2. Export generateMetadata() for SEO (uses next-intl getTranslations)
3. If localized slug differs, add pathname mapping to i18n/routing.ts
4. Use 'use client' if hooks/state needed

### Creating a Server Action
1. Create in app/actions/my-action.ts or inline in route handler
2. Export async function myAction(formData: FormData) or accept params
3. Use revalidatePath() or revalidateTag() for ISR cache invalidation
4. Return { error: "message" } for client error handling

### Adding a Database Table
1. Define schema in lib/db/schema.ts (pgTable, indices, relationships)
2. Run pnpm db:generate to create migration file in drizzle/
3. Review generated SQL; adjust if needed
4. Deploy: pnpm db:migrate on production

### CMS: Creating a New Content Type
1. Define schema in sanity/schemaTypes/ (e.g., myType.ts)
2. Export from schemaTypes/index.ts
3. Add to structureTool list in sanity/structure.ts
4. Query in components: client.fetch(MY_GROQ_QUERY, params)

### Blog Features
- Post search API: /api/blog/search?q=insurance&locale=en&page=1&limit=12
- Comments API: POST /api/blog/comments (requires Clerk auth), GET likes, DELETE with user ownership check
- Blog revalidation: See BLOG_REVALIDATION_SETUP.md

### Handling Calls & Transcriptions
1. Agent CRM sends webhook to /api/cron/*
2. Fetch transcript from GHL or download recording from Kixie
3. Transcribe with OpenAI Whisper if needed
4. Generate summary: summarizeCallTranscript(transcript, config, language)
5. POST to Agent CRM contact notes with unique prefix
6. Mark processed in DB to prevent re-processing

## Key Env Vars & Secrets

Required for local dev:
- DATABASE_URL, DATABASE_URL_UNPOOLED (Neon connection strings)
- NEXT_PUBLIC_SANITY_PROJECT_ID, SANITY_API_WRITE_TOKEN
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET

For integrations:
- Agent CRM: AGENT_CRM_API_KEY, AGENT_CRM_LOCATION_ID, AGENT_CRM_PI, AGENT_CRM_*_WORKFLOW IDs
- Kixie: KIXIE_API_KEY, KIXIE_BUSINESS_ID, KIXIE_CALL_SUMMARY_ENABLED
- OpenAI: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_WHISPER_MODEL
- Meta: NEXT_PUBLIC_FACEBOOK_PIXEL_ID, META_CAPI_ACCESS_TOKEN
- Cloudinary: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_SECRET
- Email: EMAIL_HOST, EMAIL_PORT, EMAIL_USER_INFO, EMAIL_PASS_INFO

See .env for full list and CALL_SUMMARY_SETUP.md, META_CAPI_SETUP.md, FACEBOOK_PIXEL_GUIDE.md for detailed integration docs.

## Testing & Debugging

- Browser DevTools: Inspect React Server Components via Next.js Dev Tools plugin
- Vercel logs: pnpm dev shows server logs; production errors in Vercel dashboard
- Database: Use pnpm db:studio to browse tables and test queries
- Sanity Studio: Navigate to /studio in dev/prod for CMS content editing
- Call summary debug: Set AGENT_CRM_CALL_SUMMARY_DEBUG=true for verbose webhook logs
- Meta CAPI testing: Set testEventCode=TEST22889 to test in Meta Events Manager

## Cron Jobs

Configured in vercel.json:
- /api/cron/call-summary-backfill: Daily 6 AM UTC; backfills missed call summaries
- /api/cron/kixie-call-summary: Every 3 minutes; processes pending Kixie webhooks

Both require CRON_SECRET header for auth.

## Deployment

- Host: Vercel (Git-based auto-deploy on push to main)
- Database: Neon PostgreSQL (serverless)
- CMS: Sanity.io (hosted)
- Env vars: Set in Vercel project settings (mirror .env.local locally)
- Build: pnpm build validates TS, lints, generates static pages
- Preview: Branching creates automatic preview deployments

## Notable Patterns

1. Middleware-based locale handling: Integrates Clerk auth + next-intl in one middleware
2. ISR with Sanity Live: Blog posts use revalidateTag("blog") + SanityLive for instant updates
3. Server-side form processing: Forms POST to API routes; errors/success handled via navigation
4. Drizzle with Neon serverless: Uses HTTP fetch (neon() adapter) instead of TCP
5. Bilingual schema: Fields have _es suffix (titleEs, descriptionEs) for Spanish
6. Leave-behind package draft: Client-side autosave via hook, canvas rendering, Cloudinary

## Gotchas & Important Notes

- Locale validation: Always check hasLocale(routing.locales, locale) before using locale
- Image domains: Add new image sources to next.config.mjs remotePatterns
- Clerk webhooks: Must be enabled in Clerk dashboard; secret in CLERK_WEBHOOK_SIGNING_SECRET
- Call transcripts: GHL may return empty; fallback to Whisper on recording URL
- Sanity queries: Use named imports from lib/sanity/queries/
- Meta CAPI deduplication: Client-side Pixel and server-side CAPI must use same eventId
- Leave-behind images: html2canvas may fail on complex layouts; test locally
- pnpm only: Package manager is pnpm; npm/yarn may break lockfile

---

## Context & AI Guidelines

The `context/` folder contains working instructions and standards that apply to every session:

- [context/ai-interaction.md](context/ai-interaction.md): Workflow rules (branch → implement → test → commit), commit conventions, when to ask vs. proceed
- [context/coding-standards.md](context/coding-standards.md): TypeScript, React, Next.js, naming, styling, error handling standards
- [context/current-feature.md](context/current-feature.md): Active feature spec + completed feature history

Feature specs (archived after merge):
- [context/features/blog-generation/](context/features/blog-generation/): Blog generation from YouTube (phases 1–6)
- [context/features/blogpost-to-newsletter/](context/features/blogpost-to-newsletter/): Blog post → newsletter email (phases 1–2)

---

For feature-specific setup, see root markdown files:
- CALL_SUMMARY_SETUP.md: Agent CRM call summaries
- META_CAPI_SETUP.md: Meta Conversions API
- FACEBOOK_PIXEL_GUIDE.md: Pixel events and testing
- CONSUMER_GUIDES_SETUP.md: Guide unlock flows
