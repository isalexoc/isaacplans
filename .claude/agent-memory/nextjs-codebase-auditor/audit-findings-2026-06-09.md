---
name: audit-findings-2026-06-09
description: First full audit findings summary — critical/high issues found on 2026-06-09
metadata:
  type: project
---

## Critical
- Guide unlock/analytics/guides routes still use in-memory stubs (not DB) — data lost on every cold start
- Kixie cron endpoint silently allows unauthenticated access when CRON_SECRET env var is absent
- /api/guide-analytics GET has no auth and a TODO comment saying to add it

## High
- All /api/admin/* API routes guard only on userId != null (any Clerk user), not role === "admin" — any logged-in user can trigger OpenAI content generation and Sanity publishes
- Webhook secret accepted via query param (?token=) in verifyCallSummaryWebhookAuthDetailed — appears in logs
- Sequential CRM API calls in create-contact route (up to 8 HTTP requests per lead submission, all synchronous in request path)
- /api/blog/likes/users fetches all rows to count instead of using count()
- Blog listing page fires a 4th Sanity query (categories) separately from the main 3 parallelized ones
- `enrollment-section.tsx` and `enrollment-section-template.tsx` both use dangerouslySetInnerHTML on steps[] prop values sourced from next-intl translations (XSS risk if translations are ever compromised or mistranslated)

## Medium
- contactPayload: any in create-contact route
- 36 console.log/warn/error in create-contact route — PII (firstName, lastName, email) in server logs
- error: any in catch blocks across newsletter routes
- : any scattered across sanity schema files and presentation components
- Blog post page does two sequential sanityFetch calls (primary slug, then fallback) instead of a single union GROQ query

## Quick wins identified
- Parallelize create-contact custom fields lookup with contact creation using Promise.all
- Replace totalCountResult.length count pattern with count() query in likes/users route
- Move categories query into the existing Promise.all in blog listing page
- Add role check to /api/admin/* routes
- Remove ?token= query param support from webhook verify (security)
