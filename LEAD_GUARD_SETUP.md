# Lead Guard: stopping bot leads without slowing real clients

**Why it exists.** From 2026-11-21 a form-bombing bot sent ~50 fake leads per weekday through the
general contact form (`/en/contact-me`, `/en/about`). Each one had a Faker name, a real stranger's
email and a random phone, and every one became a CRM contact. The contact workflow then emailed
"Your Personalized Quote" to those strangers, texted the random numbers (some delivered), and
created an opportunity. The bot never ran JavaScript: it posted React's server-rendered form (the
no-JavaScript fallback of a server action) straight to the page.

**What it does.** Every website lead is judged on the server **before** anything reaches the CRM:

| Verdict | When | What happens |
|---|---|---|
| **allow** | everything looks normal | today's flow, plus the tag `web_verified` |
| **hold** | anything doubtful: no / forged / stale form token, sent < 1.2 s after the page rendered, the hidden honeypot filled, a phone number that cannot exist, a name with links or digits, a post from another site, a lead type only our server sends, a burst on the general contact form (3/hour, 6/day), more than 25 allowed leads a day on one form | **not** sent to the CRM; stored encrypted; Telegram line to Isaac; released with one click at `/es/admin/lead-holds` |
| **block** | only bot certainties: a server action posted without React (how the bot submitted), a JSON body with several lead types at once, a JSON post with neither a form token nor an `Origin` header (a script, not a browser) | nothing stored, nothing sent; logged as `[lead-guard]` |

In all three cases the visitor sees the normal success screen. No puzzles, no extra steps, no
third-party script. Anything a real person could ever produce — an autofilled hidden field, a tab
opened before a deploy, a key change, a slow phone — is at worst **held**, never dropped.

## How the pieces fit (lib/lead-guard/)

- **No-JS door closed.** The 10 `useActionState` lead forms wrap their server action in a client
  function (`withLeadGuardAction`), so React no longer renders the no-JavaScript post path the bot
  used; clicks before hydration are replayed by React. A server action invoked without React's
  `Next-Action` header is blocked. The wrapper also turns a thrown action (network drop, deploy)
  into the form's normal error message instead of a crashed page, and ignores a replayed click
  after success.
- **Form token.** The root layout renders a stateless HMAC token into `<body data-lgt>` on every
  page view, so a real browser always has one (no network call), timestamped at render. Tabs open
  more than 6 hours fetch a fresh one from `GET /api/form-session`. Server-action forms send it as
  `_lgt`; fetch funnels as `leadGuard: {t}`.
- **Honeypot.** `<LeadGuardHoneypot/>` in the server-action forms and the IUL guía / LegalShield
  funnels: off-screen, aria-hidden, meaningless name, autofill / password-manager ignore attributes.
  Filled → hold. (The old client-only checks in those two funnels, which silently did nothing when
  autofill filled a field, are gone.)
- **Phone check.** `libphonenumber-js` max metadata (direct dependency, core API with explicit
  metadata). Server-action forms say "please double-check this number" once; the same number sent
  again is accepted and held. Funnels hold. Keep the dependency current (new area codes such as 357
  lag in the metadata).
- **Rate limits.** The general contact and agent-CRM forms (essentially no real volume) hold after
  3 allowed people in an hour or 6 in a day; every other form after `LEAD_GUARD_DAILY_CAP` (25) a
  day. They count people (a hash of the phone), never wait more than 0.8 s on Neon, and fail open.
- **In-process CRM call.** `/api/create-contact`'s logic lives in `lib/create-contact/core.ts`. The
  route serves the browser funnels (after the gate); the server actions, lead magnets, referral
  partners and Release call the core directly — no HTTP self-hop, so the visitor's real IP reaches
  CAPI and nothing depends on a shared signature across deployments.
- **Existing contacts.** On the duplicate path a website form now only fills blank names / email
  (like the phone rule from 2026-11-17); different values go to a note. A bot typing a client's
  email can no longer rename the client or repoint their email.
- **Stand-in contact ids.** Held / blocked leads get a 20-character id shaped like a GHL id. The
  step-2 routes (`contact-append-address`, `contact-append-iul`, `legal-shield/append`,
  `iul/guia-email`, `legal-shield/guide-email`) recognize it: a hold files the step-2 data with the
  hold (replayed on release, or forwarded to the real contact if already released); a block is
  ignored.
- **Storage.** `lead_holds`, `lead_hold_appends`, `lead_guard_events` (migration
  `0047_lead_guard`). Only allowed and held leads write; blocked bots never load or wake Neon. A held
  row is never deleted unreviewed; reviewed rows go 30 days after review, events after 180 days.
- **Fallback.** If a hold can't be stored in 4 s (Neon down, migration missing), the lead goes to the
  CRM before the response as a bare contact tagged `web_review` (no lead tags, no workflow, no CAPI)
  plus a note; its step-2 answers become notes. If the CRM can't take it either, the visitor gets the
  form's normal "please try again" error instead of a false success. A lead is never silently lost.
- **Alerts.** One Telegram line per hold (same chat as the Telegram-lead alerts), at most 6 an hour;
  the daily reconcile cron sends "N leads waiting" while any are held, and returns releases stuck
  mid-way to "held".

Also in this release: `/api/create-contact` no longer logs the full payload or returns the CRM
contact object, and caps the body at 64 KB; referral-partner attribution can no longer be set from
a browser; the guide-email routes send only to the email on file (and greet with the CRM's first
name); the newsletter sends a pending address at most one confirmation per 15 minutes and at most
20 first-time confirmations an hour site-wide.

## Setup (Isaac)

1. **Database:** `pnpm db:migrate 0047` (never plain `pnpm db:migrate`). Until it runs, held leads
   use the `web_review` CRM fallback.
   - Merge note: `feature/agent-platform-pilot` has `0046_agent_platform` (already applied in
     production). When that branch merges, keep both journal entries (46 then 47) and regenerate the
     0047 snapshot so its `prevId` points at 0046 (`pnpm db:generate` will report a collision
     otherwise). The SQL files themselves don't conflict.
2. **Env (Vercel):** nothing required — the key is derived from `INTAKE_ENCRYPTION_KEY`. Optional:
   - `LEAD_GUARD_SECRET` (any long random string, **main project only**, never the agent-platform
     project): gives the guard its own key. Old tokens and held ids keep working (key ring); when
     rotating later, keep the previous value in `LEAD_GUARD_SECRET_PREVIOUS` for a week.
   - `LEAD_GUARD_MODE` = `enforce` (default) | `shadow` (judge + log, let everything through) | `off`
   - `LEAD_GUARD_SHADOW_SURFACES` = comma list kept in shadow (never `contact` / `agent_crm`)
   - `LEAD_GUARD_DAILY_CAP` (default 25)
   - Telegram alerts reuse `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID`.
3. **GHL (CRM settings):**
   - **Required: turn off External Tracking form capture** on pages with the app's lead forms (or the
     domain's "Form submissions" switch). It creates a second, unchecked contact before the app does,
     lets bots that run JavaScript into the CRM, and makes allowed and released leads take the
     duplicate path.
   - Recommended: in the **contact** workflow (the "Your Personalized Quote" one), first step "Contact
     tags include `web_verified`", otherwise notify Isaac and stop; same before its 24-hour
     follow-up. Only on workflows that website leads alone enter — never on workflows that Facebook
     lead ads, Telegram, Leads the Way, referral manual entries or manual contacts also enter (they
     never carry the tag).
   - Turn on **Number Intelligence** (Settings → Phone System) so invalid numbers are never texted.
   - Set a **Time Window** (Timezone = Contact) on lead workflows: a Release clicked at night would
     otherwise text immediately.
   - Confirm no "Contact Created" workflow messages contacts (the fallback's `web_review` contacts
     must stay silent).
4. **Review:** `/es/admin/lead-holds` (also on the admin dashboard as "Held Website Leads").
5. **Optional (Vercel Firewall):** a Log rule for POST to `/en/contact-me`, `/en/about`,
   `/es/contacto`, `/es/sobre-mi`, `/en/agent-crm` with no `next-action` header shows whether the bot
   keeps trying. Any future Challenge / Bot Protection rule must not challenge POSTs to those pages or
   `/api/create-contact`.

## Watching it

- Vercel logs: search `[lead-guard]` — one JSON line per decision (surface, verdict, reasons,
  token state, browser family, Origin present, JA4, country; never names, emails, phones or IPs).
- Admin page: allowed / held counts per form for 24 h and 7 days.
- Offline checks: `pnpm test:lead-guard`.

## Rollback

Set `LEAD_GUARD_MODE=shadow` (or `off`) in Vercel and redeploy (Vercel applies env changes to new
deployments only). `shadow` keeps the decision logs so the effect stays visible.

## Later, only if needed

- **Vercel BotID** if a bot that runs JavaScript appears (protect only `/api/create-contact` and the
  exact form routes; wrap the client fetch with a timeout and a hold fallback — its client patch has
  no timeout and its behavior in Facebook/Instagram in-app browsers is unmeasured).
- **Trestle Real Contact** as a hold signal (name ↔ phone/email match), after Isaac approves the cost
  (~$0.035/lead) and a privacy-policy line.
- The anonymous intake self-start (`/[lob]/apply/start` → autosave) still writes to the CRM without
  these checks; it is the likely next target if a bot adapts.
