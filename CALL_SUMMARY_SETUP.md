# Agent CRM call summaries (OpenAI → contact notes)

Automatically summarizes phone calls from GoHighLevel (Agent CRM) and creates notes on the contact record.

## Flow

1. **Real-time:** GHL sends `InboundMessage` / `OutboundMessage` (call) to the webhook.
2. Fetch transcript from GHL (`GET .../messages/:messageId/transcription`), or Whisper on recording URL if empty.
3. OpenAI generates a structured summary (Spanish or English to match the call), with a **Coaching** section focused on final expense when applicable, and **bold** markdown for key facts (names, DOB, amounts, etc.).
4. `POST /contacts/:contactId/notes` in Agent CRM.
5. `call_summary_processed` table prevents duplicate notes.

**Backfill:** Daily cron processes recent calls that were missed.

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

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model for summaries |
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

### 3. Health check

```bash
curl https://www.isaacplans.com/api/webhooks/agent-crm/calls
```

Returns `{ ok: true, enabled: true, configured: true }` when env is complete.

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
