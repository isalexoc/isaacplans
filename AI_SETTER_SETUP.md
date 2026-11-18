# AI Setter — setup

Leads text back at all hours, and Isaac can't answer every one when it arrives. The **AI Setter**
(Claude Opus 5.5) answers them over the CRM's SMS and WhatsApp, in English or Spanish, with one
goal: a phone call with Isaac.
- It offers **two concrete times** and books the one the lead picks into the GHL calendar of the
  lead's product and language, so GHL's own confirmations and reminders fire.
- When Isaac is free right now, it asks him on Telegram whether he can **call now**.
- It never gives prices, product details or advice. Whether, when and where it may write is
  decided by code, never by the model.

**Example** (a Spanish-speaking Final Expense lead in Eastern time; both replies are approved
templates, so they go out at once):

```
Lead · SMS · Tue 7:42 pm   Hola, ¿cuánto cuesta lo de gastos finales?

AI · price_redirect        Hola María, le responde el asistente de IA (inteligencia artificial) de
                           Isaac Plans Insurance. ¡Buena pregunta! Depende de su edad, el estado
                           donde vive y lo que quiera cubrir; Isaac le da los números exactos en
                           una llamada de 15 minutos. ¿Mañana a las 10 de la mañana o el jueves a
                           la 1 de la tarde? Responda STOP para no recibir más mensajes.

Lead                       Mañana a las 10 está bien

AI · confirm_booking       ¡Listo! Isaac le llamará mañana a las 10 de la mañana desde el
                           (540) 426-1804. Guarde su número: isaacplans.com/isaac-orraiz.vcf.
                           ¿Necesita otro horario? Responda aquí.

GHL                        Appointment on the Final Expense (ES) calendar, assigned to Isaac,
                           confirmed, tag ai_booked + a note. GHL's confirmation and
                           reminders go out.
```

## How it works

```
Lead texts back (SMS or WhatsApp)
  └─ GHL workflow "AI Setter – Mensaje entrante"   Customer Replied · tag ai_setter · re-entry ON
       Custom Webhook ──► POST /api/webhooks/agent-crm/ai-setter   (Bearer secret)
                          {"event":"inbound","contactId":"{{contact.id}}"}

Webhook: secret · body ≤ 2 KB · ≤ 30 pokes per contact per hour
         arms ONE turn per contact, due 20 s later (a burst of texts gets one reply) ──► QStash

QStash ──► /api/queue/ai-setter · job "turn"   (fenced claim, 240 s budget)
  1. Read GHL: the contact, its SMS/WhatsApp thread, its appointments
  2. Rules in code, before any AI: STOP / HELP / START · suppression list · tags · DND · client?
     Isaac took over? · message older than 12 h · caps and loops · WhatsApp 24 h window
     lead's hours · license state · Medicare · daily budget
  3. Claude Opus 5.5 (minimal, masked context) ends the turn with ONE action:
       template · free-text draft · book / reschedule / cancel · call now
       hand off · opt out · nothing
  4. Free text only: the guard (≤ 3 SMS segments, banned words, no prices or health,
     no fact that isn't in the thread, allowed links only, no emoji in SMS)
  5. Approved template ───────────────► "send" job right away
     Free text or unapproved template ► inbox + Telegram card  [Enviar] [Lo tomo yo] [Abrir]
                                        (no Telegram: tag ai_setter_alert → "AI Setter – Aviso")
                                        Isaac approves in Telegram or the panel ──► "send" job

QStash ──► /api/queue/ai-setter · job "send"
  Re-checks everything right before the POST: suppression · DND · a newer message from the lead
  Isaac replied by hand · WhatsApp window · lead's hours (else held) · template still approved
  approved → sending → sent   (a timeout is send_unknown: looked up in GHL, never resent blind)
  └─ POST /conversations/messages ──► the text lands in the contact's GHL conversation

Isaac replies by hand (GHL app, a Kixie text, WhatsApp on his phone, any call)
  └─ the classifier sees it on the next turn ──► AI paused 48 h on that lead, its drafts voided
     (workflow "AI Setter – Isaac respondió" pokes the webhook, so this happens within seconds)
```

The third job, **call-now timeout**, runs 3 minutes after a "call now" card: if Isaac hasn't
tapped **[Estoy llamando]** or **[No puedo]**, the lead gets two times instead.

**Shadow mode** (`AI_SETTER_DRY_RUN=true`, the default): steps 1–4 run for real, but step 5 only
stores what the AI *would* send, as `shadow`, in the inbox. No text goes out and nothing is
booked. An opt-out is still honored: the number is suppressed and DND is set in GHL.

**GHL stays the channel and the record.** Every text goes out through
`POST /conversations/messages` and sits in the contact's conversation. Every booking is a GHL
appointment (`POST /calendars/events/appointments`) on the calendar of the lead's product and
language (`lib/ai-setter/product.ts`). GHL's own Conversation AI is not used: it takes one calendar
per bot, doesn't pause when Isaac answers from his phone, can't read call outcomes and has no
per-state rules.

## Phase 1: what it does and doesn't

**Who it answers:** contacts with the `ai_setter` tag who write by SMS or WhatsApp. It never
answers:
- a number on DND or on the suppression list;
- contacts tagged `legal_shield`, `agent_crm_affiliate`, `tcpa_litigator_risk` or
  `ai_setter_off` (put `ai_setter_off` on anyone the AI must leave alone);
- clients, per the app's database: sold on a call, an Impact enrollment, a signed ACA
  confirmation or a completed intake. Those go to Isaac;
- a message more than 12 hours old. It's logged for Isaac instead.

**What it does** (EN/ES, `lib/ai-setter/prompts.ts`):
- **Wants a call** → two concrete times chosen by code: the soonest at least 1 hour out, plus one
  in another part of the day or the next day (from 5 pm if the lead works). Times fall on :00 or
  :30, and a time the lead asks for is offered when it fits Isaac's hours.
- **Picks one** → booked: assigned to Isaac, `confirmed`, a phone call, GHL notifies; tag
  `ai_booked` and a note. Only a time already offered to this lead, and at most one future booking
  per lead. It also reschedules and cancels.
- **Price or "send me info"** → one line that steers to the call, never a number.
- **"Who is this?"** → what they asked about, that Isaac is a licensed agent, two times.
- **"Call me now"** → "let me see if Isaac is free" plus a Telegram card. At most once a day per
  lead, only inside Isaac's hours, when he isn't marked busy and has no call about to start.
- **Not interested** → one polite close, never insists.
- **Asks for a person or writes ISAAC, is a client, complains, mentions a lawyer, health or
  Medicare, sends audio or a photo** → handed to Isaac, with a short hold message such as "Isaac
  will reply to you personally today before …".
- **Unknown state** → asks it. **A state Isaac isn't licensed in** → a polite close and the tag
  `out_of_license_state`.
- **Turns down two offers** → the self-booking link.

**Voice:** usted by default in Spanish (tú only once the lead uses it, remembered per lead),
neutral Latin-American Spanish, 1–2 sentences. Never "insurance / policy / premium / seguro /
póliza / prima" outside the brand name.

**Isaac's call hours** (Eastern; editable in /admin/ai-setter → Ajustes):

| Days | Hours |
|---|---|
| Mon / Wed / Thu | 9:00 am–2:00 pm and 9:30 pm–12:00 am |
| Tue / Sun | 9:00 am–12:00 am |
| Fri / Sat | 9:00 am–1:00 pm and 10:30 pm–12:00 am |

Leads are offered times between 9 am and 9 pm **their** time. The late windows are too late for
Eastern and Central leads, so they mostly see mornings and early afternoons, plus all of Tuesday
and Sunday. Ajustes previews what an Eastern, Central, Mountain and Pacific lead would be offered
this week. Outside his hours Isaac doesn't call, but he still reviews and approves.

**Not in Phase 1.** Each piece has its own gate first:
- **Phase 2:** the AI's first message to a new lead, and follow-up cadences. They wait for recorded
  consent, a hardened form (bot check, Trestle phone check), per-state contact rules and a single
  texting owner per lead. Also WhatsApp through an SMS with a wa.me link plus a manual one-tap
  outbox (never WhatsApp Web automation), and autopilot per reply type.
- **Phase 3:** reactivating old leads (only after a legal review), FB / IG / chat / email, and
  recovering missed appointments.

Until then your GHL workflows keep sending the first text. The AI only answers.

## Rules the code enforces

The code decides whether, when and where the AI may write. Claude only chooses what to say. These
checks run before the model sees anything, and the send job runs them again right before a text
goes out (`lib/ai-setter/compliance.ts`, `send.ts`, `guard.ts`).

1. **Opt-outs, in three tiers** (EN and ES, on every new message and every turn, before anything
   else; definitive ones are also caught on email, Facebook, Instagram and chat, which the AI
   never answers):
   - **Keyword:** the whole message is an opt-out word: STOP, STOP ALL, QUIT, END, REVOKE,
     OPT OUT, CANCEL, UNSUBSCRIBE, BASTA, ALTO, PARAR, CANCELAR, BAJA, NO MÁS ("STOP please" and
     "ya basta" count). Definitive.
   - **Phrase or wrong number:** "stop texting me", "remove me", "no me escriban", "número
     equivocado"… Definitive. A wrong number also voids the consent.
   - **Ambiguous:** an opt-out word inside a longer message ("can you stop by?"), or "don't call
     me" limited to a time or traded for texts. The lead is frozen and Isaac gets an alert. A lead
     the AI manages, writing in the last 30 minutes, also gets **one** clarification ("Do you want
     us to stop messaging you completely? Reply STOP to confirm."). While frozen, code reads the
     answer: "yes" / "sí" / "ok" → definitive opt-out; a clear "no, keep texting" → the
     conversation goes on; anything else → still frozen, Isaac is alerted again, the AI writes
     nothing. A cancel word next to an appointment word ("quiero cancelar la cita") is not an
     opt-out (the AI cancels the call), unless the message also says stop, basta, "no quiero
     ninguna llamada"….
   - **Applying a definitive opt-out:** pending drafts are voided, the number is suppressed
     (rule 2), and GHL DND is set on SMS, WhatsApp, Email, FB and Call (never
     `inboundDndSettings`). A carrier keyword on SMS (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END,
     QUIT, REVOKE, OPT OUT) is already confirmed by GHL and the carrier, so the app sends no second
     confirmation. Any other opt-out (a phrase, a wrong number, any opt-out on WhatsApp) from the
     last 30 minutes gets one confirmation text on that channel: DND goes on every other channel
     at once, and on that channel right after the confirmation, or anyway if the confirmation
     can't go out. A failed DND write is retried once, then Isaac is told to set it by hand. A
     contact the AI doesn't manage (no `ai_setter` tag, or an exclusion tag) is only added to the
     suppression list: no text and no CRM change, and Isaac's alert says so. Isaac gets an alert
     either way.
2. **Suppression by phone, forever.** Opt-outs are stored in `ai_setter_suppressions` by E.164
   phone, not by contact, so a duplicate or re-created contact with the same number stays
   suppressed. Every turn and every send checks it. Only **START / UNSTOP** (also SUBSCRIBE,
   REANUDAR, INICIAR) from that number lifts it, and the lift is recorded with when and why. The
   row is never deleted.
3. **HELP.** A message that is only HELP / AYUDA / INFO / INFORMACIÓN, from a lead the AI manages
   and written in the last 30 minutes, gets a fixed reply from the code, with no approval: "Isaac Plans Insurance: Isaac Orraiz, licensed agent. Call
   (540) 426-1804 or visit isaacplans.com. Reply STOP to opt out." In Spanish it follows the
   lead's register. HELP replies, clarifications and confirmations that can't go out within 30
   minutes expire instead of arriving late.
4. **Reply windows**, in the lead's local time. The zones are the strictest of the area code's, the
   GHL address's (read fresh every turn and again at send time) and a state the lead told the AI;
   with no zone at all, both Eastern and Pacific must allow the send.
   - The lead wrote in the last 30 minutes → the reply goes now.
   - Otherwise only 8:00 am–9:00 pm local. A reply outside that is held until the window opens.
   - **Pennsylvania** (by address or area code): only Monday–Saturday, 9:00 am–7:00 pm, never
     Sunday, even right after the lead wrote. This holds until counsel confirms the rule.
5. **WhatsApp 24-hour window.** On WhatsApp the AI writes only inside Meta's customer-service
   window: 24 hours from the lead's last WhatsApp message, read from the GHL thread. Once it
   closes, nothing goes out there.
6. **License gate.** The lead's state, from the GHL address or what the lead told the AI (never
   the phone's area code), must be one where Isaac is licensed (the licensed-states list in
   Sanity). Code refuses to look for times, book or reschedule otherwise. Unknown state → the AI
   asks for it. Not licensed → a polite close and `out_of_license_state`. The list couldn't be
   read (Sanity down) → Isaac takes over; nothing is offered unchecked.
7. **Medicare and health go to Isaac.** Any mention of Medicare, Medigap or Part D / Parte D hands
   the lead to Isaac, and so do health conditions and medications. Nobody is excluded by age.
8. **AI disclosure, brand and STOP, added by the code.** The AI's first message on each channel,
   the first after 7 quiet days and the first after a pause or a handoff open with "Hi María, this
   is Isaac Plans Insurance's AI assistant (automated)." / "Hola María, le responde el asistente
   de IA (inteligencia artificial) de Isaac Plans Insurance." They end with "Reply STOP to opt
   out." / "Responda STOP para no recibir más mensajes." The model never writes these lines. It
   never claims to be human or to be Isaac; asked, it says it's Isaac's AI assistant and that the
   lead can write ISAAC to reach him.
9. **No prices, health or advice.** The prompt forbids prices, amounts, eligibility, approvals,
   guarantees, health or legal opinions, product details and "free". On free text the guard also
   blocks:
   - `$` and prices, "approved" and "guaranteed", health words;
   - insurance / policy / premium / underwriting / seguro / póliza / prima, except in the brand;
   - any name, date or number that isn't in the thread;
   - links other than the allowed ones, emoji in SMS, and more than 3 SMS segments (2 when the
     code will add the AI notice and STOP);
   - a draft that writes "(automated)" or "STOP" itself: those lines are the code's. "I'm Isaac's
     AI assistant" is allowed, since it's the honest answer to "are you a bot?".

   A failing draft is regenerated once with the failures listed. If it fails again, it goes to
   Isaac and the lead gets the fixed "Isaac will answer you personally" message. A model refusal
   hands the lead to Isaac with no message at all. Isaac's own edits are checked too: a claim to
   be human, a forbidden word, a link or phone that isn't Isaac's, or a leftover {placeholder}
   blocks the edit.
10. **Privacy.** Anthropic gets a minimal, masked context: the SMS/WhatsApp thread of the phone on
    file only (last 15 messages or 30 days, 1,000 characters each, with links, emails, phones and
    long numbers masked), the last call's outcome codes (never the call notes, which carry health
    and money details), first name, product, state and zone, and appointments. Attachments never
    reach the model. Alerts never carry the lead's words, and logs never carry message text.
11. **Only the number that wrote, only fresh context.** A reply goes to the number the turn read;
    if the contact's phone changes before the send (or GHL reports the inbound came from another
    number), nothing is sent and Isaac is alerted. A message the lead sends, or a reply Isaac
    types, while a turn is running is never lost: that turn re-arms when it finishes, and a
    reply the turn queued waits and is replaced. A held reply that names "today" / "tomorrow" on a
    different day, or offers a time now under an hour away, is regenerated instead of sent. Sends
    held by errors (GHL down, settings unreadable) give up after 2 hours and Isaac is told.
12. **Loops and caps.** Per lead: 8 turns a day, 40 per conversation, one pending draft. Overall:
    60 turns an hour and the daily Claude budget, with alerts at 50, 80 and 100%. Auto-replies are
    ignored. Three instant replies (under 15 seconds) or the same message over and over pause the
    lead for 24 hours and alert Isaac.

### Internal do-not-contact policy

> **Isaac:** esta es la política escrita que pide la ley (TCPA). Aplicarla en todos los canales y
> darle una copia a quien la pida.

**Isaac Plans Insurance — internal do-not-contact policy** (version 1, 2026-11-17; owner: Isaac
Orraiz)

1. **Scope.** Every channel (texts, WhatsApp, calls, email, social messages), every product line,
   and everyone who contacts people for the agency: Isaac, any staff or vendor, the CRM's
   workflows and the AI Setter.
2. **What counts as a request.** Any reasonable way of saying it, in any language: an opt-out word
   (STOP, BASTA…), a phrase ("don't text me", "no me llamen"), "wrong number", or a request made
   on a call, by email or in person. When it isn't clear, ask once and send nothing else until the
   person answers.
3. **Recording.** The internal do-not-contact list records the phone number (E.164), the date and
   time, the channel, the words used and the CRM contact. Requests by text are recorded
   automatically (`ai_setter_suppressions`). For a request by call, email or in person, Isaac sets
   DND on every channel of the contact the same day and adds a note with the date and the words
   used.
4. **Honored at once, everywhere.** A request stops all contact on every channel and for every
   product: the AI and the CRM within minutes, people the same day, always well inside the 10
   business days the FCC allows. One confirmation text with no marketing is the only message
   allowed after it.
5. **Kept at least 10 years.** Entries are never deleted. The app keeps every suppression for
   good; lifting one records when and why, and the original evidence stays.
6. **Lifted only on new consent** from that same number: the person texts START or UNSTOP (lifted
   automatically and recorded), or submits a new web form with consent (lifted by Isaac by hand
   after checking the form, with the reason recorded; the panel has no button for this yet).
   Never because a lead seems interested, a relative asks, or a list was bought.
7. **Never shared.** The list stays inside the agency and the vendors that send for it, and they
   get it only to honor it.
8. **Owner.** Isaac Orraiz keeps this policy. He trains anyone who contacts leads for the agency on
   it, reviews it once a year and after any change in the law, and gives a copy to anyone who asks.

Pending review by counsel, together with the Phase 2 legal review.

## Costs

| Item | Cost |
|---|---|
| **Claude Opus 5.5** | About **US$0.03–0.10 per turn**, at low effort with the prompt cached (US$4 / US$20 per million input / output tokens, cache reads US$0.20). Measure it in shadow mode before settling the daily budget (default US$10). The fallback models, used only when Opus 5.5 declines a request, bill US$5 / US$25, and their output always goes to approval. |
| **GHL Custom Webhook** | A Workflow Premium action: **US$0.01 per run** after the first 100 free. One run per lead message, and one per manual reply from Isaac. |
| **SMS** | The CRM's usual rate per segment. An AI text is at most 3 segments. |
| **WhatsApp** | Since **October 1, 2026**, Meta bills each reply sent inside the 24-hour window (a "service message") per message; these used to be free. Check the current US rate in Agent CRM's WhatsApp billing or on Meta's rate card (developers.facebook.com/docs/whatsapp/pricing) before budgeting. |
| **Telegram, QStash** | Telegram is free. A reply uses a few QStash messages (turn, send, sometimes a check) on the existing Upstash plan. |

## Setup, in order

1. Phase 0 (section 1). Nothing is switched on until it's done.
2. Environment variables (section 2).
3. `pnpm db:migrate 0045` (section 3).
4. The three GHL workflows (section 4).
5. Shadow mode, approve the templates, then approval mode (section 5).

## 1. Phase 0: before switching on

> **Isaac:** hacer todo esto una vez y en orden. La IA sigue apagada (`AI_SETTER_ENABLED=false`)
> hasta terminar.

1. **Anthropic.** In the Claude Console (platform.claude.com, formerly console.anthropic.com),
   create a workspace just for the AI Setter and give it a monthly spend limit. Create two keys in
   it:
   - a **production** key: `ANTHROPIC_API_KEY` in Vercel, Production only;
   - a **development** key: `ANTHROPIC_API_KEY` in your local `.env`, for
     `pnpm test:ai-setter --live` and `pnpm ai-setter:try`.

   Separate keys keep test spend apart, and one can be revoked without the other.
2. **A Private Integration only for the AI.** Agent CRM → Settings → Private Integrations → create
   a new one, e.g. "AI Setter". Don't widen `AGENT_CRM_PI`. Give it exactly these scopes:

   | Area | Scopes |
   |---|---|
   | Conversations | `conversations.readonly`, `conversations/message.readonly`, `conversations/message.write` |
   | Contacts | `contacts.readonly`, `contacts.write` |
   | Calendars | `calendars.readonly`, `calendars/events.readonly`, `calendars/events.write` |
   | Users | `users.readonly` |

   Copy the token into `AI_SETTER_GHL_PI`. **Revoking this integration switches the AI off at
   once**, with no deploy. Also note your GHL user id for `AI_SETTER_GHL_USER_ID` (Settings → My
   Staff; if the screen doesn't show it, Claude can read it through this key, which has
   `users.readonly`).
3. **Telegram bot, for alerts and approvals.** If the Telegram-leads bot already exists, reuse it.
   Otherwise:
   1. In Telegram, open @BotFather → `/newbot`, and copy the token into `TELEGRAM_BOT_TOKEN`.
   2. Generate `TELEGRAM_WEBHOOK_SECRET` with the one-liner in section 2.
   3. After the deploy, run `pnpm telegram:webhook --set`. It subscribes the bot to
      `callback_query`, the button presses. Re-run it after every deploy that changes the allowed
      updates; `pnpm telegram:webhook` alone shows the status and warns when one is missing.
   4. Send `/start` to the bot from your own account. It answers "Connected" with your chat id.
      Put that id in `TELEGRAM_ADMIN_CHAT_ID`. **Required for the AI Setter:** its cards and
      buttons go only to that id.

   Who counts as "you" can't be changed by a stranger. AI Setter cards go only to
   `TELEGRAM_ADMIN_CHAT_ID`, and a button works only when the person pressing it IS that id.
   Without it the AI Setter skips Telegram and alerts go through the "AI Setter – Aviso" workflow.
   A business connection or a `/start` from anyone else never takes over the chat. (The Telegram
   lead alerts, a separate feature, can still use the first chat that sent `/start` when the env
   value is unset.) The AI Setter needs only the token, the secret and your chat id;
   `TELEGRAM_LEADS_ENABLED` can stay off.
4. **Calendars.** `pnpm ai-setter:try --calendars` checks every calendar id in
   `lib/ai-setter/product.ts`, which are the booking-widget ids from
   `app/[locale]/*/calendar/page.tsx`. For each one it prints whether it's a calendar of this
   location, its type and slot length, whether you're on its team, and how many free slots the
   next 3 days have. Then check by hand in each calendar's settings:
   - minimum scheduling notice of 1 hour or less;
   - a bookable range of at least the next 7 days;
   - open hours at least as wide as your schedule;
   - Google Calendar connected, so bookings show there and block your time.
5. **How GHL marks each outgoing message.** Send one message of each kind to your own contact:
   - a manual reply from the GHL web app, and one from the mobile app;
   - a workflow SMS;
   - a calendar confirmation;
   - a message sent through the API;
   - a WhatsApp from your phone (coexistence);
   - a Kixie call.

   Then run `pnpm ai-setter:try --sources <yourContactId>`. It prints the last 25 messages'
   direction, type, source, user id (first 4 characters) and status, never the text, and how the
   classifier labels each one. Every manual one must read `human`, every automatic one
   `automated`. Send Claude the output: `lib/ai-setter/classify.ts` is frozen from it before
   go-live.
6. **Workflow inventory.** List what every `AGENT_CRM_WORKFLOW_*` workflow and every tag-triggered
   workflow sends, and when, including the Telegram and Senior Life cadences. In Phase 1 they keep
   sending the first text and the AI only answers. If new leads get no first text today, create a
   simple one in GHL until Phase 2.
7. **Booking test.** Put your own contact id in `AI_SETTER_TEST_CONTACT_IDS` in `.env`, then run
   `pnpm ai-setter:try --book <yourContactId> --yes`. It books a real appointment at the next free
   slot of the general calendar. Check that:
   - it shows in GHL and in Google Calendar;
   - GHL's confirmation and reminders arrive. If the reminders don't fire for this API-created
     appointment, add the trigger **Appointment Status (Modified By: API)** to the reminder
     workflow.

   Then decide which confirmation a lead gets: the AI's `confirm_booking` text (your number and
   vCard; the app's default) or GHL's own. Keep only one, or the lead gets two. Clean up with
   `pnpm ai-setter:try --cancel-appointment <appointmentId> --yes` (the book command prints it; it
   refuses an appointment whose contact isn't in `AI_SETTER_TEST_CONTACT_IDS`).
8. **SMS and A2P.**
   - Review the A2P 10DLC campaign: its use case and sample messages should cover replying to
     leads and scheduling calls.
   - Check GHL's SMS compliance settings. If GHL already appends "Reply STOP" or sender info on its
     own, set `AI_SETTER_APPEND_STOP=false`, so a lead never sees two STOP lines.
   - Text HELP to your number from another phone. If something already answers it, set
     `AI_SETTER_REPLY_HELP=false`, so a lead gets one answer, not two.
   - Turn GHL's Conversation AI off on SMS and WhatsApp. Two bots must never answer the same lead.
9. **Security.**
   - The old public endpoint `/api/test-agent-crm` is deleted on this branch (it returned the
     first 20 characters of `AGENT_CRM_PI` to anyone). After the deploy,
     `curl -i https://www.isaacplans.com/api/test-agent-crm` must answer 404.
   - Scope every AI Setter variable to **Production** only in Vercel (section 2).
   - Turn on MFA on your Clerk account. It opens /admin/ai-setter, where texts to leads are
     approved.
10. **For Phase 2** (doesn't block Phase 1):
    - the share of web leads in the last 90 days that ticked "SMS Consent: Yes";
    - confirm the CRM's WhatsApp is 540-681-3507, in coexistence;
    - the QStash plan and its delay limit;
    - schedule the legal review;
    - do you sell Medicare Advantage or Part D?

## 2. Environment variables

> **Isaac:** poner estas variables en Vercel **solo en Production**, y en `.env` las que usan los
> scripts. Después de cambiarlas, volver a desplegar.

**Two defaults to know.** `AI_SETTER_ENABLED` defaults to **`false`**: the AI is off.
`AI_SETTER_DRY_RUN` defaults to **`true`**: shadow mode, where the AI answers into the inbox and
never to the lead. Switching it on takes `AI_SETTER_ENABLED=true`. Letting it actually text leads
also takes `AI_SETTER_DRY_RUN=false`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AI_SETTER_ENABLED` | yes | `false` | Master switch. Off: the webhook answers `"skipped":"disabled"` and stores nothing; queued jobs and the daily reconcile skip too. |
| `AI_SETTER_DRY_RUN` | no | **`true`** | **Shadow mode.** Everything runs, nothing is sent or booked; each reply lands in the inbox as `shadow`. Set `false` only after the shadow review. Opt-outs are honored either way. |
| `AI_SETTER_WEBHOOK_SECRET` | yes | — | Bearer secret both GHL workflows send. The webhook answers 500 without it and 401 when it doesn't match. |
| `AI_SETTER_GHL_PI` | yes | — | The AI's own Private Integration token (Phase 0, step 2). Never `AGENT_CRM_PI`. |
| `AI_SETTER_GHL_USER_ID` | yes | — | Isaac's GHL user id: the owner of every booking, and how his manual replies are recognized. |
| `ANTHROPIC_API_KEY` | yes | — | Claude key from the AI Setter's Anthropic workspace: production key in Vercel, development key in `.env`. Only the AI Setter uses it. |
| `AGENT_CRM_LOCATION_ID` | yes | — | Already set. The sub-account; contacts of any other location are ignored. |
| `AI_SETTER_MODEL` | no | `claude-opus-5-5` | Claude model. |
| `AI_SETTER_EFFORT` | no | `low` | `low`, `medium` or `high`. Higher effort costs more; measure in shadow mode before raising it. |
| `AI_SETTER_MAX_TOKENS` | no | `8000` | Output cap per Claude call, 1,024–32,000. |
| `AI_SETTER_DAILY_BUDGET_USD` | no | `10` | Claude spend per day (Eastern), 0–1,000. Each turn first reserves a realistic worst case (about US$0.54: 4 calls × 12k input + 3k output tokens at fallback rates), then settles the real cost. Over budget, the lead is told Isaac will reply and Isaac gets an alert. Alerts at 50, 80 and 100%. |
| `AI_SETTER_TAG_NEW_LEADS` | no | `false` | `true`: `create-contact` adds `ai_setter` to new web leads (never LegalShield or Agent CRM affiliate leads). It lets the AI answer them; it never sends a first message. |
| `AI_SETTER_TEST_CONTACT_IDS` | no | empty | Comma-separated contact ids that `pnpm ai-setter:try` may write to (`--book … --yes`). Empty: the CLI never writes. Your own test contact only. |
| `AI_SETTER_AGENT_PHONE` | no | `(540) 426-1804` | The number leads are told Isaac calls from (booking confirmation, HELP). |
| `AI_SETTER_AGENT_FIRST_NAME` | no | `Isaac` | Name used in the texts. |
| `AI_SETTER_AGENT_FULL_NAME` | no | `Isaac Orraiz` | Name in the HELP reply and the system prompt. |
| `AI_SETTER_BRAND_NAME` | no | `Isaac Plans Insurance` | Brand in the AI disclosure and the HELP reply. |
| `NEXT_PUBLIC_SITE_URL` | no | `https://www.isaacplans.com` | Already set. Links in texts and alerts. |
| `AI_SETTER_APPOINTMENT_MINUTES` | no | `30` | Length of a booked call, 10–120. Must match the calendars' slot length, which `--calendars` prints. |
| `AI_SETTER_DEBOUNCE_SECONDS` | no | `20` | Wait after a message before the turn runs, so a burst gets one reply (0–120). |
| `AI_SETTER_CALL_NOW_TIMEOUT_SECONDS` | no | `180` | "Call now": with no button tap by then, the lead gets two times instead (60–900). |
| `AI_SETTER_DRAFT_TTL_HOURS` | no | `2` | A free-text draft not approved by then expires as `stale` (1–24). |
| `AI_SETTER_HUMAN_PAUSE_HOURS` | no | `48` | A manual reply from Isaac pauses the AI on that lead this long (1–720). |
| `AI_SETTER_INBOUND_MAX_AGE_HOURS` | no | `12` | Older lead messages are logged for Isaac, never answered by the AI (1–72). |
| `AI_SETTER_MAX_TURNS_PER_CONTACT_DAY` | no | `8` | Turns per lead per day (1–50). |
| `AI_SETTER_MAX_TURNS_PER_THREAD` | no | `40` | Turns per conversation; after that it goes to Isaac (1–200). |
| `AI_SETTER_MAX_TURNS_PER_HOUR` | no | `60` | Turns per hour across all leads (1–1,000). Over it, a turn retries in 10 minutes. |
| `AI_SETTER_APPEND_STOP` | no | `true` | Adds the STOP line to the AI's first message on a channel. `false` only if GHL already appends one (Phase 0, step 8). |
| `AI_SETTER_DEBUG` | no | `false` | Extra logs. They never contain message text, names, emails or full numbers. |
| `QSTASH_ENABLED`, `QSTASH_TOKEN` | yes | — | Already set. Publish the jobs. There is no inline fallback: without QStash every poke is ignored and logged. |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | yes | — | Already set. Verify deliveries to `/api/queue/ai-setter`. |
| `QSTASH_URL`, `QSTASH_TARGET_BASE_URL` | no | — | Already set; see QSTASH_SETUP.md. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | recommended | — | The bot that sends Isaac cards with buttons (Phase 0, step 3). Without them, alerts fall back to the "AI Setter – Aviso" workflow. |
| `TELEGRAM_ADMIN_CHAT_ID` | **yes, for Telegram cards** | — | Isaac's chat id (the bot's `/start` reply shows it). AI Setter cards go only to it and only it can press the buttons. Without it, AI Setter alerts skip Telegram and use the "AI Setter – Aviso" workflow. |
| `AI_SETTER_REPLY_HELP` | no | `true` | Answer HELP / AYUDA with the fixed help text. Set `false` if GHL or the carrier already answers HELP. |

Generate the secrets (`AI_SETTER_WEBHOOK_SECRET`, and `TELEGRAM_WEBHOOK_SECRET` if it isn't set
yet):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Production only.** In Vercel, tick only **Production** for every AI Setter variable. Preview
deployments build any pushed branch, and they must never hold a key that can text leads or spend
on Claude. Env changes apply to the next deployment, so redeploy after changing them.

**Local `.env`, for the scripts.** `pnpm ai-setter:try` needs `AI_SETTER_GHL_PI`,
`AGENT_CRM_LOCATION_ID` and `AI_SETTER_GHL_USER_ID`, plus `AI_SETTER_TEST_CONTACT_IDS` to write.
Its shadow turn also needs `AI_SETTER_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` (use the development
key) and `DATABASE_URL`, but not `QSTASH_*`: it replaces the queue with a recorder and prints the
jobs it would have published. It prints whatever is missing.

## 3. Database

> **Isaac:** correr `pnpm db:migrate 0045`. Nunca `pnpm db:migrate` solo.

Migration `0045` (`drizzle/0045_ai_setter.sql`) adds five tables. Every statement is
`CREATE … IF NOT EXISTS`, so it's safe to re-run:
- `ai_setter_leads`
- `ai_setter_messages`
- `ai_setter_suppressions`
- `ai_setter_events`
- `ai_setter_daily_usage`

Run `pnpm db:migrate 0045`. Don't run the plain `pnpm db:migrate`: it re-runs every migration from
0000, and on the live database that stops at 0029.

Panel settings (pause, "busy until", hours, approved templates) live in the existing `app_settings`
table, so they need no table of their own. Deploying before the migration is harmless while
`AI_SETTER_ENABLED` is `false`: the webhook, the jobs and the reconcile all stop before touching
these tables. Only the panel fails until the migration runs.

## 4. GHL workflows (built by hand; GHL's API can't create workflows)

> **Isaac:** crear los tres workflows a mano, con *Allow Re-entry* encendido y sin pasos de espera,
> y publicarlos.

### "AI Setter – Mensaje entrante" (the lead wrote)

1. **Automation → Workflows → Create Workflow → Start from scratch.** Name it
   **AI Setter – Mensaje entrante**.
2. **Trigger: Customer Replied.**
   - Filter **Reply channel**: SMS and WhatsApp. If the filter takes only one value, add the
     trigger twice, once per channel.
   - Filter **Has tag**: `ai_setter`.
   - Filter **Doesn't have tag**: `legal_shield`, `agent_crm_affiliate`, `tcpa_litigator_risk`,
     `ai_setter_off` (one filter per tag if needed).

   The app re-checks every tag itself; the filters just save webhook runs.
3. **Action: Custom Webhook.** It's a Workflow Premium action at US$0.01 per run after 100 free
   runs, and the Agent CRM agency must have Premium Features enabled.
   - **Method:** POST
   - **URL:** `https://www.isaacplans.com/api/webhooks/agent-crm/ai-setter`
   - **Authorization:** Bearer Token = your `AI_SETTER_WEBHOOK_SECRET`. If the builder has no
     Bearer option, choose "No auth + Custom Header" with `Authorization: Bearer <secret>`.
   - **Header:** `Content-Type: application/json`
   - **Body (raw JSON):** `{"event":"inbound","contactId":"{{contact.id}}"}`. Insert
     `{{contact.id}}` with the `{ }` picker.
4. **No other steps.** No Wait, no SMS: the app answers.
5. **Settings:** Allow Re-entry **ON**, or it fires only once per contact. Then **Publish**.

The webhook answers `{"ok":true,"accepted":true}` within a second. The reply comes about 20 seconds
later (the debounce), plus Claude's time.

### "AI Setter – Isaac respondió" (Isaac wrote by hand)

1. Create a workflow named **AI Setter – Isaac respondió**.
2. **Trigger: User Replied** (a team member replied to the contact), filter **Has tag**
   `ai_setter`.
3. **Action: Custom Webhook**, with the same URL, authorization and header. Body:
   `{"event":"user_replied","contactId":"{{contact.id}}"}`.
4. Allow Re-entry **ON**, no Wait steps, then **Publish**.

If your builder has no **User Replied** trigger, skip this workflow. Isaac's replies are still
caught: the next turn reads the thread and pauses the AI, and every send re-checks the thread
first. This workflow only makes the pause, and voiding the drafts, immediate.

### "AI Setter – Aviso" (alert fallback)

1. Create a workflow named **AI Setter – Aviso**.
2. **Trigger: Contact Tag**, filter **Tag Added** = `ai_setter_alert`.
3. **Action: Send Internal Notification** → SMS (or in-app) → to Isaac. Text:

   ```
   Asistente IA: {{contact.first_name}} necesita su atención. https://www.isaacplans.com/es/admin/ai-setter
   ```

   Never put the lead's message in it; the panel has it.
4. **Action: Remove Contact Tag** `ai_setter_alert`.
5. Allow Re-entry **ON**, then **Publish**.

The app uses this only when Telegram isn't set up or a Telegram send fails. It removes and re-adds
`ai_setter_alert`, because GHL fires "Tag Added" only when the tag wasn't already there. Alerts
that aren't about a contact (budget, errors) then reach only the Vercel logs.

## 5. Switch it on

> **Isaac:** primero modo sombra (no sale nada), después aprobar las plantillas, y solo entonces
> `AI_SETTER_DRY_RUN=false`.

**Enroll leads.** The AI answers only contacts with the `ai_setter` tag:
- `AI_SETTER_TAG_NEW_LEADS=true`: `create-contact` tags new web leads, never LegalShield or Agent
  CRM affiliate leads;
- and/or bulk-add `ai_setter` in GHL (Contacts → select → Add Tag).

In Phase 1 the tag only lets the AI **answer** when a lead writes. It never sends a first message.

**Rollout:**
1. **Shadow.** `AI_SETTER_ENABLED=true` with `AI_SETTER_DRY_RUN=true` (the default). Real
   conversations, nothing sent: /admin/ai-setter → Bandeja shows what the AI would have said. Tune
   the templates and the tone, and watch the cost per turn before settling the daily budget.
2. **Approve the templates** in Ajustes. One approval covers a template's English, Spanish-usted
   and Spanish-tú wording. It's stored as a hash, so any wording change in the code sends the
   template back to "to approve". An unapproved template waits in the inbox like free text. HELP
   and opt-out replies never need approval.
3. **Approval mode.** `AI_SETTER_DRY_RUN=false`. Approved templates go out on their own at once;
   free text waits for **[Enviar]** in Telegram or the panel.
4. **Phase 2, later.** A reply type goes automatic when its numbers justify it (30+ reviewed, 90%+
   sent unedited). Proactive messages come once their gates are in place.

**Off switches**, fastest first:
- Ajustes → pause everything (no deploy). "Estoy ocupado hasta" only stops call-now offers until
  then.
- Revoke the AI's Private Integration in GHL: every GHL call fails at once.
- `AI_SETTER_ENABLED=false`, then redeploy.
- For one lead: "Lo tomo yo" in the panel or on the Telegram card, or the `ai_setter_off` tag in
  GHL.

## 6. Test

> **Isaac:** la prueba de punta a punta (paso 4) se hace con su propio contacto.

1. **Offline:** `pnpm test:ai-setter` (no keys, no network). It covers:
   - opt-out tiers in EN and ES, including "cancelar la cita";
   - HELP and suppression by phone;
   - the windows: split zones, area code vs address, PA;
   - the license gate;
   - time picking: daylight saving, Eastern vs Pacific, "after 5";
   - template hashes, the guard (including facts not in the thread) and the classifier;
   - whole turns with a fake GHL and Claude: no double send on retries or bursts, a late approval
     goes `stale`, a manual reply pauses, a workflow welcome text and a GHL confirmation don't, and
     an empty budget fails safe.
2. **Live Claude, prints only:** `pnpm test:ai-setter --live en` or `--live es`, on the development
   key. About 25 scenarios ("how much is it?", "send me info", "I already have one", "is this a
   robot?", "call me now", STOP, wrong number, Spanglish, tú vs usted, California at night, health,
   Medicare, a current client, an unlicensed state, an audio), each scored by rules and a rubric.
   It touches neither the CRM nor the database.
3. **One shadow turn on a real contact:** `pnpm ai-setter:try <contactId>`. It reads GHL, calls
   Claude and stores what it would send as `shadow`, in the database from `.env`. It sends and books
   nothing and makes no CRM change (DND, notes, tags are recorded and printed, not made); alerts
   print to the console. It prints the text and its cost. With `--yes` and a contact in
   `AI_SETTER_TEST_CONTACT_IDS` the CRM writes are real.
4. **End to end, on your own contact.** Do it after Phase 0, with the workflows published,
   `AI_SETTER_DRY_RUN=false`, and only your own contact tagged `ai_setter` (keep
   `AI_SETTER_TAG_NEW_LEADS=false` until it passes):
   1. Become a lead through the real form, so `create-contact` and its workflows run, then add
      `ai_setter` to that contact by hand.
   2. Reply to the workflow's text.
   3. You get two times.
   4. Pick one: it's booked.
   5. The appointment shows in GHL and in Google Calendar, and the reminders arrive.
   6. Ask for another time: it's rescheduled.
   7. Write "llámeme ya": the Telegram card's [Estoy llamando] and [No puedo] work, and with no
      tap you get two times after 3 minutes.
   8. Reply by hand from GHL: the AI pauses.
   9. Send 3 texts in a row: one turn, one reply.
   10. Send STOP: the number is suppressed, with no second confirmation.

   GHL doesn't document these, so check them here too: whether Customer Replied fires for WhatsApp
   and for a contact's very first message, and how GHL marks a WhatsApp sent from your phone.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Nothing happens when a lead replies | The workflow isn't published; Allow Re-entry is off (it fired once per contact); the contact lacks `ai_setter` or has an exclusion tag; `AI_SETTER_ENABLED` isn't `true`; QStash isn't configured | Open the workflow's execution log. No run: check the trigger, filters and re-entry. `"skipped":"disabled"`: set `AI_SETTER_ENABLED=true` and redeploy. `"accepted":true`: in Vercel logs, filter `[AI_SETTER]`. "Not configured; poke ignored" lists the missing variables (often `QSTASH_*`), and a `Turn` line's `reason` names the rule that stopped it (`not_enrolled`, `excluded_tag`, `dnd`, `suppressed`, `paused`, `stale_inbound`…). |
| Webhook step fails with 401 | The secret in the workflow doesn't match `AI_SETTER_WEBHOOK_SECRET` | Paste it again in both workflows, with no quotes or spaces |
| Webhook step fails with 500 "Endpoint not configured" | `AI_SETTER_WEBHOOK_SECRET` isn't set in Vercel Production | Set it and redeploy |
| The AI paused after a workflow SMS or a calendar confirmation | The classifier took that automated message for one of Isaac's | Run `pnpm ai-setter:try --sources <contactId>` and send Claude the output to fix `classify.ts`. Resume the lead in the panel. |
| Reminders missing for AI bookings | GHL's reminder workflow doesn't fire for API-created appointments | Add the trigger **Appointment Status (Modified By: API)** to it |
| Telegram buttons do nothing / "No permitido" | Telegram isn't sending button presses (`callback_query`), or your chat isn't the admin chat | Run `pnpm telegram:webhook --set` (again after each deploy that changes the allowed updates), and set `TELEGRAM_ADMIN_CHAT_ID` to your chat id |
| No Telegram cards at all | `TELEGRAM_BOT_TOKEN` or `TELEGRAM_ADMIN_CHAT_ID` is missing (the logs say `TELEGRAM_ADMIN_CHAT_ID not set`) | Set both in Vercel. Meanwhile alerts go through the "AI Setter – Aviso" workflow (never in shadow mode, which doesn't touch the CRM). |
| Drafts go stale | Not approved within `AI_SETTER_DRAFT_TTL_HOURS`, or the lead wrote again or you replied first (the send re-checks) | Approve sooner, or raise `AI_SETTER_DRAFT_TTL_HOURS` (up to 24) |
| Every turn hands off, with the note "Presupuesto diario de la IA agotado" | The day's Claude budget is spent, or it's set below one turn's reservation (about US$0.54) | Raise `AI_SETTER_DAILY_BUDGET_USD`, and check today's cost in the panel |
| A reply waits until the morning | The lead's window: 8 am–9 pm local, or Mon–Sat 9 am–7 pm in Pennsylvania. The send is held. | Nothing to fix |
| Two STOP lines in one text | GHL appends its own STOP footer too | `AI_SETTER_APPEND_STOP=false` |

## Where runs are recorded

- **`ai_setter_leads`:** one row per contact. Status (active, paused, handoff, booked, stopped,
  opted_out), language and register, product, zone and state, the turn's fencing (run id, attempt,
  last handled message), the pause, offered times and the appointment.
- **`ai_setter_messages`:** every message the AI produced. Its status (draft → approved → sending →
  sent, or shadow, stale, rejected, superseded, blocked, failed, send_unknown), template or free
  text, tokens and cost, the rule decision (no message text) and who approved it, when. The text is
  erased after 90 days; the rest of the row stays (5 years at least).
- **`ai_setter_events`:** each contact's audit trail: webhook pokes, opt-outs, START, handoffs,
  Isaac taking over.
- **`ai_setter_suppressions`:** opt-outs by E.164 phone, kept for good. A lift records when and
  why.
- **`ai_setter_daily_usage`:** per day (Eastern): turns, reserved and actual Claude cost, sends.
- **Settings:** `app_settings` keys `ai_setter_paused`, `ai_setter_busy_until`,
  `ai_setter_schedule` and `ai_setter_templates`.
- **Logs:** Vercel → Logs, filter `[AI_SETTER]`. Ids, statuses and masked phones only, never
  message text.

The daily `/api/cron/queue-reconcile` (7 AM UTC) expires old drafts, erases 90-day-old text, and
re-publishes stuck turns and approved sends to QStash. It never runs a turn or a send itself,
since it fires at 2–3 AM Eastern.
