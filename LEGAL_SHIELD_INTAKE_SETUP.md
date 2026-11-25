# Legal Shield intake (Ysmael) — setup

Your dad, **Ysmael Orraiz**, sells LegalShield the way you sell Impact: he opens a client's intake,
shares a vertical 9:16 presentation over CrankWheel, and "Confirmar mis datos" turns that tab into
the client's application. He then enrolls the client on LegalShield's site from the summary.

- **One offer:** Plan Legal Preferencial ($39.95) + IDShield Familiar 3B ($34.95) = **$74.90/mes**,
  or $850.86/año. Never Básico or Premium.
- **Spanish only**, under `/es/legal-shield/intake`.
- **His own login** (Clerk role `legal_shield`). It opens the Legal Shield area and nothing else of
  yours. You (admin) can open all of his clients.
- **His own CrankWheel account**, never yours.
- **Nothing new in GHL:** no custom fields, no workflows, no `pnpm intake:fields`. Links go out from
  his own WhatsApp.

## How Ysmael uses it

1. He signs in and opens **/es/legal-shield/intake**. `/es/admin` shows him only a "Legal Shield"
   section.
2. He finds a lead or creates a client. His search only shows contacts tagged `legal_shield`,
   `legal_shield_guide_funnel` or `legal_shield_intake`, and only their name, email and phone.
   Under it, **Sus clientes** lists all of those contacts, 20 a page, newest first, with the date
   each came in: **Iniciar registro** on any of them, or **Abrir registro** when they already have
   one. "Ocultar" folds the list away (remembered on that computer).
3. On the client's form he clicks **Reunirse ahora**, sends the link with the **WhatsApp** button,
   and waits until the client is in.
4. He clicks **Abrir presentación** (a new tab) and shares **that tab** from the CrankWheel extension.
5. He moves with → / ←, Space or 1–9 (F = full screen). On the price slide he can switch
   **Mensual / Anual** in front of the client.
6. **Budget objection:** in his form tab (not shared) he turns off **IDShield Familiar 3B en el
   precio**, or presses **Shift+I** in the deck. The price slide changes to $39.95 with nothing
   crossed out, and no switch is ever drawn on the shared tab.
7. The last slide, **Confirmar mis datos**, turns the shared tab into the form. They fill it in
   together; the package switch and his notes never show there.
8. **Enlace privado** (on the form): for the SSN's last 4, the card or the bank account. He sends it
   by WhatsApp, the client types the numbers on their own phone, and his form shows only the last 4.
9. The summary (**Ver**) has Reveal / Copy for each field, with dates as MM/DD/AAAA, for typing into
   LegalShield's enrollment.
10. **Emails to him:** when a client submits the form on their own, or sends the private link, he
    gets "Ana Prueba completó su solicitud" with a link to the summary. The email never contains the
    client's answers. Completed rows stand out (green) on his dashboard.

## The public presentation (for anyone, by WhatsApp)

**https://www.isaacplans.com/es/legal-shield/plan** is one general link Ysmael can send anyone. The
client walks the same presentation alone, one screen at a time (Next, Back, swipe, and his WhatsApp
always one tap away), and:

- sees the price of the **bundle only** (Preferencial + IDShield Familiar 3B), with no way to drop
  IDShield, and picks **Mensual** ($74.90/mes) or **Anual** ($850.86/año);
- taps **Llenar mi solicitud**, which opens their own application, already set to the bundle and the
  payment they picked. The same phone reopens the same application if they come back.

The application belongs to Ysmael: it shows in his dashboard (with the client's name once they type
it), the CRM contact appears with his tags as soon as they type an email or phone, and he gets the
"completó su solicitud" email when they submit. Then he enrolls them on LegalShield's site as usual.

WhatsApp shows the link with its own preview ("Red de Apoyo Latino USA", never Isaac Plans). The page
isn't indexed by search engines.

## Setup (you, once)

### 1. His Clerk login, by invitation

Invite him **with the role already on the invitation**, so he is never, even for a moment, a normal
site user: the Clerk → GHL sync would make him a lead in your CRM.

```bash
curl -X POST https://api.clerk.com/v1/invitations \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email_address":"HIS_EMAIL","public_metadata":{"role":"legal_shield"}}'
```

He signs up through the link in that email, not with Google on the site. Turn on MFA for him.

If he already has an account: Clerk dashboard → Users → him → **Metadata → Public** →
`{"role":"legal_shield"}`, then delete the contact the sync created for him in GHL. Role changes
reach the site within a minute.

### 2. His CrankWheel

1. **Account:** a CrankWheel account in **his** email. Solo ($29/month, 1 user) includes the API.
   Pick a paid plan before the trial ends: the free plan isn't listed with API access.
2. **Extension:** CrankWheel Screen Sharing in his Chrome or Edge, **signed in as him**. If that
   browser was ever signed in to your CrankWheel, log out first: a link made for his email only
   connects to his share.
3. **Key:** at `https://meeting.is/ss/` (as him) → **API** tab → a **read/write** key (a read-only
   one is optional).
4. **Vercel:** `CRANKWHEEL_PRESENTERS` for **Production and Preview**, marked Sensitive, then
   redeploy:

   ```json
   [{"userId":"user_…","email":"his-crankwheel-email","writeKey":"…","readKey":"…"}]
   ```

   - `userId`: his Clerk user ID (Clerk → Users → him).
   - `email`: exactly the email of his CrankWheel account.
   - `readKey` is optional.
   - Your own `CRANKWHEEL_*` variables stay as they are; you are not in this list.

   Until it's right, his panel says "CrankWheel todavía no está configurado para su cuenta". It
   never uses your account.

### 3. Who owns the public applications

In Vercel, set `LEGAL_SHIELD_DEFAULT_OWNER_USER_ID` to **Ysmael's Clerk user ID** (Production and
Preview), then redeploy. Without it, "Llenar mi solicitud" brings the client back to the presentation
with "No pudimos abrir tu solicitud…", and nothing is created: Legal Shield never falls back to your
default owner, so his clients can't land on your list by accident.

### 4. The migration, before the code deploys

```bash
pnpm db:migrate 0048
```

It adds one column (`crankwheel_meetings.presenter_email`). It's safe on today's code, but the new
code reads it, so run it **before** merging. Use the prefix: a full `pnpm db:migrate` re-runs old
migrations and is unsafe.

### 5. Email

Nothing new: the notices go out through the site's SMTP (`EMAIL_HOST`, `EMAIL_USER_INFO`,
`EMAIL_PASS_INFO`) to his Clerk email, from "Avisos de solicitudes". Have him check his spam folder
the first time.

### 6. Before he uses it with clients

- The rights to the deck photos (the grandfather and boy, the family), and LegalShield's
  pre-approval of the deck if associates need it.
- A test in a preview deployment: you make a CrankWheel link for one of your clients and he makes
  one for his. Both links must stay live, and each client must land on the right person's screen.

## What reaches your CRM

- **Contacts:** matched only by exact email or phone. Every client he works (new, matched or
  picked from his search) gets `legal_shield_intake` and `legal_shield_guide_funnel` (your tag for
  his leads; any GHL workflow that starts on it will run for them too), plus `spanish` when the
  contact is new. **Never** `legal_shield`, which starts the funnel's
  workflow.
- **On completion:** only blank fields are filled (an existing contact is never overwritten), tag
  `ls_intake_completed`, and a short note. **No SSN digits, card or bank number ever goes to GHL.**
- **After a screen share:** a "🖥️ Screen share" note on the contact.
- The AI Setter skips `legal_shield_intake` and `legal_shield_guide_funnel` contacts and doesn't
  count them as insurance clients.

## Data he collects

- SSN: **last 4 only**.
- Card number, expiry, CVV and bank numbers are encrypted in Neon and **kept after completion**,
  because the database is the only copy he enrolls from. That was your call; card rules (PCI) forbid
  keeping a CVV, so have him delete the client's session once the enrollment is done.
- Every Legal Shield page is private: no Pixel, GA or CRM scripts, not indexed, no framing by other
  sites. Previews in WhatsApp show "Red de Apoyo Latino USA", never Isaac Plans.

## Changing things

- **Prices:** `lib/legal-shield/plans.ts`, in cents (LegalShield's own figures, not computed). The
  form and the price slide both read it.
- **Deck wording:** `components/legal-shield-presentation/copy.ts`. Keep it free of insurance words;
  `pnpm test:staff-access` fails if one slips in.
- **The form:** `lib/intake-configs/legal-shield.ts`.

## Tests

```bash
pnpm test:staff-access     # roles, routes, CRM scoping, prices, the owner email, no insurance words
pnpm test:crankwheel       # one CrankWheel account per agent, no fallback to yours
pnpm test:intake-autosave
```

## When something's off

| What you see | Why |
| --- | --- |
| He lands on "unauthorized" | The role is missing or misspelled in Clerk (`legal_shield`). |
| "No pudimos abrir tu solicitud" on the public presentation | `LEGAL_SHIELD_DEFAULT_OWNER_USER_ID` isn't set in Vercel (or no redeploy since). |
| "CrankWheel todavía no está configurado…" | `CRANKWHEEL_PRESENTERS` is missing, isn't valid JSON, or has the wrong `userId`; or no redeploy since the change. |
| The client waits in a share nobody is presenting | His extension is signed in to a different CrankWheel account than the `email` in the variable. |
| No email after a client finishes | SMTP settings, or his spam folder. Vercel logs say `owner notice sent` / `owner notice failed`. He gets no email when he submits the form himself. |
