# Agent CRM call summaries (OpenAI → contact notes)

Automatically summarizes phone calls from GoHighLevel (Agent CRM) and creates notes on the contact record.

## Flow

1. **Real-time:** GHL sends `InboundMessage` / `OutboundMessage` (call) to the webhook.
2. Fetch transcript from GHL (`GET .../messages/:messageId/transcription`), or Whisper on recording URL if empty.
3. OpenAI extracts the call into structured JSON (`StructuredCallSummary` in `lib/call-summary-structured.ts`): line of business (ACA, STM, Dental/Vision, Hospital Indemnity, IUL, Final Expense), disposition, client profile, health, financial, quote/policy details, objections, next steps, follow-up date, and coaching — in Spanish or English to match the call.
4. A deterministic TypeScript formatter (`lib/call-summary-note-format.ts`) renders the note as plain text with emoji section headers (GHL notes do **not** render Markdown — see [Note format](#note-format) below).
5. `POST /contacts/:contactId/notes` in Agent CRM.
6. `call_summary_processed` table prevents duplicate notes.

**Backfill:** Daily cron processes recent calls that were missed.

**Kixie:** End Call webhook → QStash job → Whisper on `recordingurl` → same OpenAI summary → GHL contact note (see [Kixie setup](#kixie-dialer-setup) below).

## Note format

GHL displays contact notes as plain text, so the note is built deterministically in code (never by the model): an at-a-glance status line (line-of-business + disposition + follow-up date), then `Key: Value` sections — only sections with data appear. Labels are localized (EN/ES) based on the detected call language. Example:

```
[AI Call Summary] — Jul 17, 2026, 2:14 PM · inbound · 18m 32s

🕊️ Final Expense | 💲 Quoted | 📅 Follow-up: Tue 7/22 2:00 PM
━━━━━━━━━━━━━━━
📝 SUMMARY
Maria called about burial coverage. Quoted $10,000 with Aetna at $54.30/mo.
Callback set for Tuesday 2 PM with her son Carlos.

👤 CLIENT INFO
Name: María López
DOB: 03/15/1948 (age 78)
Phone: (813) 555-0147

🏥 HEALTH
Tobacco: No
Conditions: diabetes (oral meds), high blood pressure
Medications: metformin 500mg, lisinopril

💰 FINANCIAL
Income: Social Security $1,200/mo
Budget: $50–60/mo

📋 QUOTE / POLICY
Carrier: Aetna (Protection Series)
Face amount: $10,000
Premium: $54.30/mo
Beneficiary: son Carlos López

⚠️ OBJECTIONS
• Wants son Carlos to hear details before signing

✅ NEXT STEPS
• [Tue 7/22 2:00 PM] Call back with Carlos on the line — agent

💡 COACHING
• Strong discovery, but no trial close after the quote
━━━━━━━━━━━━━━━
Generated from Kixie call recording (kx_12345)
```

**Sensitive data:** SSNs, bank/routing, and card numbers are masked to their last 4 digits (`•••-••-6789`, `•••• 1111`) — the prompt instructs last-4 only and `maskSensitiveNumbers` re-masks the final note as a backstop. Phone numbers are never masked.

## Callback Priority + Call Metrics dashboards

Every processed call now also writes `disposition`, `lineOfBusiness`, `followUpDateIso`, and the full structured summary JSON into `call_summary_processed` (previously this data only existed as text inside the GHL note). Two admin pages read it:

- `/admin/call-dashboard` — contacts whose most recent completed call has an open disposition (follow_up, appointment_set, needs_info, no_decision), sorted by soonest promised follow-up.
- `/admin/call-metrics` — contact rate, disposition mix, and line-of-business mix for the last 7/30/90 days.

Both are linked from the "Call Center" section on `/admin`. No new env vars required — they read data the pipeline already writes.

## Missed-call SMS/WhatsApp drafts

When a call goes unanswered (no-answer/busy/failed — from GHL or Kixie, same behavior either way), the pipeline drafts a short SMS and a slightly warmer WhatsApp follow-up message and posts them as a CRM note titled "📱 Follow-Up Drafts" for the agent to review and copy/send manually — **never auto-sent**. Repeated dial attempts to the same contact within the same local day (triple-dialing) collapse into one draft.

| Variable | Default | Purpose |
|----------|---------|---------|
| `MISSED_CALL_DRAFTS_ENABLED` | `false` | Master switch |
| `MISSED_CALL_DRAFTS_NOTE_PREFIX` | `📱 Follow-Up Drafts` | Note title prefix |
| `AGENT_LOCAL_TIMEZONE` | `America/New_York` | Used for the "one draft per contact per day" dedup boundary and for resolving relative follow-up dates ("Tuesday 2pm") into absolute datetimes |
| `AGENT_CRM_APP_URL` | `https://app.gohighlevel.com` | Override if the GHL contact deep-link shape ever changes |

Requires the same `AGENT_CRM_PI`, `OPENAI_API_KEY`, and `DATABASE_URL` as the rest of this pipeline. Test locally with `pnpm test:missed-call-drafts --formatter-only` (no network) or `pnpm test:missed-call-drafts en` / `es` (live OpenAI, prints both drafts, never posts a note).

## Environment variables

### Required (you likely already have)

| Variable | Purpose |
|----------|---------|
| `AGENT_CRM_PI` | Private Integration token |
| `AGENT_CRM_LOCATION_ID` | Sub-account / location ID |
| `OPENAI_API_KEY` | OpenAI API key |
| `DATABASE_URL` | Neon Postgres (idempotency table) |

### Call summary (your `.env` block)

| Variable | Example | Purpose |
|----------|---------|---------|
| `AGENT_CRM_CALL_SUMMARY_ENABLED` | `true` | Master switch |
| `AGENT_CRM_CALL_SUMMARY_WEBHOOK_SECRET` | *(you choose)* | Bearer token for workflow webhooks; optional if using GHL signature headers |
| `AGENT_CRM_CALL_SUMMARY_NOTE_PREFIX` | `AI Call Summary` | Prefix in note (no quotes in `.env`) |
| `CRON_SECRET` | *(long random string)* | Protects backfill cron route |
| `OPENAI_WHISPER_MODEL` | `whisper-1` | Fallback when GHL transcript is empty |
| `AGENT_CRM_CALL_SUMMARY_INCLUDE_VOICEMAIL` | `false` | Include voicemail calls |
| `AGENT_CRM_CALL_SUMMARY_DEBUG` | `true` | Verbose step-by-step logs in server console (Vercel → Logs) |

### Kixie dialer

| Variable | Example | Purpose |
|----------|---------|---------|
| `KIXIE_CALL_SUMMARY_ENABLED` | `true` | Master switch for Kixie End Call webhook |
| `KIXIE_CALL_SUMMARY_WEBHOOK_SECRET` | *(you choose)* | Webhook auth (`x-call-summary-secret` header or `?token=`) |
| `KIXIE_CALL_SUMMARY_MIN_DURATION_SECONDS` | `60` | Skip short calls (also filter in Kixie UI) |
| `KIXIE_API_KEY` | *(from Kixie dashboard)* | Recording download auth |
| `KIXIE_BUSINESS_ID` | e.g. `65871` | Optional query param for recording URL |
| `KIXIE_RECORDING_MAX_BYTES` | `24000000` | Max bytes per Whisper chunk (~25MB API limit) |
| `KIXIE_WHISPER_SEGMENT_SECONDS` | `600` | Split longer recordings (10 min segments) |

Requires the same `AGENT_CRM_*`, `OPENAI_*`, `DATABASE_URL`, and `CRON_SECRET` as GHL summaries.

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_MODEL` | `gpt-4o` | Chat model for summaries (use `gpt-4o-mini` to cut cost) |
| `OPENAI_MAX_OUTPUT_TOKENS` | `3000` | Cap on summary output tokens |
| `AGENT_CRM_CALL_SUMMARY_MAX_TRANSCRIPT_CHARS` | `120000` | Truncate long transcripts |
| `AGENT_CRM_CALL_SUMMARY_BACKFILL_DAYS` | `30` | How far back cron looks |
| `AGENT_CRM_CALL_SUMMARY_BACKFILL_MAX_PER_RUN` | `15` | Max calls per cron run |

Set all variables in **Vercel** production and in **`.env.local`** locally.

## Database migration

```bash
npm run db:migrate
```

Creates table `call_summary_processed`.

## GoHighLevel setup

### 1. Private Integration scopes

In Agent CRM → Settings → Private Integrations → edit your PI:

- Contacts: read + write (notes)
- Conversations / messages: read (transcription + export)
- Enable **call transcription** in phone settings if available

### 2. Webhook URL

**Production:**

```
https://www.isaacplans.com/api/webhooks/agent-crm/calls
```

**Option A — Native GHL webhooks (recommended)**

Subscribe to:

- `InboundMessage`
- `OutboundMessage`

GHL signs requests with `X-GHL-Signature` (or legacy `X-WH-Signature`). No shared secret required if signatures verify.

**Option B — Workflow custom webhook**

After each completed call, add **Custom Webhook**:

- URL: same as above
- Header: `Authorization: Bearer <AGENT_CRM_CALL_SUMMARY_WEBHOOK_SECRET>`
- Body: `contactId`, `messageType: CALL`, and `transcript` from the Transcript Generated trigger.
- Filter short calls in the **GHL workflow** (e.g. duration &gt; 60s); the app does not enforce a minimum duration.

Example workflow JSON:

```json
{
  "contactId": "{{contact.id}}",
  "messageType": "CALL",
  "transcript": "{{transcript_generated.call_transcript}}"
}
```

Use the `{ }` picker for each value. `messageId` is optional when `transcript` is sent.

### 3. Health check (GHL)

```bash
curl https://www.isaacplans.com/api/webhooks/agent-crm/calls
```

Returns `{ ok: true, enabled: true, configured: true }` when env is complete.

## Kixie dialer setup

### 1. Prerequisites

- Kixie integrated with **Go High Level** (LeadConnector) so `contactid` and `crmlink` are populated.
- **Call recording** enabled in Kixie (required for `recordingurl`).
- Same Private Integration and OpenAI keys as the GHL flow.

### 2. Webhook in Kixie

**Manage → Integrations → Kixie Event Webhooks** (or Account → Webhooks):

| Setting | Value |
|---------|--------|
| Event | **End Call** (`endcall`) |
| URL | `https://www.isaacplans.com/api/webhooks/kixie/calls` |
| Header | `x-call-summary-secret`: `<KIXIE_CALL_SUMMARY_WEBHOOK_SECRET>` (no `Bearer` — Kixie rejects spaces) |
| Filters | **Answered** calls; duration **≥ 60 seconds** (recommended) |

**Async queue:** The webhook only enqueues a job (`status: pending`) and publishes a QStash message. QStash delivers to `/api/queue/kixie-call-summary` (**800s** timeout on Vercel Pro), which downloads the MP3, runs Whisper (with ffmpeg chunking for long calls), and creates the GHL note. The daily `/api/cron/queue-reconcile` cron drains any job QStash missed; `/api/cron/kixie-call-summary` remains as a manual kick target.

Kixie sends JSON automatically (no custom body). Important fields:

- `data.callDetails.contactid` — GHL contact ID
- `data.callDetails.recordingurl` — MP3 for Whisper
- `data.callDetails.callid` — idempotency key (`kx_<callid>`)

### 3. Health check

```bash
curl https://www.isaacplans.com/api/webhooks/kixie/calls
```

### 4. Processor cron (manual)

```bash
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://www.isaacplans.com/api/cron/kixie-call-summary
```

Runs one queued Kixie job. Not scheduled in `vercel.json` — live processing is event-driven via QStash (`/api/queue/kixie-call-summary`), with the daily `/api/cron/queue-reconcile` as the safety net.

### 5. Avoid duplicate notes

If the same call also triggers your GHL **Transcript Generated** workflow, you may get **two** notes. Use **one** path per dialer:

- **LC Phone / GHL native** → GHL workflow only  
- **Kixie PowerCall** → Kixie webhook only  

## Cron backfill

`vercel.json` runs daily at 06:00 UTC:

```
GET /api/cron/call-summary-backfill
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the project.

Manual run:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://www.isaacplans.com/api/cron/call-summary-backfill?days=30&max=10"
```

## Local testing

**Without any API calls or webhooks** — deterministic formatter + masking checks:

```bash
pnpm test:call-summary --formatter-only
```

**Live OpenAI run on a sample transcript** (needs `OPENAI_API_KEY`; never posts a CRM note):

```bash
pnpm test:call-summary fe-en   # also: fe-es, aca-es, iul-en
```

**Full webhook flow:**

1. `npm run db:migrate`
2. `npm run dev`
3. Use ngrok or similar to expose `/api/webhooks/agent-crm/calls`
4. POST a sample call payload with `Authorization: Bearer <your webhook secret>`

## Debug logging

Set in `.env.local` / Vercel:

```env
AGENT_CRM_CALL_SUMMARY_DEBUG=true
```

All logs use the prefix `[AGENT_CRM_CALL_SUMMARY]`.

| Level | When |
|-------|------|
| `info` | Always — webhook accepted, pipeline start/end, note created, skips |
| `warn` / `error` | Always — auth failures, API errors, pipeline failures |
| `debug` / `→ step` | Only when `DEBUG=true` — payloads (sanitized), API timings, transcript previews |

View logs:

- **Local:** terminal running `npm run dev`
- **Production:** Vercel project → Logs → filter by `[AGENT_CRM_CALL_SUMMARY]`

Health check includes `debug: true/false`:

```bash
curl https://www.isaacplans.com/api/webhooks/agent-crm/calls
```

## Troubleshooting

| Issue | Check |
|-------|--------|
| 401 Unauthorized | Webhook secret / GHL signature |
| `not_configured` | `OPENAI_API_KEY`, `AGENT_CRM_PI`, `AGENT_CRM_LOCATION_ID` |
| `No transcript available` | GHL transcription on? Recording in `attachments`? |
| `Create note failed 401` | PI needs `contacts.write` |
| Duplicate notes | Run migration; `call_summary_processed` must exist |
| Kixie `missing_recording_url` | Enable call recording in Kixie |
| Kixie `missing_contact_id` | Confirm GHL integration; check `contactid` in webhook payload |
| Kixie download 403 | Fixed via browser-like headers + `KIXIE_API_KEY`; retry with `failed` row |
| Kixie slow / timeout | Processor allows **800s**; very long calls use ffmpeg 10-min chunks |
| Job stuck `processing` | Reclaimed after 2 hours; or run processor cron manually |
| Run migration | `npm run db:migrate` for `0009_call_summary_jobs.sql` |
