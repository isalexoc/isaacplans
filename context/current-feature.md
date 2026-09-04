# Current Feature

## Status

Done: **Live objection listener** (branch `feature/live-objection-listener`, merged). Phase 2 of the
objection work: while Isaac is on a call, the client's speech is transcribed live and a matching
objection card is suggested on screen. Clicking it opens the existing answer dialog.

**Why browser capture rather than the phone system.** Kixie's entire documented API is nine
metadata-only webhooks; GHL has no mid-call voice webhook and its number lives in GoHighLevel's own
Twilio subaccount. Neither can hand us live audio. Isaac talks through a headset with calls in
Chrome, so `getDisplayMedia({audio:true})` on the softphone TAB captures the client directly.

**ONE stream, not two.** The tab's audio output is what the softphone PLAYS — i.e. the remote party
— so tab capture IS the client, with perfect separation and no diarization. Isaac's mic contributes
nothing (every seeded trigger is a thing the client says) and dropping it halves the bill, removes
the getUserMedia permission, and deletes the echo cross-contamination risk class rather than
mitigating it.

**The wire protocol was verified by running it, and the design's version was wrong.** Synthesised an
objection with ElevenLabs TTS, decoded to PCM16, and streamed it through the real socket. First
attempt: every frame rejected with `input_error: "Could not parse the protocol message."` The field
is **`audio_base_64`**, not `audio_chunk`, and the query param is **`language_code`**, not
`language`. Corrected, the socket returned the sentence verbatim. Also confirmed live: `POST
/v1/single-use-token/realtime_scribe` returns `{token}` (15-minute TTL, consumed on use), so the
browser connects directly and never sees `ELEVENLABS_API_KEY` — which is the only shape that works,
since Vercel serverless cannot hold a long-lived inbound socket.

**No resampler.** `audio_format` is an enum covering pcm_8000 through pcm_48000 and every chunk
carries its own `sample_rate`, so when the AudioContext comes back at 48 kHz we declare pcm_48000
and send it. That deleted ~120 lines of hand-rolled windowed-sinc DSP from the design.

**Matcher accuracy, measured against the real 29-objection library:** 10/12 objections detected
(83%), 5/5 pieces of ordinary call chatter correctly ignored, 0 false positives — better than the
50-65% the design predicted. The two misses are corpus gaps, not algorithm failures ("discuss THIS
with my daughter" breaks contiguity against the seeded "discuss with my daughter"; "I never called
anybody" is not among the didnt-request-this phrasings). Both are fixed by editing triggers in
Sanity with no deploy, which is exactly why the algorithm stays dumb — the corpus is the tuning
surface.

**Nothing is persisted.** No Neon, no Sanity, no localStorage, and no API route ever receives
transcript text, so nothing can land in a Vercel log either. Transcript lives in a ref and dies on
stop or unmount. This does NOT remove the consent obligation — wiretap statutes cover interception,
not storage — but it means there is no archive.

**Cost: $0.39 per live call-hour**, billed per audio minute. Silence is streamed to hold the socket
open, so an open socket bills wall-clock: the Stop button, the 60-minute hard cap
(`LIVE_OBJECTIONS_MAX_SESSION_MINUTES`) and the silence watchdog are load-bearing, not decoration.

Verified: `tsc --noEmit` clean, full `pnpm build` green, token endpoint and socket exercised against
the live API, matcher measured against production content.

**Not verified, and it needs Isaac:**
- Whether Kixie PowerCall and the GHL softphone render call audio in a Chrome TAB or a detached
  popup WINDOW. A window share carries no audio at all — this is the one thing that could make the
  feature unusable, and it cannot be tested from here.
- The consent wording, which he says aloud. It is `DISCLOSURE` in
  `components/objections/live-listen-control.tsx`, EN and ES.
- `LIVE_OBJECTIONS_ENABLED=true` must be set in Vercel; it is already set in local `.env`.
- Zero-retention / no-training and accepted Scribe terms in the ElevenLabs account. Unaccepted terms
  fail at the SOCKET with `unaccepted_terms`, not at the token mint, so it looks like a bug.

---

**PDF export narrowed to the Complete Script only** (follow-up, branch
`feature/pdf-complete-script-only`). Isaac only wants the "Complete Script (All-in-One)" on paper —
the per-section script and the objection cards are for reading on screen, where they are searchable
and collapsible. The variant concept is removed rather than left as dead branches: the section
renderer, tips panels, objection cards and the masthead contents list are gone from `pdf.tsx`, the
route no longer queries objections at all, and the split button is now a single Download PDF whose
language follows the dashboard toggle. Final Expense EN went 21 pages -> 9, ES 38 -> 12.

Note: IUL's English `completeScript.contentEn` is a single block containing the literal character
"s" — the same placeholder junk as its objections — so that button produces a near-blank page until
it is written. No length threshold was added to hide it; masking the real state of the content is
worse than showing it.

Done: **Script polish — dark mode, image sizing, PDF export** (branch `feature/script-polish`,
merged). Three fixes plus one new feature on `/presentations`.

**The dark-mode highlight bug was not a colour problem.** `@portabletext/toolkit` sorts a span's
marks by occurrence count and then by `knownDecorators.indexOf()` — the list is
`["strong","em","code","underline","strike-through"]` (dist/index.js:28), so a CUSTOM decorator
returns -1 and sorts BEFORE `strong`. `buildMarksTree` then makes the highlight the OUTER node and
`<strong class="text-foreground">` its child, and a direct colour on the child beats the parent's
inherited one: near-white text on an amber highlight. Every broken highlight in the screenshots was
on bold text. Fixed by letting `strong`/`em` inherit colour rather than setting it — which also
stops a bold word inside `agentNote` or `blockquote` from jumping to full foreground. Every block
style sets a colour on its own wrapper, so nothing is left unstyled; a future block style added
WITHOUT one would leave bold text at the browser default.

**The objection badges were a Tailwind purge**, fixed separately in `d7d8997`: `content` did not
include `./lib`, so all sixteen dark-mode classes from `lib/objections/types.ts` were never
generated. Light mode worked only because those shades appear elsewhere under `components/`. The
dark treatment was then rebuilt properly — `bg-<hue>-950` was 1.14:1 against the card, effectively
invisible, so chips are now a translucent 500/20 fill + 400/50 inset ring + 200 text. Three hues
moved (sky→blue, teal→cyan, indigo→fuchsia) taking minimum hue separation across the eight
categories from 14° to 28°; safe to do now precisely because the dark badges had never rendered.

**Images.** The renderer hardcoded `width(500)` and a fabricated `width={500} height={600}` box, so
a dense underwriting grid was unreadable and every image reserved the wrong space while loading. A
`size` field (small / standard / wide / full, labelled by what the image IS, radio layout) now
drives both a CSS cap and what is requested from Sanity's CDN at 2x. Real dimensions are parsed from
the asset id, which works without dereferencing `asset` — the GROQ queries project block arrays raw.
Images with no value set render as `wide`, deliberately not the old 500px. Click-to-enlarge opens a
lightbox with fit/actual-size toggle.

**PDF export** follows the repo's `@react-pdf/renderer` precedent (`lib/mailing-labels/`), NOT
html2canvas or jsPDF.html() — those rasterise. `lib/presentation-scripts/` holds the theme, the
Portable Text→PDF converter, the document, and server-side content gathering; the route mirrors
`app/api/admin/mailing-labels/print/route.ts` exactly. Verified against live data: Final Expense EN
21 pages / ES 38, IUL EN 7 / ES 10, objections-only 7, ~2s each, real Helvetica in four weights and
PDF bookmarks.

> **Do not wrap the section list in `pdf.tsx` back in a `<View>`.** It reintroduces a SYNCHRONOUS
> runaway loop in @react-pdf's pagination — not a slow render, an event-loop block that a timeout
> cannot catch. Reproduced at 1.5 GB RSS and climbing. On Vercel that is an OOM'd lambda, not a 504.
> The Fragment structure and the comment above it are load-bearing.

Verified: `tsc --noEmit` clean, full `pnpm build` green, six PDF variants generated from production
Sanity data.

**Not verified, and it needs Isaac:** how a rendered PDF page actually looks (no PDF rasteriser on
this machine — structure is confirmed, visual layout is not), and the dark-mode result in a browser.

---

Done: **Objection Library — cards + instant search** (branch `feature/objection-library`, merged).
Objections lived inside one long rich-text blob in `objectionHandling`, rendered in a
one-at-a-time accordion — so reaching them mid-call closed whatever Isaac was reading, and finding
the right rebuttal meant scrolling a wall of text while a client waited.

**Objections are now their own document type, shared across products.** `sanity/schemaTypes/
objectionType.ts` holds title / type / triggers / answer per language, plus a `linesOfBusiness`
checkbox list where **empty means every product**. "I can't afford it" is written once. Answers
reuse `scriptBlockArray`, so a rebuttal gets the same toolbar as the scripts.

**The reading view puts the cards above the accordion and opens answers in a Dialog.** Not inside
the accordion, because that accordion is one-section-at-a-time and closing the section he was
reading is the actual problem. The overlay means the page keeps its scroll position and its open
section — close it and he is exactly where he was. Ctrl+K (or `/`) opens a cmdk palette that
searches titles and triggers; `preventDefault()` on Ctrl+K is mandatory or Chrome takes focus to
the address bar, and the palette closes any open answer first so two focus traps never fight.

**`count(undefinedField) == 0` is FALSE in GROQ** — Sanity stores an empty array as undefined.
Verified against the live dataset: `{"undef": null, "eqZero": false, "guarded": true}`. Every
product filter in `sanity/structure.ts` therefore leads with `!defined(linesOfBusiness) ||`, or
every "all products" objection silently vanishes from all six panes. The reading view sidesteps it
by bucketing in plain JS (`appliesToLob`).

**Search strips diacritics, and that is not polish.** The live Spanish content has "cotización",
"información", "opción"; nobody reaches for the accent key mid-call. The palette runs
`shouldFilter={false}` and uses the same `matchesObjection()` as the grid — cmdk's own scorer is
not diacritic-insensitive, so it would disagree with the grid about what exists.

**17 objections migrated** from the Final Expense script: 9 bilingual, 3 EN-only, 5 ES-only. EN and
ES were written independently and do not line up (12 vs 13, each with objections the other lacks),
so `scripts/migrate-objections-to-library.ts` parses only the answer blocks and takes titles, types
and triggers from a hand-written pairing table. Spanish #1 is deliberately used twice — its heading
enumerates both "just shopping" and "mail me something". Answer blocks are copied verbatim, so the
`strong` "Response A (…)" labels and the numbered list under "I want to think about it" survive.
**Join every child when reading a heading, never `children[0]`** — 5 of 13 Spanish headings hide
their text behind a `"\n\n"` first child and one splits across five children.

**Two bugs fixed on the way through.** The language toggle was per-tab state, so choosing Spanish
in Final Expense and clicking IUL silently dropped back to English; it now lives on the dashboard.
And the migration's own idempotency report was wrong — `_createdAt === _updatedAt` is true for a
freshly seeded row too, so a re-run claimed to create all 17 again (it had not; `createIfNotExists`
is safe and the dataset held exactly 17 with no duplicates). It now queries existing ids first.

**IUL deliberately keeps the old free-text section**: its `objectionHandling.contentEn` is the
single character "s", so there was nothing to migrate. `hideObjectionHandling` is computed per
product *and per language*, so a product with English cards but no Spanish ones falls back to the
old blob in Spanish automatically. Nothing was deleted from the schema, the query or the data.

Verified: `tsc --noEmit` clean, full `pnpm build` green, migration idempotent on re-run
(`0 written, 17 left alone`), and `OBJECTIONS_QUERY` against production returns 17 — 12 visible in
English, 14 in Spanish.

**Not verified, and it needs Isaac:** the cards, the dialog and Ctrl+K in a real browser.

**Live-call objection detection was researched and deliberately deferred.** Kixie's documented API
is nine metadata-only webhooks — no audio, no transcript stream; its "real-time transcription" is
an in-product dashboard with no integration surface, and Listen/Whisper/Barge has no API. GHL has
no mid-call voice webhook and its transcription endpoint is keyed to a post-call `messageId`; the
number lives in GoHighLevel's own Twilio subaccount, so there are no credentials to attach a stream
with. The viable path needs no telephony change at all: Isaac uses a headset with calls in Chrome,
so `getUserMedia` (his mic) plus `getDisplayMedia({audio:true})` on the call tab gives two separate
streams — perfect speaker separation, no diarization needed — fed to ElevenLabs Scribe v2 Realtime
(~150 ms, ~$0.39/hr; `ELEVENLABS_API_KEY` is already set). Gates are a per-session click, Chrome
tab-audio only (not window sharing), and all-party consent law in 11-15 states. The `triggersEn` /
`triggersEs` fields exist now as the seed corpus for that matching.

---

Done: **Script editor formatting tools** (branch `feature/script-editor-tools`, merged). Isaac writes
sales scripts in Studio and reads them at `/presentations` during live client calls. He asked for a
highlighter and "other options to format the text in a better way" — the toolbar only ever offered
Sanity's stock word-processor defaults because all 26 rich-text fields on `presentationScript` were
the bare `{type: 'block'}`.

**The vocabulary is now one shared definition**, `sanity/schemaTypes/scriptPortableText.tsx`, used by
every field via `scriptBlockArray()`. `presentationScriptType.ts` went from 804 lines of copy-pasted
array definitions to ~150; a tool added there now appears in all 26 fields at once. Note that
`defineField()` cannot type these array fields (TS2345, and `of: [...] as any` does not help) — the
same limitation already worked around in `iulPresentation/helpers.ts` — so the helpers return plain
object literals.

**Sanity REPLACES the default styles/decorators/annotations rather than merging them** (plain `||`
fallbacks at `@sanity/schema@4.18.0` Rule.js:421,431,444-446). Everything existing content uses is
therefore re-declared explicitly: `strong`, `em`, `underline`, `normal`, `h1`-`h4`, both list types,
and the `link` annotation. Dropping one would not just hide a button — the editor auto-strips
orphaned marks the moment a document is edited, so the formatting would be permanently gone.

**New tools:** three highlighters named by meaning rather than colour (Emphasize / Good news /
Careful — Isaac's choice over a single yellow marker), a "Fill in the blank" mark for values
substituted live, and four block styles: Say word for word, Ask then stop talking, Client says /
objection, Agent note — do not read. Removed `code` and `strike-through` after confirming zero uses.
Kept `underline` — a census found 62 of them.

**The census had to be re-run.** The first query defaulted to the published perspective and missed a
draft; `perspective=raw` gives the true picture — 3 documents, 1518 blocks, `strong` x687,
`underline` x62, `em` x55, and exactly 2 blockquotes (the same block in a published doc and its
draft).

**That blockquote is why "Client says" got its own style value instead of reusing the built-in.** Its
text is "(Slow down here. Pause often. Let them answer.)" — an agent stage direction. Repurposing
`blockquote` would have put a rose "CLIENT SAYS" badge on it in the Final Expense Product
Presentation section, i.e. attributed Isaac's own pacing note to the client, on a page read aloud
during calls. `clientSays` is a new value; `blockquote` stays neutral and no content changed meaning.

**Three silent drops on the reading view were fixed at the same time**, all pre-existing: 62
underlines rendered unstyled (the renderer only mapped strong/em/link), level-2 sub-bullets rendered
identically to top-level ones (`list-inside` with no per-level indent), and the `prose prose-sm`
classes on the wrappers are inert because `@tailwindcss/typography` is not installed — so there was
no fallback catching any of it. Body text went from ~12px to ~15-16px; `unknownMark` and
`unknownBlockStyle` fallbacks now catch anything unmapped. The component map moved to module scope
behind a `useMemo` keyed on language, so PortableText's own memo works again.

**Studio-specific gotchas worth remembering:** the style dropdown renders custom style components
with *only* `children` (`sanity/lib/index.mjs:30423`, `jsx(CustomComponent, {children: title})`), so
label pills must be guarded on `props.block` or the menu shows tall coloured boxes with doubled
labels. `DEFAULT_DECORATORS`/`DEFAULT_ANNOTATIONS` are not exported by `sanity@4.18.0` despite the
docs, and the `component` property only exists via a `declare module` inside `sanity`, so definition
types must be imported from `sanity`, never `@sanity/types`.

Verified: `tsc --noEmit` clean, `Schema.compile()` clean with every existing mark and style still
declared, full `pnpm build` green. `components/portable-text-components.tsx` was left untouched — it
serves the blog, whose schema still uses Sanity's defaults.

**Not verified, and it needs Isaac:** the toolbar and the reading view in a real browser. Restart
`pnpm dev` (a soft refresh is not enough — the mounted Studio memoizes its compiled schema) and hard
reload `/studio`.

**Known, deliberately not fixed here:** `accent` in `tailwind.config.ts:28` is a flat hex string
shadowing the shadcn accent token, so `hover:text-accent-foreground` compiles to nothing and
dark-mode hover on ghost buttons is white-on-cyan at ~2.4:1. Pre-existing and site-wide; fixing it
means sweeping every `bg-accent`/`text-accent` use.

**Worth doing next:** the AI script generator (`lib/script-generator/`) only ever emits
`normal`/`h1`-`h4`/`bullet`/`strong`, so generated scripts arrive nearly unformatted and the new
tools only apply to hand-edits. Its list regex `/^[-*]\s+(.+)$/` also never matches "1. ", so
numbered call steps collapse into one run-on paragraph.

---

In progress: **Call Study — recorded calls as readable dialogue** (branch `feature/call-study`,
migration `0035` applied). Isaac studies recorded IUL and life calls to build a better sales script.
What he needs from each file is a conversation he can read line by line — "Will: … / Dennis: …" —
not a subtitle file with timestamps.

**The engine is ElevenLabs Scribe, not the Kixie Whisper pipeline, and that removes most of the
work.** `lib/whisper-transcribe-long.ts` splits audio with ffmpeg only because Whisper caps at 25MB,
and Whisper cannot separate speakers at all — which is the entire point here. Scribe takes files up
to 10 hours / 5GB in one call, diarizes natively, and runs async via webhook. No chunking, no
function timeout, no ffmpeg. It also reads the audio from a URL, so recordings never pass through
Vercel (which caps request bodies at 4.5MB anyway — hence the signed browser→Cloudinary upload
lifted from `components/admin/page-media-client.tsx`).

**The finding that justified probing the API before writing code.** Passing the `pii` entity
*category* for redaction also redacts `name` and `name_given` — verified live, it turns "Hi, this is
Will" into "Hi, this is {NAME_0}" and destroys the one thing the feature exists to produce. The
redaction list is therefore narrow and explicit. `money` and `age` are deliberately absent too: a
premium figure and a client's age are the substance of a life call, not incidental PII.

**`speaker_id` comes back as the literal strings `agent` and `customer`** when `detect_speaker_roles`
is on — undocumented, and it means the transcript reads sensibly before any naming pass runs. GPT
then proposes real names from the introductions, and a rename control fixes what it misses. Renaming
rewrites a two-entry `speakerMap`, never the turns, so a correction is instant on an hour-long call.

**The snippet library is the part that serves the actual goal.** One call's analysis is interesting;
twenty calls' rebuttals filtered to "price objections on IUL calls that closed" is how a script gets
written. Quotes are required verbatim — a paraphrase cannot be said out loud on the next call.

Verified: 71/71 offline tests (turn grouping incl. interruptions and stray attributions, rendering,
metrics, windowing, redaction policy, and 16 webhook-signature cases). Live against the real API:
diarization, role detection, and redaction — SSN and card masked, names intact. Full webhook path
against the real database: bad signature 401, stale timestamp 401, valid 200 with 5 turns stored,
duplicate delivery a no-op, GPT correctly naming Will and Dennis. Analysis on a real transcript:
price objection caught with both sides verbatim, 3/3 quotes verbatim. **Full `pnpm build` green.**

**Not yet verified, and it needs Isaac:** a real multi-hour call end to end, which needs the webhook
registered in the ElevenLabs dashboard (Developers → Webhooks → "Transcription completed" →
`/api/webhooks/elevenlabs/transcript`, HMAC) and `ELEVENLABS_WEBHOOK_SECRET` set locally and in
Vercel. It is deliberately left blank rather than holding a placeholder: an empty secret fails
loudly, a wrong one would 401 every delivery and only surface a day later via the reconcile.

**Cost:** Scribe is ~$0.22/hour of audio. The ElevenLabs allowance is ~65k credits/month at roughly
330 credits/minute — on the order of three hours of audio, shared with the video studio's voiceover
and music. `payg` bills overage rather than stopping. Worth watching the counter after the first
few real calls.

---

In progress: **CrankWheel meetings, launched from the app** (branch `feature/crankwheel-meetings`,
migration `0034` applied). CrankWheel's in-page CRM button does not render on LeadConnector custom
domains, so Isaac could only start a screen share from the browser extension while sitting on a
contact page. This moves that button into our app, where the domain is ours and the problem does
not exist.

**Two link types, because there are two different moments.** `make_noauth_link` is "meet now": the
client taps the text and is in, with no number to read back. `schedule_meeting` is a durable link
safe to send days ahead, where the handshake is the point rather than the friction. Both are minted
from the same panel, which the IUL intake form and the standalone `/admin/meet` launcher share.

**The hazard that shaped the design.** A noauth link binds to the *first session joined with it*,
and the account has one presenter. Mint a link for client A, then mint one for B and start sharing,
and A clicking their still-live link lands in **B's session** with no handshake. `truncate_older_links`
is the documented fix and is passed unconditionally, never as an option — the consequence, that only
one instant link is live at a time account-wide, is stated in the panel rather than left to be
discovered.

**No polling of CrankWheel and no new cron.** `create_hook` / `viewer_hook` are HTTPS URLs
CrankWheel GETs when the session starts and when the client joins, so the "client joined" badge is
event-driven. They are unauthenticated GETs with no signature, so the 32-char secret in the path is
the whole credential — the blast radius is deliberately two timestamps and nothing else, and an
unknown secret answers 200 rather than 404 so it cannot be used as an oracle. The post-meeting CRM
note is a QStash job fired from `create_hook`, with the existing daily reconcile as the backstop for
scheduled links (which have no hook) and hooks that never arrived.

**A surprise worth recording:** this account's links come back as `hl=es` by default, so rewriting
the viewer language matters for *English* clients too, not only Spanish ones.

Verified: 27/27 offline tests (URL parsing, session matching, note formatting in both languages);
`make_noauth_link` and `schedule_meeting` both minted and deleted against the live account; the hook
receiver stamps both timestamps against the real database and is idempotent on replay; signed-out
callers get 401 on the API and the admin page behaves exactly like its peers. **Full `pnpm build`
green.**

**Not yet verified, and it needs Isaac:** an actual meeting — link on a second device, sharing
started from the extension, badge flipping to "client joined". Hooks need a public https origin, so
this cannot happen on localhost. Also outstanding: `pnpm iul:fields` to provision the `meeting_link`
CRM field, and the two GHL workflows (`meeting_now_sent`, `meeting_scheduled_sent`). Until those
exist, "send by text" reports a clear error and the copy-link path is the working one.

---

Completed: **Document previews, and one upload path for every file** (branch
`feature/document-previews`, merged to `main`). Isaac asked that every uploaded document reach the
CRM, appear on the admin form however many there are, and show a preview where possible, without
restricting file types.

**A flaw in the previous session's work, found while doing this.** The document link uploaded each
file to Cloudinary and then **never stored the resulting `public_id`**. Every document a client sent
created an asset that was unreachable and unpurgeable, and it made previews impossible. `FileRef`
now carries `cloudinaryId`, `resourceType` and `format`, and deleting a file destroys the Cloudinary
copy too.

**One pipeline, both paths.** The agent's own uploader and the client's link now call the same
`ingestIntakeFile`: Cloudinary for a previewable copy, then the CRM's dedicated upload endpoint for
the copy the agent opens. Before this they stored different things, so whether a document had a
thumbnail depended on who had attached it.

**The bug that had to be designed around, because it fails silently.** The CRM is authoritative
about *which* files exist — it echoes the whole field back after every upload, which is exactly what
makes several documents accumulate correctly — but it knows nothing about Cloudinary. Storing its
list naively would erase the `cloudinaryId` of every file already attached and kill their thumbnails
on the *next* upload, with no error anywhere. `mergeCloudinaryMetadata` matches existing entries
back by URL; 17 tests cover it, including three uploads in a row, deletion, and files predating
previews.

**Previews.** Images and PDFs get a real thumbnail (`pg_1` for page one of a PDF — note the contrast
with the conversion allow-list, which deliberately excludes PDFs: a thumbnail of page one belongs in
a list, replacing the stored document with page one would destroy it). Anything Cloudinary cannot
draw falls back to an icon rather than a broken frame, as do files attached before today.

**The preview route is the security-sensitive piece.** Documents use `authenticated` delivery, so
something must sign a URL — and signing whatever id it is handed would make it an oracle for every
asset in the Cloudinary account, including the agent's licence images. The requested id must appear
on *this session's own* file list. Proven: the same authorized caller gets 302 for their own
document and **404 for an id they do not own**.

**No file-type restriction anywhere.** The agent's uploader carried
`accept="image/*,application/pdf"`; removed. The server enforces size and a short executable
blocklist, nothing else.

Verified: 17/17 merge, 6/6 preview signing, 3/3 authorization. **Full `pnpm build` green** — which
also retroactively clears the ESLint gate that was unproven when `feature/iul-document-capture` was
merged.

**Still unverified: the live CRM upload**, which would mean creating a real contact in the
production CRM and deleting it again. The call itself is unchanged from the one the Documents step
has used in production all along. One real upload settles it.

---

Completed: **Secure document upload link** (branch `feature/iul-document-capture`, merged to
`main`, migration `0033` applied). The same idea as the SSN/bank capture link, for the Documents step: the agent issues a
link, the client photographs a licence, a green card or whatever was asked for, and it lands on the
CRM contact beside the documents the agent uploaded themselves.

**A sibling table, not a `kind` column on `iul_secure_captures`.** The lifecycles are opposites.
That link is single use — the first submit closes it, which is right for four numbers typed once.
This one stays open until it is revoked or the application completes, because the agent rarely
knows upfront whether they need a licence, a green card, both sides of one card, or a page the
client forgot. Sharing a table would have put an `if (kind === …)` inside the single-use check that
protects an SSN link, which is the last place in this feature that should grow a branch.

**Two destinations, and they are not redundant.** Cloudinary with `authenticated` delivery — the
same footing as the agent's licence images — is what the app can render from without handing anyone
a URL that works on its own; verified that an unsigned URL is refused and only a signed one
resolves. Then the same bytes go to the contact's `attachment_other` field through the identical
helper the agent's own Documents step uses, because Isaac submits applications out of the CRM and a
document only in our database is one he has to remember to go and find.

**The reason Cloudinary is in the path at all:** a client photographing a green card on an iPhone
produces HEIC, which plenty of software will not open, and "they sent it and I cannot read it" is
the same dead end as not sending it. Cloudinary converts it to JPEG on the way through.

**The bug that conversion nearly caused:** Cloudinary classifies a **PDF as an image**, so a
blanket `f_jpg` would have silently flattened a multi-page PDF into a picture of page one — losing
pages of a document somebody needs. Conversion is narrowed to an allow-list of formats that
actually need it (HEIC/HEIF/AVIF/TIFF); everything else passes through byte-for-byte. Covered by a
test that would fail if anyone widens it.

Client page: two buttons, no form. "Take a photo" carries `capture="environment"` so the camera
opens directly rather than asking Camera-or-Files; "Choose a file" carries **no `accept`** at all,
because any allow-list shows a client a file they cannot select. Uploads run **one at a time** —
a client who picks four photos should not watch a bar and then learn the fourth failed. The page
never lists what is already on file: a forwarded link that reads back someone's identity documents
is a worse leak than the upload it was protecting.

Any file type, minus a short list of executable extensions. Nothing a client photographs is on that
list, and an endpoint that stores any executable a stranger sends is an invitation however
unguessable the token.

Verified end to end against the real database and Cloudinary: **20/20** — authenticated storage,
unsigned URLs refused, PDF not flattened, filenames made safe without becoming useless, link
lifecycle, revoke, completed-application closes it, a new link revoking the previous one,
executables and empty files rejected. Throwaway sessions and Cloudinary assets cleaned up.

**Not verified: the CRM upload leg.** Exercising it means creating a real contact in the production
CRM, which is not something a test should leave behind. The call itself is the same one the
existing Documents step already uses in production.

**Local build gate not met, merged on Isaac's explicit call.** `pnpm build` compiles successfully
and then dies in the lint/typecheck phase with `Fatal process out of memory: Zone` — five attempts
across 3/4/6 GB heaps, cold and warm cache. The cause is the machine, not the code: ~1.3 GB free of
7.9 GB, with Chrome, Edge and VS Code holding most of it. Asking V8 for a heap the OS cannot back
turns the clean OOM into an access violation, which is what made this look like a code fault at
first. `tsc --noEmit` passes on the final state and compilation succeeds; **ESLint is the one gate
never proven** — there is no standalone `eslint` binary in the project and `next lint --file` drops
into an interactive setup prompt. Watch the Vercel deploy, which builds with far more memory.

**Pending from Isaac:** `pnpm iul:fields` to create the "Document Capture Link" field (until then
copy-link works and send-by-text returns a clear error), and a GHL workflow on the tag
`iul_document_capture_sent`. Its own field and tag deliberately — both links can be live at once,
and a workflow texting "the link" would have no way to know which one it meant.

---

Completed: **Secure link gets its own unbranded preview card** (branch `feature/secure-link-og`,
merged to `main`).
Isaac wanted the capture link to unfurl with his own artwork, deliberately as a utility page — no
branding, no product, no mention of insurance.

**The page previously had no Open Graph on purpose**, with a comment arguing a preview card would
put "send us your SSN" into a chat thread anyone could read. That reasoning was sound but the
conclusion did not hold: a page with no OG tags still unfurls, because WhatsApp and iMessage fall
back to `<title>` and the meta description — and the old title was
"Send Your Details Securely | Isaac Plans Insurance" with a description naming both the SSN and the
bank details. So the choice was never "card or no card", only what the card would say. The new copy
is strictly less revealing than what was already shipping.

Now: **"Secure Information" / "A private, encrypted link to send your information safely."** and the
Spanish equivalent, with Isaac's per-language artwork. No `siteName` (its only job is branding), and
no `og:url` or canonical — both would echo the tokenised URL into the page body and every preview
cache, and a canonical is meaningless when each link is unique. `noindex` and `no-referrer` stay.

**The Cloudinary transform is pinned to JPEG**, not `f_auto`. Measured on these exact images: a
modern `Accept` header gets a 50 KB WebP, a crawler sending a wildcard gets a 72 KB JPEG — two
derived assets, two cold-start transcodes, and a blank card on any crawler that advertises WebP but
cannot render it in a preview. `f_jpg,q_auto:good,w_1200,h_630,c_fill` gives every recipient the
same 72 KB file. Same reasoning as `HERO_VIDEO_TRANSFORM`. Size matters independently: the sources
are 1.5 MB PNGs and WhatsApp demotes a link to a small thumbnail above roughly 600 KB. The
1731×909 originals are within a rounding error of the 1.91:1 card ratio, so nothing is cropped.
Both derived images are warmed and serving from CDN in under 0.22 s.

Two things verified rather than assumed:

- **A preview fetch does not mark the link opened.** `openedAt` is stamped by the client page's own
  call to the capture API, which only runs in a browser, so a crawler rendering no JavaScript never
  reaches it. Checked against the real database: HTML fetched, `og:image` present, `openedAt` still
  null. This matters because the agent's panel reads "opened" as "the client is looking at it now".
- **Clerk does not intercept crawlers in production.** In dev, a crawler `User-Agent` plus
  `Accept: text/html` gets a 307 to a Clerk handshake (`__clerk_hs_reason=dev-browser-missing`),
  which would break the preview entirely. That reason is development-instance-only; confirmed
  against live production, where the same crawler request to a public page returns 200 with OG tags
  intact.

Noted, not changed: `OG_IMAGE_TRANSFORM` in `lib/page-media/cloudinary-urls.ts` still uses `f_auto`
and has the same crawler problem. It is only read by the admin page-media upload route, which bakes
the transform into the stored URL at upload time — so changing the constant would not fix images
already uploaded, exactly the trap the hero-video work hit.

---

Completed: **Secure capture links ask for only what is missing** (branch
`feature/scoped-secure-capture`, merged to `main`). Isaac often already holds half of this — the client read their
bank details off a cheque but went quiet at the SSN, or the reverse. Sending a form that demands
both again means asking someone to retype a number the agent already has correct, which is exactly
how a correct value becomes a wrong one.

Three named scopes — **both / SSN only / bank details only** — chosen over Isaac's suggested pair
of checkboxes because two checkboxes have four states and one of them means "ask the client for
nothing", which is a link that wastes a phone call. The set of useful requests is genuinely three,
so it is modelled as three, as a `ChoiceCard` radiogroup that costs a glance rather than a decision.

**No migration.** `iul_secure_captures.field_keys` already existed as a per-link frozen snapshot of
what a link may write — added so a later code change could not widen a link already sitting in
someone's text messages. Scoping is just letting the agent choose what goes into it, which means
the narrowing is enforced by the same mechanism that was already the security boundary: an SSN-only
link physically cannot write an account number.

Where the work actually was, none of it in the picker:

- **`validate()` in the client PATCH route required all four fields**, so a scoped link would have
  been unsubmittable. It now validates only the keys in the frozen snapshot — plus an explicit
  guard rejecting an empty snapshot, because "validate whatever turns up" would let a link close
  having collected nothing at all.
- **The agent's poll masked all four fields regardless of scope.** With a bank-only link out, the
  agent typing the SSN themselves would watch it turn into dots and get told "the client replaced
  what you typed" — which never happened. Masking is now scoped to the live link's keys. Sessions
  that never had a link keep the old behaviour, so nothing unrelated shifts.
- **The CRM note hardcoded "SSN and bank details" and listed all four fields.** A note claiming an
  SSN arrived on a bank-only link is worse than no note: the agent stops chasing the thing still
  missing. It now names what actually landed.
- The client page renders only the fields asked for, and the intro says which — a client promised
  one question and shown four is the reason they hesitated in the first place.

Verified end to end against the real database and a running server: **19/19 checks** — scope
round-trips, snapshot contents, the GET the phone renders from, scoped submissions accepted,
out-of-scope keys silently dropped rather than stored, incomplete submissions still rejected, and
single-use still closing the link. Screenshots confirm all three scopes render correctly. Throwaway
sessions cleaned up.

One test expectation was wrong rather than the code: `isValidSsn` is a length check by design,
since the field also accepts ITINs, so `111111111` is accepted. Left as is — tightening it risks
rejecting a legitimate ITIN.

Still unverified: the **agent-side panel**, which needs a Clerk admin session and cannot be
exercised headlessly — the same gap as the original secure-capture work.

---

Completed: **Routing lookup runs on free Fed data, no provider** (branch
`feature/local-ach-directory`, merged to `main`). Isaac asked why the lookup needed a paid API
when Google answers "what is the Bank of America routing number for Texas" for free. Investigating
it changed the decision, so the answer is worth keeping.

**Paying would not have fixed his example.** The Fed's directory carries a state for every
institution, but it is the bank's *administrative* address. Measured against the real file: 103 of
Bank of America's 106 routing numbers say Virginia, 83 of Wells Fargo's 86 say Minnesota, all 70 of
Capital One's say Virginia, all 44 of U.S. Bank's say Minnesota. Searching that data for
"Bank of America" + "Texas" returns nothing useful — and every paid routing-search API is built on
the same file. Google answers because sites assemble those tables from each bank's own
customer-service pages, which is a different source entirely.

**And the key was never premium anyway.** `API_NINJAS_KEY` was on the free tier, the search
endpoint is premium-only, so `providerUnavailable` latched on the first call and the panel hid
itself. The feature did not exist in production while looking present in the code — the failure
mode that removing the provider was meant to end. `API_NINJAS_KEY` is now unused and can come out
of `.env` and Vercel.

What replaced it:

- **`lib/iul-intake/data/ach-directory.generated.ts`** — the FedACH participant directory, 16,592
  institutions, embedded as gzip+base64 (187 KB gzipped, 250 KB of source). Embedded rather than
  read from disk on purpose: a data file has to be named in `outputFileTracingIncludes` for every
  route that reads it, and a route added later that forgets the entry breaks in production only.
  Regenerate with `pnpm build:ach-directory`; 1,606 retired numbers (merged banks carrying a
  replacement number) are dropped so a dead number can never be suggested.
  Vintage is 2018-12-04 — the last public release, since the Fed moved the bulk file behind FedLine.
- **`lib/iul-intake/data/bank-state-routing.ts`** — 250 hand-verified numbers across 26 big banks,
  the part the Fed file structurally cannot answer. Two gates, both of which rejected real published
  numbers rather than being decoration: the ABA checksum caught `081000033` (published as Bank of
  America Missouri, simply wrong) and directory presence caught `064103707` (published as U.S. Bank
  North Carolina, absent from the Fed entirely). A third caught `122000496`, added by hand as
  Comerica Arizona and actually MUFG Union Bank. `pnpm check:ach-directory` re-runs all of it.
- **`lib/iul-intake/ach-directory.ts`** — replaces both `routing-lookup.ts` (paid search) and
  `bank-lookup.ts` (free reverse lookup); both files are gone, and with them the last third party
  that saw any part of a client's bank details. 51 ms to inflate and index on cold start, ~1 ms per
  search after.

**The 84% that makes free data good enough:** 8,842 of 10,520 institution names register exactly one
routing number, so for regional banks and credit unions the state is irrelevant and the answer is
confident whatever state the client names. Verified end to end — Randolph Brooks TX, Suncoast FL,
Langley VA, Security Service TX all resolve to a single correct number, and Bank of America Texas
now returns `111000025`, which is both Isaac's original example and a number the old free reverse
provider could not find at all.

Results are labelled `curated` / `single` / `candidates`, because "this is the number" and "one of
these three is the number" are different things to say out loud to a client. Nothing is ever
auto-filled: the client confirms against their own cheque or app, which is the only verification
step the feature has.

---

In progress: **IUL intake — Final Expense look, SSN moved, secure capture link, routing lookup**
(branch `feature/iul-intake-restyle-secure-capture`). Isaac fills this form while the client
watches over a video call, which is the premise behind all four changes.

- **The look.** The visual language that made the Final Expense wizard readable — 2px borders,
  generous radii, 18px values, brand-coloured focus, tappable choice cards — moved out of that
  1652-line component into `components/intake-ui` and both forms import it. The six class strings
  are byte-identical to what was there (verified against `git HEAD` by comparing the extracted
  values), so FE renders unchanged. IUL keeps its **step structure** — this is a restyle, not FE's
  one-question-per-screen flow — and uses a middle-density `FIELD_INPUT`, because at FE's exact
  `px-5 py-4 text-lg` the 18-field personal step runs ~2500px and the agent scrolls *more*.
- **SSN moved** from step 1 (eighth question a client ever sees) to the top of the last step,
  retitled "Payment & sensitive info". No migration — same jsonb key; validation, CRM mapping and
  encryption all derive their key lists from the section list.
- **Secure capture link** (`iul_secure_captures`, migration `0032`): the agent issues a one-shot
  link, the client types SSN + routing + account + type on their own phone, and the agent's screen
  fills with the last 4 digits within ~3s. See the commit body for the full concurrency story; the
  short version is that the poll hands the agent **masks**, which makes every later autosave a
  no-op through the existing merge, plus a 15s server grace window and a focus guard.
- **Routing-number lookup** (`API_NINJAS_KEY`): bank name + the state the account was **opened**
  in → candidate ACH numbers, which Isaac reads back for the client to confirm. Suggests, never
  auto-fills — a wrong routing number is a failed draft and a lapsed policy.

Bugs fixed in the blast radius: `routingNumber` had no `maxLength` and no validator (the only line
of business without one — now capped at 9 with an ABA checksum, verified against real bank
numbers); the SSN rendered as raw `123456789` (now `123-45-6789` with a live digit counter); and
sensitive fields defaulted to **visible**, which is the wrong default when a client is watching the
screen share.

**Applied already:** `pnpm db:migrate` (migration 0032) and `pnpm iul:fields` (created the CRM
field `IUL Intake - Secure Capture Link`, id `gxdgRe5RV1nCFyb6YxUe`).

**Pending from Isaac:**
1. A **GHL workflow** keyed on the tag `iul_secure_capture_sent` that texts
   `{{contact.iul_secure_capture_link}}`. Until it exists, "copy link" works and "send by text"
   returns a clear error. There is no direct SMS API in this repo — GHL does the sending.
2. **`API_NINJAS_KEY`** in `.env` (premium tier). Without it the routing-lookup panel does not
   render and the form behaves exactly as before.
3. Manual verification of the **agent-side** capture panel, live poll and grace window — they
   require a Clerk admin session, so they could not be exercised headlessly. The client-side half
   was verified end to end against the real database.

---


In progress: **Pinned hero video format, site-wide** (branch `feature/hero-video-pin-format`) —
the same Cloudinary cold-start fix applied to `/agent-crm`, now applied to every hero video on the
site, starting from the Spanish Final Expense apply hero Isaac asked about.

`lib/page-media/cloudinary-urls.ts` `HERO_VIDEO_TRANSFORM` was
`f_auto,q_auto,vc_auto,w_1280,c_limit` — chosen so modern browsers got VP9/AV1 and older ones
H.264. Sound for a short clip, wrong for a hero: Cloudinary derives a separate asset per browser
family and transcodes each on the first request for it. Measured on the 11-minute FE apply hero:
Chrome got `webm; vp9` at 30.4 MB (etag `bff9e3ec`), Safari on iPhone `mp4; hvc1` at 37.7 MB (etag
`5ad46c02`). Two files, two cold starts, above the fold. Now `f_mp4,vc_h264,q_auto:good,w_1280,c_limit`.

**The part that nearly got missed:** an override saved in /admin/hero stores the FULL delivery URL
with that day's transform baked in, so changing the constant fixes the built-in defaults and
silently skips every video Isaac actually uploaded — exactly the ones most likely to be cold. The
`final-expense/main/hero/es` override was still on `f_auto,q_auto,w_1280`. `parseMedia` now runs
stored video URLs through `withPinnedVideoTransform`, so old and new overrides normalise on read
with no data migration. Its segment detector is an allow-list of Cloudinary parameter prefixes,
not a "letters then underscore" test, because the naive version eats a folder called `my_videos`
and turns a working URL into a 404 — covered by a case in the throwaway check.

Verified after warming: both FE videos return an identical ETag, byte count and content-type to
Chrome, iPhone and Android, every request under 0.12 s.

`pnpm warm:media` now covers page-media too — it reads every hero cell's live media (override when
set, default otherwise) straight from the database, so an admin upload is warmed without anyone
maintaining a second list. It runs with `--conditions=react-server` so a plain script can import
the real `settings.ts` (which pulls in `server-only`) instead of a driftable copy of it. Current
run: 36 assets, all generated and CDN-served.


In progress: **Agent CRM affiliate page** (branch `feature/agent-crm-affiliate`) — a shareable
page at `/agent-crm` (same slug in both languages) that Isaac sends to other insurance agents to
promote his Agent CRM affiliate link, `https://www.agent-crm.com/?fpr=isaacplans`.

Aimed at producers, not clients, so it deliberately looks nothing like the site's lead funnels:
dark hero, no quote form above the fold, and the primary action is an outbound link rather than a
capture. Full site header and footer stay on for credibility.

- **`lib/agent-crm-affiliate.ts`** — the affiliate URL, the per-language walkthrough video, the
  per-language OG card, and a small standalone YouTube/Vimeo/direct-file URL parser. Every piece
  of creative that lands later is a one-line constant here rather than a literal in the page.
  The affiliate URL is used **verbatim, with nothing appended**: `fpr` is the FirstPromoter
  referral parameter, no per-button UTM would ever surface in that dashboard, and the one link
  that pays must not carry avoidable risk.
- **`components/agent-crm/agent-crm-cta.tsx`** — every "Start with Agent CRM" button. Analytics
  fire without intercepting the click, so a blocked or slow pixel can never eat the referral.
  `placement` (hero / under_video / bonus / final) rides on the event, not the URL.
- **`components/agent-crm/agent-crm-video.tsx`** — three states: a designed "coming soon" frame
  while `url` is null (not a dead play button), a click-to-play facade once a URL is set, then the
  real player. Same reasoning as the blog hero: an iframe on load would drop several hundred KB of
  third-party JS into the LCP path for visitors who never press play.
- **`components/agent-crm/agent-crm-lead-form.tsx`** + **`app/actions/agent-crm-affiliate.ts`** —
  the quieter "ask me anything first" capture below the FAQ, for the agent who reads everything
  and still isn't buying software today. Writes its own contact with source `agent_crm_affiliate`
  and tag `agent-crm-affiliate`, deliberately **not** through `/api/create-contact`: that route
  fires the consumer workflows, and an agent asking about a CRM must never land in a
  "thanks for your health insurance inquiry" sequence.
- FAQPage JSON-LD, per-language `og:image` / canonical / hreflang, and the FTC affiliate
  disclosure on the page itself.

- **Free trial** (branch `feature/agent-crm-free-trial`): every account gets 14 days free, which
  is the page's strongest lever, so it leads rather than hiding in the FAQ. All five CTAs read
  "Start my 14-day free trial", the `og:description` opens with it in both languages, and a
  dedicated emerald "No risk" band sits directly after the walkthrough — an agent who just watched
  the video has exactly one question left, and it is what this costs to find out. Emerald rather
  than brand blue so it reads as a separate promise from the "why through my link" card below it.
  The third card is the one that matters commercially: book the setup call *inside* the trial, so
  the fortnight is spent judging a configured system instead of an empty account.
  Copy deliberately never claims "no credit card required" — that was not established, and it is
  the one trial claim that damages trust if wrong. Everything written is true either way.

- **Spanish walkthrough + price** (branch `feature/agent-crm-video-and-price`): the hero-media slot
  now holds either a video or a still, per language, via `AgentCrmHeroMedia` in
  `lib/agent-crm-affiliate.ts`.
  - **ES** plays the real 8m 06s walkthrough. The master is a 493.9 MB screen capture at
    1994×1080, so it is delivered as `w_1600,c_limit,f_auto,q_auto` → 40.7 MB, a 92% cut.
    Measured, not guessed: `w_1280` gives 32.1 MB and `q_auto:eco` 27.3 MB, both rejected because
    this is a recording of a CRM and downscaling a 1994 px capture softens exactly the small UI
    text somebody pressed play to read. Verified in a real browser — zero video elements before
    the click, then playing at `readyState 4`, `seekable` across the full 486.5 s immediately
    (faststart MP4, so viewers can scrub without downloading it) and buffering ~44 s ahead rather
    than pulling 40 MB up front. Poster is the Spanish card, so the slot is branded before play,
    and the caption states the runtime, which lifts play rate.
  - **EN** has no clip yet, so the slot renders the English card as a plain still with **no play
    button** — a dead play control is worse than no control. Its section copy was rewritten to
    match: "See it before you buy it / a tour of the exact system" would be a broken promise over
    a static image, so English reads "A look inside / This is what you're actually getting", and
    the hero's secondary button says "See what you get" rather than "Watch the walkthrough".
    When the English clip lands, set `videoUrl` in `AGENT_CRM_MEDIA_EN` and put that wording back.
  - **$97** appears in four places — trust row, the trial card ("if you stay, it's $97 a month"),
    the bonus note, and the "does it cost more through your link" FAQ. Naming the price inside the
    trial block matters: a free trial with an unstated price after it reads as a catch. The
    framing throughout is that the price is identical either way, so going direct means paying the
    same $97 and getting none of the setup call.
  - Same `autoPlay` correction as the blog player: the `<video>` sits behind `started`, so
    playback had depended on React committing before the frame callback rather than on the
    browser. ES uses a native file, so this is the path that actually runs.

- **Standard form + guaranteed video availability** (branch `feature/agent-crm-standard-form`):
  - The capture form was rebuilt on the site's shared lead-form pattern rather than its own
    bespoke one: `PhoneInput` normalising to E.164, the SMS and marketing consent checkboxes
    (which the first version lacked — that is the TCPA opt-in record), localized privacy/terms
    links, and the same field/error styling as `health-alternative-lead-form`.
  - It now posts through `/api/create-contact` like every other form, added there as a
    first-class `agentCrmData` lead type: `lead_source_details`, consent capture, locale tags,
    duplicate-safe creation, and the tags applied on the duplicate-merge path too. Tagged
    `agent_crm_affiliate` + "Agent CRM Affiliate Lead", and its note opens by stating the contact
    is a fellow agent, not a client — that is what keeps a recruit out of an insurance sequence.
    Excluded from the generic notification workflow like every other specialty lead, but with a
    deliberate difference: `AGENT_CRM_WORKFLOW_AGENT_CRM_AFFILIATE` **falls back** to the
    notification workflow when unset, because a recruit with no automation at all is a silent
    lead. Meta CAPI stays off for it by construction — the helper only fires when the client
    passes a pixel `eventId`, and non-ads forms don't, so agent recruits can't skew the
    insurance-Lead optimisation.
  - **Video format is now pinned, and this matters.** `f_auto` was deriving a separate asset per
    browser family — measured: VP9 WebM for Chrome/Firefox/Android (31.5 MB), HEVC MP4 for Safari
    on iPhone (38.7 MB), and an H.264 MP4 for Save-Data clients that was caught mid-transcode.
    Each is generated on the first request that asks for it, from a 493.9 MB master. Warming the
    page in Chrome would have done nothing for the first iPhone visitor. Pinned to
    `f_mp4,vc_h264,q_auto:good` so exactly one derived asset exists; verified identical ETag,
    size and content-type across Chrome, Firefox, Safari (iPhone/Mac), Android, Samsung
    Internet, Save-Data and iOS 12, every one answering in under 0.3 s from CDN.
  - `pnpm warm:media` (`scripts/warm-cloudinary-media.ts`) generates every derived asset ahead of
    visitors and reports size and response time. Its URL list is derived from the same constants
    the page renders from, so it cannot go stale against production. Run it after changing a
    transformation or swapping a video. Images still use `f_auto` and can derive a webp variant on
    first request — harmless at 0.1–0.2 MB, unlike a 40 MB video.

**Pending from Isaac:** the English walkthrough clip; whether the trial requires a card at signup
(if it does not, saying so is worth another lift); confirmation that $97 is monthly — it is
written as "$97/month", which is the natural reading, but it is a price on a public page; and
whether to create a dedicated GHL workflow for `AGENT_CRM_WORKFLOW_AGENT_CRM_AFFILIATE` (until
then recruits ride the notification workflow).

**Known issue:** the EN/ES OG share cards Isaac supplied read "Agency CRM"; the product is "Agent
CRM". Flagged, not yet resolved — they are live on `main`.

---

In progress: **Blog featured video** (branch `feature/blog-featured-video`) — a blog post can now
carry a video URL alongside its featured image. The image stays the canonical artwork everywhere
it already is (listings, search, `og:image`, newsletter, JSON-LD); the video only replaces it in
the hero slot of the post page itself, with the image serving as its poster frame.

- **Studio**: new collapsible `featuredVideo` object on `post` — a **Video URL** (YouTube, Vimeo,
  or a direct `.mp4`/`.webm`/`.mov`, Cloudinary included; https only, validated against the same
  parser the page renders with) and an **Orientation** radio (landscape 16:9 / vertical 9:16 /
  square 1:1). Nothing is uploaded to Sanity — the clips already live on YouTube or in Cloudinary.
- **`lib/blog-featured-video.ts`**: dependency-free URL parser shared by the schema and the page,
  so validation and rendering can't drift. Unparseable URL → null → the page falls back to the
  plain image, so a bad link can degrade the hero but never blank it.
- **`components/blog-featured-video.tsx`**: click-to-play facade over the poster. The embed only
  mounts on click, so a video post costs the same on first paint as an image post instead of
  pulling ~800 KB of YouTube JS into the LCP path for readers who never press play.

Verified:
- **Parser** — 42 cases through a throwaway harness: every YouTube shape (`watch?v=`, `youtu.be`,
  `/shorts/`, `/embed/`, `/live/`, `m.`, `-nocookie`, extra params), Vimeo including the unlisted
  hash in both its path and `?h=` forms, and Cloudinary video URLs that carry no file extension
  once a transformation is applied. Correctly rejects `http:` (mixed content), `javascript:`,
  channel pages, Cloudinary *image* URLs, and empty input. `isSupportedBlogVideoUrl` agrees with
  `parseBlogVideoUrl` on every case, so the Studio cannot accept a link the page would drop.
- **The LCP claim holds** — with a video set, the initial HTML carries **0 `<iframe>` tags** and
  **0 bytes of YouTube JS**; the embed URL appears only as a serialized prop in the RSC payload.
- **Both orientations render** — landscape full-width 16:9, vertical constrained to 420px and
  centered, posters cropped to 1600×900 and 720×1280 to match each player's shape.
- **No regression** on existing posts: the diff rewrote the featured-image branch, and a post
  without a video still renders its hero image identically.
- Fixed while verifying: `start()` carried a comment copied from `components/media/
  hero-video-player.tsx` claiming the `<video>` is already mounted. It is not — here the element
  sits behind `started`, so autoplay depended on React committing before the frame callback
  rather than being guaranteed. The element now carries `autoPlay`, with the `play()` call kept as
  a caught fallback.

**Not yet exercised end to end:** no post has `featuredVideo` set, so a real clip has never played
on a live page. The video path was verified by injecting a URL locally and reverting. Pasting a
video link into any post in the Studio is the remaining check.

---

In progress: **Apply pages, shared intake engine, and admin-editable hero media (image or
video)** — a three-phase feature. Approved plan saved at
`C:\Users\isale\.claude\plans\i-need-to-do-sleepy-lagoon.md`.

Closes three gaps at once:

1. Only 3 of 8 lines of business have an `/apply` page (ACA, IUL, Final Expense). The other five
   — short-term-medical, dental-vision, hospital-indemnity, life-insurance, health-alternative —
   have no apply page, no intake, and no "Ready to apply now?" CTA on their main page.
2. The intake system is copy-pasted per line of business (~35 files each; the three existing ones
   are 95% identical). Cloning it five more times would mean ~175 files and eight copies of every
   future fix.
3. Hero media is only admin-editable on the five `get-covered` ads funnels, and only as a still
   image. Isaac is standing up a video recording studio and wants to drop a video into any main
   or apply hero — or keep/swap the photo — from the admin dashboard.

**Phase 1 — Apply pages + CTAs** (branch `feature/lob-apply-pages`): a new client-safe LOB
registry at `lib/lob/registry.ts`; collapse the six byte-identical `*-apply-cta.tsx` /
`*-apply-hero-button.tsx` components into two parameterized ones (16 copies avoided); five new
`/<lob>/apply` + `/<lob>/apply/start` pages cloned from `app/[locale]/aca/apply/page.tsx`; ten
message files registered in `i18n/request.ts`; ten `pathnames` entries (`apply` → `aplicar`);
`ctaSecondary={<LobApplyHeroButton …/>}` on the five main LOB pages.

**Phase 2 — Shared intake engine** (branch `feature/intake-engine`): `lib/intake-core/` ported
from the ACA vertical but config-driven, plus `lib/intake-configs/<lob>.ts` ×5 (one shared
"ancillary" field set for STM/dental/hospital/health-alternative, a separate life-insurance set
with beneficiaries and health questions). **One** new `intake_sessions` table with a `lob`
discriminator instead of five tables; one `app/api/intake/[lob]/**` route tree; generic
`components/intake/*` and `hooks/use-intake-autosave.ts`; a generic
`scripts/create-intake-fields.ts <lob>` writing IDs to a committed JSON instead of regex surgery
on a TS file. ACA/IUL/FE are deliberately **not** migrated — they keep working untouched.

**Phase 3 — "Page Media"** (branch `feature/page-media`): generalize `lib/ads-images/` →
`lib/page-media/` over three surfaces per LOB (main / apply / ads) × hero + OG × en/es, and add
video. No DB migration — it keeps using the generic `app_settings` table, and the `ads` surface
keeps emitting today's exact keys so existing overrides survive. Hero media becomes
`{type:"image"} | {type:"video", posterUrl, playback:"loop"|"click"}`, rendered by a new
**server-component** `components/media/hero-media.tsx` using a plain `<video>` — deliberately not
`next-cloudinary`'s video.js-based `CldVideoPlayer`, which would add a large client bundle to
pages whose LCP costs ad money. Video uploads go browser→Cloudinary directly with a signed
request (Vercel's 4.5 MB body cap makes proxying impossible) with an XHR progress bar.
Also fixes two live bugs: `app/actions/ads-images.ts:11`'s hardcoded `VALID_LOBS` (so "Use
default image" currently fails for Life Insurance and Health Alternative) and the
one-query-per-row admin read.

**All three phases are implemented and build clean** (`pnpm build`, `tsc --noEmit`), on branch
`feature/lob-apply-pages`. Not yet committed.

Verified:
- **Phase 1** — all 16 apply routes compile; the 10 new URLs return 200 in both locales with zero
  `MISSING_MESSAGE`; the "Ready to apply now?" button is on all 8 main pages with correctly
  localized hrefs.
- **Phase 2** — apply → start 307s with the device cookie set; resume-by-device returns the same
  token instead of duplicating; autosave writes and flips status to `in_progress`; a real Agent CRM
  contact is created lazily on the first save carrying an email/phone; SSN comes back masked
  (`•••••6789`) and is `enc:v1:…` at rest; **echoing the mask back preserves the real value**
  (confirmed by decrypting from Postgres). Security: a Dental token via the Life route 404s, an
  unknown line 404s, a link opened on a second device gets `403 claimed_elsewhere`, the agent
  dashboard is blocked signed-out, the admin API 401s. A config validator confirms complete
  bilingual labels, correctly prefixed slugs, no cross-line collisions and resolvable `showIf`
  targets across all 5 configs (290 fields, 218 CRM slugs).
- **Phase 3** — a legacy `aca_get_covered_hero_url_en` row written in the old module's format is
  read by the new one and renders on the live page (the no-migration claim, tested). Video renders
  correctly in both modes: loop emits `autoPlay muted loop playsInline aria-hidden` +
  `motion-reduce:hidden` with a poster sibling on `motion-reduce:block`; click emits `controls`
  with a poster and no autoplay. The `so_0` poster and `f_auto,q_auto,w_1280` video URLs both 200
  from Cloudinary. With no override, every page falls back to its original image.

**Open items:**
- **CRM fields are not provisioned.** `pnpm intake:fields --all` must run against production Agent
  CRM before intake sync writes real values — 218 custom fields across the five lines (~44 each,
  in line with ACA's existing ~60). Worth reviewing the field sets in `lib/intake-configs/` first;
  GHL slugs are awkward to rename after creation.
- `INTAKE_DEFAULT_OWNER_USER_ID` is set in Vercel and `.env`; the optional per-line overrides
  (`STM_DEFAULT_OWNER_USER_ID` etc.) are unset and fall back to it, which is the intended default.
- Migration `0031_lumpy_mentor.sql` (`intake_sessions`) is applied locally; **still needs
  `pnpm db:migrate` on production.**
- The intake dashboards' signed-out redirect target (`/${locale}/sign-in?…`) is not a real route —
  an inherited quirk shared with all three original dashboards, not introduced here.
- Apply-page hero photos reuse each line's main-page photo as a placeholder; all are now swappable
  from `/admin/hero` without a deploy.

## Prior feature

Last completed: **Final Expense — Self-Apply Intake + Agent Dashboard**, merged to main from
`feature/final-expense-apply`.

Adds a third self-serve intake pipeline (alongside IUL and ACA): `/final-expense/apply` →
Clerk sign-up → `/final-expense/apply/start` → `/final-expense/intake/[token]`, plus an agent
dashboard at `/final-expense/intake` to create/manage sessions ("the workflow page"). Backend
(session table, field-catalog DSL, AES-256-GCM encryption, autosave, CRM sync) mirrors
`lib/iul-intake/*`/`lib/aca-intake/*` exactly. Scope is deliberately lite — no
tobacco/health/hospitalization questionnaire, single-person only (no owner-vs-insured
branching) — just name/contact, DOB/gender, SSN with a graceful no-SSN path, address, mother's
maiden name, treating physician, and a medication picker backed by NIH's free RxTerms API (drug
name autocomplete) + a static curated condition list (usage/"what's it for").

The client-facing wizard UI is intentionally **not** a copy of IUL/ACA's dense multi-field
stepper — after reviewing Ethos reference screenshots, it's a one-question-per-screen animated
flow (thin progress bar, icon-illustrated selectable cards, sticky disabled→active Next button,
`framer-motion` transitions — already a dependency). The agent dashboard/read-only view stay in
the existing denser style.

Two existing FE success screens (`final-expense-get-covered-funnel.tsx`'s "done" phase,
`final-expense-lead-form.tsx`'s SUCCESS state) get a new "Apply now" CTA pointing at
`/final-expense/apply`, mirroring exactly what ACA did in `aca-get-covered-funnel.tsx:592`.

**Implemented.** New: `lib/fe-intake/*` (fields/schema/validation/encryption/ghl-field-ids/
server/ui-strings/types/share-url), `lib/fe-intake-api.ts`, `hooks/use-fe-intake-autosave.ts`,
`app/api/fe-intake/**` (list/create, `[token]` GET/PATCH/DELETE, complete/reopen/reset/send-link,
`medications/search` — proxies NIH's free RxTerms Clinical Table Search Service, keyless),
`scripts/create-fe-intake-fields.ts` (`pnpm fe-intake:fields`), `fe_intake_sessions` Drizzle
table + migration `0018_plain_sleepwalker.sql`, `components/final-expense-apply-cta.tsx`,
`components/fe-intake/{intake-form,intake-dashboard,client-view,intake-breadcrumb}.tsx`, pages at
`/final-expense/apply(/start)` and `/final-expense/intake(/[token](/view))`, i18n routing entries
(ES: `/gastos-finales/aplicar`, `/gastos-finales/admision`), `messages/{en,es}/final-expense/
apply.json`, `FE_APPLY_HERO_IMAGE` in `lib/get-covered-fast/constants.ts` (reuses the existing FE
get-covered EN hero photo as a placeholder).
- **Verified**: `pnpm tsc --noEmit` and `pnpm build` both clean — all 5 new routes compiled
  (confirmed in the build's route manifest). Dev-server + headless-Chrome screenshots confirmed
  `/en/final-expense/apply` and `/es/gastos-finales/aplicar` render correctly (hero, badge,
  4-benefit grid, 3-step "how it works," secure note, CTA button) with no `MISSING_MESSAGE`
  errors. Confirmed `/final-expense/apply/start` 307-redirects a signed-out visitor back to
  `/final-expense/apply` (Clerk-gated, no session yet). Confirmed `/final-expense/get-covered`
  and `/final-expense` still load cleanly after the CTA edits. **Not verified live** (Clerk-gated,
  same reasoning as every prior LOB's self-apply flow): the actual one-question intake wizard at
  `/final-expense/intake/[token]` and the agent dashboard at `/final-expense/intake` — both
  require a real Clerk session; verified by careful code review instead, consistent with how
  `/admin/hero` and the ACA/IUL intake forms were verified when first built.
- **Known open items**: GHL custom fields not yet provisioned (`pnpm fe-intake:fields` needs to
  run against production Agent CRM before CRM sync writes real values — currently all blank in
  `lib/fe-intake/ghl-field-ids.ts`); new env var `FE_INTAKE_DEFAULT_OWNER_USER_ID` needs setting
  in Vercel (mirrors `ACA_DEFAULT_OWNER_USER_ID`/`IUL_DEFAULT_OWNER_USER_ID`); `FE_APPLY_HERO_IMAGE`
  is a reused placeholder photo, swappable anytime; the intake dashboard/view pages' unauthenticated
  redirect target (`/${locale}/sign-in?...`) doesn't actually exist as a route in this app — an
  inherited quirk copied verbatim from the ACA/IUL dashboards (which have the same latent 404 for
  a signed-out direct visit), not something introduced or fixed here; migration
  `0018_plain_sleepwalker.sql` needs `pnpm db:migrate` on production.
- Merged to main. Still-open items carried into the Phase 2 work above: GHL custom fields for FE
  were never provisioned (`pnpm fe-intake:fields`), `FE_INTAKE_DEFAULT_OWNER_USER_ID` is unset in
  Vercel, and the intake dashboards' signed-out redirect target (`/${locale}/sign-in?…`) is not a
  real route in this app — a latent 404 shared by all three existing dashboards.

Before that: **Health Coverage Alternative** (8th LOB, `feature/health-alternative-lob`) and
**Life Insurance** (7th LOB, `feature/life-insurance-lob`) — both in History below.

## History

- 2026-08-04: **Health Coverage Alternative line of business** implemented (pending
  commit/merge). 8th line of business, promoting Isaac's existing Pivot Health STM agent link
  (`PIVOT_DIRECT_QUOTE_URL` in `lib/pivot-direct-quote.ts`) to an underserved audience:
  ACA-subsidy-ineligible, ACA-too-expensive, no qualifying immigration status, freelancers/
  self-employed, college students. Distinct from the existing `/short-term-medical` LOB ("gap
  coverage between jobs" framing) and `/carriers/pivot/shortterm` (detailed compliance-heavy
  carrier page, left untouched) — same pattern as Life Insurance vs. IUL.
  - **Main page** `/health-alternative` (es: `/alternativa-de-salud`): hero, about, a self-enroll
    `PlanEnrollCard` section (reuses `components/SelfEnrollSection.tsx`, linking to
    `PIVOT_DIRECT_QUOTE_URL` with Pivot's real logo), eligibility (4 audience-segment bullets:
    subsidy/cost, immigration status, self-employed, students), "how we find your coverage", FAQ
    (incl. an immigration-status question and a "how is this different from ACA/Short-Term
    Medical" question), CTA banner, JSON-LD. CTA button opens a lead-capture modal
    (`HealthAlternativeButton` → `form-modal-health-alternative.tsx` →
    `health-alternative-lead-form.tsx` → `app/actions/health-alternative.ts`) whose success screen
    includes the Pivot self-enroll CTA (`health-alternative-self-enroll-cta.tsx`, mirrors
    `life-insurance-self-enroll-cta.tsx`'s self-contained-bilingual pattern) alongside "Book a
    consultation" — self-enroll was extended to every surface (main page, CTA modal, ads page) per
    explicit user decision, beyond what was literally requested (ads-page success screen only).
  - **Booking page** `/health-alternative/calendar` mirrors `life-insurance/calendar` exactly.
  - **Meta-ads landing page** `/health-alternative/get-covered` (es:
    `/alternativa-de-salud/obtener-cobertura`): bare chrome, 4-field form
    (`health-alternative-get-covered-funnel.tsx`, mirrors `life-insurance-get-covered-funnel.tsx`),
    admin-overridable hero/OG image via `/admin/hero` (added `"health-alternative"` to
    `lib/ads-images/{shared,settings}.ts`'s `ADS_LOBS`). "Done" screen's self-enroll button links
    to `PIVOT_DIRECT_QUOTE_URL`. Skipped a bespoke GA4 analytics module for v1, same as Life
    Insurance.
  - **Header/footer nav**: new `healthAlternative` entry (icon `LifeBuoy`) in both
    `components/header.tsx`'s `serviceLinks` and `components/footer.tsx`'s `footerLinks.services`.
  - **CRM integration**: new `healthAlternativeData` payload key added throughout
    `app/api/create-contact/route.ts` (16 edit points, mirroring the Life Insurance integration
    exactly — Meta CAPI source/contentName branches, duplicate-merge allowlist, lead-details text,
    CRM tags incl. `Health Coverage Alternative Lead` + `health_alternative_get_covered_funnel`,
    the `contactPayload.source` field, the generic-Notification-workflow exclusion guard, and an
    optional dedicated `AGENT_CRM_WORKFLOW_HEALTH_ALTERNATIVE` workflow step).
  - **Routing/sitemap/JSON-LD**: full dual-locale entries in `i18n/routing.ts` +
    `i18n/navigation.ts`; bare-chrome pathnames added to both `lib/ads-landing.ts` arrays AND
    `middleware.ts`'s independent hardcoded lists; `getHealthAlternativePageLd`/`BreadcrumbLd`
    (locale-aware slug helper, ES slug differs from EN) and
    `getHealthAlternativeGetCoveredAdsPageLd`/`BreadcrumbLd` in `lib/seo/jsonld.ts`; 3 new sitemap
    entries.
  - **Content note**: initially picked hero/section photos from
    `lib/dental-enrollment-carriers.ts`'s stock pool without previewing them — one turned out to
    be an actual dental-checkup scene, thematically wrong for a general health-coverage page.
    Caught via screenshot review and swapped for neutral/family photos already used on ACA's page
    (`tmpfs1tzoqj_1_qqzvsx`, `pexels-emma-bauso-1183828-2253879_1_zd87oq`, `tmp8ukl9fl1_m7udej`)
    plus IUL/Life Insurance's eligibility photo (`pexels-jibarofoto-2014773_wxjikn`). Lesson: don't
    reuse a themed stock-photo pool (e.g. "dental enrollment") for unrelated content without
    checking what's actually in the photos.
  - **Verified**: `pnpm build` + `tsc --noEmit` clean. Dev-server + headless-Chrome screenshots
    confirmed both locales render correctly (hero, self-enroll section, FAQ content all present
    with no `MISSING_MESSAGE` errors) for the main page and both locales of the ads-landing page
    (bare chrome + form + correct Pivot Health hero photo). Calendar iframe URLs resolve correctly
    per locale. Sitemap includes all 6 new URLs. Not verified live: a real `/api/create-contact`
    submission end-to-end against production Agent CRM (GHL) — deliberately skipped, same
    reasoning as Life Insurance (creates a real contact, could fire real automations).
  - Known open items: `/health-alternative/calendar` reuses the generic `/contact/calendar` GHL
    booking-widget IDs as a placeholder (Isaac should create a dedicated calendar and hand over
    EN/ES widget URLs); ads-page hero/OG image is a placeholder stock photo
    (`pexels-august-de-richelieu-4260639_qgzqnk`) — swap anytime via `/admin/hero`;
    `AGENT_CRM_WORKFLOW_HEALTH_ALTERNATIVE` is optional/no-op until set.
  - Not yet merged — awaiting explicit go-ahead to commit (branch `feature/health-alternative-lob`).

- 2026-08-04: **Life Insurance line of business** completed. 7th line of business, distinct from
  IUL/Final Expense, positioned as plain term life insurance for consumers.
  - **Main page** `/life-insurance` (es: `/seguro-de-vida`): hero, about, a self-enroll section
    (reuses the existing `PlanEnrollCard`/`components/SelfEnrollSection.tsx`, already used on
    ACA/Dental-Vision/Hospital-Indemnity, linking to Isaac's Ethos instant-issue term life invite —
    `https://agents.ethoslife.com/invite/d723a`), eligibility, "how we find your rate", FAQ, CTA
    banner, JSON-LD. CTA button opens a lead-capture modal (`LifeInsuranceButton` →
    `form-modal-life-insurance.tsx` → `life-insurance-lead-form.tsx` →
    `app/actions/life-insurance.ts`) whose success screen includes the Ethos self-enroll CTA
    (`life-insurance-self-enroll-cta.tsx`, mirrors `iul-apply-success-cta.tsx`'s
    self-contained-bilingual pattern) alongside "Book a consultation".
  - **Booking page** `/life-insurance/calendar` mirrors `iul/calendar` exactly.
  - **Meta-ads landing page** `/life-insurance/get-covered` (es:
    `/seguro-de-vida/obtener-cobertura`): bare chrome (logo+phone header, minimal footer —
    verified via `x-ads-landing-variant: iul-bare` response header), 4-field form
    (`life-insurance-get-covered-funnel.tsx`, mirrors `aca-get-covered-funnel.tsx`),
    admin-overridable hero/OG image via the existing `/admin/hero` tool (added `"life-insurance"`
    to `lib/ads-images/{shared,settings}.ts`'s `ADS_LOBS`). "Done" screen replaces ACA's "Start
    application" with the Ethos self-enroll button. Deliberately skipped building a bespoke
    funnel-level GA4 analytics module (like `lib/analytics/aca-get-covered-ga.ts`) — relies on
    `ServicePageTracker` + Meta Pixel/CAPI instead; not part of the explicit ask.
  - **Header/footer nav**: new `lifeInsurance` entry (key deliberately distinct from IUL's existing
    `"life"` key/translations) in both `components/header.tsx`'s `serviceLinks` and
    `components/footer.tsx`'s `footerLinks.services`.
  - **CRM integration**: new `lifeInsuranceData` payload key added throughout
    `app/api/create-contact/route.ts` (17 edit points — Meta CAPI source/contentName branches,
    duplicate-merge allowlist, lead-details text, CRM tags incl. `Life Insurance Lead` +
    `life_insurance_get_covered_funnel`, the `contactPayload.source` field, the
    generic-Notification-workflow exclusion guard, and an optional dedicated
    `AGENT_CRM_WORKFLOW_LIFE_INSURANCE` workflow step) — mirrors `finalExpenseData`'s simple shape
    (not IUL's, which carries IUL-only fields).
  - **Routing/sitemap/JSON-LD**: full dual-locale entries in `i18n/routing.ts` +
    `i18n/navigation.ts`; bare-chrome pathnames added to both `lib/ads-landing.ts` arrays AND
    `middleware.ts`'s independent hardcoded lists; `getLifeInsurancePageLd`/`BreadcrumbLd`
    (Final-Expense-style locale-aware slug helper, since ES slug differs from EN) and
    `getLifeInsuranceGetCoveredAdsPageLd`/`BreadcrumbLd` in `lib/seo/jsonld.ts`; 3 new sitemap
    entries.
  - **Verified**: `pnpm build` + `tsc --noEmit` clean. Dev-server + headless-Chrome screenshots
    confirmed both locales render correctly (hero, self-enroll section, FAQ content all present
    with no `MISSING_MESSAGE` errors) for the main page and both locales of the ads-landing page
    (bare chrome + form). Calendar iframe URLs resolve correctly per locale. Sitemap includes all 6
    new URLs. Admin `/admin/hero` registration verified via code review (Clerk-gated, same as every
    other admin route — not logged in live, matching how the ACA feature verified this exact tool).
    Not verified live: a real `/api/create-contact` submission end-to-end against production Agent
    CRM (GHL) — deliberately skipped since it creates a real contact and could fire real
    automations; recommend Isaac do this once ready (submit a real test lead through
    `/life-insurance/get-covered`, confirm tags/source and `capiDispatched: true`).
  - Known open items still outstanding: `/life-insurance/calendar` reuses the generic
    `/contact/calendar` GHL booking-widget IDs as a placeholder (Isaac should create a dedicated
    calendar and hand over EN/ES widget URLs); ads-page hero/OG image is a placeholder stock photo
    (`v1785777580/pexels-freestockpro-12969212_1_xck4cm`, borrowed from `/aca/apply`'s hero) —
    swap anytime via `/admin/hero`; `AGENT_CRM_WORKFLOW_LIFE_INSURANCE` is optional/no-op until set.
  - Merged to main on branch `feature/life-insurance-lob`.

- 2026-08-03: **Ads-image upload + sign-up-first Clerk default** completed. Follow-up to the
  ACA Get Covered work below, same day. Two independent pieces:
  1. **Upload instead of paste-a-URL** for the `/admin/hero` image overrides: replaced the
     Cloudinary-URL text field with a drag-and-drop/click-to-upload tile
     (`components/admin/ads-images-client.tsx`) backed by a new admin-gated
     `app/api/admin/ads-images/upload/route.ts` — uploads straight to Cloudinary
     (`ads-images/{lob}/{kind}/{locale}` folder, `unique_filename: true` so a swap never serves
     stale CDN bytes under a reused public_id), builds an optimized delivery URL (`f_auto,q_auto`,
     width-capped for hero / smart-cropped 1200×630 for OG), and persists it as the override in
     one round trip via the existing `setAdsImageOverride`. Client-side, large photos are
     compressed with the existing `lib/image-compress.ts` (built for the ACA intake's green-card
     photos) before upload — Vercel's serverless request body cap is 4.5 MB, so this isn't
     optional. Also set the `/aca/apply` page's placeholder hero to a real photo
     (`ACA_APPLY_HERO_IMAGE` in `lib/get-covered-fast/constants.ts`).
  2. **Every Clerk entry point sitewide now defaults to the sign-up screen, not sign-in**
     (`SignInButton` → `SignUpButton`, `signUpForceRedirectUrl`/`signUpFallbackRedirectUrl` →
     `signInForceRedirectUrl`/`signInFallbackRedirectUrl` — the symmetric prop for the "already
     have an account" path within the sign-up modal, confirmed against Clerk's actual
     `SignUpButtonProps` type). Rationale: most clicks on an ad-driven "Apply now" CTA are
     brand-new visitors, so defaulting to "Sign In" cost them an extra tap to find "Sign up."
     Applied uniformly per explicit request rather than only on the apply pages: `aca-apply-cta.tsx`,
     `iul-apply-cta.tsx`, `blog-user-auth.tsx` (header button, label updated "Sign In" → "Sign Up"),
     `blog-comments.tsx` (label "Sign in to comment" → "Sign up to comment"),
     `blog-social-actions.tsx` (icon-only, no label to update), `final-expense-leave-behind-landing.tsx`
     and `sale-sticker/sale-sticker-landing.tsx` (internal `LandingSignInButton` helper renamed to
     `LandingSignUpButton` to match what it now renders). `pnpm build` + `tsc --noEmit` clean.
     Not independently verified live (Clerk modal rendering isn't something to screenshot-test
     meaningfully) — verified via Clerk's type definitions and a clean build instead.
  Merged to main on branch `feature/ads-image-upload-and-signup-default`.

- 2026-08-03: **ACA Get Covered ads landing page + self-serve application + unified ads-image
  admin** completed. `/aca/get-covered` (+ `/aca/obtener-cobertura`) mirrors
  `/final-expense/get-covered`/`/iul/get-covered` but single-step only (first/last name, email,
  phone — no second step, per explicit request): `components/aca/aca-get-covered-funnel.tsx` is a
  trimmed clone of the IUL funnel (`Phase = "contact" | "done"` only, no quiz), validated by the
  existing shared `shortTermMedicalFormSchema`, submitting to `/api/create-contact` with the
  existing `acaData` shape (`source: "aca_get_covered_ads"`) rather than inventing a fourth
  per-LOB payload like FE/IUL did — keeps ACA a single unified CRM lead type, distinguished by a
  new `aca_get_covered_funnel` tag and a Meta CAPI duplicate-merge carve-out
  (`trySendMetaLeadCapiLead` in `app/api/create-contact/route.ts`) mirroring the existing FE/IUL
  special-casing. Done screen adds a "Start your ACA application" CTA alongside
  book-appointment/call/WhatsApp, the ACA analogue of IUL's "Ready to apply now?".
  Since ACA intake was previously 100% agent-initiated (no public entry point, unlike IUL's
  `/iul/apply`), built the missing self-serve pair: `/aca/apply` (public marketing page,
  `components/aca-apply-cta.tsx` — Clerk `SignInButton` modal, noindex until launched) →
  `/aca/apply/start` (server page, pulls the Clerk profile, calls new
  `selfStartAcaIntakeForClient()` in `lib/aca-intake/server.ts` — resume/claim/create, reusing the
  already-existing `findUnclaimedAcaSessionByEmail()`/`createAcaIntakeSession()` primitives) →
  redirects into the existing `/aca/intake/[token]` form. New `ACA_SELF_APPLY_TAG` +
  `ACA_DEFAULT_OWNER_USER_ID` env var (mirrors `IUL_DEFAULT_OWNER_USER_ID`) — the fixed agent
  owner self-started sessions land under. The same "Start your ACA application" CTA was also added
  to the shared `components/aca-lead-form.tsx` success screen, cascading to every other ACA
  lead-capture surface site-wide (`ACAButton`/`AcaQuoteModal` on `/aca` + `/aca/[state]`, the
  header quote CTA, blog CTAs, Get Covered Fast funnel's ACA result step) with a single edit.
  Scope decision: the ACA consumer-guide PDF download flow (`guide-unlock-modal.tsx`) does NOT get
  this CTA — different success moment (unlocking a document, not a lead thank-you).
  New i18n: `messages/{en,es}/aca/{get-covered,apply}.json` (split-file convention, registered in
  `i18n/request.ts`), `i18n/routing.ts` pathnames for `/aca/get-covered`, `/aca/apply`,
  `/aca/apply/start`; `lib/ads-landing.ts` + `middleware.ts` bare-chrome pathname lists (the
  latter has its own independent hardcoded list, easy to miss — both needed updating).
  **Second pass**: set the ACA hero/OG default to a real Cloudinary family photo (was a
  placeholder), then generalized the FE-only, hero-only admin override tool into
  `lib/ads-images/` (`settings.ts` server logic + `shared.ts` types/constants split out
  specifically so the "use client" admin component doesn't pull `"server-only"`/`db` into the
  browser bundle — first attempt broke the build this way) covering hero **and** OG images across
  Final Expense, IUL, and ACA. Storage keeps the exact original `fe_get_covered_hero_url_en/_es`
  `app_settings` keys so Isaac's existing FE override keeps working with no migration; IUL and ACA
  hero images, and all three lines' OG images, are newly admin-overridable for the first time.
  Old single-purpose `/admin/get-covered-hero` (page, client component, action, hero-setting.ts)
  deleted and replaced by a tabbed `/admin/hero` (`components/admin/ads-images-client.tsx`) with
  live thumbnail previews per line of business × image kind × locale; `/admin` dashboard card
  updated to match. Verified: `pnpm build` + `tsc --noEmit` clean, live curl round-trip against
  Agent CRM confirmed the new tag/CAPI branch (real "Test User" contact created, `capiDispatched:
  true`, Isaac confirmed leaving the test lead in place), screenshots confirmed bare chrome, the
  single-step form, and the new hero photo rendering correctly. Not verified live (no browser
  automation tooling available): the Clerk sign-up modal on `/aca/apply` and the `/admin/hero`
  page itself (Clerk-protected, same as every other admin route — code-reviewed instead, mirrors
  the already-proven `get-covered-hero` pattern). **Needs `ACA_DEFAULT_OWNER_USER_ID` set in
  Vercel** (already added to local `.env` by Isaac, same value as `IUL_DEFAULT_OWNER_USER_ID`).
  Merged to main on branch `feature/aca-get-covered`.

---

## Prior feature: ACA Client Intake

Mirrored the IUL secure-link intake for ACA ahead of open enrollment: agent creates a session from
`/aca/intake`, a token link syncs to the contact's `aca_intake_link` field, a GHL workflow sends it,
and the client fills an 8-step autosaving form on their phone. Iterated post-merge via
`feature/aca-add-member-button`, `feature/aca-intake-bare-chrome`, and `feature/aca-file-previews`
(see git history) — effectively complete; not re-summarized in `History` below since it predates
this file's per-feature entries.

Field spec (approved, rev 2): [context/features/aca-intake/fields-spec.md](features/aca-intake/fields-spec.md)

## History

- 2026-07-21: **Call-Center Ops: Callback Dashboard + Conversion View + Missed-Call Drafts** completed. Structured call-summary data (disposition, lineOfBusiness, followUpDateIso, full StructuredCallSummary JSON) now persists to `call_summary_processed` (new columns, migration `0014_perpetual_squadron_sinister.sql`) instead of being discarded after the GHL note is written — `lib/openai-call-summary.ts` prompt gained a `followUpDateIso` schema field (model resolves "Tuesday 2pm" using a new weekday+timezone reference-date line from `lib/timezone.ts`, validated by `asIsoDateTime()`'s 2-year hallucination guard in `lib/call-summary-structured.ts`); both `markCallProcessed()` call sites in `lib/agent-crm-call-summary.ts` now pass the structured fields through.
  - **Callback Priority dashboard** (`/admin/call-dashboard`): `lib/call-dashboard.ts::getOpenLoopCalls()` uses `db.selectDistinctOn([contactId])` for true one-row-per-contact "most recent completed call," filtered to open-loop dispositions (follow_up/appointment_set/needs_info/no_decision), sorted by `followUpDateIso` ascending (nulls last). `components/call-dashboard/open-loop-dashboard.tsx` flags overdue follow-ups in red; links out via new `agentCrmContactUrl()` helper (`lib/agent-crm-contacts.ts`, env `AGENT_CRM_APP_URL` override).
  - **Call Metrics view** (`/admin/call-metrics`): first `.groupBy()` query in the codebase (`app/api/admin/call-metrics/route.ts`) — disposition mix, LOB mix, and a contact-rate stat computed from `completed` vs `skipped` rows where `errorMessage LIKE 'call_status_%'` (excludes non-call skips like voicemail/not-a-call from the denominator).
  - **Missed-call SMS/WhatsApp drafts** (`lib/missed-call-drafts/`): triggers when a GHL or Kixie call is gated as a genuine no-answer/busy/failed dial (not voicemail or non-call events) — hooked into `processCallSummary`'s skip branch (GHL, already inside the webhook's `after()`) and a new `after()` block in `app/api/webhooks/kixie/calls/route.ts` (Kixie never resolved contact identity for missed calls before; required extracting `resolveKixieContactContext()` out of `kixieToCallSummaryPayload()` in `lib/kixie-call-webhook.ts` — behavior-preserving refactor, verified against the existing answered-call path). New `missed_call_drafts` table dedupes to one draft per contact per local calendar day (`AGENT_LOCAL_TIMEZONE`, default `America/New_York`) so triple-dialing collapses into a single note — repeat triggers same day just bump `attemptCount`. Drafts personalize from the most recent prior call when one exists (carrier/face/premium + language), else infer language from GHL contact tags (spanish/english) falling back to Spanish, defaulting to `final_expense`. Prompt reuses the exact "never say insurance/policy/premium/underwriting, avoid seguro" compliance rules from `lib/social-media-studio/prompts.ts`; SMS is short/plain/no-emoji, WhatsApp allows 1-2 emoji. Notes post via the existing generic `createContactNote()` (dynamic `import()` from `lib/agent-crm-call-summary.ts` to avoid a circular dependency, matching the existing dynamic-import precedent in `lib/openai-call-summary.ts`). A 48-hour freshness guard prevents the daily backfill/reconcile crons from spamming drafts for stale historical no-answer calls. Feature flag `MISSED_CALL_DRAFTS_ENABLED` (default false, matches every other pipeline flag's env-var-only convention — no admin UI toggle).
  - Both dashboards linked from `/admin` via new "Call Center" section.
  - Test scripts: `pnpm test:missed-call-drafts --formatter-only|--dedup-live|en|es` (mirrors `pnpm test:call-summary`'s two-mode design) and `pnpm seed:call-dashboard` (fabricates `call_summary_processed` rows, contacts prefixed `seed-fixture-`, for local dashboard verification without a real call). Verified live: `followUpDateIso` correctly resolved "Thursday at 3 PM" to an absolute UTC instant against a real transcript; missed-call drafts in both languages passed compliance regex assertions (no insurance/policy/premium/seguro) with real GPT-4o output.
  - Out of scope by explicit user decision: a "never-called fresh leads" queue on the callback dashboard (would need a new GHL contact-list-by-tag integration — good phase 2 candidate).
  - **New env vars to set in Vercel**: `MISSED_CALL_DRAFTS_ENABLED=true` to turn the feature on (starts disabled); optionally `AGENT_LOCAL_TIMEZONE` (default `America/New_York` is already correct for Isaac) and `MISSED_CALL_DRAFTS_NOTE_PREFIX`/`AGENT_CRM_APP_URL` overrides if needed.
  - Merged to main on branch `feature/call-center-ops`.

- 2026-07-18: **Call notes — bold labels + ⭐ key-fact line** completed. `lib/call-summary-note-format.ts`: `toBoldSans()` maps A–Z/a–z/0–9 to Unicode bold sans-serif (𝗔…𝟵; accented chars pass through unchanged) — applied to section headers, row labels, `Quotes given:` label, and status-line chips only; client data values stay ASCII so CRM text search keeps matching. New `buildKeyFactLine()` renders `⭐ carrier — face — premium` under the status line (main policy quote, else first alternative quote with a premium). Ops notes from this session: the Jul 17 push (`ebac159`) silently never deployed on Vercel — production kept writing old-format notes for hours; re-triggered with empty commit `6df832d` on Jul 18 and verified live via a production probe (throwaway contact + fake transcript through the real webhook, note/contact/DB row cleaned up after). Historical notes never restyle themselves; one was regenerated additively for a real lead by locating the true call message via `exportCallMessages` (works even for `wh_` workflow-webhook rows). Merged to main on branch `feature/call-notes-bold-labels`.
- 2026-07-17: **Structured AI call notes** completed. Call-summary notes rewritten from model-generated Markdown (GHL renders notes as plain text, so `##`/`**` showed literally) to structured JSON extraction + deterministic plain-text formatter. `lib/call-summary-structured.ts` — `StructuredCallSummary` contract (language/lineOfBusiness/disposition enums + clientProfile, health, financial, policy, quotes, objections, nextSteps, followUpDate, coaching, otherNotes; all values free-form strings); `normalizeStructuredSummary()` never throws (enum alias maps, Spanish-stopword language fallback, placeholder scrubbing, string→array coercion; worst case degrades to summary-only note); `maskSensitiveNumbers()` compliance backstop (spaced/dashed SSNs → `•••-••-1234`, 13–19-digit cards → `•••• 1234`, 8–12-digit runs within 40 chars of ssn/routing/account/cuenta/tarjeta triggers → last-4; phone numbers untouched). `lib/call-summary-note-format.ts` — `formatStructuredNote()`: at-a-glance status line (LOB emoji + disposition + `📅 Follow-up:` chip, deduped when disposition is follow_up), then emoji sections 📝 SUMMARY / 👤 CLIENT INFO / 🏥 HEALTH / 💰 FINANCIAL / 📋 QUOTE / POLICY (with `Quotes given:` bullets) / ⚠️ OBJECTIONS / ✅ NEXT STEPS (`• [date] action — owner`) / 📌 OTHER NOTES / 💡 COACHING; empty sections omitted; full EN/ES label dictionaries; `formatLocalizedDate()`; `NOTE_SEPARATOR` (`━━━`). `lib/openai-call-summary.ts` — SYSTEM_PROMPT rewritten: embedded JSON schema, per-LOB extraction priorities for all 6 lines (FE underwriting/beneficiary/payment, ACA household/income/APTC/SEP, STM gap/preexisting, D/V needs/waiting periods, HI supplemented plan/daily benefit, IUL goals/contribution), disposition definitions, last-4 sensitive-data rule, coaching retained; `max_tokens` sent + warn on `finish_reason: "length"`; parse → normalize → format; `CallSummaryResult` gains optional `structured` (future hook for contact-field sync). Config: `OPENAI_MODEL` default `gpt-4o-mini` → `gpt-4o` (env overrides), new `OPENAI_MAX_OUTPUT_TOKENS` (default 3000). `formatNoteBody` header date localized to the call language (was hardcoded en-US), `---` → `━━━`, redundant `truncateTranscriptForConfig` removed. Test harness: `pnpm test:call-summary --formatter-only` (masking + normalizer assertions, EN/ES/malformed/degenerate renders, zero API calls) and `pnpm test:call-summary {fe-en,fe-es,aca-es,iul-en}` (live OpenAI on fixtures in `scripts/data/call-transcripts/`; never posts CRM notes). Docs: CALL_SUMMARY_SETUP.md (structured note-format section with sample, QStash corrections replacing stale "3-minute cron" refs, env table) + CLAUDE.md call-summary/Kixie lines. **Deploy note: set `OPENAI_MODEL=gpt-4o` in Vercel — the env var currently pins `gpt-4o-mini`, overriding the new default.** Out of scope by user decision: auto-syncing extracted fields (DOB/address) to the GHL contact record. Merged to main on branch `feature/call-notes-structured`.

- 2026-07-16: **IUL Presentation → Sanity CMS + Clerk-secured license reveal** completed. All 26 slides of `/iul/presentation` now come from the Sanity singleton `iulPresentation` (_id: `iulPresentation`) — 18 slide object types (`sanity/schemaTypes/iulPresentation/`) with EN+ES field pairs per slide (presentationScript convention, decks can't drift); shared `labels`, page `ui` (header/stepper/fullscreen/intake CTA), and `meta` (SEO) objects also localized pairs. New `agentLicense` doc type holds license metadata only (state reference, `cloudinaryPublicId`, active, order) — license images stay in Cloudinary authenticated delivery, never on Sanity's public CDN. Read path: `lib/iul-presentation.ts` (`getIulPresentation` via `sanityFetch` + tag `iul-presentation`, `mapIulPresentation` collapses `xEn/xEs` → `x` per locale and resolves image refs to `{url, alt}`), `lib/slide-accessor.ts` (`createAccessor` mimics next-intl `t()`/`t.raw()` so slide component bodies stayed unchanged), `lib/agent-licenses.ts` (`getAgentLicenseStates` — page-safe query selecting only `{code,name}` so Cloudinary IDs never enter the RSC payload; `getLicensePublicId` — Sanity IS the proxy whitelist). License reveal: password flow deleted (`/api/unlock-licenses`, forgeable `licenses_unlocked` cookie, `PRESENTATION_PASSWORD` fallback); reveal is now Clerk-admin-only — page passes `isAdmin` (`currentUser().publicMetadata.role === "admin"`), image proxy moved to `/api/admin/license-image?key={stateCode|drivers}` (middleware-enforced 401/403 + signed 1h Cloudinary URLs). Locale-coupled logic replaced by explicit data: `scenarioKind` enum drives scenario icons, `investments[].isIul` + `labelPlacement` drive the risk/reward chart, `keyNumbers[].numberType`, `statistics.*Value/*Label` on the company slide. Hardcoded TSX leaks (product/scenario/discovery/hero images, headshot, NLG logo, $57.4B/175+/A+ stats, English fallbacks) absorbed into the Sanity doc; slide images uploaded as Sanity assets. Seeds: `pnpm add:iul-presentation` (`--force` to replace; clobbers Studio edits) + `pnpm add:agent-licenses` from snapshots at `scripts/data/iul-presentation-{en,es}.json` (moved out of `messages/`; `i18n/request.ts` merge block removed). Deleted 14 dead slide components (~1,100 lines) + module-level iconMap/colorMap. `/api/revalidate/iul` (Bearer `REVALIDATION_SECRET`) revalidates tags `iul-presentation` + `agent-licenses` — Sanity webhook filtered to `_type in ["iulPresentation","agentLicense"]` must be added in the Sanity dashboard. `PRESENTATION_PASSWORD` env var can be removed from Vercel. Merged to main on branch `feature/iul-presentation-sanity`.

- 2026-06-11: **Social Media Content Studio — Phase 7** completed. `lib/social-media-studio/sanity-publisher.ts` — `getWriteClient()` (next-sanity `createClient`, `SANITY_API_WRITE_TOKEN`, throws if missing); `generateUniqueSlug(client, title)` (lowercases + slugifies title, fetches all existing `socialPost` slug.current values, increments `-2`/`-3`/... until unique); `publishSocialPost(req)` (maps `SocialPostPublishRequest` → Sanity document: `generatedCopies` array items with `_type: "object"` + `_key: "${platform}_${locale}"`; `videoScript` sub-object maps `onScreenTextSuggestions → onScreenText`; spreads `videoScript` only when provided; `client.create()` with `Record<string, unknown> & { _type: string }` typing; returns `{ sanityDocumentId, slug }`). `app/api/admin/social-media-studio/publish/route.ts` — Clerk-auth POST; `maxDuration = 30`; 401 if unauthenticated; 400 if `source.title` missing, `copies` empty, or `SANITY_API_WRITE_TOKEN` not set; 500 on create error. `app/[locale]/admin/social-media-studio/history/page.tsx` — Server Component (no `"use client"`); `auth()` redirects to `/sign-in` if unauthenticated; GROQ `*[_type == "socialPost"] | order(createdAt desc) [0...50]` fetching `_id`, `sourceType`, `sourceTitle`, `sourceCategory`, `status`, `tags`, `createdAt`, `"platforms": generatedCopies[].platform`, `"locales": generatedCopies[].locale`, `squareImageUrl`; card list with 64×64 thumbnail, title, type badge, category chip, status chip (green if published, gray otherwise), formatted date, unique platform chips, "View in Studio →" deep link to `sanity.io/manage/project/{id}/...`; "No posts yet" empty state; "+ Generate New Post" button links to `/en/admin/social-media-studio`. `app/[locale]/admin/social-media-studio/page.tsx` — header refactored to `flex items-center justify-between` with "View History →" link. No new env vars. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-7`.
- 2026-06-11: **Social Media Content Studio — Phase 6** completed. `app/[locale]/admin/social-media-studio/page.tsx` — single-file Client Component (`"use client"`), 1,416 lines. `StudioState` interface with `step`, `source`, `copies`, `images`, `videoScript`, `scriptDuration`, plus `isGenerating*`/`*Error` flags per step; `useState<StudioState>` updated immutably throughout. `StepIndicator`: 5-step indicator (Source → Copy → Images → Script → Export) with green ✓ for completed, blue for current, gray for future. **Step 1 `SourcePickerStep`**: tab switcher (Blog Post / Lead Magnet / Direct Topic); search debounced 400ms → `GET /sources?q=`; skeleton loading; result cards with thumbnail + `Select →` button; on select: fetches `/sources/{type}/{id}` then fires `POST /generate-copy` and advances immediately; Direct Topic form builds `SocialPostSource` client-side. **Step 2 `CopyReviewStep`**: loading spinner while generating; error/retry state; platform tabs (5) + EN/ES toggle; editable hook/body/cta textareas with `updateCopy()` rebuilding `fullPost` + `characterCount` live; character counter turns red over platform limit; hashtag pills with × remove + inline `+ Add` input; `CopyBtn` shows 2s "Copied!" feedback; "Regenerate All ↺" with `confirm()` dialog. **Step 3 `ImageStudioStep`**: `useEffect` auto-starts on `state.step === "images"` if `!state.images && !state.isGeneratingImages`; editable headline input; "Shorten ✎" button generates 5/6/7-word client-side chip options; source/AI background radio; 1:1 + 9:16 image previews with download links; "Regenerate Images ↺". **Step 4 `VideoScriptStep`**: `useEffect` auto-starts 30s script on step entry; duration toggle (no auto-regen — explicit "Regenerate for selected duration" button); collapsible full script; on-screen text / b-roll / delivery tips / caption sections each with copy buttons; "Skip to Export" available. **Step 5 `ExportStep`**: read-only platform copy (EN/ES × 5 platforms) with "Copy for Metricool"; image previews + download links; expandable video script preview; Sanity save form (draft/published toggle + tag pills); calls Phase 7 `/publish` route; success banner with Studio link; "Generate Another Post" resets to `{ step: "source" }`. Middleware already protects `/en/admin(.*)` — no changes needed. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-6`.
- 2026-06-11: **Social Media Content Studio — Phase 5** completed. `lib/social-media-studio/prompts.ts` — `VIDEO_SCRIPT_SYSTEM_PROMPT` (Isaac's talking-head video style, English-only script rules, JSON response shape with "script" key); `buildVideoScriptPrompt(source, duration)` (assembles user prompt with source title/subtitle/category/bodyText/publicUrl, duration-specific word targets — 65–75 words for 30s, 130–150 words for 60s — and scene structure block: 30s: `[0:00–0:03]` HOOK / `[0:03–0:15]` PROBLEM / `[0:15–0:25]` SOLUTION / `[0:25–0:30]` CTA; 60s: adds `[0:40–0:50]` PROOF and `[0:50–0:60]` CTA). `lib/social-media-studio/script-generator.ts` — `generateVideoScript(req)` (GPT-4o JSON mode, `max_tokens: 2000`, `temperature: 0.8`, unwraps `raw.script ?? raw`); `validateVideoScript(raw, duration)` (throws on missing `fullScript`/`hookScript`; normalizes `onScreenTextSuggestions` and `brollSuggestions` arrays with `String()` map; falls back `voiceoverTips`/`suggestedCaption` to `""`). `app/api/admin/social-media-studio/generate-video-script/route.ts` — Clerk-auth POST; `maxDuration = 30`; 401 if unauthenticated; 400 if `source.title` missing or `duration` not 30/60; 500 on generation error; returns `{ success: true, data: { script } }`. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-5`.
- 2026-06-11: **Social Media Content Studio — Phase 4** completed. `lib/social-media-studio/image-generator.ts` — `CATEGORY_SCENES` (11-entry map keyed by insurance category slug); `buildDallePrompt(sourceTitle, category?)` (constructs DALL-E prompt with category-specific scene, brand color palette, no-text instruction); `encodeCloudinaryText(text)` (spaces→`_`, commas→`%2C`, slashes→`%2F`); `buildTransformUrl(publicId, ratio, encodedHeadline, brandName)` (builds `https://res.cloudinary.com/{cloud}/image/upload/` URL with transformation chain: `c_fill,w_N,h_N,g_auto` → `e_gradient_fade,y_-0.5,b_rgb:000000` → headline text layer `g_south` → Isaac Plans watermark `g_north_east,o_80`; 1:1: 1080×1080, font 52px, textY 120; 9:16: 1080×1920, font 56px, textY 200); `generateSocialImages(req)` returns `{ images: SocialCreativeImages, warnings: string[] }` — if `!req.generateNew && req.sourceImageUrl`: uploads to `social-media/{category}/sources/` via `cloudinary.uploader.upload()`; on failure pushes warning and falls through to DALL-E; DALL-E call: `model: "dall-e-3"`, `size: "1024x1024"`, `quality: "standard"`, uploads to `social-media/{category}/backgrounds/`; if DALL-E also fails returns empty `{ square: "", vertical: "", ... }` with warnings; uses `import cloudinary from "@/config/cloudinary"` (centralized config). Fix applied: `response.data?.[0]?.url` (optional chain for possibly-undefined `data`). `app/api/admin/social-media-studio/generate-images/route.ts` — Clerk-auth POST; `maxDuration = 120`; 401 if unauthenticated; 400 if `headline` missing; always returns `success: true`; warnings surfaced at top level of `SocialStudioSuccess<T>`. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-4`.
- 2026-06-11: **Social Media Content Studio — Phase 3** completed. `lib/social-media-studio/prompts.ts` — `COPY_GENERATION_SYSTEM_PROMPT` (brand voice, insurance compliance rules, CRITICAL Latin American Spanish section with specific term preferences and tone guidance); `PLATFORM_SPECS` record (per-platform character targets, hashtag rules, tone styles, and hook examples for all 5 platforms); `buildCopyPrompt(source, platforms, locales)` (assembles user prompt with source content, platform spec strings joined by `---`, and explicit JSON shape instructions including `fullPost` assembly rules). `lib/social-media-studio/copy-generator.ts` — `generateSocialCopy(source, platforms?, locales?)` (single GPT-4o call, `response_format: { type: "json_object" }`, `max_tokens: 6000`, `temperature: 0.75`, model from `OPENAI_MODEL ?? "gpt-4o"`; parses `raw.copies` array; throws if empty); `validateAndNormalizeCopy(raw, index)` (throws on missing `platform`, `locale`, `hook`, `fullPost`; strips `#` prefix from hashtags; falls back `characterCount` to `fullPost.length`). `app/api/admin/social-media-studio/generate-copy/route.ts` — Clerk-auth POST; `maxDuration = 60`; 401 if unauthenticated; 400 if `source.title` missing or `OPENAI_API_KEY` not set; 500 on generation error; returns `{ success: true, data: { copies } }`. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-3`.
- 2026-06-11: **Social Media Content Studio — Phase 2** completed. `lib/social-media-studio/source-fetcher.ts` — `portableTextToPlainText()` (walks Portable Text blocks, extracts plain text via `.children[].text` join); `fetchSourceList(options)` (runs blog-posts + lead-magnets GROQ in parallel via `Promise.all`; blog GROQ: `locale`, `title match $q + "*"`, `category`, ordered by `publishedAt desc`, returns `{ _id, title, slug, excerpt, category, featuredImageUrl: image.asset->url, publishedAt }`; lead magnet GROQ: `status == "published"`, same filters, returns `{ _id, title, subtitle, slug, category, coverImageUrl: coverImage.asset->url, publishedAt }`); `fetchBlogPostContent(id)` (fetches full post, calls `portableTextToPlainText(body).slice(0, 3000)`, builds `SocialPostSource` with `publicUrl: https://isaacplans.com/{locale}/blog/{slug}`; throws `"Blog post not found: {id}"` on null); `fetchLeadMagnetContent(id)` (fetches full lead magnet, builds `bodyText` from targetAudience + keyBenefits bullets + `description` plain text (1,500 char limit), builds `SocialPostSource` with `publicUrl: https://isaacplans.com/en/lead-magnets/{slug}`; throws `"Lead magnet not found: {id}"` on null). Field name fix: blog post uses `image.asset->url` (not `mainImage`). `app/api/admin/social-media-studio/sources/route.ts` — Clerk-auth `GET`; accepts `q`, `category`, `locale` (default "en"), `limit` (default 30) query params; returns `{ success: true, data: { blogPosts, leadMagnets } }`. `app/api/admin/social-media-studio/sources/[type]/[id]/route.ts` — Clerk-auth `GET`; dispatches to `fetchBlogPostContent` or `fetchLeadMagnetContent` based on `type`; 400 for unknown type; 404 if error message includes "not found"; otherwise 500; `params` awaited as `Promise` per Next.js 15 convention. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-2`.
- 2026-06-11: **Social Media Content Studio — Phase 1** completed. `lib/social-media-studio/types.ts` — all TypeScript contracts for all 7 phases: `SocialPlatform` union ("facebook" | "instagram" | "tiktok" | "threads" | "google_business"); `SocialLocale` ("en" | "es"); `SourceType` ("blog_post" | "lead_magnet" | "direct_topic"); `SocialPostStatus` ("draft" | "published" | "archived"); `PLATFORM_COPY_LIMITS` (min/max char counts per platform); `PLATFORM_LABELS`; `ALL_PLATFORMS`; `ALL_LOCALES`; `SocialPostSource` (normalized AI input from blog/lead magnet/topic); `BlogPostSummary` + `LeadMagnetSummary` (Phase 2 list items); `SocialPostCopy` (hook + body + cta + hashtags + fullPost + characterCount per platform/locale); `SocialCreativeImages` (square/vertical Cloudinary URLs + overlay headline); `VideoScript` (30|60s duration, hookScript, fullScript, onScreenTextSuggestions, brollSuggestions, voiceoverTips, suggestedCaption); `GeneratedSocialPackage` (full output: source + 10 copies + images + optional script); request types (`CopyGenerationRequest`, `ImageGenerationRequest`, `VideoScriptRequest`, `SocialPostPublishRequest`); response shapes (`SocialStudioSuccess<T>`, `SocialStudioError`, `SocialStudioResponse<T>`); `PublishedSocialPost`. `sanity/schemaTypes/socialPostType.ts` — `socialPost` Sanity document schema with 5 field groups: **source** (sourceType, sourceId, sourceTitle, sourceSlug, sourceUrl, sourceImageUrl, sourceCategory); **copies** (generatedCopies array — platform × locale objects with hook/body/cta/hashtags/fullPost/characterCount); **images** (squareImageUrl, verticalImageUrl, imageHeadline); **video** (videoScript object — duration/hookScript/fullScript/onScreenText/brollSuggestions/voiceoverTips/suggestedCaption); **meta** (status, tags, createdAt, updatedAt). `ShareIcon` from `@sanity/icons`, ordered by `createdAt` desc. Pattern fix: used plain object literals (not `defineField`) for `array` and `object` type nested fields — same pattern as `leadMagnetType.ts`. `sanity/schemaTypes/index.ts` + `sanity/structure.ts` updated to register and surface "Social Media Posts" in Studio sidebar. `pnpm tsc --noEmit` clean. Merged to main on branch `feature/social-media-studio-phase-1`.
- 2026-06-09: **Lead Magnet Generator — Phase 7** completed. `app/[locale]/admin/lead-magnet-generator/page.tsx` — 1,123-line single-file multi-step wizard (Client Component, `"use client"`). `StepIndicator` breadcrumb (Prompt → Outline → Generate → Images → Publish). Step 1 `PromptStep`: 6 fields (topic, category, targetAudience, keyTopics textarea, tone radio, additionalContext), calls `/generate-outline` on submit. Step 2 `OutlineStep`: editable title/subtitle/keyBenefits/section titles, add (max 8) / remove (min 4) sections, word count + page count badges. Step 3 `GeneratingStep`: `useEffect` on `[state.step, state.currentSectionIndex]` drives sequential `/generate-section` calls, then `/generate-intro-conclusion`; collapsible completed section cards with Regenerate, progress bar, inline error with Retry without clearing progress. Step 4 `ImagesStep`: `useEffect` auto-starts `/generate-images` on enter, cover image + section image grid with section title labels, "Skip Images" link, "Continue to Publish →". Step 5 `PublishStep`: editable title/subtitle/SEO/lead form fields, draft/published toggle, "Generate PDF" → iframe preview (`<iframe src={pdfUrl}>`), "Save to Sanity →" calls `/publish`, shows 500 errors inline. `SuccessView`: Sanity Studio deep link, public landing page link (if published), PDF download link, "Generate Another Guide" reset. Auth: `useAuth()` redirects unauthenticated to `/sign-in`. TypeScript clean. Merged to main on branch `feature/lead-magnet-generator-phase-7`.
- 2026-06-09: **Lead Magnet Generator — Phase 6** completed. `lib/lead-magnet-generator/sanity-publisher.ts` — `getWriteClient()` (replicated from blog publisher, uses `SANITY_API_WRITE_TOKEN`); `uploadImageToSanity()` (fetch URL → arrayBuffer → Buffer → `client.assets.upload("image", ...)`); `generateUniqueSlug()` (fetches all existing `leadMagnet` slugs, increments `-2`/`-3`/... until unique); `buildSections()` (maps `contentBlocks` → Sanity blocks + optional per-section image upload, non-fatal on failure); `publishLeadMagnet()` (main export: uploads cover image, builds sections, constructs full `leadMagnet` document with all 18 fields, `client.create()`, returns `PublishedLeadMagnet`). `app/api/admin/lead-magnet-generator/publish/route.ts` — Clerk auth (401), `maxDuration = 60`, returns `{ sanityDocumentId, slug, pdfUrl, publicUrl }` or 500 on failure. TypeScript fix: typed doc as `Record<string, unknown> & { _type: string }` for `client.create()` compatibility. Merged to main on branch `feature/lead-magnet-generator-phase-6`.
- 2026-06-09: **Lead Magnet Generator — Phase 5** completed. `lib/lead-magnet-generator/pdf-generator.tsx` — `assemblePdf()` builds Document tree (Cover → TOC → Introduction → Sections → Conclusion → Back page) via `renderToBuffer()`; `uploadPdfToCloudinary()` uploads as `resource_type: "raw"` to `lead-magnets/{category}/{slug}-{ts}.pdf`; `generateAndUploadPdf()` orchestrates both. `lib/lead-magnet-generator/pdf/` — 5 components: `pdf-styles.ts` (brand tokens + StyleSheet), `pdf-cover.tsx` (blue bg, cover image with fallback, title/subtitle), `pdf-toc.tsx` (numbered items with dot leaders + estimated page numbers at `3 + i*2`), `pdf-section.tsx` (markdown parser: `##`→h2, `###`→h3, `- `→bullet, `> `→action step callout, else body; inline bold via regex; float-right section image), `pdf-back-page.tsx` (blue CTA page, white headline, benefit bullets, white CTA box, footer). `app/api/admin/lead-magnet-generator/generate-pdf/route.ts` — Clerk auth (401), `maxDuration = 60`, returns `{ pdfUrl, pageCount }` or 500 on failure. Key fix: used `renderToBuffer()` from `@react-pdf/renderer` v4.5.1 (not the deprecated `pdf().toBuffer()` from older versions). Merged to main on branch `feature/lead-magnet-generator-phase-5`.
- 2026-06-09: **Lead Magnet Generator — Phase 4** completed. `lib/lead-magnet-generator/image-generator.ts` — `generateLeadMagnetImages(outline)`: `selectSectionIndices(n)` selects 3–4 section indices at ~20/45/70/90% positions (all if ≤4); cover image generated via GPT-4o prompt → DALL-E 3 (1792×1024, quality: "standard") → Cloudinary upload to `lead-magnets/{category}/cover-{ts}`; section images via same pipeline (1024×1024) to `lead-magnets/{category}/sections/section-{idx}-{ts}`; each step is non-fatal (try/catch, `""` on failure, warnings array). `app/api/admin/lead-magnet-generator/generate-images/route.ts` — Clerk auth (401), `maxDuration = 120`, always returns `success: true` with warnings for image failures (never 500). Merged to main on branch `feature/lead-magnet-generator-phase-4`.
- 2026-06-09: **Lead Magnet Generator — Phase 3** completed. `lib/lead-magnet-generator/prompts.ts` — extended with `SECTION_GENERATION_SYSTEM_PROMPT` + `buildSectionPrompt()` (passes full outline + all prior completed sections as context to prevent repetition) and `INTRO_CONCLUSION_SYSTEM_PROMPT` + `buildIntroConclusionPrompt()`. `lib/lead-magnet-generator/section-generator.ts` — `generateSection()` (plain completion, `max_tokens: 2000`, throws if `wordCount < 500`, markdown → Portable Text via `textToBlocks()`) + `generateIntroConclusion()` (JSON mode, validates both fields, both → Portable Text). `app/api/admin/lead-magnet-generator/generate-section/route.ts` + `generate-intro-conclusion/route.ts` — Clerk-authenticated POSTs, `maxDuration = 60`. Merged to main on branch `feature/lead-magnet-generator-phase-3`.
- 2026-06-09: **Lead Magnet Generator — Phase 2** completed. `lib/lead-magnet-generator/prompts.ts` — `LEAD_MAGNET_SYSTEM_PROMPT` + `buildOutlinePrompt()` user prompt builder. `lib/lead-magnet-generator/outline-generator.ts` — `generateLeadMagnetOutline()` calls OpenAI with `response_format: { type: "json_object" }`, validates and normalizes all fields (title ≤80 chars, subtitle ≤160 chars, category override from input, keyBenefits sliced to 5, sections 6–8 enforced, word/page counts recomputed locally). `app/api/admin/lead-magnet-generator/generate-outline/route.ts` — Clerk-authenticated POST, `maxDuration = 30`, returns 401 for unauthenticated and 400 for missing `OPENAI_API_KEY`. Merged to main on branch `feature/lead-magnet-generator-phase-2`.
- 2026-06-09: **Lead Magnet Generator — Phase 1** completed. `sanity/schemaTypes/leadMagnetType.ts` — full Sanity document schema with 6 field groups (identity, content, leadForm, seo, generation, dates) and 18 fields; registered in `sanity/schemaTypes/index.ts`; custom sidebar entry added to `sanity/structure.ts` with `defaultOrdering` by `publishedAt` desc. `lib/lead-magnet-generator/types.ts` — all TypeScript contracts for phases 1–8 (`LeadMagnetPromptInput`, `LeadMagnetOutline`, `GeneratedLeadMagnet`, `LeadMagnetImages`, `PublishedLeadMagnet`, `LeadMagnetApiResponse`, etc.). `/lead-magnets/[slug]` + `es: /imanes-de-leads/[slug]` added to `i18n/routing.ts`. Merged to main on branch `feature/lead-magnet-generator-phase-1`.
- 2026-06-05: **Blog Post to Newsletter — Phase 2** completed. `sanity/actions/sendNewsletterAction.tsx` — custom Studio document action with confirmation dialog (live EN/ES subscriber counts, already-sent warning, success/error states); registered in `sanity.config.ts` for `post` type only; added `@sanity/ui` and `@sanity/icons` as direct deps. Merged to main on branch `feature/blogpost-to-newsletter-phase-2`.
- 2026-06-05: **Blog Post to Newsletter — Phase 1** completed. `newsletterSentAt` field added to Sanity post schema; `@portabletext/to-html` installed; `lib/email/portable-text-to-html.ts` (portable text → inline email HTML); `lib/email/newsletter-post.ts` (bilingual email template + `sendNewsletterPost()` orchestrator); `GET /api/newsletter/subscriber-counts` (Clerk-auth); `POST /api/newsletter/send-post` (locale-segmented send, duplicate prevention, force override). Merged to main on branch `feature/blogpost-to-newsletter-phase-1`.
- 2026-06-04: **Blog Generation from YouTube — Phase 1** completed. YouTube data extraction service (`lib/blog-generator/`), Clerk-authenticated API route (`/api/admin/blog-generator/extract`), shared TypeScript types, and CLAUDE.md. Merged to main on branch `feature/blog-generation-youtube`.
- 2026-06-04: **Blog Generation from YouTube — Phase 2** completed. OpenAI content generation service (`lib/blog-generator/content-generator.ts`), portable-text utilities extracted to `lib/blog-generator/portable-text.ts`, API route (`/api/admin/blog-generator/generate`), `openai` package added. Merged to main on branch `feature/blog-generation-phase-2`.
- 2026-06-04: **Blog Generation from YouTube — Phase 3** completed. OpenAI EN→ES translation service (`lib/blog-generator/translator.ts`), Sanity thumbnail upload + bilingual post creation (`lib/blog-generator/sanity-publisher.ts`), API route (`/api/admin/blog-generator/publish`). Posts published as drafts with `relatedPost` linking. Merged to main on branch `feature/blog-generation-phase-3`.
- 2026-06-04: **Blog Generation from YouTube — Phase 4** completed. Protected admin page at `/en/admin/blog-generator` with 6-stage pipeline UI (URL input → extract → generate → review/edit → publish → success). Middleware updated to protect `/admin` routes. Merged to main on branch `feature/blog-generation-phase-4`.
- 2026-06-04: **Blog Generation from YouTube — Phase 5** completed. Field-level regeneration (title/excerpt/body), CTA auto-suggestion with category mapping, publish status control (draft/published), and batch mode (up to 10 URLs). TypeScript check passes. Merged to main on branch `feature/blog-generation-phase-5`.
- 2026-06-04: **Blog Generation from YouTube — Phase 6** completed. DALL-E 3 image generation — 1 featured (1792×1024) + 3 body images (1024×1024) per post. GPT-4o generates prompts, images uploaded to Sanity, body images inserted at 25/50/75% of body blocks. Skippable step with YouTube thumbnail fallback. Committed directly to main.
- 2026-06-09: **Lead Magnet Generator — Phase 8** completed. `app/[locale]/lead-magnets/[slug]/page.tsx` — Server Component ISR landing page (`export const revalidate = 3600`); hero with `coverImage` + dark gradient overlay + "FREE DOWNLOAD" badge; 2-col `keyBenefits` grid with `CheckCircle` icons; `@portabletext/react` `description` body + `targetAudience` callout; `<LeadMagnetForm>` in a sticky card; `downloadCount` trust section with 5-star rating; footer CTA with `NEXT_PUBLIC_PHONE_NUMBER` tel link + "Browse all free guides →". `generateMetadata()` reads `seo.metaTitle/metaDescription` with fallbacks to `title/subtitle`; `og:image` from `coverImage.asset.url`. 404 on missing/draft slugs. `components/lead-magnet-form.tsx` — Client Component; name (required) + email (required, client-side regex validation) + phone (optional); `POST /api/lead-magnets/download`; success state: `window.open(pdfUrl)` + fallback `<a>` + consultation phone link. `app/api/lead-magnets/download/route.ts` — public POST (no auth); validates name + email + slug; fetches Sanity (`generatedPdfUrl` 404 if missing); creates Agent CRM contact with tags `["lead-magnet", "lead-magnet-{category}", "lead-magnet-{slug}"]` using `AGENT_CRM_PI` token (non-fatal); triggers workflow via `leadFormSettings.agentCrmWorkflowId` or `AGENT_CRM_LEAD_MAGNET_WORKFLOW_ID` env var (non-fatal); fires Meta CAPI `Lead` event via `sendMetaCapiEvent` with `content_name/content_category` custom data (non-fatal); increments `downloadCount` via Sanity write client patch (non-fatal); returns `{ success: true, data: { pdfUrl } }`. New env var: `AGENT_CRM_LEAD_MAGNET_WORKFLOW_ID`. Merged to main on branch `feature/lead-magnet-generator-phase-8`.
- 2026-06-09: **Final Expense State Pages + Blog Improvements** completed. `app/[locale]/final-expense/[state]/page.tsx` — 16-state landing pages at `/en/final-expense/[state]` with state-specific hero, FAQs, related Final Expense blog posts, `getFeStatePageLd` + `getFeStateBreadcrumbLd` JSON-LD via `<Script>`, and `generateStaticParams`. `lib/final-expense-states.ts` — `FE_STATE_SLUGS`, `FeStateSlug`, `FeStateInfo`, `FE_STATE_MAP` (16 states). Sitemap entries added. `lib/seo/jsonld.ts` — `getFeStatePageLd` (WebPage) + `getFeStateBreadcrumbLd` (Home → Final Expense → State) + `getBlogCategoryCollectionPageLd` (CollectionPage with hasPart items) + `getBlogCategoryBreadcrumbLd` (Home → Blog → Category). `app/[locale]/blog/category/[category]/page.tsx` — CollectionPage + BreadcrumbList JSON-LD injected. `components/blog-scroll-floating-cta.tsx` — scroll-triggered floating quote button (appears at 50% scroll depth, dismissible with ×, opens category-appropriate quote modal). `lib/blog-featured-image.ts` — `cloudinaryFetchedImageUrl(url, w, h)` helper (f_auto, q_auto, c_fill, g_auto). `components/blog-post-card.tsx` + related posts grid in blog post page: switched from bare `urlFor().url()` to `cloudinaryFetchedImageUrl` for WebP/AVIF delivery. `app/[locale]/blog/[slug]/page.tsx` — added `generateStaticParams` + `BlogScrollFloatingCTA`. Committed directly to main.
