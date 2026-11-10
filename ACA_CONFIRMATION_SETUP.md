# ACA application review confirmation — setup

CMS requires a record that each ACA client **reviewed their Marketplace application and confirmed it
is accurate before it was submitted** (45 CFR 155.220(j)(2)(ii)(A)). The record must show the date
reviewed, the client's name, that the attestations were explained, and the agent's name. You keep it
**10 years** and hand it to CMS if they ask.

This is the **second** CMS signature. The first one, the agent-of-record consent, still goes out
from your Agent CRM workflow, exactly as before. Nothing about it changed.

The wording is CMS's own **Model Eligibility Application Review Form** (OMB 0938-1438, English and
Spanish), with your name and NPN and the client's name filled in. Three lines are added: "and I
understand what they mean" (CMS's FAQ asks for that), the electronic-signature line, and the
10-year line.

## How to use it on a call

1. Fill in the Marketplace application with the client. **Don't submit yet.**
2. Open **/aca/intake** and click **Confirmación** on the client's row, or on a CRM search result.
3. Check the **legal name**. Use it exactly as it appears on the application; it's printed on the
   form. Check the language. **Preview the document** if you want to see what they'll sign.
4. Click **Send for signature**. The client gets the email right away.
5. Stay on the call. The dialog updates by itself: **Sent → Opened → Signed**.
6. When it says **Signed**, submit the application.

**Every new application, update or plan change needs a new confirmation.** The dialog keeps the
history for each client, and every signed one has its PDF.

Useful buttons in the dialog:
- **Copy link**: if the email is slow or in spam, paste the link in a WhatsApp or text.
- **Resend email**: same link, and it's good for another 7 days.
- **Cancel request**: the link stops working. Use it if the name was wrong, then send a new one.
- **View PDF / Download PDF**: the signed copy.

## What the client sees

- An email from you through the CRM ("Action needed / Acción requerida"), with a **Review and sign**
  button. It also shows in the contact's conversation.
- A one-page form on isaacplans.com, in Spanish or English (they can switch).
- A signature box: **draw** with a finger (the default) or **type** their name. The Type box starts
  empty: the client types their own name (CMS wants evidence the client typed it, not that it was
  filled in for them).
- A checkbox: "I reviewed my application information, it is accurate, and I agree to sign this
  confirmation electronically."
- A thank-you screen with the date and time.

The link works **once** and expires in **7 days**. The page has no Facebook Pixel, Google Analytics
or CRM chat, because the link itself is the key and the page shows the client's name and email.

## What happens after they sign

A few seconds later, in the background:

1. **The PDF.** Page 1 is the form with their signature. Page 2 is the signature trail: when it was
   requested, emailed, opened and signed, with the IP address, approximate location and device for
   each, plus an **evidence hash** (SHA-256). The hash covers the text, the names, the signature,
   the signer's details and the time. If anything changed later, it wouldn't match.
2. **The archive.** The PDF is stored privately in Cloudinary. Nobody can open it without a signed
   request from the app. That's the 10-year copy.
3. **The contact's Documents.** The same PDF is uploaded to the File Upload field
   "ACA Confirmación firmada". Agent CRM lists those files in **Documents → Internal → Custom
   Fields**. (Agent CRM has no API for the Documents "+ Add" button. A File Upload field is the one
   way an app can put a file there.)
4. **A note** on the contact (once the PDF is archived): who signed, when, IP, location, device, and a
   download link.
5. **The tag `aca_confirmation_signed`**, last, and only once the PDF is archived and saved in
   Documents. That way an automation started by the tag never runs ahead of the PDF. Use it in your own
   automations if you want, for example to notify you or move a pipeline stage. It's removed and
   re-added on every signature, so "tag added" fires every time.

**If it was signed from your IP address.** The app compares the client's IP with the ones you used
to send the request. If they match, the dialog shows a red warning and the PDF's second page says
so. An agent signing for a client is exactly what CMS audits for. If the client didn't sign it
themselves, cancel it and send a new one.

## One-time setup

1. **Database.** Run:

   ```
   pnpm db:migrate 0043
   ```

   **Not** plain `pnpm db:migrate`. That re-runs every migration from 0000 and fails at 0029.
2. **CRM key scopes.** In Agent CRM → Settings → Private Integrations, the key in `AGENT_CRM_PI`
   needs:
   - `conversations/message.write` (the same one the Impact welcome needs) — to send the email;
   - `forms.write` — to upload the PDF to the File Upload field;
   - the contacts, tags and notes scopes the app already uses.
3. **The File Upload field.** Run the dry run first, then the real thing:

   ```
   pnpm aca-confirmation:field --dry-run
   pnpm aca-confirmation:field
   ```

   It creates "ACA Confirmación firmada" (or finds it if it's there) and prints its id.
4. **Env vars**, in Vercel (Production) and `.env`, then redeploy. Env changes only apply to new
   deployments.

   | Var | Value |
   |---|---|
   | `ACA_AGENT_NPN` | **Required.** Your NPN. Never put it in the code: the repo is public. Until it's set, the dialog can't send. |
   | `ACA_CONFIRMATION_FILE_FIELD_ID` | The id printed in step 3. Until it's set, the PDF is archived but not saved in the contact's Documents. |
   | `ACA_CONFIRMATION_EMAIL_FROM` | Optional. The sender, e.g. `isaac@isaacplans.com`. Empty = the CRM's default sender. |
   | `ACA_AGENT_NAME` | Optional. Default `Isaac Orraiz`. |
   | `ACA_AGENT_PHONE` | Optional. Default `(540) 426-1804`. |
   | `ACA_AGENT_EMAIL` | Optional. Default `info@isaacplans.com`. |

   QStash and Cloudinary are already set up; nothing new there.

## First test (on your own contact)

Use an email that is **not** @isaacplans.com: the app refuses those, because the link has to reach
the client's own inbox.

- [ ] The email arrives, and it shows in the contact's conversation.
- [ ] The dialog goes **Sent → Opened → Signed** while you watch.
- [ ] The PDF is 2 pages, with the right name, NPN, times and trail.
- [ ] The PDF is in the contact's **Documents → Internal → Custom Fields**.
- [ ] The note and the `aca_confirmation_signed` tag are on the contact.
- [ ] Opening the link again says it was already signed.
- [ ] Resend and Cancel work on a second test request.

**Quick check you can do today, no code needed:** open an IUL client who sent files through the
app's document link (those go to a File Upload field the same way), then open **Documents →
Internal**. If their file is under **Custom Fields**, step 3 above will work the same way.

## If CMS asks for a record

- Open the client in **/aca/intake** → **Confirmación**: every confirmation is listed with its PDF.
  This works even if the contact was later merged or deleted in Agent CRM. Only sending a new one
  needs the contact.
- **Download PDF** always gives the archived file, the one whose hash is recorded. If the archive
  can't be reached at that moment, it says so instead of handing you a re-made copy.
- Or open the contact in Agent CRM: **Documents → Internal → Custom Fields**, or the note's link.
- The PDF's second page shows exactly when it was signed. That has to be **before** the
  application's submission time on the Marketplace.

## Troubleshooting

- **"The CRM key is not allowed to send emails."** Add the `conversations/message.write` scope (step
  2). The link was still created: copy it, or resend after fixing the scope.
- **"The CRM did not send the email (4xx)…"** Usually email DND on the contact, or an
  `ACA_CONFIRMATION_EMAIL_FROM` address the CRM won't send from.
- **"Set ACA_AGENT_NPN in Vercel…"** Step 4, then redeploy.
- **"Saved in the contact's Documents" never turns green.** `ACA_CONFIRMATION_FILE_FIELD_ID` is
  missing or wrong, or the key lacks `forms.write`. The PDF is still archived and the note has the
  link; the tag waits for this step. Once it's fixed, the daily job (7 AM UTC) finishes anything
  signed in the last 60 days. You can still send new confirmations in the meantime.
- **The client says the link expired or doesn't work.** Resend it (another 7 days), or cancel and
  send a new one.
- **The client's email in the CRM changed.** Resend refuses, because the form shows the old email.
  Cancel and send a new one.

## Plan year 2028: heads-up

For enrollments from **August 1, 2027** (plan year 2028), CMS requires its **own HHS-created form,
word for word**, for both the consent **and** this review. A typed signature or a checked box will
no longer count. Consents and reviews collected before then stop counting for 2028 enrollments.
HHS hadn't published that form yet (as of November 2026).

- The form text here is a **versioned template**: the HHS text drops in as a new version, with
  typing turned off.
- From Aug 1, 2027 the dialog shows a warning before sending with this wording. It still sends,
  because 2027 special-enrollment work stays valid until the end of 2027.
- **Your first-consent Agent CRM form needs the same change by then.** Its wording will have to be
  replaced with the HHS form, and the signature set to "Draw".

## How it works (for whoever maintains it)

```
/aca/intake → "Confirmación" dialog
  POST /api/admin/aca-confirmation/<contactId>      issue + email (CRM Conversations API)
  GET  /api/admin/aca-confirmation/requests/<id>    live status (polled only while the dialog is open)

/{en|es}/aca/{confirmation|confirmacion}/<token>    the client's page (public; token = credential)
  GET  /api/aca-confirmation/<token>                the form; records "viewed" (browser fetch only)
  POST /api/aca-confirmation/<token>                the signature; one conditional UPDATE

QStash → /api/queue/aca-confirmation-finalize       PDF → Cloudinary → File Upload field → note → tag
Daily /api/cron/queue-reconcile                     finishes anything QStash gave up on
```

- Code: `lib/aca-confirmation/` (`form-text.ts` = the wording, versioned; `server.ts`; `finalize.ts`;
  `pdf.tsx`), `components/aca-confirmation/`.
- Tables: `aca_confirmations` (one row per request, never overwritten once signed) and
  `aca_confirmation_events` (the trail).
- Offline test: `pnpm test:aca-confirmation`.
