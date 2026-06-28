# QStash Setup (Event-Driven Background Jobs)

Upstash QStash replaces frequent Neon-polling crons with an **event-driven** model:
publish a message when there's real work, and QStash calls an HTTP endpoint back
(with built-in retries and exact-time delivery). The database stays idle — and
therefore cheap — until there's actually something to do.

> **Why this exists:** two crons (`kixie-call-summary` every 3 min, `social-publish`
> every 5 min) queried Neon around the clock, so the serverless compute never
> auto-suspended and billed ~24/7 (≈$59/month flat, regardless of call volume).
> QStash makes cost scale with real usage instead of wall-clock time.

## How it works

**Kixie call summaries**
1. Kixie End Call → `POST /api/webhooks/kixie/calls` → enqueues a job row (dedup) →
2. `after()` publishes a QStash message → QStash calls `POST /api/queue/kixie-call-summary` →
3. that endpoint claims the job by id and runs Whisper → GPT → GHL note.
4. On a transient error it returns `500`, so QStash retries with backoff.

**Social publishing**
1. Schedule a post → `POST /api/admin/social-publishing/schedule` →
2. publishes a QStash message with `notBefore = scheduledFor` and stores the
   returned `qstashMessageId` on the post row →
3. QStash calls `POST /api/queue/social-publish` at the scheduled time → publishes.
4. Reschedule/cancel deletes the old QStash message and (for reschedule) publishes a new one.

**Backstop:** `/api/cron/queue-reconcile` runs **once daily** to drain anything
QStash ever missed (lost message / exhausted retries). One Neon wake/day.

## Environment variables

| Var | Required | Notes |
|-----|----------|-------|
| `QSTASH_ENABLED` | yes | `true` to use QStash. When `false`, Kixie falls back to a direct processor kick and posts wait for the daily reconcile. Keep `false` in local dev (QStash cloud can't reach `localhost`). |
| `QSTASH_TOKEN` | yes (prod) | Publish token — Upstash console → QStash → US/EU region. |
| `QSTASH_URL` | yes (prod) | Region-specific endpoint shown next to the token, e.g. `https://qstash-us-east-1.upstash.io`. Must match the region the token came from. |
| `QSTASH_CURRENT_SIGNING_KEY` | yes (prod) | For verifying inbound deliveries. |
| `QSTASH_NEXT_SIGNING_KEY` | yes (prod) | Rotation key (also from the console). |
| `QSTASH_TARGET_BASE_URL` | yes (prod) | Public origin QStash calls back, e.g. `https://www.isaacplans.com`. Falls back to the inbound request origin if unset. |

## Database migration

A `qstash_message_id` column was added to `social_scheduled_posts`. Apply it:

```bash
pnpm db:migrate   # applies drizzle/0010_*.sql
```

## Setup steps

1. Create a QStash project at https://console.upstash.com/qstash and copy the
   token + both signing keys.
2. Add the env vars above to Vercel (and `.env` for reference). Set
   `QSTASH_TARGET_BASE_URL` to the production domain.
3. Run the migration on the production database (`pnpm db:migrate`).
4. Set `QSTASH_ENABLED=true` in Vercel and redeploy.
5. **Neon console** (Project → Branch → Compute): set **autosuspend = 60s** and
   **min compute = 0.25 CU**. This is the biggest immediate cost win.

## Local development

QStash cloud cannot reach `localhost`, so keep `QSTASH_ENABLED=false` locally —
the Kixie webhook will use its direct kick fallback. To test the QStash path
locally, run the dev server:

```bash
npx @upstash/qstash-cli dev   # prints local QSTASH_URL + signing keys to use
```

## Health check

```bash
# Should return 401 (signature required) — confirms the endpoint is protected:
curl -i -X POST https://www.isaacplans.com/api/queue/kixie-call-summary -d '{}'
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Deliveries 401 | Signing keys missing/wrong, or `QSTASH_TARGET_BASE_URL` ≠ the URL QStash calls (host/`www` mismatch). |
| Nothing published | `QSTASH_ENABLED=false` or `QSTASH_TOKEN` unset → `publishJob` no-ops (jobs still run via the kick / daily reconcile). |
| Posts publish late | Confirm `qstash_message_id` is saved on the row and the message exists in the Upstash console. |
| Job retried forever | QStash caps retries; permanent failures (`missing_recording_url`, bad post data) return 200 so they don't retry. |
