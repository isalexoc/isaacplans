# IUL Credentials Share — GoHighLevel Automation

Auto-generate a branded **agent credentials image** (headshot + contact + state
license + driver's license) for a client's state and send it from a GoHighLevel
(LeadConnector) workflow — no manual generating during the call.

This is the automated version of the "Download as Image/PDF" buttons on
**/iul/presentacion** slide 1. Same secure Cloudinary-authenticated source
images; the difference is the composing happens server-side on demand.

---

## How it works

```
GHL workflow ──(Webhook: state + secret)──▶ POST /api/iul/credentials-image
                                                   │
             pulls your authenticated state + driver's-license images (signed, server-side)
             renders one branded card with next/og
             uploads it to Cloudinary (public, unguessable ID)
             schedules a QStash job to delete it after TTL
                                                   │
        ◀────────────────── { "url": "https://res.cloudinary.com/.../xyz.png" }
                                                   │
GHL maps {{url}} into the next step ──▶ send via SMS/MMS, Email, or WhatsApp
```

- **Endpoint:** `POST https://www.isaacplans.com/api/iul/credentials-image`
- **Auth:** shared secret (not Clerk) — this route is intentionally public + secret-guarded.
- **Output:** a single PNG URL. The card auto-deletes after `IUL_CREDENTIALS_TTL_HOURS`
  (default **48h**) so your ID documents aren't left permanently public.

### Channel notes
- **MMS / WhatsApp:** the carrier/WhatsApp re-hosts the media at send time, so the
  48h TTL never affects delivery.
- **Email:** the URL is embedded and loaded when the client opens the email — make
  sure the TTL comfortably covers how long that might take (raise
  `IUL_CREDENTIALS_TTL_HOURS` if clients tend to open emails days later).

---

## Environment variables

Set these locally in `.env` **and** in Vercel → Project → Settings → Environment
Variables (Production):

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `IUL_CREDENTIALS_SHARE_SECRET` | ✅ | — | Secret GHL must send. Without it the endpoint returns 500. |
| `IUL_CREDENTIALS_TTL_HOURS` | — | `48` | Hours before the generated card is auto-deleted. |

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Auto-delete uses the existing QStash setup (`QSTASH_ENABLED`, signing keys — see
QSTASH_SETUP.md). If QStash is **off**, the image still generates and returns a
URL, but it is **not** auto-deleted — purge the `iul-credentials/` Cloudinary
folder periodically in that case.

---

## Request / response contract

**Request** — JSON body (or query params):

| Field | Required | Notes |
| --- | --- | --- |
| `state` | ✅ | 2-letter code (`FL`) or full name (`Florida`). Must be a **licensed** state. Case-insensitive. |
| `locale` | — | `en` or `es` (default `en`). Controls the labels on the card. |

Secret can be sent three ways (any one):
- `Authorization: Bearer <secret>`
- `x-share-secret: <secret>`
- `?secret=<secret>` query param

**Success (200):**
```json
{
  "success": true,
  "url": "https://res.cloudinary.com/<cloud>/image/upload/iul-credentials/fl-en-….png",
  "state": { "code": "FL", "name": "Florida" },
  "locale": "en",
  "expiresInHours": 48,
  "autoDelete": true
}
```

**Errors:**
- `400` — missing `state`
- `401` — bad/missing secret
- `404` — state not licensed, or no license image on file (`code`: `unknown_state` / `missing_state_image` / `missing_drivers_image`)
- `500` — endpoint not configured, or render failure

### Quick manual test
```bash
curl -X POST https://www.isaacplans.com/api/iul/credentials-image \
  -H "Authorization: Bearer $IUL_CREDENTIALS_SHARE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"state":"FL","locale":"es"}'
```
(Or in a browser while testing: `…/api/iul/credentials-image?state=FL&secret=YOUR_SECRET`.)

---

## GoHighLevel workflow setup

You build this in GHL — the app only provides the endpoint. It does **not** touch
your existing workflows.

1. **Trigger** — whatever you already use (e.g. appointment booked, tag added,
   inbound call, a manual "Send my credentials" tag).

2. **Action → Webhook**
   - **Method:** `POST`
   - **URL:** `https://www.isaacplans.com/api/iul/credentials-image`
   - **Headers:**
     - `Authorization` = `Bearer YOUR_SECRET`
     - `Content-Type` = `application/json`
   - **Body (JSON / Custom Data):**
     ```json
     { "state": "{{contact.state}}", "locale": "es" }
     ```
     `{{contact.state}}` works whether your contacts store `FL` or `Florida`.
     Or use a workflow dropdown/custom field instead of the contact's state.

3. **Map the response** — in the same Webhook action, capture the response so the
   image URL becomes usable downstream. GHL exposes returned fields as
   `{{webhook.<action>.url}}` (or via "Custom Values" mapping, depending on your
   GHL version) — map `url` to a value you'll reference next, e.g. `credentials_image_url`.

4. **Action → Send message** (any channel):
   - **SMS/MMS:** attach/insert the image using the mapped URL.
   - **Email:** put the mapped URL in an `<img src="{{credentials_image_url}}">`
     or as an attachment.
   - **WhatsApp:** send as a media message using the mapped URL.

5. *(Optional)* Add an **If/Else** before the Webhook to only run when
   `{{contact.state}}` is one of your licensed states, so unlicensed states don't
   hit a 404.

---

## Security notes

- Source state + driver's-license images stay `authenticated` in Cloudinary and
  are only ever fetched **server-side** with a signed URL — public IDs never
  reach the browser or GHL. (Same model as `/api/admin/license-image`.)
- The **composed** card is deliberately public so the client can open it with no
  login — that's the whole point of sending it. It uses an unguessable random ID
  and auto-deletes after the TTL.
- Keep `IUL_CREDENTIALS_SHARE_SECRET` private (Vercel + GHL only). Rotate it by
  changing both places; no code change needed.
