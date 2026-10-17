# Phone Finder — setup

Tick **Find More Phones** on a GHL contact. Within about 15 seconds the contact's other phone numbers
appear in the **Additional Possible Phones** field, best first, ready to copy into Kixie.

## How it works

```
GHL: tick "Find More Phones"
  └─ Workflow "Phone Finder"
       1. Custom Webhook ──► POST /api/webhooks/agent-crm/phone-finder   (Bearer secret)
       2. Update Contact Field: Clear field data → Find More Phones      (unticks the box)

Server: arm one run per contact → QStash → /api/queue/phone-finder
  1. Trestle: is the phone on file theirs? active? a TCPA litigator?
  2. EnformionGO: find the person (name + email/address/DOB/phone), up to 4 name variants
  3. Trestle: check each new number against the lead's name
  4. Write the ranked list into "Additional Possible Phones"
```

**Example field value:**

```
✓ 786-412-0199 · Mobile · registered to this name · active 92/100 · seen 2026
• 305-412-0123 · Landline · active 61/100 · seen 2024
⛔ 954-412-0170 · DO NOT CALL: TCPA litigator

⚠ The phone on file is registered to someone else.

Searched Oct 16, 2026, 3:02 PM · EnformionGO (people search) + Trestle (phone checks)
✓ = registered to this name. No consent from the client for these numbers: call by hand, don't text.
```

**How to read it:**
- **✓** — Trestle says the number is registered to this lead's name.
- **•** — Found in the person's public record, but Trestle has no name for it (common with prepaid
  phones). Worth a try.
- **⛔** — The subscriber is a known TCPA litigator. Don't call it.

**Rules the build keeps:**
- **Nothing is added to GHL's phone list.** Extra phones would join GHL's duplicate matching, so a
  relative submitting a form with that number would be merged into this contact. Workflows would
  also start texting a found number if the primary were ever deleted.
- **The numbers carry no consent.** Call them by hand only. Once the client confirms a number on a
  call, update their phone yourself.
- **The number on file is checked too.** If it belongs to a litigator, the contact is tagged
  `tcpa_litigator_risk`.
- **Never use these results for underwriting.** Neither vendor is a consumer reporting agency
  (FCRA).

## 1. Vendor accounts

| Vendor | What to do | Cost |
|---|---|---|
| **Trestle** ([trestleiq.com](https://trestleiq.com)) | Sign up. Business verification uses the EIN. Real Contact works straight away. Fund the self-serve wallet and turn on auto top-up: at $0 the API stops. Copy the API key. | $0.035 per check (Real Contact + litigator). The free trial is 25 queries. |
| **EnformionGO** ([go.enformion.com](https://go.enformion.com)) | Sign up. There's a $10 card verification, returned as credit. Under **Keys**, copy the Access Profile name and password. Check **Keys > Pricing** for your per-match price. | Free tier is 100 matches a month, then Starter from $0.25 per match. Misses are free. |

**Before going live, email EnformionGO** (supportgo@enformion.com). Their self-serve terms (API
item 7) restrict "storing" or "merging" their data without a written addendum. Their own docs sell
this exact use ("CRM record cleanup and enhancement", "lead qualification"). Ask them to confirm in
writing that saving Contact Enrichment results to your own CRM for your own inbound leads is
allowed. Keep the reply.

Trestle's terms allow lead verification and contactability. Marketing use is limited to "responding
to an inbound request": your ad-form leads qualify, but cold referrals are less clear.

**Typical cost per tick:** about $0.30–$0.45. That's the $0.035 check of the phone on file, plus
$0.25 if EnformionGO finds the person, plus $0.035 for each new number (at most 5).

## 2. Environment variables

Set these in Vercel and in `.env` locally:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PHONE_FINDER_ENABLED` | yes | `false` | Master switch |
| `PHONE_FINDER_WEBHOOK_SECRET` | yes | — | Bearer secret the GHL webhook sends. The endpoint returns 500 without it. |
| `TRESTLE_API_KEY` | yes | — | Trestle API key |
| `ENFORMION_AP_NAME` / `ENFORMION_AP_PASSWORD` | yes | — | EnformionGO Access Profile |
| `PHONE_FINDER_DAILY_LIMIT` | no | `100` | Paid searches per day (agent timezone). 0 blocks all searches. |
| `PHONE_FINDER_MAX_SEARCHES` | no | `4` | EnformionGO name variants per tick. Misses are free but count toward the plan's monthly search cap. |
| `PHONE_FINDER_MIN_IDENTITY_SCORE` | no | `75` | Below this, the field says "Weak record match" |
| `PHONE_FINDER_RERUN_COOLDOWN_HOURS` | no | `24` | Re-ticking with unchanged info inside this window does nothing |
| `PHONE_FINDER_ENFORMION_PRICE_MILLS` | no | `250` | Cost estimate per match, in 1/1000 USD |
| `PHONE_FINDER_DEBUG` | no | `false` | Extra logs. They never contain names, emails or full numbers. |

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Phone Finder also uses the existing `AGENT_CRM_PI`, `AGENT_CRM_LOCATION_ID`, `AGENT_LOCAL_TIMEZONE`,
`DATABASE_URL` and `QSTASH_*`. With `QSTASH_ENABLED` off, a tick runs inline instead.

## 3. Database

Migration `0040` adds `phone_finder_runs` (one row per contact) and `phone_finder_daily_usage`. Both
statements are `CREATE … IF NOT EXISTS`. Apply only `drizzle/0040_cuddly_maverick.sql`. Don't run a
blind `pnpm db:migrate`: it re-executes every file.

## 4. GHL fields

`pnpm phone-finder:fields` handles both fields and is safe to re-run:
- It finds **Additional Possible Phones** by its key, `contact.additional_possible_phones_multiline`.
- It creates the **Find More Phones** checkbox (one option, **Search**) in the same folder.
- It writes both ids into `lib/phone-finder/ghl-field-ids.ts`.

Both fields already exist (2026-10-16).

## 5. GHL workflow (built by hand — GHL's API can't create workflows)

1. **Automation → Workflows → Create Workflow → Start from scratch.** Name it **Phone Finder**.
2. **Trigger: Contact Changed.**
   - Add filter **Custom Field → Find More Phones**.
   - Pick **Has changed to → Search** if the builder offers it. Otherwise pick **Is → Search**.
3. **Action: Custom Webhook.** This is a Workflow Premium action at $0.01 per run after 100 free
   runs; the Agent CRM agency must have Premium Features enabled.
   - **Method:** POST
   - **URL:** `https://www.isaacplans.com/api/webhooks/agent-crm/phone-finder`
   - **Authorization:** Bearer Token = your `PHONE_FINDER_WEBHOOK_SECRET`. If the builder has no
     Bearer option, choose "No auth + Custom Header" with `Authorization: Bearer <secret>`.
   - **Header:** `Content-Type: application/json`
   - **Body (raw JSON):** `{"contactId":"{{contact.id}}"}`. Insert `{{contact.id}}` with the `{ }`
     picker.
4. **Action: Update Contact Field.**
   - Action type **Clear field data**, field **Find More Phones**. This unticks the box so it can be
     ticked again later.
5. **Settings:** Allow Re-entry **ON**. Then **Publish**.

Make sure no other workflow triggers on an *unfiltered* Contact Changed in a way that messages the
lead. Phone Finder's own field write is a contact change too.

## 6. Test

1. **Free plan check.** `pnpm phone-finder:try <yourContactId>` reads the contact and prints the
   search plan. No vendor calls, nothing written.
2. **Paid dry run.** `pnpm phone-finder:try <yourContactId> --yes` makes the real vendor calls and
   prints the exact field text it *would* write. It writes nothing. Run it on a few leads whose right
   number you already know.
3. **End to end.** Set `PHONE_FINDER_ENABLED=true`, publish the workflow, and tick the box on a
   test contact. Then confirm:
   - The field fills.
   - The box unticks.
   - The contact's other custom fields are unchanged.
   - The workflow execution log shows the webhook answered `{"ok":true,"queued":true,...}`.

**Offline tests:** `pnpm test:phone-finder` (no keys, no network).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Webhook step fails with 401 | The secret in the workflow doesn't match `PHONE_FINDER_WEBHOOK_SECRET` |
| Webhook answers `"skipped":"disabled"` | `PHONE_FINDER_ENABLED` isn't `true` in Vercel |
| Webhook answers `"queued":false,"reason":"in_flight"` | A search for that contact is still running; wait a minute |
| Nothing happens on a re-tick | Same info searched within the last 24 h; the field already has that answer. Change the email or address, or wait. |
| Field says "Daily search limit reached" | `PHONE_FINDER_DAILY_LIMIT` hit; resets at midnight in the agent timezone |
| Field says "EnformionGO account problem" | Wrong Access Profile, or the plan's monthly search limit is used up |
| "N number(s) could not be checked by Trestle" | Trestle wallet empty or key revoked. Numbers still show, without ✓. |
| Vercel logs `[PHONE_FINDER] Not configured; run left pending` | A required env var is missing. The run stays pending and the daily reconcile picks it up once it's fixed. |

Each search is recorded in `phone_finder_runs` (status, outcome, estimated cost, PII-free summary).
Spend per day is in `phone_finder_daily_usage`. The daily `/api/cron/queue-reconcile` finishes any
search QStash never delivered.
