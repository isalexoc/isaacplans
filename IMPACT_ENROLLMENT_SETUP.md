# Impact enrollment welcome — setup

After you enroll a client in Impact Health Sharing, open **/health-alternative/intake** and click
**Impact enrollment** on the client's row or on a CRM search result. Fill in:
- the member ID,
- the start date,
- the monthly payment,
- the payment day,
- the **member ID card PDF** from the Impact portal.

Then click **Send welcome**. The client gets:
- the **welcome email with the ID card PDF attached**, sent by the app through the CRM;
- **two texts (the first with the card as an image) and a WhatsApp**, sent by your Agent CRM
  workflow. The WhatsApp is a utility template with no image; it points the client to their email for the card.

**No custom fields are created.** The values and the card links travel in the email and in the body
of the workflow's trigger request. They are used only for that send.

## How it works

```
Dashboard → "Impact enrollment" dialog
  - Name, email, phone and language come from the CRM contact.
  - You type the 4 values and pick the card PDF.
  - The browser renders the PDF (pdf.js) into one JPG, front over back, and previews it.
    Click the preview to check it full size.
  - Send ──► POST /api/admin/impact-enrollment/<contactId>   (admin only)

Server
  1. Upload the PDF and the JPG to the CRM media library. A resend with no new file reuses the
     card already stored.
  2. Email: POST /conversations/messages (type Email, html, attachments: [PDF]). The email shows up
     in the contact's conversation.
  3. Texts/WhatsApp: POST the payload to the GHL Inbound Webhook (IMPACT_WELCOME_WEBHOOK_URL).
  4. Save the send in `impact_enrollments`.
  5. Add a note "Impact Health Sharing enrollment" on the contact. It holds the 4 values and the
     PDF link.

GHL workflow "Impact Health Enrollment Info" (one workflow, both languages)
  Inbound Webhook trigger → Find Contact → Language filter (contact has the `spanish` tag?)
    ├─ Spanish: SMS 1 (card image) → wait 1 min → SMS 2 → WhatsApp → wait 2 business days → task
    └─ English: same steps with the English texts and template
```

**Why the email is sent by the app and not the workflow:** a workflow's Send Email action can only
attach a fixed file from the media library, the same file for everyone. Only the API can attach
each client's own card.

**Language:** the dialog doesn't ask for one. A contact with the `spanish` tag gets Spanish, and any
other contact gets English. That's the same condition as the workflow's language filter, so the
email (sent by the app) and the texts (sent by the workflow) always match. The dialog shows which
language applies and why. To switch, change the tag in the CRM, then reopen the dialog.

**What the dialog checks:**
- The card is required on a first send.
- The contact needs an email in the CRM. The email is also their portal username, so use the same
  one they were enrolled with at Impact.
- It warns when the contact has no phone, so the texts and WhatsApp can't go out.
- Use the **Send** checkboxes to send only the email, only the texts and WhatsApp, or both.
- A send to a client who already got the welcome asks for confirmation first.

**When a send fails:**
- **The email fails:** the workflow is not called, so nothing went out. Just retry.
- **The email went out but the workflow refused:** the dialog says so in red. Resend with only
  "Texts and WhatsApp" ticked.

## One-time setup

1. **Database:** run `pnpm db:migrate 0041`, then `pnpm db:migrate 0042`. Together they create
   `impact_enrollments` with the card columns. Don't run plain `pnpm db:migrate`: it re-runs every
   migration from 0000, and on the live database that stops at 0029.
2. **Let the CRM key send messages.** In Agent CRM, go to Settings → Private Integrations. Give the
   key stored in `AGENT_CRM_PI` the scope **`conversations/message.write`**, and keep its
   **`medias.write`** scope, which it needs for uploading the card. Without the first scope, the
   dialog shows "The CRM key is not allowed to send emails".
3. **Build the workflow.** Follow the next section.
4. **Set the env vars** in Vercel (Production) and in `.env`:

   | Var | Value |
   |---|---|
   | `IMPACT_WELCOME_WEBHOOK_URL` | The workflow's Inbound Webhook URL (one workflow for both languages) |
   | `IMPACT_TEMP_PASSWORD` | The shared temporary portal password printed in the email. Kept out of the code because the repo is public. |
   | `IMPACT_EMAIL_FROM` | Optional. The email's sender, e.g. `isaac@isaacplans.com`. When empty, the CRM uses its default sender. |

   Until the webhook URL is set, the dialog can't send the texts. Until `IMPACT_TEMP_PASSWORD` is
   set, it can't send the email. The dialog says so in both cases.

## Building the workflow in Agent CRM

One workflow serves both languages.

1. **Create the workflow.** Go to Automation → Workflows → Create Workflow → Start from scratch.
2. **Add the trigger.** Choose **Inbound Webhook**, then copy its URL into
   `IMPACT_WELCOME_WEBHOOK_URL` in `.env`.
3. **Send a sample.** Keep the workflow in **Draft** and run:

   ```
   pnpm exec tsx scripts/impact-welcome-sample.ts
   ```

   The script posts a fake client with placeholder card links. A Draft workflow doesn't run, so
   nobody gets a message. In the trigger, click **Fetch Sample Requests** and select the request.
4. **Find the contact.** Add **Find Contact** with a single filter:
   - **Contact ID** = `{{inboundWebhookRequest.contact_id}}`, if offered;
   - otherwise **Email** = `{{inboundWebhookRequest.email}}`.

   Put every step under **Contact found**.
5. **Language filter.** Add an If/Else:
   - **English** branch: Tags *does not include* `spanish`;
   - **Spanish** branch: everything else.

   This is the same rule the app uses. Don't branch on a custom field the app doesn't read.

   In each branch, add steps 6 to 9 with that language's texts and template.
6. **SMS 1.** In the action's **attachment** field, add the URL
   `{{inboundWebhookRequest.member_card_image_url}}`. It's a JPG, because most phones don't open a
   PDF sent by text. Then add a **Wait** of 1 minute, so SMS 2 doesn't arrive first.
7. **SMS 2.** Plain text, no attachment.
8. **WhatsApp.** Send the approved utility template (`impact_bienvenida_es` / `impact_welcome_en`,
   below). Its 2 variables come from the contact, set when the template is created. It has no image: the card is in the email.
9. **Dental reminder.** Add a **Wait** of 2 days, Monday to Friday only, then an **Add Task**:
   "Send dental ID to {{contact.first_name}}".
10. **Publish.** Then test from the dashboard on your own contact. After the test, check:
   - the email arrived with the PDF;
   - the texts arrived with the image;
   - the WhatsApp arrived with the name and email filled in;
   - the note was added to the contact.

**Don't add a Send Email step to this workflow.** The app already sends the welcome email.

### Payload keys

Use these as `{{inboundWebhookRequest.<key>}}`. Every value arrives already formatted in the
client's language.

| Key | Spanish example | English example |
|---|---|---|
| `member_id` | `IHS-00123` | `IHS-00123` |
| `start_date` | `1 de noviembre de 2026` | `November 1, 2026` |
| `monthly_amount` | `$189.50` | `$189.50` |
| `payment_day` | `el 5 de cada mes` | `the 5th of every month` |
| `member_card_image_url` | the card JPG (front over back) | same |
| `member_card_url` | the card PDF | same |
| `language` | `es` | `en` |
| `portal_username` | the contact's email | the contact's email |
| `first_name`, `last_name`, `email`, `phone`, `contact_id` | from the CRM contact | from the CRM contact |
| `agent_name` | the signed-in agent's name | the signed-in agent's name |
| `start_date_iso` | `2026-11-01` | `2026-11-01` |
| `monthly_amount_number` | `189.50` | `189.50` |
| `payment_day_number` | `5` | `5` |
| `sent_at` | ISO timestamp | ISO timestamp |

**Template rules:**
- `monthly_amount` already includes the `$`. Don't add another `$` in the template.
- `payment_day` already includes "el" / "the", so write `Pago: {{…monthly_amount}} {{…payment_day}}`.
- `{{user.name}}` is the contact's assigned user. For a contact with none, use
  `{{inboundWebhookRequest.agent_name}}`.
- Don't rename keys in the code once the workflows exist. GHL stores merge tags as literal text, so
  a rename silently blanks them.

## Templates for the workflow

`{{iw.x}}` is short for `{{inboundWebhookRequest.x}}`. Type the full form in GHL.

`<TEMP_PASSWORD>` is your shared temporary portal password. Type it straight into the GHL template.
It is deliberately not in this repo, because the repo is public.

The **email** is not here. It lives in the app (`lib/impact-enrollment/email.ts`), in Spanish and
English, and includes the "your member ID card is attached" section.

### Spanish

**SMS 1** (attach `{{iw.member_card_image_url}}`):

```
Hola {{contact.first_name}}, ¡felicidades por tu plan Impact Health! Aquí va tu tarjeta de miembro. ID: {{iw.member_id}}. Pago: {{iw.monthly_amount}} {{iw.payment_day}}. Portal: impact.mysharable.com/signin/v1/en Usuario: {{contact.email}} Clave: <TEMP_PASSWORD> (cámbiala al entrar). Ayuda: (855) 378-6777. Te mandé todos los detalles por email. -{{user.name}}
```

**SMS 2:**

```
{{contact.first_name}}, para tu médico primario: agenda tu cita y llena los datos aquí: app.impacthealthsharing.com/forms/provider-assistance. Impact te avisará en 3-5 días hábiles cuando esté listo. Tu ID dental estará listo en 48 horas hábiles; te lo enviaré por aquí.
```

**WhatsApp: utility template `impact_bienvenida_es`** (Settings → WhatsApp → Templates).

| Field | Value |
|---|---|
| Category | Utility |
| Language | Spanish (`es`) |
| Header | None |
| Footer | `Isaac Plans Insurance · Respóndeme si tienes dudas` |

It stays under Meta's 1,024-character body limit. It follows Meta's utility rules:
- transactional only;
- no variable at the start or end, none adjacent;
- no password, because passwords belong to the "authentication" category; the client gets theirs
  in the email and SMS 1.

Sample values: `María`, `maria@example.com`.

```
Hola {{1}}, tu inscripción en Impact Health Sharing quedó confirmada. Revisa tu correo: ahí te envié tu tarjeta de miembro y los datos de tu membresía (ID, fecha de inicio y pago mensual). Muestra la tarjeta en cada visita.

🔐 *Portal de miembro*
Usuario: {{2}}
Tu contraseña temporal está en mi correo; cámbiala al entrar.

🦷 Tu ID dental estará listo en 48 horas hábiles y te lo enviaré por aquí.

👨‍⚕️ *Médico primario*
1. Agenda tu cita con una semana de anticipación.
2. Llena los datos de la cita con el botón de abajo.
3. Impact coordina con el consultorio (3 a 5 días hábiles) y te avisa.
¿No tienes doctor? Escribe a CareNavigator@AMPS.com con el tipo de doctor y tu código postal.

🏥 En cada visita pagas solo: $50 doctor de cabecera, $75 especialista o urgent care, $150 emergencias. La telemedicina desde el portal es gratis.

⚠️ Para cirugías no urgentes, MRI, maternidad o cáncer, tu doctor debe llamar antes al (855) 378-6777 para pedir aprobación.
```

Buttons:

| Type | Text | Value |
|---|---|---|
| URL | `Entrar a mi portal` | `https://impact.mysharable.com/signin/v1/en` |
| URL | `Datos de mi cita` | `https://app.impacthealthsharing.com/forms/provider-assistance` |
| Phone | `Llamar a Impact` | `+1 855 378 6777` |

**Variables are bound to contact fields when you create the template.** Agent CRM's template editor only offers contact and custom fields there; `{{inboundWebhookRequest.*}}` exists only inside a workflow run, so it can't be picked. That's why the WhatsApp carries only standard contact fields and sends the client to their email for the member ID, start date and payment. Those values are in the email and SMS 1. This keeps the no-custom-fields rule.

| Variable | Custom variable | Sample |
|---|---|---|
| `{{1}}` | `{{contact.first_name}}` | `María` |
| `{{2}}` | `{{contact.email}}` | `maria@example.com` |

### English

**SMS 1** (attach `{{iw.member_card_image_url}}`):

```
Hi {{contact.first_name}}, congratulations on your Impact Health plan! Here's your member ID card. ID: {{iw.member_id}}. Payment: {{iw.monthly_amount}}, {{iw.payment_day}}. Portal: impact.mysharable.com/signin/v1/en Username: {{contact.email}} Password: <TEMP_PASSWORD> (change it when you log in). Help: (855) 378-6777. I emailed you all the details. -{{user.name}}
```

**SMS 2:**

```
{{contact.first_name}}, for your primary care doctor: book your appointment and fill in the details here: app.impacthealthsharing.com/forms/provider-assistance. Impact will let you know in 3-5 business days when it's ready. Your dental ID will be ready in 48 business hours; I'll send it to you here.
```

**WhatsApp: utility template `impact_welcome_en`.**

| Field | Value |
|---|---|
| Category | Utility |
| Language | English (US) |
| Header | None |
| Footer | `Isaac Plans Insurance · Reply here with any questions` |
| Buttons | `Go to my portal`, `My appointment details`, `Call Impact` (same values as the Spanish ones) |

The variables are the same as the Spanish ones: `{{1}}` = `{{contact.first_name}}`, `{{2}}` = `{{contact.email}}`.

Sample values: `Maria`, `maria@example.com`.

```
Hi {{1}}, your Impact Health Sharing enrollment is confirmed. Check your email: I sent you your member ID card and your membership details (ID, start date and monthly payment). Show the card at every visit.

🔐 *Member portal*
Username: {{2}}
Your temporary password is in my email; change it when you log in.

🦷 Your dental ID will be ready in 48 business hours, and I'll send it to you here.

👨‍⚕️ *Primary care doctor*
1. Book your appointment, ideally a week ahead.
2. Fill in the appointment details with the button below.
3. Impact coordinates with the office (3 to 5 business days) and lets you know.
Don't have a doctor? Email CareNavigator@AMPS.com with the type of doctor and your ZIP code.

🏥 At each visit you only pay: $50 primary care, $75 specialist or urgent care, $150 emergency room. Telehealth from the portal is free.

⚠️ For non-urgent surgeries, MRIs, maternity or cancer, your doctor must call (855) 378-6777 beforehand to request approval.
```

## Troubleshooting

- **"The CRM key is not allowed to send emails."** Add the `conversations/message.write` scope to the
  Private Integration key (`AGENT_CRM_PI`). Nothing was sent.
- **"Could not save the ID card in the CRM media library."** The key may be missing the
  `medias.write` scope, or the CRM is down. Nothing was sent.
- **"The CRM did not send the email (4xx) …"** The CRM's own message follows the status code.
  Common causes:
  - The contact has email DND on.
  - The `IMPACT_EMAIL_FROM` address is not allowed to send from your account.
  Nothing was sent.
- **The texts arrive without the image.** In the SMS action, check that the attachment is the URL
  `{{inboundWebhookRequest.member_card_image_url}}` and not a file uploaded once. Re-fetch the
  sample and re-pick the tag.
- **Messages went out with blank values.** A merge tag doesn't match a payload key. Re-fetch the
  sample request in the trigger and re-pick the tag instead of typing it.
- **`{{contact.*}}` values are blank.** The workflow didn't attach to the contact. Re-check the
  contact mapping in step 4 of the workflow build.
- **The dialog says a workflow or the password is "not connected yet".** Set the env var in Vercel
  and redeploy. Env changes only apply to new deployments.
