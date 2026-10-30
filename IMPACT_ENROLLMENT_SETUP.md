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
- **two texts and a WhatsApp with the card as an image**, sent by your Agent CRM workflow.

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
  3. Texts/WhatsApp: POST the payload to the language's GHL Inbound Webhook
     (IMPACT_WELCOME_WEBHOOK_URL_ES or _EN).
  4. Save the send in `impact_enrollments`.
  5. Add a note "Impact Health Sharing enrollment" on the contact. It holds the 4 values and the
     PDF link.

GHL workflow "Impact welcome (ES/EN)"
  Inbound Webhook trigger → SMS 1 (with the card image) → SMS 2 → WhatsApp (card in the header)
  → wait 2 business days → task "send dental ID"
```

**Why the email is sent by the app and not the workflow:** a workflow's Send Email action can only
attach a fixed file from the media library, the same file for everyone. Only the API can attach
each client's own card.

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

1. **Database:** `pnpm db:migrate` creates `impact_enrollments` (migration `0041`).
2. **Let the CRM key send messages.** In Agent CRM, go to Settings → Private Integrations. Give the
   key stored in `AGENT_CRM_PI` the scope **`conversations/message.write`**, and keep its
   **`medias.write`** scope, which it needs for uploading the card. Without the first scope, the
   dialog shows "The CRM key is not allowed to send emails".
3. **Build the workflows.** Follow the next section.
4. **Set the env vars** in Vercel (Production) and in `.env`:

   | Var | Value |
   |---|---|
   | `IMPACT_WELCOME_WEBHOOK_URL_ES` | The Spanish workflow's Inbound Webhook URL |
   | `IMPACT_WELCOME_WEBHOOK_URL_EN` | The English workflow's Inbound Webhook URL |
   | `IMPACT_TEMP_PASSWORD` | The shared temporary portal password printed in the email. Kept out of the code because the repo is public. |
   | `IMPACT_EMAIL_FROM` | Optional. The email's sender, e.g. `isaac@isaacplans.com`. When empty, the CRM uses its default sender. |

   Until a language's webhook URL is set, the dialog can't send that language's texts. Until
   `IMPACT_TEMP_PASSWORD` is set, it can't send the email. The dialog says so in both cases.

   Prefer one workflow that branches on `{{inboundWebhookRequest.language}}`? Put the same URL in
   both webhook vars.

## Building the workflow in Agent CRM

Do this once per language.

1. **Create the workflow.** Go to Automation → Workflows → Create Workflow → Start from scratch.
   Name it `Impact welcome (ES)`.
2. **Add the trigger.** Choose **Inbound Webhook**, then copy its URL into
   `IMPACT_WELCOME_WEBHOOK_URL_ES` in `.env`.
3. **Send a sample.** Keep the workflow in **Draft** and run:

   ```
   pnpm exec tsx scripts/impact-welcome-sample.ts es
   ```

   The script posts a fake client with placeholder card links. A Draft workflow doesn't run, so
   nobody gets a message. In the trigger, click **Fetch Sample Requests** and select the request.
4. **Match the contact.** Map **Email → `email`** and **Phone → `phone`**. Depending on your
   account, that's in the trigger's contact mapping or in a **Create/Update Contact** action right
   after the trigger. Map only those two fields.
5. **SMS 1.** In the action's **attachment** field, add the URL
   `{{inboundWebhookRequest.member_card_image_url}}`. It's a JPG, because most phones don't open a
   PDF sent by text.
6. **SMS 2.** Plain text, no attachment.
7. **WhatsApp.** Use your utility template with an **image header**, and set the header URL to
   `{{inboundWebhookRequest.member_card_image_url}}`. The card then shows right in the chat. To send
   the PDF instead, use a **document header** with `{{inboundWebhookRequest.member_card_url}}`.
8. **Dental reminder.** Add a **Wait** of 2 days, Monday to Friday only, then an **Add Task**:
   "Send dental ID to {{contact.first_name}}".
9. **Publish.** Then test from the dashboard on your own contact. After the test, check:
   - the email arrived with the PDF;
   - the texts arrived with the image;
   - the WhatsApp arrived with the card;
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

**WhatsApp** (image header: `{{iw.member_card_image_url}}`):

```
¡Hola {{contact.first_name}}! 🎉 *Felicidades por tu nuevo plan con Impact Health Sharing.*

📎 *Arriba está tu tarjeta de miembro.* Guárdala y muéstrala en cada visita.

📋 *Tus datos:*
• ID de miembro: {{iw.member_id}}
• Pago mensual: {{iw.monthly_amount}}
• Fecha de pago: {{iw.payment_day}}
• Atención al cliente: (855) 378-6777

🔐 *Tu portal:*
https://impact.mysharable.com/signin/v1/en
Usuario: {{contact.email}}
Contraseña: <TEMP_PASSWORD>
_Cámbiala la primera vez que entres._

🦷 *Beneficio dental:*
Tu ID dental estará listo en 48 horas hábiles. Podrás descargarlo y yo también te lo enviaré por aquí.

👨‍⚕️ *Cómo iniciar con tu médico primario:*
1️⃣ Agenda una cita con tu doctor (idealmente con una semana de anticipación).
2️⃣ Llena los datos de la cita aquí: https://app.impacthealthsharing.com/forms/provider-assistance
3️⃣ Impact coordina con el consultorio en 3 a 5 días hábiles.
4️⃣ Te avisarán por texto o email cuando esté listo. ¡Luego ya puedes ir a tu cita!
¿No tienes doctor? Escribe a CareNavigator@AMPS.com con el tipo de doctor y tu código postal.

🏥 *Al ir al doctor:*
Muestra tu tarjeta y paga solo: $50 doctor de cabecera, $75 especialista/urgent care, $150 emergencias. La telemedicina desde el portal es *gratis*.

⚠️ *Importante:* Para cirugías no urgentes, MRI, maternidad o cáncer, tu doctor debe llamar *antes* al (855) 378-6777 para pedir aprobación.

Te envié todos los detalles por correo. ¡Cualquier duda, escríbeme por aquí! 🙌
```

### English

**SMS 1** (attach `{{iw.member_card_image_url}}`):

```
Hi {{contact.first_name}}, congratulations on your Impact Health plan! Here's your member ID card. ID: {{iw.member_id}}. Payment: {{iw.monthly_amount}}, {{iw.payment_day}}. Portal: impact.mysharable.com/signin/v1/en Username: {{contact.email}} Password: <TEMP_PASSWORD> (change it when you log in). Help: (855) 378-6777. I emailed you all the details. -{{user.name}}
```

**SMS 2:**

```
{{contact.first_name}}, for your primary care doctor: book your appointment and fill in the details here: app.impacthealthsharing.com/forms/provider-assistance. Impact will let you know in 3-5 business days when it's ready. Your dental ID will be ready in 48 business hours; I'll send it to you here.
```

**WhatsApp** (image header: `{{iw.member_card_image_url}}`):

```
Hi {{contact.first_name}}! 🎉 *Congratulations on your new plan with Impact Health Sharing.*

📎 *Your member ID card is above.* Save it and show it at every visit.

📋 *Your details:*
• Member ID: {{iw.member_id}}
• Monthly payment: {{iw.monthly_amount}}
• Payment date: {{iw.payment_day}}
• Customer service: (855) 378-6777

🔐 *Your portal:*
https://impact.mysharable.com/signin/v1/en
Username: {{contact.email}}
Password: <TEMP_PASSWORD>
_Change it the first time you log in._

🦷 *Dental benefit:*
Your dental ID will be ready in 48 business hours. You'll be able to download it, and I'll also send it to you here.

👨‍⚕️ *Getting started with your primary care doctor:*
1️⃣ Book an appointment with your doctor (ideally a week ahead).
2️⃣ Fill in the appointment details here: https://app.impacthealthsharing.com/forms/provider-assistance
3️⃣ Impact coordinates with the office in 3 to 5 business days.
4️⃣ They'll text or email you when it's ready. Then you can go to your appointment!
Don't have a doctor? Email CareNavigator@AMPS.com with the type of doctor and your ZIP code.

🏥 *At the doctor:*
Show your card and pay only: $50 primary care, $75 specialist/urgent care, $150 emergency room. Telehealth from the portal is *free*.

⚠️ *Important:* For non-urgent surgeries, MRIs, maternity or cancer, your doctor must call (855) 378-6777 *beforehand* to request approval.

I sent you all the details by email. Any questions, message me here! 🙌
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
