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
- Integrations: Agent CRM (LeadConnector), Meta CAPI, Facebook Pixel, Kixie Dialer, OpenAI (Whisper + GPT), Anthropic Claude (Opus 5.5 via @anthropic-ai/sdk, ANTHROPIC_API_KEY; used only by the AI Setter), Nodemailer
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

1. Call summaries: Webhook receives InboundMessage/OutboundMessage, fetches GHL transcript or transcribes with OpenAI Whisper, extracts structured JSON with GPT (lib/call-summary-structured.ts), formats a plain-text emoji note (lib/call-summary-note-format.ts — GHL does not render Markdown), posts to contact notes
   - Config: lib/agent-crm-call-summary-config.ts, lib/agent-crm-call-summary.ts
   - Store: lib/agent-crm-call-summary-store.ts tracks processed calls (prevents duplicates)
   - Backfill cron: /api/cron/call-summary-backfill (daily 6 AM UTC per vercel.json)
   - Kixie dialer support: QStash queue /api/queue/kixie-call-summary (+ daily /api/cron/queue-reconcile backstop)
   - Test locally: pnpm test:call-summary --formatter-only (no API calls) or pnpm test:call-summary fe-en (live OpenAI, never posts notes)

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
- QStash (background jobs): QSTASH_ENABLED, QSTASH_TOKEN, QSTASH_URL, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, QSTASH_TARGET_BASE_URL
- Phone Finder: PHONE_FINDER_ENABLED, PHONE_FINDER_WEBHOOK_SECRET, TRESTLE_API_KEY, ENFORMION_AP_NAME, ENFORMION_AP_PASSWORD (tuning vars in PHONE_FINDER_SETUP.md)
- Impact welcome: IMPACT_WELCOME_WEBHOOK_URL (one GHL Inbound Webhook workflow; it branches on the contact's `spanish` tag, and the app picks the email language the same way), IMPACT_TEMP_PASSWORD (shared portal password printed in the welcome email; never in code, repo is public), IMPACT_EMAIL_FROM (optional sender), IMPACT_AGENT_IBO (Isaac's Impact IBO # on the sales presentation's agent slide; never in code, repo is public; unset shows "—")
- ACA application review confirmation: ACA_AGENT_NPN (required; never in code, repo is public), ACA_CONFIRMATION_FILE_FIELD_ID (File Upload field from `pnpm aca-confirmation:field`; the signed PDF lands in the contact's Documents), optional ACA_CONFIRMATION_EMAIL_FROM / ACA_AGENT_NAME / ACA_AGENT_PHONE / ACA_AGENT_EMAIL
- Lead Guard (website lead spam): nothing required (its key is derived from INTAKE_ENCRYPTION_KEY unless LEAD_GUARD_SECRET is set); LEAD_GUARD_MODE = enforce (default) | shadow | off; LEAD_GUARD_SHADOW_SURFACES (comma list kept in shadow); LEAD_GUARD_DAILY_CAP (default 25); LEAD_GUARD_SECRET_PREVIOUS during a rotation. Telegram hold alerts reuse TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID. See LEAD_GUARD_SETUP.md
- AI Setter: AI_SETTER_ENABLED (default false), AI_SETTER_DRY_RUN (default true = shadow mode, nothing is sent), AI_SETTER_WEBHOOK_SECRET, AI_SETTER_GHL_PI (its own Private Integration, never AGENT_CRM_PI), AI_SETTER_GHL_USER_ID, ANTHROPIC_API_KEY (Claude; only the AI Setter uses it). Production-only in Vercel; tuning vars (AI_SETTER_*) in AI_SETTER_SETUP.md

See .env for full list and CALL_SUMMARY_SETUP.md, META_CAPI_SETUP.md, FACEBOOK_PIXEL_GUIDE.md, QSTASH_SETUP.md for detailed integration docs.

## Testing & Debugging

- Browser DevTools: Inspect React Server Components via Next.js Dev Tools plugin
- Vercel logs: pnpm dev shows server logs; production errors in Vercel dashboard
- Database: Use pnpm db:studio to browse tables and test queries
- Sanity Studio: Navigate to /studio in dev/prod for CMS content editing
- Call summary debug: Set AGENT_CRM_CALL_SUMMARY_DEBUG=true for verbose webhook logs
- Meta CAPI testing: Set testEventCode=TEST22889 to test in Meta Events Manager

## Background Jobs & Cron

**Standard for all background / async / scheduled / retry work: Upstash QStash (event-driven), NOT polling crons.** A cron that queries Neon every few minutes keeps the serverless database awake 24/7 and bills compute around the clock regardless of real activity (this is exactly what caused a runaway Neon bill — see QSTASH_SETUP.md). Instead: publish a QStash message when there's real work; QStash calls back (with built-in retries + delayed/exact-time delivery), so Neon stays idle until needed.

Rule: **do not add a Vercel cron more frequent than daily that touches Neon.** If you need timely background processing, retries, or scheduled delivery, use QStash (`lib/qstash/` — `publishJob`, `cancelJob`, `verifyQStashRequest`).

QStash delivery endpoints (auth via `Upstash-Signature`, not CRON_SECRET):
- /api/queue/kixie-call-summary: processes one Kixie call (published from the Kixie webhook)
- /api/queue/social-publish: publishes one scheduled social post at its exact time
- /api/queue/phone-finder: runs one Phone Finder search (published from the GHL "Find More Phones" webhook)
- /api/queue/aca-confirmation-finalize: finishes one signed ACA confirmation (PDF archive, CRM Documents file, note, tag; published when the client signs)
- /api/queue/ai-setter: one AI Setter job: a turn (code rules, then Claude picks one reply or action), a send (re-checks everything, then posts the approved text to GHL) with its verify-send, or a call-now timeout (published from the GHL reply webhook, approvals and the turn itself)

Crons in vercel.json (all CRON_SECRET bearer auth; all daily-or-less):
- /api/cron/call-summary-backfill: Daily 6 AM UTC; backfills missed GHL call summaries
- /api/cron/queue-reconcile: Daily 7 AM UTC; safety-net that drains any Kixie job / social post QStash missed; for the AI Setter it only re-publishes stuck turns and approved sends (never runs them inline), expires old drafts and erases 90-day-old message text
- /api/cron/social-token-refresh: Weekly (Mon 8 AM UTC); refreshes social OAuth tokens

QStash is feature-flagged by `QSTASH_ENABLED`; when off, the Kixie webhook falls back to a direct processor kick and posts wait for the daily reconcile. The AI Setter has no inline fallback: without QStash its webhook ignores every poke.

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
7. Event-driven background jobs: QStash publishes a message on real work and calls back (retries + exact-time delivery); never frequent Neon-polling crons (see "Background Jobs & Cron")

## Gotchas & Important Notes

- Locale validation: Always check hasLocale(routing.locales, locale) before using locale
- Image domains: Add new image sources to next.config.mjs remotePatterns
- Clerk webhooks: Must be enabled in Clerk dashboard; secret in CLERK_WEBHOOK_SIGNING_SECRET
- Call transcripts: GHL may return empty; fallback to Whisper on recording URL
- Sanity queries: Use named imports from lib/sanity/queries/
- Meta CAPI deduplication: Client-side Pixel and server-side CAPI must use same eventId
- Leave-behind images: html2canvas may fail on complex layouts; test locally
- pnpm only: Package manager is pnpm; npm/yarn may break lockfile
- Website lead forms go through Lead Guard (lib/lead-guard, LEAD_GUARD_SETUP.md): a `useActionState` lead form passes `withLeadGuardAction(serverAction)` (never the server action itself: that re-opens the no-JavaScript post a spam bot used), calls `useLeadGuardPrefetch()` and renders `<LeadGuardHoneypot />`; its action calls `submitGuardedActionLead`; a browser `fetch` to /api/create-contact sends `leadGuard: await getLeadGuardPayload()`; server code never calls /api/create-contact over HTTP — it calls `createContactCore` (lib/create-contact/core.ts) in-process. `pnpm test:lead-guard` fails when a new form skips it
- Client-data pages are private: any page where a client's personal data is typed or shown, or whose URL is a credential, must match lib/private-pages.ts (every `/intake|admision` route, secure/document links, /admin already do). Middleware then drops Meta Pixel, GA and the CRM chat/tracking/form capture and blocks framing by other sites. Never add a third-party script to those pages

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
- PHONE_FINDER_SETUP.md: "Find More Phones" checkbox → EnformionGO + Trestle → "Additional Possible Phones" field
- IMPACT_ENROLLMENT_SETUP.md: Impact Health Sharing post-sale welcome from /health-alternative/intake: email with the ID card PDF attached sent by the app (Conversations API), texts/WhatsApp with the card image via a GHL Inbound Webhook workflow; values ride in the email/webhook body, never custom fields. Also the Health Coverage intake's secure link (client types SSN/ITIN, ID number, bank details at /secure/<token>; `config.secureCapture`, table `intake_secure_captures`, tag `ha_secure_capture_sent`)
- ACA_CONFIRMATION_SETUP.md: CMS application review confirmation (the second CMS signature, before submission) from /aca/intake: app-sent email → client e-signs a one-page CMS-model form at /aca/confirmation/[token] → PDF + signature trail archived (Cloudinary, 10 yrs), saved to the contact's Documents, note + tag; first consent stays in the GHL workflow
- LEAD_GUARD_SETUP.md: Lead Guard — every website lead is judged before the CRM (allow → normal flow + `web_verified` tag; hold → kept out of the CRM, encrypted in Neon, Telegram line, released at /es/admin/lead-holds; block → bot certainty, nothing stored); form token on `<body data-lgt>` (+ `/api/form-session` for old tabs), honeypot, phone validity, in-process create-contact core, stand-in contact ids for step-2 routes, names/email on existing contacts only fill blanks; migration 0047 (0046 is the agent-platform branch); started by the Nov 2026 contact-form bombing bot
- AI_SETTER_SETUP.md: AI Setter (Claude Opus 5.5) answers `ai_setter`-tagged leads' SMS/WhatsApp replies (GHL "Customer Replied" workflow → webhook → QStash) and books calls into the product + language GHL calendar, or asks Isaac on Telegram to call now; shadow mode by default, approval-first templates, compliance rules in code (`lib/ai-setter/`), migration 0045, written internal DNC policy
