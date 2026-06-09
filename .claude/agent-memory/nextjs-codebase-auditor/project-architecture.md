---
name: project-architecture
description: Isaac Plans Insurance codebase architecture, hotspot files, recurring anti-patterns, and auth conventions
metadata:
  type: project
---

## Stack
Next.js 15 App Router, React 19, TypeScript, Tailwind, Drizzle ORM on Neon PostgreSQL, Sanity CMS, Clerk auth, next-intl (en/es), Vercel deployment, pnpm.

## Auth conventions
- Admin routes (`/presentations`, `/admin`) protected in middleware via `isProtectedRoute` + `auth.protect()`
- All `/api/admin/*` routes pass through Clerk context (middleware matcher includes them) but only check `userId !== null` — they do NOT enforce `role === "admin"`. The page-level check at `app/[locale]/presentations/page.tsx` and `app/[locale]/admin/blog-generator/page.tsx` is the only role guard.
- `/api/newsletter/send-post`, `/api/admin/blog-generator/*`, `/api/admin/lead-magnet-generator/*`, `/api/newsletter/subscriber-counts` all gate only on `userId` (any authenticated Clerk user, not admin role).

## Known hotspot files (high complexity, frequently modified)
- `app/api/create-contact/route.ts` — 1,466 lines; 36 console.log/warn/error calls; typed as `contactPayload: any`; makes 2 sequential CRM API calls per new contact (custom fields lookup + contact create + workflow enrollments = up to 8 sequential HTTP calls); no rate limiting
- `lib/agent-crm-call-summary.ts` — call processing pipeline; complex retry/fallback logic
- `lib/leave-behind-package.ts` — quote builder; canvas rendering
- `app/[locale]/blog/[slug]/page.tsx` — 914 lines; dual Sanity fetch (POST_QUERY then FIND_RELATED_QUERY sequential on miss); 3 urlFor() calls on related posts in a map()

## Recurring anti-patterns found in audit
1. `contactPayload: any` in create-contact route
2. In-memory state used for production data (guide unlocks, analytics) — DB code commented out
3. Admin API routes check only `userId != null`, not `role === "admin"`, allowing any authenticated user to trigger OpenAI/Sanity writes
4. Sequential awaits that could be parallelized (blog page fetches, create-contact custom fields lookup)
5. `: any` used across sanity schema types and presentation components
6. `error: any` in catch blocks of newsletter and subscriber routes
7. Kixie cron endpoint allows execution with no CRON_SECRET if env var is unset (only backfill endpoint requires it)
8. `/api/guide-analytics` GET endpoint has no authentication and a TODO comment acknowledging it
9. `totalCountResult.length` pattern in `api/blog/likes/users/route.ts` fetches ALL rows to count instead of using `count()`
10. Blog page fetches a separate categories query (fetching all posts' category field) on every render

## In-memory stub routes (not yet persisted to DB)
- `app/api/unlock-guide/route.ts` — uses module-level Map instead of DB
- `app/api/guide-analytics/route.ts` — uses module-level array instead of DB
- `app/api/guides/route.ts` — returns MOCK_GUIDES constant instead of DB

## Webhook secret exposure
- `lib/agent-crm-webhook-verify.ts` line 63: accepts webhook secret via `?token=` query parameter, which will appear in server logs and potentially in referrer headers
