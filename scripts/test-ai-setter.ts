/**
 * AI Setter tests. Offline by default: no network, no database, no keys.
 *
 *   pnpm test:ai-setter              unit checks + whole turns on fake GHL / Claude / DB / queue
 *   pnpm test:ai-setter --live es    live Claude (the DEVELOPMENT key in .env) on the synthetic
 *   pnpm test:ai-setter --live en    personas in scripts/data/ai-setter/live-personas.json, with GHL,
 *                                    DB, Telegram and QStash still fake. Prints each persona's facts,
 *                                    tool calls, action, final text, guard result and cost, and
 *                                    scores the rules. `--only price,stop` runs just those.
 *
 * Offline it never imports lib/db or a `server-only` module (store, settings, calls, license,
 * notify, actions, process). The core (turn.ts, send.ts, outbound.ts, tools.ts, context.ts, …) takes
 * every side effect through AiSetterPorts (lib/ai-setter/types.ts), so the fakes below stand in:
 * FakeStore mirrors lib/ai-setter/store.ts statement by statement, FakeGhl records every write, and
 * FakeLlm replays a script of tool calls through the REAL tool executor, so tools.ts runs for real.
 *
 * A failing `check` exits 1. `known(...)` documents a bug in ANOTHER file that this suite reports
 * but does not fix: it prints "KNOWN BUG" without failing the run, and "now fixed" once it holds
 * (then turn it into a plain check).
 */

import { LIVE_MODE } from "./lib/ai-setter-test-env";

import { existsSync, readFileSync } from "fs";
import path from "path";

import Anthropic from "@anthropic-ai/sdk";

import { areaCodeInfo, isTollFreeOrShortCode } from "../lib/ai-setter/area-codes";
import {
  LEAD_HOURS,
  applyPreference,
  filterSlots,
  formatAppointmentForText,
  formatEta,
  formatSlotForText,
  isIsaacAvailableNow,
  isValidTimeZone,
  isWithinSchedule,
  parseHHMM,
  partOfDay,
  pickTwoSlots,
  shouldShowZone,
  slotsByZone,
  validateSchedule,
  zoneLabel,
  zonedParts,
  zonedTimeToDate,
} from "../lib/ai-setter/availability";
import { classifyOutbound, latestHumanOutbound, newestInbound } from "../lib/ai-setter/classify";
import {
  channelWindow,
  classifyTrivialInbound,
  detectHelp,
  detectLoop,
  detectMedicare,
  detectOptOut,
  detectStart,
  licenseDecision,
  localClock,
  normalizeText,
  replyWindowDecision,
  resolveLeadZones,
  toStateCode,
  usesTu,
  type OptOutTier,
} from "../lib/ai-setter/compliance";
import {
  AI_BOOKED_TAG,
  MAX_LLM_CALLS_PER_TURN,
  OUT_OF_LICENSE_STATE_TAG,
  getAiSetterConfig,
  missingAiSetterConfig,
  type AiSetterConfig,
} from "../lib/ai-setter/config";
import { buildUserContent, refreshOfferLabels, renderFacts, renderThread, type TurnFacts } from "../lib/ai-setter/context";
import {
  attachmentKindOf,
  channelOfMessageType,
  classifySendFailure,
  createAiSetterGhlPort,
  parseContact,
  parseEvents,
  parseFreeSlots,
  parseMessages,
} from "../lib/ai-setter/ghl";
import { autoFixEnglishPunctuation, guardFreeText, smsSegments, type GuardContext } from "../lib/ai-setter/guard";
import { costMicrosOf, createLlmPort } from "../lib/ai-setter/llm";
import { createMemoryLogger } from "../lib/ai-setter/log";
import { needsDisclosure } from "../lib/ai-setter/outbound";
import {
  BOOKING_PATHS,
  CALENDAR_IDS,
  DEFAULT_SCHEDULE,
  calendarIdFor,
  languageFromTags,
  productFromSignals,
  topicPhrase,
} from "../lib/ai-setter/product";
import { TURN_INSTRUCTION, buildSystemPrompt } from "../lib/ai-setter/prompts";
import { runSend, runVerifySend, type SendResult } from "../lib/ai-setter/send";
import {
  TEMPLATE_DESCRIPTIONS,
  TEMPLATE_IDS,
  TEMPLATE_META,
  getTemplateText,
  isComplianceTemplate,
  isTemplateId,
  renderTemplate,
  templateCatalog,
  templateHash,
  type TemplateId,
  type TemplateVars,
} from "../lib/ai-setter/templates";
import { clip, detectMessageLanguage, maskForModel, toE164Nanp } from "../lib/ai-setter/text-utils";
import { MODEL_TEMPLATE_IDS, TOOL_DEFS, createToolExecutor, newToolState, type ToolContext } from "../lib/ai-setter/tools";
import { allowedLinks, runTurn, templateVars, type TurnResult } from "../lib/ai-setter/turn";
import type {
  AiSetterPorts,
  AiSetterSettings,
  AppointmentRef,
  AttachmentKind,
  CallSignal,
  CallsPort,
  Channel,
  ContactSnapshot,
  DndChannel,
  GhlFailure,
  GhlPort,
  GhlResult,
  Lang,
  LeadRecord,
  LicensePort,
  LlmLoopResult,
  LlmPort,
  LlmSession,
  LlmUsage,
  MessageRecord,
  MessageStatus,
  NewMessage,
  NotifyEvent,
  NotifyPort,
  OfferedSlot,
  QueuePort,
  Register,
  SendOutcome,
  SettingsPort,
  StorePort,
  SuppressionScope,
  ThreadChannel,
  ThreadMessage,
  ToolExecResult,
  TurnFence,
  TurnReason,
} from "../lib/ai-setter/types";
import { aiDisclosure, capitalizeFirst, greeting, sanitizeFirstName, stopFooter, withDisclosure } from "../lib/ai-setter/ui-strings";
import { resolveTimezone } from "../lib/leads-the-way/timezone";
import { normalizeUpdate } from "../lib/telegram/update";

// ═══ Harness ═════════════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
const knownBugs: string[] = [];

function show(detail: unknown): string {
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail, (_key, value: unknown) => (value instanceof Set ? [...value] : value));
  } catch {
    return String(detail);
  }
}

function check(name: string, condition: boolean, detail?: unknown): boolean {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${show(detail)}`}`);
  }
  return condition;
}

const j = (v: unknown) => JSON.stringify(v);

/** An explicit environment for getAiSetterConfig (never this process's). */
const envOf = (vars: Record<string, string> = {}) => vars as unknown as NodeJS.ProcessEnv;

function eq(name: string, actual: unknown, expected: unknown): boolean {
  return check(name, j(actual) === j(expected), { actual, expected });
}

/** One check over a table of cases; on failure the detail lists every row that failed. */
function table<I, O>(name: string, rows: ReadonlyArray<readonly [I, O]>, fn: (input: I) => O): boolean {
  const bad: Array<{ input: I; expected: O; actual: O }> = [];
  for (const [input, expected] of rows) {
    const actual = fn(input);
    if (j(actual) !== j(expected)) bad.push({ input, expected, actual });
  }
  return check(`${name} (${rows.length} cases)`, bad.length === 0, bad);
}

/** A bug in another file, reported (see the summary) but not fixed here. Never fails the run. */
function known(name: string, holdsWhenFixed: boolean, where: string, detail?: unknown): void {
  if (holdsWhenFixed) {
    passed++;
    console.log(`  ✓ ${name} (was a KNOWN BUG, now fixed: turn this into a check)`);
    return;
  }
  knownBugs.push(`${name} — ${where}`);
  console.log(`  ! KNOWN BUG ${name} — ${where}${detail === undefined ? "" : ` — ${show(detail)}`}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const NY = "America/New_York";
const CHI = "America/Chicago";
const DEN = "America/Denver";
const LA = "America/Los_Angeles";
const BRAND = "Isaac Plans Insurance";

let unitSeq = 0;
/** A thread message for the unit checks (ids m1, m2, …). */
function tmsg(p: Partial<ThreadMessage> & Pick<ThreadMessage, "direction" | "dateAdded">): ThreadMessage {
  unitSeq++;
  return {
    id: p.id ?? `m${unitSeq}`,
    conversationId: "c1",
    channel: p.channel ?? "SMS",
    messageType: p.messageType ?? (p.channel === "WhatsApp" ? "TYPE_WHATSAPP" : "TYPE_SMS"),
    source: p.source ?? null,
    userId: p.userId ?? null,
    body: p.body ?? "hello",
    attachmentKinds: p.attachmentKinds ?? [],
    dateAdded: p.dateAdded,
    status: p.status ?? null,
    direction: p.direction,
    fromNumber: p.fromNumber ?? null,
  };
}

// ═══ config ══════════════════════════════════════════════════════════════════════════════════

function configTests(): void {
  section("config");
  const d = getAiSetterConfig(envOf());
  check(
    "defaults: off, shadow mode ON, claude-opus-5-5, effort low, 8000 max tokens",
    !d.enabled && d.dryRun && d.model === "claude-opus-5-5" && d.effort === "low" && d.maxTokens === 8000,
    d
  );
  check(
    "defaults: caps and timers from the plan",
    d.maxTurnsPerContactPerDay === 8 &&
      d.maxTurnsPerThread === 40 &&
      d.maxTurnsPerHour === 60 &&
      d.humanPauseHours === 48 &&
      d.inboundMaxAgeHours === 12 &&
      d.debounceSeconds === 20 &&
      d.callNowTimeoutSeconds === 180 &&
      d.draftTtlHours === 2 &&
      d.dailyBudgetUsd === 10 &&
      d.appointmentMinutes === 30 &&
      d.appendStopFooter &&
      d.replyToHelp &&
      !d.tagNewLeads,
    d
  );
  const c = getAiSetterConfig(envOf({
    AI_SETTER_ENABLED: "TRUE",
    AI_SETTER_DRY_RUN: "false",
    AI_SETTER_EFFORT: " Medium ",
    AI_SETTER_MAX_TURNS_PER_CONTACT_DAY: "999",
    AI_SETTER_DEBOUNCE_SECONDS: "-5",
    AI_SETTER_DAILY_BUDGET_USD: "abc",
    AI_SETTER_WEBHOOK_SECRET: '"s3cret-value"',
    NEXT_PUBLIC_SITE_URL: "https://example.test/",
    AI_SETTER_TEST_CONTACT_IDS: "abcDEF1234567890xyzA, bad id, x",
  }));
  check(
    "parsing: booleans, effort, clamped ints, bad float → default, quotes stripped, trailing slash, id list",
    c.enabled &&
      !c.dryRun &&
      c.effort === "medium" &&
      c.maxTurnsPerContactPerDay === 50 &&
      c.debounceSeconds === 0 &&
      c.dailyBudgetUsd === 10 &&
      c.webhookSecret === "s3cret-value" &&
      c.siteUrl === "https://example.test" &&
      j(c.testContactIds) === j(["abcDEF1234567890xyzA"]),
    c
  );
  eq("missingAiSetterConfig names everything a live turn needs", missingAiSetterConfig(d, { publish: false, receive: false }), [
    "AI_SETTER_WEBHOOK_SECRET",
    "AI_SETTER_GHL_PI",
    "AGENT_CRM_LOCATION_ID",
    "ANTHROPIC_API_KEY",
    "AI_SETTER_GHL_USER_ID",
    "QSTASH_ENABLED + QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY + QSTASH_NEXT_SIGNING_KEY",
  ]);
  check(
    "no credential in this process (the env module ran first)",
    !process.env.DATABASE_URL && !process.env.AI_SETTER_GHL_PI && !process.env.AGENT_CRM_PI && !process.env.ANTHROPIC_API_KEY
  );
}

// ═══ compliance ══════════════════════════════════════════════════════════════════════════════

function complianceTests(): void {
  section("compliance: text normalization");
  table(
    "normalizeText",
    [
      ["¡No más, por favor! 🙏", "no mas por favor"],
      ["Don't TEXT me!!!", "dont text me"],
      ["don´t call", "dont call"],
      ["𝐒𝐓𝐎𝐏", "stop"],
      ["  Opt-Out  ", "opt out"],
      ["Ｓｔｏｐ", "stop"],
      ["👍❤️", ""],
      ["Señor Núñez", "senor nunez"],
    ],
    normalizeText
  );

  section("compliance: opt-outs in 3 tiers (EN/ES)");
  const optOuts: Array<[string, OptOutTier | null]> = [
    // keyword: the whole message (fillers aside) is an opt-out word → definitive
    ["STOP", "keyword"],
    ["please stop", "keyword"],
    ["Stop.", "keyword"],
    ["STOP STOP", "keyword"],
    ["Basta ya", "keyword"],
    ["No más por favor", "keyword"],
    ["Opt-out", "keyword"],
    ["CANCELAR", "keyword"],
    ["Baja", "keyword"],
    ["END", "keyword"],
    ["stop all", "keyword"],
    // phrase: unmistakable do-not-contact → definitive
    ["Stop texting me", "phrase"],
    ["No me escriban mas", "phrase"],
    ["No me escriban más!!", "phrase"],
    ["Unsubscribe me", "phrase"],
    ["Please remove me from your list", "phrase"],
    ["take me off this list", "phrase"],
    ["Leave me alone", "phrase"],
    ["Do not text me", "phrase"],
    ["Don't call me", "phrase"],
    ["dont call or text me", "phrase"],
    ["No me llamen", "phrase"],
    ["Dejen de escribirme por favor", "phrase"],
    ["Bórrenme de la lista", "phrase"],
    ["Quítenme de la lista", "phrase"],
    ["No quiero recibir mensajes", "phrase"],
    ["No quiero más llamadas", "phrase"],
    ["No me manden más mensajes", "phrase"],
    ["Quiero darme de baja", "phrase"],
    ["Déjenme en paz", "phrase"],
    ["I revoke my consent", "phrase"],
    ["I'm no longer interested in texts", "phrase"],
    ["stop sending me messages", "phrase"],
    ["No me llamen ni me escriban", "phrase"],
    ["how do I opt out?", "phrase"],
    ["Please don't text me anymore", "phrase"],
    ["No me llamen nunca más", "phrase"],
    // wrong number: the consent is void → definitive
    ["Numero equivocado", "wrong_number"],
    ["Sorry, wrong number", "wrong_number"],
    ["Se equivocaron de número", "wrong_number"],
    ["No conozco a esa persona", "wrong_number"],
    ["you have the wrong person", "wrong_number"],
    ["Wrong #", "wrong_number"],
    // not an opt-out: appointment cancels, other meanings, reactions
    ["Quiero cancelar la cita", null],
    ["Can I cancel my appointment?", null],
    ["cancel the call please", null],
    ["I'll call you this weekend", null],
    ["A veces la presión baja", null],
    ["Es muy alto el precio", null],
    ["¿No me llaman hoy?", null],
    ["Isaac no me llamó", null],
    ["No estoy interesado", null],
    ["No gracias", null],
    ["Liked “Hi Maria, this is Isaac Plans Insurance. Reply STOP to opt out.”", null],
    ["Le gustó “Responda STOP para cancelar”", null],
    ["   ", null],
    ["Yes", null],
    // ambiguous: freeze, one clarification, alert Isaac
    ["can you stop by tomorrow?", "ambiguous"],
    ["Stop it", "ambiguous"],
    ["I want to cancel", "ambiguous"],
    ["can I opt out later", "ambiguous"],
    ["No me llame antes de las 5", "ambiguous"],
    ["Please don't call me at work", "ambiguous"],
    ["Don't text me after 9pm", "ambiguous"],
    ["No me llame, mejor escríbame", "ambiguous"],
    ["don't call me, text me instead", "ambiguous"],
    ["Hoy no me llamen", "ambiguous"],
    ["Thanks for texting ABC! Reply STOP to unsubscribe.", "ambiguous"],
  ];
  for (const tier of ["keyword", "phrase", "wrong_number", "ambiguous", null] as const) {
    table(`opt-out → ${tier ?? "none"}`, optOuts.filter(([, t]) => t === tier), (s) => detectOptOut(s)?.tier ?? null);
  }
  eq("matched text: keyword without fillers / the phrase itself", [detectOptOut("stop please")?.matched, detectOptOut("Stop texting me now")?.matched], [
    "stop",
    "stop texting",
  ]);

  section("compliance: HELP, START, trivial messages");
  table(
    "detectHelp (whole message only)",
    [
      ["HELP", true],
      ["Ayuda!", true],
      ["Info", true],
      ["Información", true],
      ["help me please", false],
    ],
    detectHelp
  );
  table(
    "detectStart (whole message only)",
    [
      ["START", true],
      ["unstop", true],
      ["Reanudar", true],
      ["start the process", false],
    ],
    detectStart
  );
  type Triv = [string, AttachmentKind[]];
  table<Triv, string | null>(
    "classifyTrivialInbound",
    [
      [["", []], "empty"],
      [["​ ‎", []], "empty"],
      [["", ["image"]], "media_only"],
      [["ok", ["image"]], null],
      [["Liked “Can Isaac call you today at 4?”", []], "reaction"],
      [['Loved "Great, see you then"', []], "reaction"],
      [["Laughed at “lol”", []], "reaction"],
      [["Reacted 😂 to “Hi there”", []], "reaction"],
      [["Le gustó “¿Le puede llamar Isaac hoy?”", []], "reaction"],
      [["Se rió de “jaja”", []], "reaction"],
      [["Reaccionó con 👍 a “Perfecto”", []], "reaction"],
      [["Liked an image", []], "reaction"],
      [["Removed a heart from “Thanks!”", []], "reaction"],
      [["‎Liked “ok”", []], "reaction"],
      [["👍", []], "emoji_only"],
      [["🙏🏽❤️", []], "emoji_only"],
      [["!!!", []], "emoji_only"],
      [["?", []], null],
      [["Ok", []], "ack"],
      [["OK!", []], "ack"],
      [["Thanks!!", []], "ack"],
      [["Ok, gracias 🙏", []], "ack"],
      [["Okay thank you", []], "ack"],
      [["Muchas gracias", []], "ack"],
      [["De nada", []], "ack"],
      [["Bueno", []], "ack"],
      [["Perfecto", []], null],
      [["Listo", []], null],
      [["Sí", []], null],
      [["Yes", []], null],
      [["Sure", []], null],
      [["Claro", []], null],
      [["I'm driving with Driving Focus turned on. I'll see your message when I get where I'm going.", []], "auto_reply"],
      [["Estoy manejando con el modo Conducción activado. Veré tu mensaje cuando llegue a mi destino.", []], "auto_reply"],
      [["Out of office until Monday.", []], "auto_reply"],
      [["Auto-Reply: I am away", []], "auto_reply"],
      [["Gracias por su mensaje. Le responderé a la brevedad.", []], "auto_reply"],
      [["Gracias por su mensaje, ¿me puede llamar a las 5?", []], null],
      [["I will get back to you tomorrow", []], null],
      [["This is an automated message", ["other"]], "auto_reply"],
      [["How much does it cost?", []], null],
    ],
    ([body, attachments]) => classifyTrivialInbound(body, attachments)
  );

  section("compliance: Medicare, tú/usted, states");
  table(
    "detectMedicare (not Medicaid)",
    [
      ["Tengo Medicare y Medicaid", true],
      ["I have a Medicare Advantage plan", true],
      ["¿Cubre la Parte D?", true],
      ["medigap?", true],
      ["suplemento de medicare", true],
      ["Tengo Medicaid", false],
      ["Soy parte de la familia", false],
    ],
    detectMedicare
  );
  table(
    "usesTu (usted wins when both appear)",
    [
      ["¿Puedes llamarme mañana?", true],
      ["Hola, como estas", true],
      ["¿Estás ahí?", true],
      ["Llámame a las 5", true],
      ["Este es tu numero?", true],
      ["¿Puede llamarme?", false],
      ["Oye, ¿usted es Isaac?", false],
      ["Llámeme a las 5 por favor", false],
      ["Estas fechas no me sirven", false],
    ],
    usesTu
  );
  table<string | null, string | null>(
    "toStateCode (codes, EN/ES names, accents, DC, PR)",
    [
      ["FL", "FL"],
      [" fl ", "FL"],
      ["Florida", "FL"],
      ["Nueva York", "NY"],
      ["N.Y.", "NY"],
      ["Carolina del Norte", "NC"],
      ["Pensilvania", "PA"],
      ["Míchigan", "MI"],
      ["Oregón", "OR"],
      ["Washington", "WA"],
      ["Washington, D.C.", "DC"],
      ["D.C.", "DC"],
      ["District of Columbia", "DC"],
      ["puerto rico", "PR"],
      ["Hawái", "HI"],
      ["Virginia Occidental", "WV"],
      ["XX", null],
      ["  ", null],
      [null, null],
      ["Mexico", null],
    ],
    toStateCode
  );

  section("compliance: area codes and zones");
  const fl = { state: "FL", timeZone: NY };
  table(
    "areaCodeInfo (state + dominant zone, overlays, split codes)",
    [
      ["+13055550142", fl],
      ["8505550142", { state: "FL", timeZone: CHI }],
      ["19155550142", { state: "TX", timeZone: DEN }],
      ["(213) 555-0142", { state: "CA", timeZone: LA }],
      ["+1 202-555-0142", { state: "DC", timeZone: NY }],
      ["+17715550142", { state: "DC", timeZone: NY }],
      ["+16065550142", { state: "KY", timeZone: NY }],
      ["+12705550142", { state: "KY", timeZone: CHI }],
      ["+12085550142", { state: "ID", timeZone: "America/Boise" }],
      ["+17015550142", { state: "ND", timeZone: CHI }],
      ["+15415550142", { state: "OR", timeZone: LA }],
      ["+15205550142", { state: "AZ", timeZone: "America/Phoenix" }],
      ["+19285550142", { state: "AZ", timeZone: "America/Phoenix" }],
      ["+18085550142", { state: "HI", timeZone: "Pacific/Honolulu" }],
      ["+19075550142", { state: "AK", timeZone: "America/Anchorage" }],
      ["+17875550142", { state: "PR", timeZone: "America/Puerto_Rico" }],
      ["+19395550142", { state: "PR", timeZone: "America/Puerto_Rico" }],
      ["+16455550142", fl],
      ["+17865550142", fl],
      ["+19175550142", { state: "NY", timeZone: NY }],
      ["+13325550142", { state: "NY", timeZone: NY }],
      ["+14485550142", { state: "FL", timeZone: CHI }],
      ["+12195550142", { state: "IN", timeZone: CHI }],
      ["+17295550142", { state: "TN", timeZone: NY }],
      ["+16215550142", { state: "TX", timeZone: CHI }],
    ],
    areaCodeInfo
  );
  table(
    "areaCodeInfo null: toll-free, 900, 5XX, Canada, Caribbean, other countries, junk",
    ["+18005550142", "8885550142", "9005550142", "5005550142", "+14165550142", "+18095550142", "+525512345678", "+4412345678", "22395", ""].map(
      (p) => [p, null] as const
    ),
    areaCodeInfo
  );
  table(
    "isTollFreeOrShortCode",
    [
      ["+18005550142", true],
      ["8335550142", true],
      ["1-888-555-0142", true],
      ["+19005550142", true],
      ["22395", true],
      ["223950", true],
      ["+13055550142", false],
      ["+18505550142", false],
      ["AMAZON", false],
      ["7726", false],
    ],
    isTollFreeOrShortCode
  );
  eq(
    "zones: FL panhandle address + 305 phone → both zones, address primary",
    resolveLeadZones({ ghlTimezone: null, state: "Florida", postalCode: "32501", phone: "+13055550142" }, resolveTimezone),
    { zones: [CHI, NY], primaryZone: CHI, stateCodes: ["FL"], licenseState: "FL", source: "address" }
  );
  eq(
    "zones: GHL alias de-duplicated with the area code",
    resolveLeadZones({ ghlTimezone: "US/Eastern", state: null, postalCode: null, phone: "+13055550142" }, resolveTimezone),
    { zones: ["US/Eastern"], primaryZone: "US/Eastern", stateCodes: ["FL"], licenseState: "FL", source: "ghl" }
  );
  eq(
    "zones: UTC placeholder ignored; PA address + CA phone keep both states",
    resolveLeadZones({ ghlTimezone: "UTC", state: "PA", postalCode: null, phone: "+12135550142" }, resolveTimezone),
    { zones: [NY, LA], primaryZone: NY, stateCodes: ["PA", "CA"], licenseState: "PA", source: "address" }
  );
  eq(
    "zones: nothing known",
    resolveLeadZones({ ghlTimezone: null, state: null, postalCode: null, phone: null }, resolveTimezone),
    { zones: [], primaryZone: null, stateCodes: [], licenseState: null, source: "none" }
  );
  eq(
    "zones: invalid GHL zone → area code only",
    resolveLeadZones({ ghlTimezone: "Nope/Zone", state: null, postalCode: null, phone: "+19155550142" }, resolveTimezone),
    { zones: [DEN], primaryZone: DEN, stateCodes: ["TX"], licenseState: "TX", source: "area_code" }
  );
  eq(
    "zones: a throwing lookup and an offset zone never place the lead",
    resolveLeadZones({ ghlTimezone: "+05:00", state: "TX", postalCode: "79901", phone: null }, () => {
      throw new Error("boom");
    }),
    { zones: [], primaryZone: null, stateCodes: ["TX"], licenseState: "TX", source: "none" }
  );
  table<[string, string], unknown>(
    "localClock",
    [
      [["2026-11-17T08:00:00Z", LA], { weekday: 2, minutes: 0, dateKey: "2026-11-17" }],
      [["2026-11-17T17:30:00Z", NY], { weekday: 2, minutes: 750, dateKey: "2026-11-17" }],
      [["2026-11-17T05:00:00Z", NY], { weekday: 2, minutes: 0, dateKey: "2026-11-17" }],
    ],
    ([iso, zone]) => localClock(new Date(iso), zone)
  );

  section("compliance: reply windows (lead hours, PA, fresh replies, DST)");
  const win = (now: string, last: string | null, zones: string[], states: string[]) => {
    const r = replyWindowDecision({ now: new Date(now), lastInboundAt: last ? new Date(last) : null, zones, stateCodes: states });
    return { allowedNow: r.allowedNow, reason: r.reason, next: r.nextAllowedAt?.toISOString() ?? null };
  };
  eq("PA lead writing on Sunday → blocked until Monday 9 am ET", win("2026-11-22T20:00:00Z", "2026-11-22T19:59:00Z", [NY], ["PA"]), {
    allowedNow: false,
    reason: "pa_window",
    next: "2026-11-23T14:00:00.000Z",
  });
  eq("PA Sunday evening → Monday 9 am", win("2026-11-23T00:30:00Z", null, [NY], ["PA"]).next, "2026-11-23T14:00:00.000Z");
  eq("PA Monday 11 am → allowed", win("2026-11-23T16:00:00Z", null, [NY], ["PA"]), { allowedNow: true, reason: "within_hours", next: null });
  eq("PA 7:30 pm, even a fresh reply → blocked until 9 am", win("2026-11-24T00:30:00Z", "2026-11-24T00:29:00Z", [NY], ["PA"]), {
    allowedNow: false,
    reason: "pa_window",
    next: "2026-11-24T14:00:00.000Z",
  });
  eq("PA (full name) Friday 7 pm → Saturday 9 am", win("2026-11-28T00:00:00Z", null, [NY], ["Pennsylvania"]).next, "2026-11-28T14:00:00.000Z");
  eq("fresh reply at 11 pm → allowed now", win("2026-11-18T04:00:00Z", "2026-11-18T03:45:00Z", [NY], ["FL"]).reason, "fresh_reply");
  eq("unknown zone at 10 pm ET → both coasts must allow (8 am PT)", win("2026-11-18T03:00:00Z", "2026-11-18T01:00:00Z", [], []), {
    allowedNow: false,
    reason: "outside_hours",
    next: "2026-11-18T16:00:00.000Z",
  });
  eq("inside hours in every zone", win("2026-11-18T19:00:00Z", null, [NY, LA], ["CA"]), { allowedNow: true, reason: "within_hours", next: null });
  eq("9:00 pm exactly → blocked until 8 am", win("2026-11-18T02:00:00Z", null, [NY], []), {
    allowedNow: false,
    reason: "outside_hours",
    next: "2026-11-18T13:00:00.000Z",
  });
  eq("8:00 am exactly → allowed", win("2026-11-18T13:00:00Z", null, [NY], []).allowedNow, true);
  eq("DST fall-back night → 8 am EST", win("2026-11-01T05:30:00Z", null, [NY], []).next, "2026-11-01T13:00:00.000Z");
  eq("Hawaii + New York → the stricter (8 am HST)", win("2026-11-18T03:00:00Z", null, ["Pacific/Honolulu", NY], ["HI"]).next, "2026-11-18T18:00:00.000Z");
  eq("GHL clock 2 min ahead still counts as fresh", win("2026-11-18T04:00:00Z", "2026-11-18T04:02:00Z", [NY], []).reason, "fresh_reply");

  section("compliance: WhatsApp 24 h window, license gate, loops");
  const now = new Date("2026-11-17T18:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * MIN);
  const thread = [
    tmsg({ direction: "inbound", channel: "WhatsApp", dateAdded: ago(23 * 60) }),
    tmsg({ direction: "inbound", channel: "SMS", dateAdded: ago(30) }),
    tmsg({ direction: "outbound", dateAdded: ago(20), source: "workflow" }),
  ];
  const wa = channelWindow(thread, "WhatsApp", now);
  check("WhatsApp open 23 h after the lead's last WhatsApp, closes at +24 h", wa.open && wa.closesAt?.getTime() === ago(23 * 60).getTime() + 24 * HOUR, wa);
  check("WhatsApp closed after 25 h", !channelWindow([tmsg({ direction: "inbound", channel: "WhatsApp", dateAdded: ago(25 * 60) })], "WhatsApp", now).open);
  eq("WhatsApp closed with no WhatsApp inbound at all", channelWindow([], "WhatsApp", now), { open: false, lastInboundAt: null, closesAt: null });
  const sms = channelWindow(thread, "SMS", now);
  check("SMS always open (last inbound reported)", sms.open && sms.lastInboundAt?.getTime() === ago(30).getTime() && sms.closesAt === null, sms);
  table<[string | null, string[] | null], string>(
    "licenseDecision",
    [
      [["FL", ["FL", "TX"]], "licensed"],
      [["Florida", ["fl", "tx"]], "licensed"],
      [["CA", ["FL"]], "not_licensed"],
      [[null, ["FL"]], "unknown"],
      [["FL", null], "unknown"],
      [["FL", []], "unknown"],
      [["ZZ", ["FL"]], "unknown"],
    ],
    ([state, list]) => licenseDecision(state, list)
  );
  const ours = new Set<string>();
  const loopThread: ThreadMessage[] = [];
  for (let i = 0; i < 3; i++) {
    const t = ago(60 - i * 10);
    const o = tmsg({ direction: "outbound", dateAdded: t, source: "api", body: `ours ${i}` });
    ours.add(o.id);
    loopThread.push(o, tmsg({ direction: "inbound", dateAdded: new Date(t.getTime() + 4_000), body: `bot reply ${i}` }));
  }
  check("loop: 3 of our messages answered in < 15 s", detectLoop(loopThread, ours, now));
  check("no loop: only 2 instant answers", !detectLoop(loopThread.slice(0, 4), ours, now));
  check(
    "no loop: answers a minute later",
    !detectLoop(loopThread.map((m) => (m.direction === "inbound" ? { ...m, dateAdded: new Date(m.dateAdded.getTime() + MIN) } : m)), ours, now)
  );
  check("no loop: older than 2 h", !detectLoop(loopThread, ours, new Date(now.getTime() + 3 * HOUR)));
  const repeats = [1, 2, 3].map((i) => tmsg({ direction: "inbound", dateAdded: ago(100 - i), body: "Thanks for contacting ABC Plumbing!" }));
  check("loop: the same long inbound 3 times", detectLoop(repeats, new Set(), now));
  check("no loop: 'Yes' 3 times is a person", !detectLoop([1, 2, 3].map((i) => tmsg({ direction: "inbound", dateAdded: ago(100 - i * 20), body: "Yes" })), new Set(), now));
  check("no loop: last 3 differ", !detectLoop([...repeats.slice(0, 2), tmsg({ direction: "inbound", dateAdded: ago(10), body: "something else here" })], new Set(), now));

  section("classify: who sent each outbound message");
  const ctx = { ourGhlIds: new Set(["mine"]), isaacUserId: "isaacUser01" };
  const out = (p: Partial<ThreadMessage>) => tmsg({ direction: "outbound", dateAdded: ago(5), ...p });
  table<ThreadMessage, string>(
    "classifyOutbound (ours / automated / human)",
    [
      [out({ id: "mine", source: "app" }), "ours"],
      [out({ source: "app" }), "human"],
      [out({ source: "workflow" }), "automated"],
      [out({ source: "campaign" }), "automated"],
      [out({ source: "bulk_actions" }), "automated"],
      [out({ source: "api" }), "automated"],
      [out({ source: "api", messageType: "TYPE_CUSTOM_SMS" }), "human"],
      [out({ source: "workflow", messageType: "TYPE_CUSTOM_PROVIDER_SMS" }), "automated"],
      [out({ channel: "Call", messageType: "TYPE_CALL", source: "workflow" }), "human"],
      [out({ channel: "Call", messageType: "TYPE_CUSTOM_CALL", source: "api" }), "human"],
      [out({ channel: "WhatsApp" }), "human"],
      [out({ channel: "WhatsApp", source: "api" }), "automated"],
      [out({ channel: "WhatsApp", source: "workflow" }), "automated"],
      [out({ userId: "isaacUser01" }), "human"],
      [out({ userId: "isaacUser01", source: "api" }), "automated"],
      [out({ userId: "isaacUser01", source: "workflow" }), "automated"],
      [out({ channel: "Activity", messageType: "TYPE_ACTIVITY_APPOINTMENT", source: "app" }), "automated"],
      [out({ messageType: "TYPE_CAMPAIGN_SMS" }), "automated"],
      [out({ messageType: "TYPE_REVIEW_REQUEST", source: "app" }), "automated"],
      [out({}), "automated"],
      [tmsg({ direction: "inbound", dateAdded: ago(1), source: "app" }), "automated"],
    ],
    (m) => classifyOutbound(m, ctx)
  );
  const humanThread = [
    out({ id: "h1", source: "app", dateAdded: ago(50) }),
    out({ id: "w1", source: "workflow", dateAdded: ago(40) }),
    out({ id: "h2", source: "app", dateAdded: ago(30) }),
    tmsg({ id: "i1", direction: "inbound", dateAdded: ago(20) }),
    tmsg({ id: "i2", direction: "inbound", channel: "WhatsApp", dateAdded: ago(10) }),
    tmsg({ id: "e1", direction: "inbound", channel: "Email", dateAdded: ago(5) }),
  ];
  eq(
    "latestHumanOutbound (any time / after 35 min ago / strictly after)",
    [latestHumanOutbound(humanThread, null, ctx)?.id, latestHumanOutbound(humanThread, ago(35), ctx)?.id, latestHumanOutbound(humanThread, ago(30), ctx)],
    ["h2", "h2", null]
  );
  eq(
    "newestInbound (any / SMS+WhatsApp / SMS / empty list)",
    [newestInbound(humanThread)?.id, newestInbound(humanThread, ["SMS", "WhatsApp"])?.id, newestInbound(humanThread, ["SMS"])?.id, newestInbound(humanThread, [])],
    ["e1", "i2", "i1", null]
  );
}

// ═══ text: ui-strings, templates, guard ══════════════════════════════════════════════════════

function guardCtx(lang: Lang, register: Register, over: Partial<GuardContext> = {}): GuardContext {
  return {
    channel: "SMS",
    lang,
    register,
    firstName: lang === "es" ? "María" : "Maria",
    agentNames: ["Isaac", "Isaac Orraiz"],
    brand: BRAND,
    agentPhone: "(540) 426-1804",
    site: "https://www.isaacplans.com",
    allowedLinks: ["https://www.isaacplans.com/en/iul/calendar"],
    offeredSlotLabels: lang === "es" ? ["hoy a las 4:30 de la tarde", "mañana a las 10:00 de la mañana"] : ["today at 4:30 pm", "tomorrow at 10:00 am"],
    threadText: "",
    maxSmsSegments: 3,
    ...over,
  };
}

type GuardCase = readonly [label: string, text: string, ctx: GuardContext, code: string | null];

/** `code` null = must pass clean; otherwise the violations must include it. */
function guardTable(name: string, cases: GuardCase[]): void {
  const bad = cases.flatMap(([label, text, c, code]) => {
    const r = guardFreeText(text, c);
    const ok = code === null ? r.ok : r.violations.includes(code);
    return ok ? [] : [{ label, text, expected: code ?? "clean", violations: r.violations, warnings: r.warnings }];
  });
  check(`${name} (${cases.length} cases)`, bad.length === 0, bad);
}

function textTests(): void {
  section("ui-strings: names, greeting, disclosure, STOP footer");
  table<string | null | undefined, string | null>(
    "sanitizeFirstName",
    [
      ["MARIA", "Maria"],
      ["josé luis", "José Luis"],
      ["  maría  ", "María"],
      ["MARÍA JOSÉ", "María José"],
      ["o'neil", "O'Neil"],
      ["o’neil", "O'Neil"],
      ["mary - jane", "Mary-Jane"],
      ["DeShawn", "DeShawn"],
      ["maría del carmen", "María del Carmen"],
      ["Maria.", "Maria"],
      ["José 🙂", "José"],
      ["Zoë", "Zoë"],
      ["test", null],
      ["Unknown", null],
      ["n/a", null],
      ["NA", null],
      ["lead", null],
      ["cliente", null],
      ["Test Lead", null],
      ["Maria Test", null],
      ["Maria2", null],
      ["", null],
      [null, null],
      [undefined, null],
      ["A", null],
      ["Dr. Smith", null],
      ["🙂", null],
      ["Maria Guadalupe Fernanda de los Angeles", null],
      ["李", null],
    ],
    sanitizeFirstName
  );
  const idempotent = ["MARIA", "josé luis", "o'neil", "maría del carmen", "DeShawn"].every((n) => {
    const once = sanitizeFirstName(n);
    return once !== null && sanitizeFirstName(once) === once;
  });
  check("sanitizeFirstName is idempotent", idempotent);
  table<[Lang, string | null], string>(
    "greeting (EN folds non-GSM accents, ES keeps them, junk names dropped)",
    [
      [["en", "Maria"], "Hi Maria,"],
      [["es", "María"], "Hola María,"],
      [["en", null], "Hi,"],
      [["es", "test"], "Hola,"],
      [["en", "MARIA"], "Hi Maria,"],
      [["en", "María"], "Hi Maria,"],
      [["en", "José"], "Hi José,"],
      [["es", "maría josé"], "Hola María José,"],
    ],
    ([lang, name]) => greeting(lang, name)
  );
  eq(
    "aiDisclosure EN / ES usted / ES tú",
    [aiDisclosure("en", "usted", BRAND), aiDisclosure("es", "usted", BRAND), aiDisclosure("es", "tu", BRAND)],
    [
      "this is Isaac Plans Insurance's AI assistant (automated)",
      "le responde el asistente de IA (inteligencia artificial) de Isaac Plans Insurance",
      "te responde el asistente de IA (inteligencia artificial) de Isaac Plans Insurance",
    ]
  );
  eq("stopFooter EN / ES usted / ES tú", [stopFooter("en", "tu"), stopFooter("es", "usted"), stopFooter("es", "tu")], [
    "Reply STOP to opt out.",
    "Responda STOP para no recibir más mensajes.",
    "Responde STOP para no recibir más mensajes.",
  ]);
  table(
    "capitalizeFirst (past ¿ ¡, digits untouched)",
    [
      ["¿le puede", "¿Le puede"],
      ["¡listo!", "¡Listo!"],
      ["hoy a las 4", "Hoy a las 4"],
      ["4:30 pm", "4:30 pm"],
      ["", ""],
      ["¿ésta?", "¿Ésta?"],
    ],
    capitalizeFirst
  );
  const wd = { brand: BRAND, includeDisclosure: false, includeGreeting: false, includeStop: false };
  type WdCase = [string, Parameters<typeof withDisclosure>[1]];
  table<WdCase, string>(
    "withDisclosure (greeting, disclosure, STOP, capitals, spacing)",
    [
      [
        ["¿Le puede llamar Isaac hoy a las 4:30 de la tarde?", { ...wd, lang: "es", register: "usted", firstName: "María", includeDisclosure: true }],
        "Hola María, le responde el asistente de IA (inteligencia artificial) de Isaac Plans Insurance. ¿Le puede llamar Isaac hoy a las 4:30 de la tarde?",
      ],
      [
        ["Can Isaac call you today at 4:30 pm?", { ...wd, lang: "en", register: "usted", firstName: null, includeDisclosure: true, includeStop: true }],
        "Hi, this is Isaac Plans Insurance's AI assistant (automated). Can Isaac call you today at 4:30 pm? Reply STOP to opt out.",
      ],
      [
        ["can Isaac call you today?", { ...wd, lang: "en", register: "usted", firstName: "Maria", includeDisclosure: true }],
        "Hi Maria, this is Isaac Plans Insurance's AI assistant (automated). Can Isaac call you today?",
      ],
      [["Can Isaac call you today at 4:30 pm?", { ...wd, lang: "en", register: "usted", firstName: "Maria", includeGreeting: true }], "Hi Maria, can Isaac call you today at 4:30 pm?"],
      [
        ["Isaac is calling you now from (540) 426-1804.", { ...wd, lang: "en", register: "usted", firstName: "Maria", includeGreeting: true }],
        "Hi Maria, Isaac is calling you now from (540) 426-1804.",
      ],
      [["I can help with that.", { ...wd, lang: "en", register: "usted", firstName: "Maria", includeGreeting: true }], "Hi Maria, I can help with that."],
      [["¿Le puede llamar Isaac hoy?", { ...wd, lang: "es", register: "usted", firstName: "María", includeGreeting: true }], "Hola María, ¿le puede llamar Isaac hoy?"],
      [["Usted pidió información.", { ...wd, lang: "es", register: "usted", firstName: null, includeGreeting: true }], "Hola, usted pidió información."],
      [["Thanks", { ...wd, lang: "en", register: "usted", firstName: null, includeStop: true }], "Thanks. Reply STOP to opt out."],
      [
        ["Pick a time here: https://www.isaacplans.com/en/iul/calendar", { ...wd, lang: "en", register: "usted", firstName: null, includeStop: true }],
        "Pick a time here: https://www.isaacplans.com/en/iul/calendar Reply STOP to opt out.",
      ],
      [
        ["Reply STOP to confirm. - Isaac Plans Insurance", { ...wd, lang: "en", register: "usted", firstName: null, includeStop: true }],
        "Reply STOP to confirm. - Isaac Plans Insurance",
      ],
      [["  Can   Isaac call  you?  ", { ...wd, lang: "en", register: "usted", firstName: null }], "Can Isaac call you?"],
      [["Hi Maria, can Isaac call you?", { ...wd, lang: "en", register: "usted", firstName: "Maria", includeGreeting: true }], "Hi Maria, can Isaac call you?"],
      [["¡Listo! Isaac le llamará hoy.", { ...wd, lang: "es", register: "usted", firstName: "María", includeGreeting: true }], "Hola María, ¡listo! Isaac le llamará hoy."],
      [
        ["¿Te puede llamar Isaac hoy?", { ...wd, lang: "es", register: "tu", firstName: "josé", includeDisclosure: true, includeStop: true }],
        "Hola José, te responde el asistente de IA (inteligencia artificial) de Isaac Plans Insurance. ¿Te puede llamar Isaac hoy? Responde STOP para no recibir más mensajes.",
      ],
    ],
    ([body, opts]) => withDisclosure(body, opts)
  );

  section("guard: SMS segments");
  table(
    "smsSegments (GSM-7 vs UCS-2, 160/153 and 70/67, escapes and surrogates never split)",
    [
      ["Hello", { encoding: "GSM-7", segments: 1, units: 5 }],
      ["", { encoding: "GSM-7", segments: 0, units: 0 }],
      ["a".repeat(160), { encoding: "GSM-7", segments: 1, units: 160 }],
      ["a".repeat(161), { encoding: "GSM-7", segments: 2, units: 161 }],
      ["a".repeat(307), { encoding: "GSM-7", segments: 3, units: 307 }],
      ["€", { encoding: "GSM-7", segments: 1, units: 2 }],
      ["a".repeat(152) + "€" + "a".repeat(152), { encoding: "GSM-7", segments: 3, units: 306 }],
      ["á".repeat(70), { encoding: "UCS-2", segments: 1, units: 70 }],
      ["á".repeat(71), { encoding: "UCS-2", segments: 2, units: 71 }],
      ["á".repeat(202), { encoding: "UCS-2", segments: 4, units: 202 }],
      ["😀", { encoding: "UCS-2", segments: 1, units: 2 }],
      ["á".repeat(66) + "😀" + "á".repeat(66), { encoding: "UCS-2", segments: 3, units: 134 }],
    ],
    smsSegments
  );
  table(
    "smsSegments encoding of Spanish/English punctuation",
    [
      ["¿Le puede llamar Isaac mañana a las 10?", "GSM-7"],
      ["José Ñoño ¿¡", "GSM-7"],
      ["Sí, más tarde", "UCS-2"],
      ["You’re all set", "UCS-2"],
    ],
    (s) => smsSegments(s).encoding
  );

  section("guard: model free text");
  const EN = guardCtx("en", "usted");
  const ESU = guardCtx("es", "usted");
  const EST = guardCtx("es", "tu");
  guardTable("brand voice: banned words (registered brand allowed)", [
    ["brand allowed", "Hi, this is Isaac Plans Insurance. Can Isaac call you today at 4:30 pm?", EN, null],
    ["brand possessive", "Isaac Plans Insurance's team can call you today at 4:30 pm.", EN, null],
    ["brand in Spanish", "Isaac Plans Insurance le puede llamar hoy a las 4:30 de la tarde.", ESU, null],
    ["policy", "Isaac can review your policy today at 4:30 pm.", EN, "banned_word:policy"],
    ["policies", "Isaac compares policies.", EN, "banned_word:policies"],
    ["lowercase brand", "isaac plans insurance can call you.", EN, "banned_word:insurance"],
    ["premium", "Your premium depends on age.", EN, "banned_word:premium"],
    ["insured", "Are you insured?", EN, "banned_word:insured"],
    ["underwriting", "Underwriting takes a day.", EN, "banned_word:underwriting"],
    ["poliza", "Isaac revisa su poliza.", ESU, "banned_word:poliza"],
    ["póliza", "Isaac revisa su póliza.", ESU, "banned_word:poliza"],
    ["seguros", "Isaac compara seguros de vida.", ESU, "banned_word:seguros"],
    ["prima", "La prima depende de su edad.", ESU, "banned_word:prima"],
    ["asegurada", "¿Ya está asegurada?", ESU, "banned_word:asegurada"],
  ]);
  guardTable("money and grounded numbers", [
    ["$50", "It's only $50 a month.", EN, "money:$"],
    ["per month", "It's only $50 a month.", EN, "money:per_month"],
    ["ungrounded 50", "It's only $50 a month.", EN, "ungrounded_number:50"],
    ["dólares", "Son unos 40 dólares.", ESU, "money:dolares"],
    ["al mes", "Desde 40 al mes.", ESU, "money:per_month"],
    ["percent", "Save 20% today.", EN, "money:percent"],
    ["por ciento", "Ahorra 20 por ciento.", EST, "money:percent"],
    ["age from the thread", "Since you are 65, Isaac will explain the options today at 4:30 pm.", guardCtx("en", "usted", { threadText: "I'm 65 years old" }), null],
    ["age not in the thread", "Since you are 65, Isaac will call you today at 4:30 pm.", EN, "ungrounded_number:65"],
    ["4:00 when 4:30 was offered", "Can Isaac call you today at 4:00 pm?", EN, "ungrounded_number:4:00"],
    ["offered time", "Can Isaac call you today at 4:30 pm?", EN, null],
    ["4 pm = 4:00", "Can Isaac call you at 4:00 pm?", guardCtx("en", "usted", { offeredSlotLabels: ["today at 4 pm"] }), null],
    ["4 is not 4:30", "Can Isaac call you at 4 pm?", EN, "ungrounded_number:4"],
    ["Isaac's phone", "Isaac will call you from (540) 426-1804 today at 4:30 pm.", EN, null],
    ["another phone", "Isaac will call you from 305-555-0142.", EN, "phone:305•••••42"],
  ]);
  guardTable("register: usted vs tú (enclitics, look-alikes)", [
    ["usted + te", "¿Te puedo llamar hoy a las 4:30?", ESU, "register:te"],
    ["usted + puedes", "¿Puedes hablar hoy a las 4:30?", ESU, "register:puedes"],
    ["usted + tu", "Isaac revisa tu caso hoy a las 4:30.", ESU, "register:tu"],
    ["tú + le puede", "¿Le puede llamar Isaac hoy a las 4:30?", EST, "register:le puede"],
    ["tú + usted", "¿Usted vive en Texas?", EST, "register:usted"],
    ["tú + su", "Isaac revisa su caso.", EST, "register:su"],
    ["usted + llamarte", "¿Isaac puede llamarte hoy a las 4:30?", ESU, "register:llamarte"],
    ["usted + darte", "Para darte el horario correcto, ¿en qué estado vive?", ESU, "register:darte"],
    ["usted + ayudándote", "Isaac sigue ayudándote.", ESU, "register:ayudándote"],
    ["tú + llamarle", "¿Isaac puede llamarle hoy a las 4:30?", EST, "register:llamarle"],
    ["tú + darle", "Para darle el horario correcto, ¿en qué estado vives?", EST, "register:darle"],
    ["suerte / de parte de", "¡Buena suerte! De parte de Isaac, que le llama hoy a las 4:30 de la tarde.", ESU, null],
    ["invierte", "Isaac le explica cómo crece lo que invierte, hoy a las 4:30 de la tarde.", ESU, null],
    ["usted ok", "¿Le puede llamar Isaac hoy a las 4:30 de la tarde?", ESU, null],
    ["tú ok", "¿Te puede llamar Isaac hoy a las 4:30 de la tarde?", EST, null],
  ]);
  guardTable("language", [
    ["English in a Spanish thread", "Can Isaac call you today at 4:30 pm?", ESU, "language:expected_es"],
    ["Spanish in an English thread", "¿Le puede llamar Isaac hoy a las 4:30?", EN, "language:expected_en"],
    ["Spanish without accents", "Hola, le puede llamar Isaac hoy", EN, "language:expected_en"],
    ["English with a Spanish name", "Hi José, can Isaac call you today at 4:30 pm?", guardCtx("en", "usted", { firstName: "José" }), null],
    ["short Spanish", "¡Perfecto, gracias!", ESU, null],
    ["state code LA is not Spanish", "Isaac is licensed in LA, so he can call you today at 4:30 pm.", EN, null],
  ]);
  guardTable("shape: emoji, length, empty, placeholders, names", [
    ["emoji in SMS", "Great! 🙂", EN, "emoji:1 (none allowed in SMS)"],
    ["2 emoji on WhatsApp", "Great! 🙂👍", guardCtx("en", "usted", { channel: "WhatsApp" }), null],
    ["3 emoji on WhatsApp", "Great! 🙂👍🎉", guardCtx("en", "usted", { channel: "WhatsApp" }), "emoji:3 (max 2)"],
    ["ZWJ family is one emoji", "Family 👨‍👩‍👧 ok", EN, "emoji:1 (none allowed in SMS)"],
    ["too long SMS", "word ".repeat(100), guardCtx("en", "usted", { maxSmsSegments: 2 }), "too_long:4 segments (max 2)"],
    ["too long WhatsApp", "word ".repeat(150), guardCtx("en", "usted", { channel: "WhatsApp" }), "too_long:750 chars (max 700)"],
    ["empty", "   ", EN, "empty"],
    ["[Name]", "Hi [Name], can Isaac call you?", EN, "placeholder"],
    ["{slotA}", "Can Isaac call you {slotA}?", EN, "placeholder"],
    ["a name nobody gave", "Hi Carlos, can Isaac call you today at 4:30 pm?", EN, "ungrounded_name:greeting"],
    ["the lead's name", "Hi Maria, can Isaac call you today at 4:30 pm?", EN, null],
    ["a name from the thread", "Hi Carlos, can Isaac call you today at 4:30 pm?", guardCtx("en", "usted", { firstName: null, threadText: "This is Carlos, Maria's husband" }), null],
  ]);
  guardTable("links, emails and phones", [
    ["shortener", "Book here: https://bit.ly/abc", EN, "link:bit.ly"],
    ["allowed link", "You can pick a time here: https://www.isaacplans.com/en/iul/calendar", EN, null],
    ["allowed link, trailing slash + period", "Pick a time here: https://www.isaacplans.com/en/iul/calendar/.", EN, null],
    ["bare domain", "Visit isaacplans.com for more.", EN, "link:isaacplans.com"],
    ["www", "Visit www.example.org now.", EN, "link:www.example.org"],
    ["email", "Write to maria@gmail.com please.", EN, "link:email"],
    ["a.m. is not a link", "Can Isaac call you tomorrow at 10:00 a.m.?", EN, null],
  ]);
  guardTable("never claims to be human (the honest answer passes)", [
    ["I'm Isaac", "Hi, I'm Isaac!", EN, "human_claim:i'm isaac"],
    ["I’m Isaac curly", "Hi, I’m Isaac!", EN, "human_claim:i'm isaac"],
    ["This is Isaac", "This is Isaac.", EN, "human_claim:this is isaac"],
    ["I am Isaac Orraiz", "Yes, I am Isaac Orraiz.", EN, "human_claim:i am isaac"],
    ["Im Isaac", "Im Isaac, can I call you?", EN, "human_claim:im isaac"],
    ["not a bot", "Don't worry, I'm not a bot.", EN, "human_claim:not a bot"],
    ["no soy un robot", "No soy un robot.", ESU, "human_claim:no soy un robot"],
    ["soy Isaac", "Hola, soy Isaac.", ESU, "human_claim:soy isaac"],
    ["a human", "You are talking to a human.", EN, "human_claim:a human"],
    ["Isaac's assistant", "This is Isaac's assistant. Can he call you today at 4:30 pm?", EN, null],
    ["Isaac's AI assistant", "Yes, I'm Isaac's AI assistant. If you'd rather talk to him, reply ISAAC.", EN, null],
    ["curly possessive", "Yes, I’m Isaac’s AI assistant. Reply ISAAC to talk to him.", EN, null],
    ["asistente de IA", "Sí, soy el asistente de IA de Isaac. Si prefiere hablar con él, escriba ISAAC.", ESU, null],
  ]);
  guardTable("no promises, no 'free', no health talk", [
    ["free", "The call is free.", EN, "promise:free"],
    ["Isaac is free", "Isaac is free right now.", EN, null],
    ["feel free", "Feel free to reply here.", EN, null],
    ["he's free", "Let me check if he's free right now.", EN, null],
    ["guaranteed", "You're guaranteed approval.", EN, "promise:guaranteed"],
    ["pre-approved", "You are pre-approved.", EN, "promise:pre-approved"],
    ["qualify", "Let's see what you qualify for.", EN, "promise:qualify"],
    ["garantizado", "Está garantizado.", ESU, "promise:garantizado"],
    ["califica", "Usted califica.", ESU, "promise:califica"],
    ["gratis", "La llamada es gratis.", ESU, "promise:gratis"],
    ["sin costo", "Es sin costo.", ESU, "promise:sin costo"],
    ["diabetes", "Diabetes is fine.", EN, "health:diabetes"],
    ["cáncer", "¿Tuvo cáncer?", ESU, "health:cancer"],
    ["heart attack", "Any heart attack?", EN, "health:heart attack"],
    ["embarazada", "¿Está embarazada?", ESU, "health:embarazada"],
    ["cirugía", "¿Tuvo una cirugía?", ESU, "health:cirugia"],
    ["diagnosed", "Were you diagnosed?", EN, "health:diagnosed"],
  ]);
  const draftCtx = (lang: Lang, register: Register, thread: string) => guardCtx(lang, register, { allowedLinks: [], threadText: thread });
  guardTable("realistic drafts pass", [
    ["spouse", "Claro, es bueno decidirlo juntos. ¿Le parece si Isaac les llama a los dos hoy a las 4:30 de la tarde?", draftCtx("es", "usted", "lo tengo que hablar con mi esposo"), null],
    ["where number", "Usted llenó un formulario en nuestra página pidiendo información. ¿Le puede llamar Isaac mañana a las 10:00 de la mañana?", draftCtx("es", "usted", "¿de dónde sacaron mi número?"), null],
    ["tú price", "¡Buena pregunta! Depende de tu edad y lo que quieras cubrir. ¿Te puede llamar Isaac hoy a las 4:30 de la tarde?", draftCtx("es", "tu", "oye cuanto cuesta"), null],
    ["robot es", "Sí, soy el asistente de IA de Isaac. Si prefiere hablar con él, escriba ISAAC.", draftCtx("es", "usted", "¿es un robot?"), null],
    ["robot en", "Yes, I'm Isaac's AI assistant. If you'd rather talk to him, reply ISAAC.", draftCtx("en", "usted", "is this a bot?"), null],
    ["already covered", "Got it! Isaac can review what you have and see if it still fits. Would today at 4:30 pm work?", draftCtx("en", "usted", "I already have coverage"), null],
    ["after 5", "No problem! Would tomorrow at 10:00 am work, or do you prefer a time after 5?", draftCtx("en", "usted", "after 5 works better"), null],
    ["price en", "Great question! It depends on your age and what you want covered. Can Isaac call you today at 4:30 pm?", draftCtx("en", "usted", "how much is it"), null],
    ["call now en", "Sure thing - let me check if Isaac is free right now.", draftCtx("en", "usted", "call me now"), null],
    ["call now es", "Con gusto, déjeme ver si Isaac está libre ahora mismo.", draftCtx("es", "usted", "llámeme ya"), null],
  ]);
  const curly = guardFreeText("You’re all set — Isaac will call you today at 4:30 pm…", EN);
  check(
    "curly quotes / em dash / ellipsis are warnings only",
    curly.ok && curly.warnings.includes("punctuation:curly_quotes") && curly.warnings.includes("punctuation:em_dash"),
    curly
  );
  eq("autoFixEnglishPunctuation", autoFixEnglishPunctuation("You’re “all set” — Isaac’s call…9–5 ok—now"), "You're \"all set\" - Isaac's call...9-5 ok - now");
  eq("autoFix keeps an English SMS in GSM-7", smsSegments(autoFixEnglishPunctuation("You’re all set — thanks…")).encoding, "GSM-7");

  section("templates: catalog, hashes, every variant");
  eq("23 templates", TEMPLATE_IDS.length, 23);
  check(
    "isTemplateId rejects prototype keys and non-strings",
    isTemplateId("help") && !isTemplateId("__proto__") && !isTemplateId("constructor") && !isTemplateId(5) && !isTemplateId(null)
  );
  eq("compliance templates (never need approval)", TEMPLATE_IDS.filter(isComplianceTemplate), ["help", "optout_confirm", "optout_clarify"]);
  check("every template has EN + ES descriptions", TEMPLATE_IDS.every((id) => TEMPLATE_DESCRIPTIONS[id].en && TEMPLATE_DESCRIPTIONS[id].es));
  const hashes = TEMPLATE_IDS.map((id) => templateHash(id));
  check(
    "hashes: 16 hex chars, stable, unique",
    hashes.every((h) => /^[0-9a-f]{16}$/.test(h)) && TEMPLATE_IDS.every((id, i) => templateHash(id) === hashes[i]) && new Set(hashes).size === hashes.length
  );
  check("catalog: 23 entries × 3 variants with their hash", templateCatalog().length === 23 && templateCatalog().every((c) => c.variants.length === 3 && c.hash === templateHash(c.id)));
  const VARIANTS: Array<[Lang, Register]> = [
    ["en", "usted"],
    ["es", "usted"],
    ["es", "tu"],
  ];
  const sample: Record<Lang, TemplateVars> = {
    en: { slotA: "today at 4:30 pm", slotB: "tomorrow at 10:00 am", when: "tomorrow, Tuesday Nov 18, at 10:00 am", eta: "today before 10 pm" },
    es: {
      slotA: "hoy a las 4:30 de la tarde",
      slotB: "mañana a las 10:00 de la mañana",
      when: "mañana martes 18 de noviembre a las 10:00 de la mañana",
      eta: "hoy antes de las 10 de la noche",
    },
  };
  const varsFor = (lang: Lang, register: Register): TemplateVars => ({
    ...sample[lang],
    topic: topicPhrase("final_expense", lang, register),
    link: "isaacplans.com/es/gastos-finales/calendario",
    agentPhone: "(540) 426-1804",
    agentFullName: "Isaac Orraiz",
    brand: BRAND,
    site: "isaacplans.com",
    vcardUrl: "isaacplans.com/isaac-orraiz.vcf",
  });
  const BANNED = /\b(insurance|insured|insurer|policy|policies|premium|underwriting)\b|(^|[^a-záéíóúñ])(seguros?|pólizas?|polizas?|primas?|asegurad[oa]s?)(?![a-záéíóúñ])/i;
  const problems: Record<string, string[]> = { vars: [], nfc: [], ascii: [], missing: [], braces: [], banned: [], spaces: [], segments: [] };
  for (const id of TEMPLATE_IDS) {
    for (const [lang, register] of VARIANTS) {
      const tag = `${id} ${lang}/${register}`;
      const raw = getTemplateText(id, lang, register);
      const names = [...new Set(Array.from(raw.matchAll(/\{(\w+)\}/g), (m) => m[1]))].sort();
      if (j(names) !== j([...TEMPLATE_META[id].vars].sort())) problems.vars.push(tag);
      if (raw !== raw.normalize("NFC")) problems.nfc.push(tag);
      if (lang === "en" && !/^[\x20-\x7E]*$/.test(raw)) problems.ascii.push(tag);
      const out = renderTemplate(id, lang, register, varsFor(lang, register));
      if (out.missing.length > 0) problems.missing.push(tag);
      if (/[{}]/.test(out.text)) problems.braces.push(tag);
      if (BANNED.test(out.text.split(BRAND).join(" "))) problems.banned.push(tag);
      if (/ {2}/.test(out.text)) problems.spaces.push(tag);
      const first = TEMPLATE_META[id].compliance
        ? out.text
        : withDisclosure(out.text, { lang, register, firstName: lang === "es" ? "María" : "Maria", brand: BRAND, includeDisclosure: true, includeGreeting: true, includeStop: true });
      if (smsSegments(first).segments > 6) problems.segments.push(`${tag}:${smsSegments(first).segments}`);
    }
  }
  check("every variant lists exactly the placeholders in TEMPLATE_META.vars", problems.vars.length === 0, problems.vars);
  check("every variant is NFC; English is plain ASCII", problems.nfc.length === 0 && problems.ascii.length === 0, problems);
  check("every variant renders with nothing missing and no braces left", problems.missing.length === 0 && problems.braces.length === 0, problems);
  check("no banned word in any rendered variant (brand aside)", problems.banned.length === 0, problems.banned);
  // Spanish with accents is UCS-2 (67 characters a part): the longest first messages are 6 parts.
  check("no double spaces; a first message (greeting + disclosure + STOP) is ≤ 6 SMS segments", problems.spaces.length === 0 && problems.segments.length === 0, problems);
  check(
    "ES: a time that starts a sentence is capitalized; 'o' before 'hoy' becomes 'u'",
    renderTemplate("price_redirect", "es", "usted", varsFor("es", "usted")).text.endsWith("¿Hoy a las 4:30 de la tarde o mañana a las 10:00 de la mañana?") &&
      renderTemplate("offer_times", "es", "usted", { slotA: "hoy a las 11:00 de la mañana", slotB: "hoy a las 6:00 de la tarde" }).text ===
        "¿Le puede llamar Isaac hoy a las 11:00 de la mañana u hoy a las 6:00 de la tarde?" &&
      renderTemplate("info_redirect", "es", "tu", { slotA: "hoy a las 2:00", slotB: "hoy a las 7:30" }).text.endsWith("¿Hoy a las 2:00 u hoy a las 7:30?")
  );
  check(
    "EN: capital at a sentence start",
    renderTemplate("price_redirect", "en", "usted", varsFor("en", "usted")).text.endsWith("call. Today at 4:30 pm or tomorrow at 10:00 am?")
  );
  eq("a blank value stays as {name} and is listed as missing (callers never send it)", renderTemplate("offer_times", "en", "usted", { slotA: "today at 4 pm", slotB: "  " }), {
    text: "Can Isaac call you today at 4 pm or {slotB}?",
    missing: ["slotB"],
  });
  eq(
    "HELP text (brand, agent, phone, site, STOP)",
    renderTemplate("help", "en", "usted", varsFor("en", "usted")).text,
    "Isaac Plans Insurance: Isaac Orraiz, licensed agent. Call (540) 426-1804 or visit isaacplans.com. Reply STOP to opt out."
  );
  const composedBad: string[] = [];
  for (const id of ["offer_times", "who_is_this", "call_now_unavailable"] as TemplateId[]) {
    for (const [lang, register] of VARIANTS) {
      const v = varsFor(lang, register);
      const body = renderTemplate(id, lang, register, v).text;
      const text = withDisclosure(body, {
        lang,
        register,
        firstName: lang === "es" ? "María" : "Maria",
        brand: BRAND,
        includeDisclosure: true,
        includeGreeting: true,
        includeStop: true,
      });
      // The guard checks the words before the code adds the notice + STOP (those trip self_notice).
      const r = guardFreeText(body, guardCtx(lang, register, { offeredSlotLabels: [v.slotA ?? "", v.slotB ?? ""], maxSmsSegments: 6 }));
      if (!r.ok) composedBad.push(`${id} ${lang}/${register}: ${r.violations.join(", ")}`);
      const segments = smsSegments(text).segments;
      if (segments > 6) composedBad.push(`${id} ${lang}/${register}: composed ${segments} segments`);
    }
  }
  check("composed first messages (offer_times, who_is_this, call_now_unavailable): bodies pass the guard, ≤ 6 segments composed", composedBad.length === 0, composedBad);
}

// ═══ availability ════════════════════════════════════════════════════════════════════════════

function availabilityTests(): void {
  const S = DEFAULT_SCHEDULE;
  const d = (iso: string) => new Date(iso);
  const ev = (start: string, end: string | null, status = "confirmed"): AppointmentRef => ({
    id: start,
    calendarId: "c",
    contactId: null,
    startTime: d(start),
    endTime: end ? d(end) : null,
    status,
    title: null,
  });

  section("availability: schedule parsing and validation");
  table(
    "parseHHMM",
    [
      ["09:00", 540],
      ["24:00", 1440],
      ["9:30", 570],
      [" 10:15 ", 615],
      ...["24:01", "12:60", "25:00", "abc", "", "1:5", "123:00", "-1:00"].map((s) => [s, null] as const),
    ],
    (s) => {
      const n = parseHHMM(s);
      return Number.isNaN(n) ? null : n;
    }
  );
  eq("DEFAULT_SCHEDULE is valid and survives a JSON round trip", [validateSchedule(S), validateSchedule(JSON.parse(JSON.stringify(S)))], [S, S]);
  const base = (days: Record<string, unknown>, timeZone: unknown = NY) => ({ timeZone, days: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], ...days } });
  eq(
    "validateSchedule sorts, pads and merges touching windows",
    validateSchedule(base({ 1: [{ start: "21:30", end: "24:00" }, { start: "9:00", end: "12:00" }, { start: "12:00", end: "14:00", x: 1 }] }))?.days[1],
    [
      { start: "09:00", end: "14:00" },
      { start: "21:30", end: "24:00" },
    ]
  );
  const missing = JSON.parse(JSON.stringify(S)) as { days: Record<string, unknown> };
  delete missing.days["3"];
  table<unknown, boolean>(
    "validateSchedule rejects bad input",
    [
      [base({ 2: [{ start: "09:00", end: "12:00" }, { start: "11:00", end: "13:00" }] }), false],
      [base({ 2: Array.from({ length: 7 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })) }), false],
      [base({ 2: Array.from({ length: 6 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })) }), true],
      [missing, false],
      [base({ 1: [{ start: "09:00", end: "24:30" }] }), false],
      [base({ 1: [{ start: "09:00", end: "09:00" }] }), false],
      [base({ 1: [{ start: "10:00", end: "09:00" }] }), false],
      [base({}, "Mars/Base"), false],
      [base({}, "+05:00"), false],
      ["x", false],
      [null, false],
      [base({ 4: { start: "09:00", end: "10:00" } }), false],
      [base({ 4: [{ start: 900, end: 1000 }] }), false],
      [{ timeZone: NY, days: [[], [], [], [], [], [], []] }, true],
    ],
    (input) => validateSchedule(input) !== null
  );
  eq("validateSchedule trims the zone", validateSchedule(base({}, " America/Chicago "))?.timeZone, CHI);
  table(
    "isValidTimeZone",
    [
      [NY, true],
      ["america/los_angeles", true],
      ["+05:00", false],
      ["", false],
    ],
    isValidTimeZone
  );

  section("availability: DST-safe local time");
  eq("zonedParts at local midnight", zonedParts(d("2026-11-18T05:00:00Z"), NY), { year: 2026, month: 11, day: 18, weekday: 3, hour: 0, minute: 0 });
  eq("fall-back: both 1:30s read as hour 1", [zonedParts(d("2026-11-01T05:30:00Z"), NY).hour, zonedParts(d("2026-11-01T06:30:00Z"), NY).hour], [1, 1]);
  eq("an invalid zone reads as Isaac's", zonedParts(d("2026-11-18T05:00:00Z"), "Nope/Nope"), zonedParts(d("2026-11-18T05:00:00Z"), NY));
  table<[string, number, string], string>(
    "zonedTimeToDate (repeated hour → earlier, skipped hour → forward, 24:00 = next midnight)",
    [
      [["2026-11-01", 90, NY], "2026-11-01T05:30:00.000Z"],
      [["2027-03-14", 150, NY], "2027-03-14T07:30:00.000Z"],
      [["2027-03-14", 1440, NY], "2027-03-15T04:00:00.000Z"],
      [["2026-11-01", 1440, NY], "2026-11-02T05:00:00.000Z"],
      [["2026-11-18", 540, LA], "2026-11-18T17:00:00.000Z"],
      [["2026-11-18", 540, "Nope"], "2026-11-18T14:00:00.000Z"],
    ],
    ([date, minute, zone]) => {
      const [year, month, day] = date.split("-").map(Number);
      return zonedTimeToDate({ year, month, day }, minute, zone).toISOString();
    }
  );
  const night = { timeZone: NY, days: { 0: [{ start: "00:00", end: "03:00" }], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
  const spring = { timeZone: NY, days: { 0: [{ start: "01:00", end: "04:00" }], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
  const touching = { timeZone: NY, days: { 0: [], 1: [{ start: "12:00", end: "14:00" }, { start: "09:00", end: "12:00" }], 2: [], 3: [], 4: [], 5: [], 6: [] } };
  table<[string, number, typeof S], boolean>(
    "isWithinSchedule (default hours, DST weekends, midnight, touching windows)",
    [
      [["2026-11-01T09:00:00-05:00", 30, S], true],
      [["2026-11-01T08:30:00-05:00", 30, S], false],
      [["2026-11-01T23:30:00-05:00", 30, S], true],
      [["2026-11-01T23:30:00-05:00", 60, S], false],
      [["2026-10-31T22:30:00-04:00", 30, S], true],
      [["2026-10-31T22:00:00-04:00", 30, S], false],
      [["2027-03-14T09:00:00-04:00", 30, S], true],
      [["2027-03-14T08:30:00-04:00", 30, S], false],
      [["2026-11-23T13:30:00-05:00", 30, S], true],
      [["2026-11-23T13:45:00-05:00", 30, S], false],
      [["2026-11-23T14:00:00-05:00", 30, S], false],
      [["2026-11-23T21:30:00-05:00", 30, S], true],
      [["2026-11-23T21:00:00-05:00", 30, S], false],
      [["2026-11-23T10:00:00-05:00", 0, S], false],
      [["2026-11-01T01:30:00-05:00", 60, night], true],
      [["2026-11-01T02:30:00-05:00", 30, night], true],
      [["2026-11-01T02:30:00-05:00", 60, night], false],
      [["2027-03-14T01:30:00-05:00", 90, spring], true],
      [["2027-03-14T01:30:00-05:00", 120, spring], false],
      [["2027-03-14T03:30:00-04:00", 30, spring], true],
      [["2026-11-23T11:30:00-05:00", 60, touching], true],
    ],
    ([iso, minutes, schedule]) => isWithinSchedule(d(iso), minutes, schedule)
  );
  check("isWithinSchedule(invalid date) is false; an invalid schedule zone reads as Isaac's", !isWithinSchedule(new Date(Number.NaN), 30, S) && isWithinSchedule(d("2026-11-23T10:00:00-05:00"), 30, { ...S, timeZone: "nope" }));

  section("availability: is Isaac free now");
  const avail = (now: string, extra: Partial<Parameters<typeof isIsaacAvailableNow>[0]> = {}) =>
    isIsaacAvailableNow({ now: d(now), schedule: S, busyUntil: null, events: [], ...extra });
  const mon10 = "2026-11-23T10:00:00-05:00";
  table<[string, Partial<Parameters<typeof isIsaacAvailableNow>[0]>], boolean>(
    "isIsaacAvailableNow (15 min left, busy-until, ±30 min around events, cancelled ignored)",
    [
      [[mon10, {}], true],
      [["2026-11-23T13:45:00-05:00", {}], true],
      [["2026-11-23T13:50:00-05:00", {}], false],
      [["2026-11-23T15:00:00-05:00", {}], false],
      [[mon10, { busyUntil: d("2026-11-23T11:00:00-05:00") }], false],
      [[mon10, { busyUntil: d("2026-11-23T09:00:00-05:00") }], true],
      [[mon10, { busyUntil: new Date(Number.NaN) }], false],
      [[mon10, { events: [ev("2026-11-23T10:20:00-05:00", "2026-11-23T10:50:00-05:00")] }], false],
      [[mon10, { events: [ev("2026-11-23T10:30:00-05:00", "2026-11-23T11:00:00-05:00")] }], false],
      [[mon10, { events: [ev("2026-11-23T10:31:00-05:00", "2026-11-23T11:00:00-05:00")] }], true],
      [[mon10, { events: [ev("2026-11-23T09:00:00-05:00", "2026-11-23T09:30:00-05:00")] }], true],
      [[mon10, { events: [ev("2026-11-23T09:00:00-05:00", "2026-11-23T09:31:00-05:00")] }], false],
      [[mon10, { events: [ev(mon10, null, "Cancelled")] }], true],
      [[mon10, { events: [ev(mon10, null, "invalid")] }], true],
      [[mon10, { bufferMinutes: 0, events: [ev("2026-11-23T10:10:00-05:00", null)] }], true],
    ],
    ([now, extra]) => avail(now, extra)
  );

  section("availability: which slots can be offered");
  const nowMon = d(mon10);
  const fs = (slotsIso: string[], leadZone: string, extra: Partial<Parameters<typeof filterSlots>[0]> = {}) =>
    filterSlots({ slotsIso, schedule: S, leadZone, now: nowMon, minNoticeMinutes: 60, durationMinutes: 30, busy: [], ...extra });
  type FsCase = [string[], string, Partial<Parameters<typeof filterSlots>[0]>];
  table<FsCase, string[]>(
    "filterSlots (Isaac's windows × lead 9–9 local, notice, horizon, :00/:30, busy, dedup)",
    [
      [[["2026-11-23T21:30:00-05:00"], LA, {}], ["2026-11-23T21:30:00-05:00"]],
      [[["2026-11-23T21:30:00-05:00"], NY, {}], []],
      [[["2026-11-23T21:30:00-05:00"], NY, { leadHours: null }], ["2026-11-23T21:30:00-05:00"]],
      [[["2026-11-23T23:30:00-05:00"], LA, {}], ["2026-11-23T23:30:00-05:00"]],
      [[["2026-11-23T23:30:00-05:00"], LA, { durationMinutes: 60 }], []],
      [[["2026-11-23T21:30:00-05:00"], CHI, {}], ["2026-11-23T21:30:00-05:00"]],
      [[["2026-11-23T22:00:00-05:00"], CHI, {}], []],
      [[["2026-11-24T09:00:00-05:00"], LA, {}], []],
      [[["2026-11-24T12:00:00-05:00"], LA, {}], ["2026-11-24T12:00:00-05:00"]],
      [[["2026-11-23T14:00:00-05:00"], NY, {}], []],
      [[["2026-11-23T10:30:00-05:00", "2026-11-23T11:00:00-05:00"], NY, {}], ["2026-11-23T11:00:00-05:00"]],
      [[["2026-11-30T10:00:00-05:00", "2026-11-30T10:30:00-05:00"], NY, {}], ["2026-11-30T10:00:00-05:00"]],
      [[["2026-11-24T10:00:00-05:00", "2026-11-26T10:30:00-05:00"], NY, { horizonDays: 2 }], ["2026-11-24T10:00:00-05:00"]],
      [[["2026-11-23T11:15:00-05:00", "2026-11-23T11:30:30-05:00", "2026-11-23T11:30:00-05:00"], NY, {}], ["2026-11-23T11:30:00-05:00"]],
      [
        [["2026-11-24T02:30:00Z", "garbage", "2026-11-23T21:30:00", "2026-11-23T21:30:00-05:00", "2026-11-23T12:00:00-0500"], LA, {}],
        ["2026-11-23T12:00:00-0500", "2026-11-24T02:30:00Z"],
      ],
      [
        [["2026-11-23T21:30:00-05:00", "2026-11-23T22:00:00-05:00"], LA, { busy: [ev("2026-11-23T21:00:00-05:00", "2026-11-23T22:00:00-05:00")] }],
        ["2026-11-23T22:00:00-05:00"],
      ],
      [[["2026-11-23T21:30:00-05:00"], LA, { busy: [ev("2026-11-23T21:00:00-05:00", "2026-11-23T22:00:00-05:00", "cancelled")] }], ["2026-11-23T21:30:00-05:00"]],
      [[["2026-11-23T21:30:00-05:00", "2026-11-23T22:00:00-05:00"], LA, { busy: [ev("2026-11-23T21:30:00-05:00", null)] }], ["2026-11-23T22:00:00-05:00"]],
      [[["2026-11-23T21:30:00-05:00"], NY, { leadHours: { start: "x", end: "y" } }], []],
      [[["2026-11-23T21:30:00-05:00"], NY, { leadHours: { start: "08:00", end: "22:00" } }], ["2026-11-23T21:30:00-05:00"]],
      [[["2026-11-23T11:00:00-05:00"], NY, { durationMinutes: 0 }], []],
    ],
    ([slots, zone, extra]) => fs(slots, zone, extra)
  );
  eq("LEAD_HOURS 9 am – 9 pm", LEAD_HOURS, { start: "09:00", end: "21:00" });
  const sunday = Array.from({ length: 32 }, (_, i) => {
    const minutes = 8 * 60 + i * 30;
    return `2026-11-22T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00-05:00`;
  });
  const nowSat = d("2026-11-21T12:00:00-05:00");
  const sunEt = filterSlots({ slotsIso: sunday, schedule: S, leadZone: NY, now: nowSat, minNoticeMinutes: 60, durationMinutes: 30, busy: [] });
  const sunPt = filterSlots({ slotsIso: sunday, schedule: S, leadZone: LA, now: nowSat, minNoticeMinutes: 60, durationMinutes: 30, busy: [] });
  eq("Sunday all day: ET lead 9:00–20:30, PT lead 12:00–23:30 ET (24 each)", [sunEt[0], sunEt.at(-1), sunEt.length, sunPt[0], sunPt.at(-1), sunPt.length], [
    "2026-11-22T09:00:00-05:00",
    "2026-11-22T20:30:00-05:00",
    24,
    "2026-11-22T12:00:00-05:00",
    "2026-11-22T23:30:00-05:00",
    24,
  ]);
  const fall = ["2026-11-01T08:30:00-05:00", "2026-11-01T09:00:00-05:00", "2026-11-01T20:30:00-05:00", "2026-11-01T21:00:00-05:00"];
  const springSlots = ["2027-03-14T08:30:00-04:00", "2027-03-14T09:00:00-04:00", "2027-03-14T23:30:00-04:00"];
  const dstRun = (slots: string[], zone: string, now: string) =>
    filterSlots({ slotsIso: slots, schedule: S, leadZone: zone, now: d(now), minNoticeMinutes: 60, durationMinutes: 30, busy: [] });
  eq(
    "DST Sundays: fall-back ET lead / spring-forward PT lead / spring-forward ET lead",
    [dstRun(fall, NY, "2026-10-31T12:00:00-04:00"), dstRun(springSlots, LA, "2027-03-13T12:00:00-05:00"), dstRun(springSlots, NY, "2027-03-13T12:00:00-05:00")],
    [["2026-11-01T09:00:00-05:00", "2026-11-01T20:30:00-05:00"], ["2027-03-14T23:30:00-04:00"], ["2027-03-14T09:00:00-04:00"]]
  );

  section("availability: the lead's preference and the two times");
  table<[string, string], string>(
    "partOfDay (lead-local)",
    [
      [["2026-11-24T11:30:00-05:00", NY], "morning"],
      [["2026-11-24T12:00:00-05:00", NY], "afternoon"],
      [["2026-11-24T16:30:00-05:00", NY], "afternoon"],
      [["2026-11-24T17:00:00-05:00", NY], "evening"],
      [["2026-11-23T21:30:00-05:00", LA], "evening"],
      [["nope", NY], "morning"],
    ],
    ([iso, zone]) => partOfDay(iso, zone)
  );
  const tue = ["2026-11-24T09:00:00-05:00", "2026-11-24T12:00:00-05:00", "2026-11-24T16:30:00-05:00", "2026-11-24T17:00:00-05:00", "2026-11-25T10:00:00-05:00"];
  type PrefCase = [Parameters<typeof applyPreference>[1], string, string[]];
  table<PrefCase, string[]>(
    "applyPreference (after/before/part/weekday/date, junk ignored)",
    [
      [[{ afterLocal: "17:00" }, NY, tue], ["2026-11-24T17:00:00-05:00"]],
      [[{ beforeLocal: "12:00" }, NY, tue], ["2026-11-24T09:00:00-05:00", "2026-11-25T10:00:00-05:00"]],
      [[{ partOfDay: "afternoon" }, NY, tue], ["2026-11-24T12:00:00-05:00", "2026-11-24T16:30:00-05:00"]],
      [[{ weekdays: [3] }, NY, tue], ["2026-11-25T10:00:00-05:00"]],
      [[{ dateLocal: "2026-11-25" }, NY, tue], ["2026-11-25T10:00:00-05:00"]],
      [[{ afterLocal: "17:00" }, LA, ["2026-11-23T21:30:00-05:00", "2026-11-23T13:00:00-05:00"]], ["2026-11-23T21:30:00-05:00"]],
      [[null, NY, [...tue, "junk"]], tue],
      [[{ afterLocal: "5pm" }, NY, tue], tue],
      [[{ weekdays: [] }, NY, tue], tue],
    ],
    ([pref, zone, slots]) => applyPreference(slots, pref, zone)
  );
  const nowTue = d("2026-11-17T10:00:00-05:00");
  const half = (date: string, from: string, to: string) => {
    const outSlots: string[] = [];
    for (let m = parseHHMM(from); m <= parseHHMM(to); m += 30) {
      outSlots.push(`${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00-05:00`);
    }
    return outSlots;
  };
  const tueDay = half("2026-11-17", "11:00", "20:30");
  type PickCase = [string[], Parameters<typeof pickTwoSlots>[1]];
  table<PickCase, string[]>(
    "pickTwoSlots (earliest + another part of day / later day / evening when the lead works)",
    [
      [[tueDay, { now: nowTue, leadZone: NY }], ["2026-11-17T11:00:00-05:00", "2026-11-17T13:00:00-05:00"]],
      [[tueDay, { now: nowTue, leadZone: NY, leadWorks: true }], ["2026-11-17T11:00:00-05:00", "2026-11-17T17:00:00-05:00"]],
      [[tueDay, { now: nowTue, leadZone: NY, exclude: ["2026-11-17T16:00:00Z"] }], ["2026-11-17T11:30:00-05:00", "2026-11-17T13:30:00-05:00"]],
      [[tueDay, { now: nowTue, leadZone: NY, exclude: ["2026-11-17T13:00:00-05:00"] }], ["2026-11-17T11:00:00-05:00", "2026-11-17T13:30:00-05:00"]],
      [[["2026-11-17T11:00:00-05:00"], { now: nowTue, leadZone: NY }], ["2026-11-17T11:00:00-05:00"]],
      [[[], { now: nowTue, leadZone: NY }], []],
      [[half("2026-11-17", "09:00", "11:30"), { now: nowTue, leadZone: NY }], ["2026-11-17T09:00:00-05:00", "2026-11-17T11:00:00-05:00"]],
      [[half("2026-11-17", "09:00", "10:00"), { now: nowTue, leadZone: NY }], ["2026-11-17T09:00:00-05:00", "2026-11-17T10:00:00-05:00"]],
      [
        [["2026-11-17T20:30:00-05:00", "2026-11-18T09:00:00-05:00", "2026-11-18T09:30:00-05:00"], { now: nowTue, leadZone: NY }],
        ["2026-11-17T20:30:00-05:00", "2026-11-18T09:00:00-05:00"],
      ],
      [[half("2026-11-17", "17:00", "20:30"), { now: nowTue, leadZone: NY, leadWorks: true }], ["2026-11-17T17:00:00-05:00", "2026-11-17T19:00:00-05:00"]],
      [
        [[...half("2026-11-17", "11:00", "12:00"), "2026-11-21T18:00:00-05:00", "2026-11-18T09:00:00-05:00"], { now: nowTue, leadZone: NY, leadWorks: true }],
        ["2026-11-17T11:00:00-05:00", "2026-11-18T09:00:00-05:00"],
      ],
      [
        [["2026-11-23T12:00:00-05:00", "2026-11-23T13:30:00-05:00", "2026-11-23T21:30:00-05:00"], { now: nowMon, leadZone: LA, leadWorks: true }],
        ["2026-11-23T12:00:00-05:00", "2026-11-23T21:30:00-05:00"],
      ],
      [[[...tueDay].reverse(), { now: nowTue, leadZone: NY }], ["2026-11-17T11:00:00-05:00", "2026-11-17T13:00:00-05:00"]],
    ],
    ([slots, input]) => pickTwoSlots(slots, input)
  );

  section("availability: zone labels and wording");
  table<string, [string, string]>(
    "zoneLabel EN/ES",
    [
      [NY, ["Eastern", "del Este"]],
      ["America/Detroit", ["Eastern", "del Este"]],
      ["America/Indiana/Indianapolis", ["Eastern", "del Este"]],
      ["America/Indiana/Knox", ["Central", "del Centro"]],
      ["America/Kentucky/Louisville", ["Eastern", "del Este"]],
      [CHI, ["Central", "del Centro"]],
      ["America/North_Dakota/Beulah", ["Central", "del Centro"]],
      [DEN, ["Mountain", "de la Montaña"]],
      ["America/Phoenix", ["Mountain", "de la Montaña"]],
      [LA, ["Pacific", "del Pacífico"]],
      ["US/Pacific", ["Pacific", "del Pacífico"]],
      ["America/Anchorage", ["Alaska", "de Alaska"]],
      ["Pacific/Honolulu", ["Hawaii", "de Hawái"]],
      ["America/Puerto_Rico", ["Atlantic", "del Atlántico"]],
      ["Europe/Madrid", ["Madrid", "de Madrid"]],
      ["Foo/Bar", ["Eastern", "del Este"]],
    ],
    (zone) => [zoneLabel(zone, "en"), zoneLabel(zone, "es")]
  );
  table<[string, Parameters<typeof shouldShowZone>[1]], boolean>(
    "shouldShowZone (Eastern from GHL/address hidden; area code, none, other zones shown)",
    [
      [[NY, "ghl"], false],
      [[NY, "address"], false],
      [[NY, "area_code"], true],
      [[NY, "none"], true],
      [["America/Detroit", "ghl"], false],
      [[LA, "ghl"], true],
      [["America/Indiana/Knox", "ghl"], true],
      [["Foo/Bar", "ghl"], true],
    ],
    ([zone, source]) => shouldShowZone(zone, source)
  );
  const nowText = d("2026-11-17T12:00:00-05:00");
  table<string, [string, string]>(
    "formatSlotForText EN/ES (today, tomorrow, weekday, date; 12-h clock; ES 'la 1', mediodía, noche)",
    [
      ["2026-11-17T16:30:00-05:00", ["today at 4:30pm", "hoy a las 4:30 de la tarde"]],
      ["2026-11-18T10:00:00-05:00", ["tomorrow at 10am", "mañana a las 10 de la mañana"]],
      ["2026-11-19T21:30:00-05:00", ["Thursday at 9:30pm", "el jueves a las 9:30 de la noche"]],
      ["2026-11-23T10:00:00-05:00", ["Monday at 10am", "el lunes a las 10 de la mañana"]],
      ["2026-11-24T10:00:00-05:00", ["Tue, Nov 24 at 10am", "el martes 24 de nov. a las 10 de la mañana"]],
      ["2026-11-18T13:00:00-05:00", ["tomorrow at 1pm", "mañana a la 1 de la tarde"]],
      ["2026-11-18T12:00:00-05:00", ["tomorrow at 12pm", "mañana a las 12 del mediodía"]],
      ["2026-11-18T19:30:00-05:00", ["tomorrow at 7:30pm", "mañana a las 7:30 de la tarde"]],
      ["2026-11-18T20:00:00-05:00", ["tomorrow at 8pm", "mañana a las 8 de la noche"]],
      ["2026-11-18T00:00:00-05:00", ["tomorrow at 12am", "mañana a las 12 de la noche"]],
      ["junk", ["junk", "junk"]],
    ],
    (iso) => [
      formatSlotForText(iso, { lang: "en", leadZone: NY, now: nowText, showZone: false }),
      formatSlotForText(iso, { lang: "es", leadZone: NY, now: nowText, showZone: false }),
    ]
  );
  eq(
    "formatSlotForText with the zone, and a Pacific lead's 'today' past midnight ET",
    [
      formatSlotForText("2026-11-17T16:30:00-05:00", { lang: "en", leadZone: LA, now: nowText, showZone: true }),
      formatSlotForText("2026-11-17T16:30:00-05:00", { lang: "es", leadZone: LA, now: nowText, showZone: true }),
      formatSlotForText("2026-11-17T21:30:00-05:00", { lang: "es", leadZone: NY, now: nowText, showZone: true }),
      formatSlotForText("2026-11-18T02:30:00-05:00", { lang: "en", leadZone: LA, now: nowText, showZone: false }),
    ],
    ["today at 1:30pm (Pacific time)", "hoy a la 1:30 de la tarde (hora del Pacífico)", "hoy a las 9:30 de la noche (hora del Este)", "today at 11:30pm"]
  );
  const appt = "2026-11-18T16:30:00-05:00";
  eq(
    "formatAppointmentForText (always the date; su/tu hora)",
    [
      formatAppointmentForText(appt, { lang: "en", register: "usted", leadZone: NY, now: nowText }),
      formatAppointmentForText(appt, { lang: "es", register: "usted", leadZone: NY, now: nowText }),
      formatAppointmentForText(appt, { lang: "es", register: "tu", leadZone: NY, now: nowText }),
      formatAppointmentForText(appt, { lang: "es", register: "usted", leadZone: LA, now: nowText }),
    ],
    [
      "Wed, Nov 18 at 4:30pm (your time)",
      "el miércoles 18 de nov. a las 4:30 de la tarde (su hora)",
      "el miércoles 18 de nov. a las 4:30 de la tarde (tu hora)",
      "el miércoles 18 de nov. a la 1:30 de la tarde (su hora)",
    ]
  );
  const noon = { timeZone: NY, days: { 0: [], 1: [{ start: "12:00", end: "13:00" }], 2: [], 3: [], 4: [], 5: [], 6: [] } };
  const empty = { timeZone: NY, days: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
  table<[string, string, Lang, typeof S], string>(
    "formatEta (shortly / today before … in the lead's zone / midnight / weekday / ASAP)",
    [
      [["2026-11-23T10:00:00-05:00", NY, "en", S], "shortly"],
      [["2026-11-23T10:00:00-05:00", NY, "es", S], "en breve"],
      [["2026-11-23T15:00:00-05:00", NY, "en", S], "today before 11pm"],
      [["2026-11-23T15:00:00-05:00", NY, "es", S], "hoy antes de las 11 de la noche"],
      [["2026-11-23T15:00:00-05:00", CHI, "en", S], "today before 10pm"],
      [["2026-11-23T15:00:00-05:00", LA, "en", S], "today before 8pm"],
      [["2026-11-21T13:30:00-05:00", NY, "es", S], "hoy antes de la medianoche"],
      [["2026-11-23T01:00:00-05:00", NY, "en", S], "today before 10am"],
      [["2026-11-22T23:50:00-05:00", NY, "es", S], "mañana antes de las 10 de la mañana"],
      [["2026-11-23T10:00:00-05:00", NY, "es", noon], "hoy antes de la 1 de la tarde"],
      [["2026-11-25T10:00:00-05:00", NY, "en", noon], "Monday before 1pm"],
      [["2026-11-23T10:00:00-05:00", NY, "es", empty], "lo antes posible"],
    ],
    ([now, zone, lang, schedule]) => formatEta({ now: d(now), schedule, lang, leadZone: zone })
  );
  const week: string[] = [];
  for (let day = 0; day < 8; day++) {
    for (let i = 0; i < 48; i++) week.push(new Date(Date.parse("2026-11-17T05:00:00Z") + day * DAY + i * 30 * MIN).toISOString());
  }
  const preview = slotsByZone({ slotsIso: week, schedule: S, now: nowText, zones: [NY, CHI, DEN, LA], durationMinutes: 30, minNoticeMinutes: 60, busy: [] });
  eq("settings preview: 12 labels per zone, ES zone names", preview.map((p) => [p.zone, p.labelEs, p.slots.length]), [
    [NY, "del Este", 12],
    [CHI, "del Centro", 12],
    [DEN, "de la Montaña", 12],
    [LA, "del Pacífico", 12],
  ]);
  const bad = new Date(Number.NaN);
  check(
    "never throws on an invalid 'now'",
    filterSlots({ slotsIso: tueDay, schedule: S, leadZone: NY, now: bad, minNoticeMinutes: 60, durationMinutes: 30, busy: [] }).length === 0 &&
      formatEta({ now: bad, schedule: S, lang: "es", leadZone: NY }) === "lo antes posible" &&
      formatSlotForText("2026-11-18T10:00:00-05:00", { lang: "en", leadZone: NY, now: bad, showZone: false }) === "Wed, Nov 18 at 10am" &&
      !isIsaacAvailableNow({ now: bad, schedule: S, busyUntil: null, events: [] }) &&
      formatSlotForText("2026-11-17T16:30:00-05:00", { lang: "en", leadZone: "x", now: nowText, showZone: true }) === "today at 4:30pm (Eastern time)"
  );
}

// ═══ context, prompt, tools (static), text utils, product ════════════════════════════════════

function contextAndToolStaticTests(): void {
  section("text-utils: phones, language, masking");
  table<string | null, string | null>(
    "toE164Nanp (strict NANP, never 'the last 10 digits')",
    [
      ["+13055550142", "+13055550142"],
      ["(305) 555-0142", "+13055550142"],
      ["1-305-555-0142", "+13055550142"],
      ["3055550142", "+13055550142"],
      ["+15005550145", "+15005550145"],
      ["1234567890", null],
      ["3051550142", null],
      ["+44 20 7946 0958", null],
      ["555-0142", null],
      ["12345678901234", null],
      ["", null],
      [null, null],
    ],
    toE164Nanp
  );
  table<string, Lang | null>(
    "detectMessageLanguage (null when it can't tell; Spanglish by majority)",
    [
      ["¿Cuánto cuesta?", "es"],
      ["How much does it cost?", "en"],
      ["ok", null],
      ["5pm", null],
      ["Hi, how much? quiero info para mi mamá, gracias", "es"],
      ["Can you call me tomorrow? gracias", "en"],
    ],
    detectMessageLanguage
  );
  table(
    "maskForModel (links, emails, phones, long digit runs; times survive)",
    [
      ["Mi correo es ana.ejemplo@example.com", "Mi correo es [email]"],
      ["Llámeme al +1 305-555-0142", "Llámeme al [phone]"],
      ["mi póliza 1234 5678 9012", "mi póliza [number]"],
      ["vea https://example.com/x?y=1 o www.example.org", "vea [link] o [link]"],
      ["a las 4:30 o 5pm, el 18", "a las 4:30 o 5pm, el 18"],
    ],
    (s) => maskForModel(s)
  );
  check("maskForModel cuts at maxChars with an ellipsis; clip collapses spaces", maskForModel("x".repeat(20), 10) === `${"x".repeat(10)}…` && clip("  a   b  ", 10) === "a b" && clip("abcdef", 4) === "abc…");
  check(
    "maskForModel keeps the space before a phone without a country code",
    maskForModel("Llámeme al (305) 555-0142") === "Llámeme al [phone]",
    maskForModel("Llámeme al (305) 555-0142")
  );

  section("product: lines, language, calendars, links");
  table<[string[], string | null], string>(
    "productFromSignals (call line of business first, then tags in order)",
    [
      [[["ai_setter", "Final Expense Lead"], null], "final_expense"],
      [[["iul_guia_funnel"], null], "iul"],
      [[["aca lead", "final expense lead"], null], "final_expense"],
      [[["referral partner lead"], null], "health_alternative"],
      [[["final expense lead"], "aca"], "aca"],
      [[["nothing"], "unknown_lob"], "general"],
    ],
    ([tags, lob]) => productFromSignals(tags, lob)
  );
  check("languageFromTags: an exact 'spanish' tag", languageFromTags([" Spanish "]) === "es" && languageFromTags(["spanish-ish"]) === "en" && languageFromTags([]) === "en");
  check(
    "every product has EN+ES calendar ids (20 chars) and /en/ /es/ booking paths",
    Object.values(CALENDAR_IDS).every((c) => /^[A-Za-z0-9]{20}$/.test(c.en) && /^[A-Za-z0-9]{20}$/.test(c.es)) &&
      Object.values(BOOKING_PATHS).every((p) => p.en.startsWith("/en/") && p.es.startsWith("/es/")) &&
      calendarIdFor(null, "es") === CALENDAR_IDS.general.es
  );
  const brandWords = /\b(insurance|policy|premium|seguro|p[oó]liza|prima)\b/i;
  check(
    "topic phrases never use banned words; tú/usted forms differ where needed",
    (["aca", "short_term_medical", "dental_vision", "hospital_indemnity", "final_expense", "iul", "life_insurance", "health_alternative", "general"] as const).every(
      (p) => !brandWords.test(topicPhrase(p, "en", null)) && !brandWords.test(topicPhrase(p, "es", "usted")) && !brandWords.test(topicPhrase(p, "es", "tu"))
    ) && topicPhrase("general", "es", "tu") === "tus opciones de cobertura"
  );
  const ports = new World().ports;
  const tv = templateVars(ports, "iul", "es", "usted", null);
  check(
    "templateVars / allowedLinks: site host without www, vCard, the product+language booking page, Isaac's number",
    tv.site === "isaacplans.com" &&
      tv.vcardUrl === "isaacplans.com/isaac-orraiz.vcf" &&
      tv.link === "isaacplans.com/es/iul/calendario" &&
      tv.agentPhone === "(540) 426-1804" &&
      tv.brand === BRAND &&
      tv.when === undefined &&
      allowedLinks(ports, "iul", "es").includes("https://www.isaacplans.com/es/iul/calendario"),
    tv
  );

  section("prompt and tool definitions");
  const config = getAiSetterConfig(envOf());
  const system = buildSystemPrompt(config);
  check("system prompt is byte-identical across calls (prompt cache) and carries no lead data", system === buildSystemPrompt(config) && !/\d{3}/.test(system) && !/[{}]/.test(system));
  const terminalTools = ["reply_with_template", "draft_reply", "request_call_now", "handoff_to_isaac", "mark_not_interested", "mark_opt_out", "end_without_reply"];
  check("system prompt names the brand, Isaac and every terminal tool", system.includes(BRAND) && system.includes("Isaac Orraiz") && terminalTools.every((t) => system.includes(t)));
  const names = TOOL_DEFS.map((t) => t.name);
  eq("12 tools, unique names", [names.length, new Set(names).size], [12, 12]);
  const notStrict = TOOL_DEFS.filter((t) => {
    const s = t.inputSchema as { type?: string; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
    const props = Object.keys(s.properties ?? {}).sort();
    return s.type !== "object" || s.additionalProperties !== false || j([...(s.required ?? [])].sort()) !== j(props);
  });
  check("every tool schema is strict-compatible (object, additionalProperties false, all properties required)", notStrict.length === 0, notStrict.map((t) => t.name));
  check(
    "terminal tools say TERMINAL; no tool takes a contact, calendar, user, phone or channel id",
    terminalTools.every((n) => TOOL_DEFS.find((t) => t.name === n)?.description.startsWith("TERMINAL.")) &&
      !TOOL_DEFS.some((t) => /contact_?id|calendar_?id|user_?id|phone|channel/i.test(Object.keys((t.inputSchema as { properties?: object }).properties ?? {}).join(" ")))
  );
  const replyEnum = ((TOOL_DEFS.find((t) => t.name === "reply_with_template")?.inputSchema as { properties: { template_id: { enum: string[] } } }).properties.template_id.enum);
  check(
    "reply_with_template offers exactly MODEL_TEMPLATE_IDS: real templates, never HELP / opt-out / holds",
    j(replyEnum) === j([...MODEL_TEMPLATE_IDS]) &&
      MODEL_TEMPLATE_IDS.every((id) => isTemplateId(id) && !isComplianceTemplate(id)) &&
      !["handoff_hold", "media_received", "call_now_checking", "call_now_calling"].some((id) => (MODEL_TEMPLATE_IDS as readonly string[]).includes(id))
  );
  check("MAX_LLM_CALLS_PER_TURN is 4 (two tool steps, the reply, one regeneration)", MAX_LLM_CALLS_PER_TURN === 4);

  section("context: what the model sees");
  const now = new Date("2026-11-17T15:00:00Z");
  const at = (m: number) => new Date(now.getTime() - m * MIN);
  const msgs: ThreadMessage[] = [
    tmsg({ id: "w1", direction: "outbound", dateAdded: at(60), source: "workflow", body: "Hola, gracias por su interés" }),
    tmsg({ id: "i1", direction: "inbound", dateAdded: at(50), body: "Mi número es (305) 555-0142 y mi correo ana.ejemplo@example.com, vean https://example.com" }),
    tmsg({ id: "ai1", direction: "outbound", dateAdded: at(40), source: "api", body: "¿Le puede llamar Isaac hoy?" }),
    tmsg({ id: "h1", direction: "outbound", dateAdded: at(30), source: "app", body: "Soy Isaac" }),
    tmsg({ id: "c1", direction: "outbound", dateAdded: at(25), channel: "Call", messageType: "TYPE_CALL", body: "" }),
    tmsg({ id: "e1", direction: "inbound", dateAdded: at(20), channel: "Email", messageType: "TYPE_EMAIL", body: "EMAIL BODY" }),
    tmsg({ id: "a1", direction: "inbound", dateAdded: at(10), body: "", attachmentKinds: ["audio"] }),
  ];
  const rendered = renderThread(msgs, { ourGhlIds: new Set(["ai1"]), isaacUserId: null, leadZone: NY, now });
  check(
    "renderThread: who wrote each line (automation / lead / ai / isaac), calls as markers, email left out, media noted",
    rendered.includes("· SMS · automation] Hola") &&
      rendered.includes("· SMS · ai] ¿Le puede") &&
      rendered.includes("· SMS · isaac] Soy Isaac") &&
      rendered.includes("(isaac called)") &&
      !rendered.includes("EMAIL BODY") &&
      rendered.includes("[audio]"),
    rendered
  );
  check("renderThread masks phones, emails and links in the lead's words", rendered.includes("[phone]") && rendered.includes("[email]") && rendered.includes("[link]") && !rendered.includes("555-0142"), rendered);
  const many = Array.from({ length: 20 }, (_, i) => tmsg({ direction: "inbound", dateAdded: at(100 - i), body: `msg ${i}` }));
  const last15 = renderThread(many, { ourGhlIds: new Set(), isaacUserId: null, leadZone: NY, now }).split("\n");
  check("renderThread keeps the last 15 messages", last15.length === 15 && last15[0].endsWith("msg 5") && last15[14].endsWith("msg 19"));
  const facts: TurnFacts = {
    now,
    channel: "WhatsApp",
    lang: "es",
    register: "usted",
    firstName: "Lucia",
    product: "final_expense",
    topic: topicPhrase("final_expense", "es", "usted"),
    leadZone: NY,
    zoneSource: "ghl",
    stateCode: "NY",
    license: "not_licensed",
    isaacFreeNow: false,
    nextIsaacWindow: "today before 10pm",
    upcomingAppointment: null,
    liveOffers: [{ id: "A", startIso: "2026-11-17T16:30:00-05:00", label: "hoy a las 4:30 de la tarde" }],
    rejections: 1,
    lastCall: { disposition: "no_answer", lineOfBusiness: "final_expense", language: "es", followUpDateIso: new Date("2026-11-20T00:00:00Z"), at: at(2 * 24 * 60) },
    whatsappWindowOpen: true,
    callNowOutcome: "timeout",
    callNowActive: null,
    callNowUsedToday: true,
  };
  const factText = renderFacts(facts);
  check(
    "renderFacts: license NO, WhatsApp window, live offers, last call as enums only, call-now follow-up",
    factText.includes("licensed_state: NO") &&
      factText.includes("channel: WhatsApp (window open: yes)") &&
      factText.includes('A = "hoy a las 4:30 de la tarde"') &&
      factText.includes("outcome no_answer, follow-up agreed for 2026-11-20") &&
      factText.includes("call_now_followup: Isaac could not call") &&
      factText.includes("call_now already used today"),
    factText
  );
  const user = buildUserContent(facts, rendered);
  check("user content = <facts> + <thread oldest_first> + the turn instruction", user.startsWith("<facts>\n") && user.includes('<thread oldest_first="true">') && user.endsWith(TURN_INSTRUCTION));
  const refreshed = refreshOfferLabels(
    [
      { id: "A", startIso: "2026-11-17T09:00:00-05:00", label: "old" },
      { id: "B", startIso: "2026-11-18T11:00:00-05:00", label: "hoy a las 11 de la mañana" },
    ],
    { lang: "es", leadZone: NY, now, showZone: false }
  );
  eq("refreshOfferLabels drops past offers and re-words the rest for 'now'", refreshed, [{ id: "B", startIso: "2026-11-18T11:00:00-05:00", label: "mañana a las 11 de la mañana" }]);
  check(
    "needsDisclosure: first message, after 7 days, per channel",
    needsDisclosure(leadRecord({ disclosedChannels: {} }), "SMS", now) &&
      !needsDisclosure(leadRecord({ disclosedChannels: { SMS: at(6 * 24 * 60).toISOString() } }), "SMS", now) &&
      needsDisclosure(leadRecord({ disclosedChannels: { SMS: at(8 * 24 * 60).toISOString() } }), "SMS", now) &&
      needsDisclosure(leadRecord({ disclosedChannels: { SMS: at(60).toISOString() } }), "WhatsApp", now)
  );

  section("telegram: button presses (callback_query)");
  eq(
    "normalizeUpdate(callback_query)",
    normalizeUpdate({ update_id: 7, callback_query: { id: "cbq1", from: { id: 99 }, message: { message_id: 5, chat: { id: 123 } }, data: "ais:a:aim_0001" } }),
    { kind: "callback_query", updateId: "7", callbackQueryId: "cbq1", fromId: "99", chatId: "123", messageId: "5", data: "ais:a:aim_0001" }
  );
  check(
    "callback without an id is ignored; without a message it keeps nulls",
    normalizeUpdate({ update_id: 8, callback_query: { from: { id: 1 } } }).kind === "other" &&
      j(normalizeUpdate({ update_id: 9, callback_query: { id: "x" } })) === j({ kind: "callback_query", updateId: "9", callbackQueryId: "x", fromId: null, chatId: null, messageId: null, data: "" })
  );
}

// ═══ core purity: the engine never reaches the DB or a server-only module ═══════════════════

function purityTests(): void {
  section("purity: the core imports no DB and no server-only module");
  const root = path.resolve(__dirname, "..");
  const core = [
    "turn",
    "send",
    "outbound",
    "tools",
    "context",
    "prompts",
    "compliance",
    "classify",
    "availability",
    "area-codes",
    "templates",
    "guard",
    "ui-strings",
    "config",
    "product",
    "types",
    "text-utils",
    "log",
    "ghl",
    "llm",
  ].map((f) => path.join(root, "lib", "ai-setter", `${f}.ts`));
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), base]) if (existsSync(candidate) && candidate.endsWith(".ts")) return candidate;
    return null;
  };
  const seen = new Set<string>();
  const offenders: string[] = [];
  const queue = [...core];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const specs = [
      ...Array.from(src.matchAll(/^\s*import\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm), (m) => m[1]),
      ...Array.from(src.matchAll(/^\s*export\s+(?!type\b)[^"';]*?\s+from\s+["']([^"']+)["']/gm), (m) => m[1]),
      ...Array.from(src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (m) => m[1]),
    ];
    for (const spec of specs) {
      if (spec === "server-only") offenders.push(`${rel} imports server-only`);
      if (/^@\/lib\/db(?:\/|$)/.test(spec) || /(?:^|\/)lib\/db(?:\/index)?$/.test(spec)) offenders.push(`${rel} imports ${spec}`);
      const next = resolve(file, spec);
      if (next) queue.push(next);
    }
  }
  check(`${core.length} core modules (+${seen.size - core.length} reached) import no lib/db and no server-only`, offenders.length === 0, offenders);
}

// ═══ ghl adapter (fake fetch) ════════════════════════════════════════════════════════════════

type FetchCall = { method: string; url: string; version: string | null; contentType: string | null; auth: string | null; body: unknown };
type FetchReply = { status: number; json?: unknown; throwName?: string };
type FetchRoute = (call: FetchCall) => FetchReply | undefined;

function fakeFetch(routes: FetchRoute[], calls: FetchCall[]) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const call: FetchCall = {
      method: init?.method ?? "GET",
      url: input.replace("https://services.leadconnectorhq.com", ""),
      version: headers.get("Version"),
      contentType: headers.get("Content-Type"),
      auth: headers.get("Authorization"),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    for (const route of routes) {
      const r = route(call);
      if (!r) continue;
      if (r.throwName) {
        const e = new Error(r.throwName);
        e.name = r.throwName;
        throw e;
      }
      return new Response(r.json === undefined ? "" : JSON.stringify(r.json), { status: r.status });
    }
    return new Response(JSON.stringify({ statusCode: 404, message: "no route" }), { status: 404 });
  };
}

async function ghlTests(): Promise<void> {
  const C1 = "c1AAAAAAAAAAAAAAAAAA";
  const route =
    (method: string, test: (url: string) => boolean, reply: FetchReply | ((c: FetchCall) => FetchReply)): FetchRoute =>
    (c) =>
      c.method === method && test(c.url) ? (typeof reply === "function" ? reply(c) : reply) : undefined;
  const port = (routes: FetchRoute[], calls: FetchCall[]) => createAiSetterGhlPort({ token: "tok_FAKE", locationId: "LOC123", fetchImpl: fakeFetch(routes, calls) });

  section("ghl: parsers");
  const contactJson = {
    contact: {
      id: C1,
      locationId: "LOC123",
      firstName: " Lucia ",
      lastName: "",
      phone: "+13055550142",
      email: "lucia.ejemplo@example.com",
      tags: ["ai_setter", { name: "spanish" }, "  ", 5],
      timezone: NY,
      state: "FL",
      postalCode: "33101",
      source: "web",
      dnd: false,
      dndSettings: {
        SMS: { status: "inactive" },
        sms: { status: "active" },
        whatsApp: { status: "permanent", message: "x" },
        Email: { status: "bogus" },
        GMB: "x",
        Call: { status: "inactive" },
        constructor: { status: "active" },
      },
      dateAdded: "2026-11-01T12:00:00.000Z",
    },
  };
  const c = parseContact(contactJson);
  check(
    "parseContact: wrapped, trimmed, tags as strings or {name}, timezone, date",
    c !== null && c.id === C1 && c.firstName === "Lucia" && c.lastName === null && j(c.tags) === j(["ai_setter", "spanish"]) && c.timezone === NY && c.dateAdded?.toISOString() === "2026-11-01T12:00:00.000Z",
    c
  );
  eq("parseContact DND: mixed key casing, the stricter wins, junk ignored", c?.dndChannels, { SMS: "active", WhatsApp: "permanent", Call: "inactive" });
  const bare = parseContact({ id: "x1AAAAAAAAAA", timezone: "Mars/Olympus", dnd: true });
  check("parseContact: bare object, invalid zone → null, dnd flag; no id → null", bare?.timezone === null && bare?.dnd === true && parseContact({ contact: { firstName: "A" } }) === null && parseContact(null) === null);
  const nested = {
    messages: {
      lastMessageId: "m3",
      nextPage: true,
      messages: [
        { id: "m1", conversationId: "conv1", direction: "inbound", messageType: "TYPE_SMS", body: "Hola", attachments: [], dateAdded: "2026-11-17T15:00:00.000Z", status: "delivered" },
        { id: "m2", direction: "outbound", type: 19, body: "Hi", dateAdded: "2026-11-17T14:00:00.000Z", source: "app", userId: "u1", attachments: ["https://x/voice.ogg?x=1", { url: "https://x/file", contentType: "image/jpeg" }] },
        { id: "m3", direction: "outbound", messageType: "TYPE_INTERNAL_COMMENT", body: "internal", dateAdded: "2026-11-17T13:00:00.000Z" },
        { id: "m4", messageType: "TYPE_SMS", body: "no direction", dateAdded: "2026-11-17T12:00:00.000Z" },
        { id: "m1", direction: "inbound", messageType: "TYPE_SMS", body: "dup", dateAdded: "2026-11-17T15:00:00.000Z" },
        { id: "m5", direction: "INBOUND", type: 99, dateAdded: 1763380000000 },
      ],
    },
  };
  const msgs = parseMessages(nested, "convX");
  const m2 = msgs.find((m) => m.id === "m2");
  const m5 = msgs.find((m) => m.id === "m5");
  check(
    "parseMessages: oldest first; internal comments, no-direction and duplicates dropped",
    j(msgs.map((m) => m.id)) === j(["m5", "m2", "m1"]),
    msgs.map((m) => m.id)
  );
  check(
    "parseMessages: numeric type 19 = WhatsApp, attachment kinds, fallback conversation id, unknown type → Other",
    m2?.messageType === "TYPE_WHATSAPP" &&
      m2.channel === "WhatsApp" &&
      j(m2.attachmentKinds) === j(["audio", "image"]) &&
      m2.conversationId === "convX" &&
      m5?.channel === "Other" &&
      m5.direction === "inbound" &&
      m5.dateAdded.getTime() === 1763380000000
  );
  check("parseMessages: flat page shape; garbage → []", parseMessages({ messages: [{ id: "f1", direction: "outbound", messageType: "TYPE_CALL", dateAdded: "2026-11-17T10:00:00Z" }] }, "c").length === 1 && parseMessages({ messages: "x" }, "c").length === 0);
  table(
    "channelOfMessageType",
    [
      ["TYPE_SMS", "SMS"],
      ["TYPE_CUSTOM_SMS", "SMS"],
      ["TYPE_SMS_REVIEW_REQUEST", "SMS"],
      ["TYPE_WHATSAPP", "WhatsApp"],
      ["TYPE_EMAIL", "Email"],
      ["TYPE_FB_MESSENGER", "FB"],
      ["TYPE_INSTAGRAM_COMMENT", "IG"],
      ["TYPE_WEBCHAT", "Live_Chat"],
      ["TYPE_CALL", "Call"],
      ["TYPE_VOICEMAIL", "Call"],
      ["TYPE_ACTIVITY_APPOINTMENT", "Activity"],
      ["TYPE_CAMPAIGN_SMS", "Other"],
      ["", "Other"],
      ["WhatsApp", "WhatsApp"],
      [" type_sms ", "SMS"],
    ],
    channelOfMessageType
  );
  table<[string, string | null | undefined], string>(
    "attachmentKindOf (content type first, then the extension)",
    [
      [["https://a/b/c.MP3", undefined], "audio"],
      [["https://a/b.jpeg?sig=1#x", null], "image"],
      [["https://a/v.mov", undefined], "video"],
      [["https://a/doc.pdf", undefined], "document"],
      [["https://a/noext", undefined], "other"],
      [["https://a/noext", "audio/ogg; codecs=opus"], "audio"],
      [["https://a/x.jpg", "application/octet-stream"], "image"],
      [["https://a/x.webm", "audio/webm"], "audio"],
      [["https://a/x.webm", undefined], "video"],
    ],
    ([url, type]) => attachmentKindOf(url, type)
  );
  eq(
    "parseFreeSlots: every day's slots, de-duplicated, sorted, junk dropped",
    parseFreeSlots({
      "2026-11-18": { slots: ["2026-11-18T10:00:00-05:00", "2026-11-18T09:30:00-05:00"] },
      "2026-11-19": { slots: ["2026-11-19T10:00:00-05:00", 5, "bad"] },
      traceId: "t1",
      "2026-11-20": { slots: ["2026-11-18T10:00:00-05:00"] },
    }),
    ["2026-11-18T09:30:00-05:00", "2026-11-18T10:00:00-05:00", "2026-11-19T10:00:00-05:00"]
  );
  const events = parseEvents({
    events: [
      { id: "e1", calendarId: "cal1", status: "booked", appointmentStatus: "confirmed", startTime: "2026-11-20 15:00:00", endTime: "2026-11-20 15:30:00", contactId: C1 },
      { id: "e2", calendarId: "cal1", status: "booked", appoinmentStatus: "Cancelled", startTime: "2026-11-19 10:00:00" },
      { id: "e3", deleted: true, startTime: "2026-11-19T10:00:00-05:00" },
      { id: "e4" },
      { id: "e5", startTime: "2026-11-21T10:00:00-05:00" },
    ],
  });
  check(
    "parseEvents: deleted / no start dropped, sorted, naive times as UTC, legacy status key, unknown status",
    j(events.map((e) => `${e.id}:${e.status}`)) === j(["e2:cancelled", "e1:confirmed", "e5:unknown"]) && events[1].startTime.toISOString() === "2026-11-20T15:00:00.000Z",
    events
  );
  table<[number, unknown], string>(
    "classifySendFailure (429 retry later; 401/403 scope; DND wording; other 4xx invalid; 0/5xx/2xx-without-id unknown)",
    [
      [[0, null], "unknown"],
      [[200, {}], "unknown"],
      [[503, null], "unknown"],
      [[429, { message: "Too many requests" }], "rejected:rate_limited"],
      [[401, {}], "rejected:scope"],
      [[403, { message: "DND" }], "rejected:scope"],
      [[400, { message: "Cannot send message as DND is active for SMS." }], "rejected:dnd"],
      [[422, { message: ["Contact has opted out"] }], "rejected:dnd"],
      [[400, { message: "Contact unsubscribed from SMS" }], "rejected:dnd"],
      [[400, { message: "Bad Request" }], "rejected:invalid"],
      [[404, {}], "rejected:invalid"],
      [[409, { message: "DND" }], "rejected:invalid"],
    ],
    ([status, json]) => {
      const o = classifySendFailure(status, json);
      return o.kind === "rejected" ? `rejected:${o.reason}` : o.kind;
    }
  );

  section("ghl: port over a fake fetch (versions, bodies, failures)");
  {
    const calls: FetchCall[] = [];
    const r = await port([route("GET", (u) => u === `/contacts/${C1}`, { status: 200, json: contactJson })], calls).getContact(C1);
    check("getContact: GET, Version 2021-07-28, no Content-Type, our Bearer token", r.ok && calls.length === 1 && calls[0].version === "2021-07-28" && calls[0].contentType === null && calls[0].auth === "Bearer tok_FAKE");
    const other = await port([route("GET", () => true, { status: 200, json: { contact: { id: C1, locationId: "OTHER" } } })], calls).getContact(C1);
    check("getContact: another location → failure, not retryable", !other.ok && other.error === "location_mismatch" && !other.retryable);
    const outcomes: Array<[FetchReply, number, boolean, string]> = [
      [{ status: 404, json: { message: "Contact not found +13055550142" } }, 404, false, "http_404"],
      [{ status: 429, json: {} }, 429, true, "http_429"],
      [{ status: 502 }, 502, true, "http_502"],
      [{ status: 0, throwName: "TimeoutError" }, 0, true, "timeout"],
      [{ status: 0, throwName: "TypeError" }, 0, true, "network"],
      [{ status: 200, json: { contact: {} } }, 200, false, "invalid_response"],
    ];
    const badOutcomes: unknown[] = [];
    for (const [reply, status, retryable, error] of outcomes) {
      const res = await port([route("GET", () => true, reply)], calls).getContact(C1);
      if (res.ok || res.status !== status || res.retryable !== retryable || res.error !== error) badOutcomes.push({ error, res });
    }
    check("getContact failures: status, retryable, our own error code (never GHL's body)", badOutcomes.length === 0, badOutcomes);
    const before = calls.length;
    const invalid = await port([], calls).getContact("../etc");
    check("an invalid id never reaches GHL", !invalid.ok && invalid.error === "invalid_id" && calls.length === before);
  }
  {
    const now = Date.now();
    const ago = (ms: number) => new Date(now - ms).toISOString();
    const threadRoutes = (convB?: FetchReply): FetchRoute[] => [
      route("GET", (u) => u.startsWith("/conversations/search?"), {
        status: 200,
        json: {
          conversations: [
            { id: "convOld", contactId: C1, lastMessageDate: now - 60 * DAY },
            { id: "convA", contactId: C1, lastMessageDate: now - 60 * MIN },
            { id: "convOther", contactId: "someoneElse00000000", lastMessageDate: now },
            { id: "convB", contactId: C1, lastMessageDate: ago(90 * MIN) },
          ],
        },
      }),
      route("GET", (u) => u.startsWith("/conversations/convA/messages") && !u.includes("lastMessageId"), {
        status: 200,
        json: {
          messages: {
            lastMessageId: "a2",
            nextPage: true,
            messages: [
              { id: "a1", direction: "inbound", messageType: "TYPE_SMS", body: "si", dateAdded: ago(60 * MIN), conversationId: "convA" },
              { id: "a3", direction: "outbound", messageType: "TYPE_ACTIVITY_APPOINTMENT", body: "Appointment", dateAdded: ago(80 * MIN) },
              { id: "a2", direction: "outbound", messageType: "TYPE_SMS", source: "workflow", body: "Hola", dateAdded: ago(120 * MIN) },
            ],
          },
        },
      }),
      route("GET", (u) => u.startsWith("/conversations/convA/messages") && u.includes("lastMessageId=a2"), {
        status: 200,
        json: {
          messages: {
            lastMessageId: "a5",
            nextPage: true,
            messages: [
              { id: "a4", direction: "inbound", messageType: "TYPE_WHATSAPP", body: "audio", dateAdded: ago(10 * DAY), attachments: ["https://s/v.ogg"] },
              { id: "a5", direction: "inbound", messageType: "TYPE_SMS", body: "old", dateAdded: ago(40 * DAY) },
            ],
          },
        },
      }),
      route("GET", (u) => u.includes("lastMessageId=a5"), { status: 500 }),
      route(
        "GET",
        (u) => u.startsWith("/conversations/convB/messages"),
        convB ?? {
          status: 200,
          json: {
            messages: {
              lastMessageId: "b2",
              nextPage: false,
              messages: [
                { id: "b1", direction: "outbound", messageType: "TYPE_CALL", body: "", dateAdded: ago(90 * MIN), userId: "isaac" },
                { id: "b2", direction: "outbound", messageType: "TYPE_INTERNAL_COMMENT", body: "note", dateAdded: ago(95 * MIN) },
                { id: "a1", direction: "inbound", messageType: "TYPE_SMS", body: "si", dateAdded: ago(60 * MIN) },
              ],
            },
          },
        }
      ),
    ];
    const calls: FetchCall[] = [];
    const r = await port(threadRoutes(), calls).listMessages(C1, { limit: 50, sinceDays: 30 });
    check(
      "listMessages: all conversations merged oldest first; cutoff, internal comments and duplicates out",
      r.ok && j(r.value.map((m) => m.id)) === j(["a4", "a2", "b1", "a3", "a1"]),
      r.ok ? r.value.map((m) => m.id) : r
    );
    const urls = calls.map((x) => x.url);
    check(
      "listMessages: one search, never old or foreign conversations, page 2 by cursor, stops at the cutoff, Version 2021-04-15",
      urls[0] === `/conversations/search?locationId=LOC123&contactId=${C1}&limit=20` &&
        !urls.some((u) => u.includes("convOld") || u.includes("convOther")) &&
        urls.includes("/conversations/convA/messages?limit=100&lastMessageId=a2") &&
        !urls.some((u) => u.includes("lastMessageId=a5")) &&
        calls.every((x) => x.version === "2021-04-15" && x.contentType === null),
      urls
    );
    const limited = await port(threadRoutes(), []).listMessages(C1, { limit: 2, sinceDays: 30 });
    check("listMessages limit 2: the newest 2 real messages, activity rides along", limited.ok && j(limited.value.map((m) => m.id)) === j(["b1", "a3", "a1"]));
    const failed503 = await port(threadRoutes({ status: 503 }), []).listMessages(C1, { limit: 50, sinceDays: 30 });
    check("listMessages: one conversation failing fails the read (retryable)", !failed503.ok && failed503.status === 503 && failed503.retryable);
  }
  {
    const calls: FetchCall[] = [];
    const p = port([route("POST", (u) => u === "/conversations/messages", { status: 201, json: { conversationId: "conv1", messageId: "msg1", msg: "Message queued successfully." } })], calls);
    const r = await p.sendMessage({ contactId: C1, channel: "SMS", text: "Hola" });
    const w = await p.sendMessage({ contactId: C1, channel: "WhatsApp", text: "Hi" });
    check(
      "sendMessage: exact body, Version 2021-04-15, JSON; WhatsApp type",
      j(r) === j({ kind: "sent", messageId: "msg1", conversationId: "conv1" }) &&
        j(calls[0].body) === j({ type: "SMS", contactId: C1, message: "Hola" }) &&
        calls[0].version === "2021-04-15" &&
        calls[0].contentType === "application/json" &&
        w.kind === "sent" &&
        (calls[1].body as { type: string }).type === "WhatsApp"
    );
    const noId = await port([route("POST", () => true, { status: 200, json: { msg: "ok" } })], calls).sendMessage({ contactId: C1, channel: "SMS", text: "x" });
    const dnd = await port([route("POST", () => true, { status: 400, json: { message: "Cannot send message as DND is active for SMS." } })], calls).sendMessage({ contactId: C1, channel: "SMS", text: "x" });
    const timeout = await port([route("POST", () => true, { status: 0, throwName: "TimeoutError" })], calls).sendMessage({ contactId: C1, channel: "SMS", text: "x" });
    const before = calls.length;
    const blank = await port([], calls).sendMessage({ contactId: C1, channel: "SMS", text: "   " });
    check(
      "sendMessage outcomes: 2xx without id → unknown, DND → rejected dnd, timeout → unknown, blank → rejected without a request",
      j(noId) === j({ kind: "unknown", status: 200 }) &&
        j(dnd) === j({ kind: "rejected", status: 400, reason: "dnd" }) &&
        j(timeout) === j({ kind: "unknown", status: 0 }) &&
        j(blank) === j({ kind: "rejected", status: 0, reason: "invalid" }) &&
        calls.length === before
    );
  }
  {
    const calls: FetchCall[] = [];
    const start = Date.UTC(2026, 10, 18, 5);
    const end = start + 40 * DAY;
    const cut = start + 31 * DAY;
    const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "+00:00");
    const p = port(
      [
        route("GET", (u) => u.includes(`startDate=${start}&`), { status: 200, json: { a: { slots: [iso(start - 30 * MIN), iso(start + 60 * MIN)] }, traceId: "t" } }),
        route("GET", (u) => u.includes(`startDate=${cut}&`), { status: 200, json: { b: { slots: [iso(end), iso(end - 60 * MIN), iso(start + 60 * MIN)] } } }),
      ],
      calls
    );
    const r = await p.getFreeSlots({ calendarId: "calXYZ", startMs: start, endMs: end, timeZone: NY, userId: "U1" });
    check(
      "getFreeSlots: split into ≤31-day chunks, zone + user passed, window filtered (end exclusive), de-duplicated",
      calls.length === 2 &&
        calls[0].url === `/calendars/calXYZ/free-slots?startDate=${start}&endDate=${cut}&timezone=America%2FNew_York&userId=U1` &&
        calls[1].url.includes(`startDate=${cut}&endDate=${end}&`) &&
        r.ok &&
        j(r.value) === j([iso(start + 60 * MIN), iso(end - 60 * MIN)]) &&
        calls.every((x) => x.version === "2021-04-15"),
      { urls: calls.map((x) => x.url), r }
    );
    const inverted = await port([], calls).getFreeSlots({ calendarId: "calXYZ", startMs: end, endMs: start, timeZone: "UTC", userId: null });
    check("getFreeSlots: an inverted range is refused locally", !inverted.ok && inverted.error === "invalid_range");
  }
  {
    const calls: FetchCall[] = [];
    const p = port(
      [
        route("GET", (u) => u.startsWith("/calendars/events?"), {
          status: 200,
          json: {
            events: [
              { id: "ev2", calendarId: "calB", startTime: "2026-11-19T10:00:00-05:00", appointmentStatus: "confirmed", deleted: false },
              { id: "ev1", calendarId: "calA", contactId: "c9", startTime: "2026-11-18T14:00:00-05:00", endTime: "2026-11-18T14:30:00-05:00", appointmentStatus: "cancelled" },
              { id: "evDel", calendarId: "calA", startTime: "2026-11-18T09:00:00-05:00", deleted: true },
            ],
          },
        }),
      ],
      calls
    );
    const r = await p.listUserEvents({ userId: "U1", startMs: 1763442000000, endMs: 1763528400000 });
    check(
      "listUserEvents: Isaac's events on every calendar, sorted, deleted dropped",
      calls[0].url === "/calendars/events?locationId=LOC123&userId=U1&startTime=1763442000000&endTime=1763528400000" && r.ok && j(r.value.map((e) => `${e.id}:${e.status}`)) === j(["ev1:cancelled", "ev2:confirmed"])
    );
  }
  {
    const calls: FetchCall[] = [];
    const routes = (readBack503 = false): FetchRoute[] => [
      route("GET", (u) => u === `/contacts/${C1}/appointments`, {
        status: 200,
        json: {
          events: [
            { id: "evNaive1", calendarId: "cal1", appointmentStatus: "booked", startTime: "2026-11-20 15:00:00", endTime: "2026-11-20 15:30:00", contactId: C1 },
            { id: "evExact", calendarId: "cal2", status: "booked", startTime: "2026-11-21T10:00:00-05:00", contactId: C1 },
            { id: "evGone", calendarId: "cal1", status: "booked", startTime: "2026-11-22 09:00:00" },
          ],
        },
      }),
      route(
        "GET",
        (u) => u === "/calendars/events/appointments/evNaive1",
        readBack503
          ? { status: 503 }
          : {
              status: 200,
              json: { event: { id: "evNaive1", calendarId: "cal1", contactId: C1, startTime: "2026-11-20T15:00:00-05:00", endTime: "2026-11-20T15:30:00-05:00", appointmentStatus: "confirmed", title: "Llamada" } },
            }
      ),
      route("GET", (u) => u === "/calendars/events/appointments/evGone", { status: 200, json: { event: { id: "evGone", deleted: true, startTime: "2026-11-22T09:00:00-05:00" } } }),
    ];
    const r = await port(routes(), calls).listContactAppointments(C1);
    const n1 = r.ok ? r.value.find((e) => e.id === "evNaive1") : undefined;
    check(
      "listContactAppointments: zone-less times re-read exactly, deleted ones dropped, exact ones untouched",
      r.ok &&
        j(r.value.map((e) => e.id)) === j(["evNaive1", "evExact"]) &&
        n1?.startTime.toISOString() === "2026-11-20T20:00:00.000Z" &&
        n1.status === "confirmed" &&
        !calls.some((x) => x.url.endsWith("/evExact")) &&
        calls[0].version === "2021-07-28" &&
        calls.slice(1).every((x) => x.version === "2021-04-15"),
      r
    );
    const transient = await port(routes(true), []).listContactAppointments(C1);
    check("listContactAppointments: a transient read-back failure is a retryable failure", !transient.ok && transient.status === 503 && transient.retryable);
  }
  {
    const input = {
      calendarId: "cal1",
      contactId: C1,
      startIso: "2026-11-20T15:00:00-05:00",
      endIso: "2026-11-20T15:30:00-05:00",
      title: "Llamada con Isaac",
      description: "Agendada por el asistente",
      assignedUserId: "U1",
    };
    const calls: FetchCall[] = [];
    const p = port(
      [
        route("POST", (u) => u === "/calendars/events/appointments", {
          status: 201,
          json: { id: "apt1", calendarId: "cal1", contactId: C1, startTime: "2026-11-20T15:00:00-05:00", endTime: "2026-11-20T15:30:00-05:00", appointmentStatus: "confirmed" },
        }),
      ],
      calls
    );
    const r = await p.createAppointment(input);
    await p.createAppointment({ ...input, assignedUserId: null });
    check(
      "createAppointment: confirmed, phone, toNotify, Isaac assigned, free-slot validation ON; no assignedUserId when null",
      r.ok &&
        r.value.id === "apt1" &&
        r.value.startTime.toISOString() === "2026-11-20T20:00:00.000Z" &&
        j(calls[0].body) ===
          j({
            calendarId: "cal1",
            locationId: "LOC123",
            contactId: C1,
            startTime: input.startIso,
            endTime: input.endIso,
            title: input.title,
            description: input.description,
            appointmentStatus: "confirmed",
            assignedUserId: "U1",
            meetingLocationType: "phone",
            overrideLocationConfig: true,
            toNotify: true,
            ignoreFreeSlotValidation: false,
          }) &&
        !("assignedUserId" in (calls[1].body as object)),
      calls[0].body
    );
    const failures: Array<[FetchReply, boolean, boolean, string]> = [
      [{ status: 400, json: { message: "The slot you have selected is no longer available." } }, true, false, "http_400"],
      [{ status: 422, json: { message: ["startTime must be a valid ISO 8601 date string"] } }, false, false, "http_422"],
      [{ status: 409, json: { message: "Conflict" } }, true, false, "http_409"],
      [{ status: 0, throwName: "TimeoutError" }, false, true, "timeout"],
      [{ status: 500 }, false, true, "http_500"],
    ];
    const badFailures: unknown[] = [];
    for (const [reply, slotTaken, retryable, error] of failures) {
      const res = await port([route("POST", () => true, reply)], calls).createAppointment(input);
      if (res.ok || res.slotTaken !== slotTaken || res.retryable !== retryable || res.error !== error) badFailures.push({ error, res });
    }
    check("createAppointment failures: slot taken / invalid / timeout / 5xx", badFailures.length === 0, badFailures);
  }
  {
    const calls: FetchCall[] = [];
    const p = port(
      [
        route("PUT", (u) => u === "/calendars/events/appointments/apt1", (call) => ({
          status: 200,
          json: (call.body as { startTime?: string }).startTime
            ? { id: "apt1", calendarId: "cal1", contactId: C1, startTime: "2026-11-21T11:00:00-05:00", endTime: "2026-11-21T11:30:00-05:00", appointmentStatus: "confirmed" }
            : { succeeded: true },
        })),
        route("GET", (u) => u === "/calendars/events/appointments/apt1", { status: 200, json: { event: { id: "apt1", calendarId: "cal1", startTime: "2026-11-21T11:00:00-05:00", appointmentStatus: "cancelled" } } }),
      ],
      calls
    );
    const moved = await p.updateAppointment({ appointmentId: "apt1", startIso: "2026-11-21T11:00:00-05:00", endIso: "2026-11-21T11:30:00-05:00", status: "confirmed" });
    const cancelled = await p.updateAppointment({ appointmentId: "apt1", status: "cancelled" });
    check(
      "updateAppointment: a new time always carries the status; a cancel without times reads the appointment back",
      moved.ok &&
        moved.value.startTime.toISOString() === "2026-11-21T16:00:00.000Z" &&
        j(calls[0].body) === j({ appointmentStatus: "confirmed", startTime: "2026-11-21T11:00:00-05:00", endTime: "2026-11-21T11:30:00-05:00", toNotify: true }) &&
        j(calls[1].body) === j({ appointmentStatus: "cancelled", toNotify: true }) &&
        cancelled.ok &&
        cancelled.value.status === "cancelled" &&
        calls[2]?.method === "GET"
    );
  }
  {
    const calls: FetchCall[] = [];
    const p = port([route("PUT", () => true, { status: 200, json: { succeded: true } }), route("POST", () => true, { status: 201, json: {} }), route("DELETE", () => true, { status: 200, json: {} })], calls);
    const setting = { status: "permanent", message: "Opted out via AI Setter", code: "ai_setter" };
    check(
      "setDnd: PUT /contacts/{id} with only dndSettings (never inboundDndSettings), capitalized keys, de-duplicated",
      (await p.setDnd(C1, ["WhatsApp", "SMS", "SMS"])) &&
        j(calls[0].body) === j({ dndSettings: { SMS: setting, WhatsApp: setting } }) &&
        calls[0].method === "PUT" &&
        calls[0].url === `/contacts/${C1}` &&
        calls[0].version === "2021-07-28"
    );
    check(
      "tags and notes: de-duplicated tags, DELETE with a JSON body, blank note refused, empty lists send nothing",
      (await p.setDnd(C1, [])) &&
        (await p.addTags(C1, ["ai_booked", " ai_booked ", ""])) &&
        j(calls[1].body) === j({ tags: ["ai_booked"] }) &&
        (await p.removeTags(C1, ["ai_setter_alert"])) &&
        calls[2].method === "DELETE" &&
        calls[2].contentType === "application/json" &&
        (await p.addTags(C1, [])) &&
        (await p.addNote(C1, "Cita agendada por el asistente")) &&
        calls[3].url === `/contacts/${C1}/notes` &&
        !(await p.addNote(C1, "  ")) &&
        calls.length === 4
    );
    const fails = port([route("PUT", () => true, { status: 0, throwName: "TimeoutError" }), route("POST", () => true, { status: 422, json: {} })], calls);
    check("write failures → false; an invalid id → false", !(await fails.setDnd(C1, ["SMS"])) && !(await fails.addTags(C1, ["x"])) && !(await fails.addNote(C1, "x")) && !(await fails.addTags("bad id", ["x"])));
  }
}

// ═══ llm adapter (fake client + the real SDK on a stubbed fetch) ═════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

async function llmTests(): Promise<void> {
  section("llm: cost");
  check(
    "costMicrosOf: primary and fallback rates, exact before rounding up",
    costMicrosOf({ input: 1000, output: 100, cacheRead: 2000, cacheWrite: 500 }, false) === 8900 &&
      costMicrosOf({ input: 1000, output: 100, cacheRead: 2000, cacheWrite: 500 }, true) === 11625 &&
      costMicrosOf({ input: 0, output: 0, cacheRead: 15, cacheWrite: 0 }, false) === 3 &&
      costMicrosOf({ input: 0, output: 0, cacheRead: 1, cacheWrite: 0 }, false) === 1 &&
      costMicrosOf({ input: 0, output: 0, cacheRead: 0, cacheWrite: 1 }, true) === 7 &&
      costMicrosOf({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, true) === 0
  );

  const TOOLS = [
    { name: "find_open_slots", description: "Find two open times.", inputSchema: { type: "object", properties: { part_of_day: { type: "string" } }, required: ["part_of_day"], additionalProperties: false } },
    { name: "reply_with_template", description: "Reply with an approved template.", inputSchema: { type: "object", properties: { template_id: { type: "string" } }, required: ["template_id"], additionalProperties: false } },
    { name: "boom", description: "Always throws.", inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  ];
  const SYSTEM = "You are the scheduling assistant. SECRET_SYSTEM_PROMPT";
  const USER = "<lead_thread>SECRET_LEAD_TEXT</lead_thread>";
  let idSeq = 0;
  const usage = (over: Loose = {}): Loose => ({
    input_tokens: 100,
    output_tokens: 20,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_creation: null,
    fallback_credit: null,
    inference_geo: null,
    iterations: null,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: "standard",
    speed: "standard",
    ...over,
  });
  const message = (o: { content: Loose[]; stop_reason: string; usage?: Loose; model?: string; stop_details?: Loose | null }): Loose => ({
    id: `msg_${++idSeq}`,
    type: "message",
    role: "assistant",
    model: o.model ?? "claude-opus-5-5",
    content: o.content,
    stop_reason: o.stop_reason,
    stop_sequence: null,
    stop_details: o.stop_details ?? null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: usage(o.usage),
  });
  const thinking = (sig: string) => ({ type: "thinking", thinking: "", signature: sig });
  const toolUse = (id: string, name: string, input: Loose = {}) => ({ type: "tool_use", id, name, input });
  const text = (t: string) => ({ type: "text", text: t, citations: null });
  const fallbackBlock = () => ({ type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" }, trigger: { type: "refusal", category: "cyber" } });
  type Step = Loose | Error;
  const fakeClient = (steps: Step[]) => {
    const calls: Array<{ params: Loose; hasSignal: boolean }> = [];
    const client = {
      beta: {
        messages: {
          create: async (params: Loose, options?: Loose) => {
            calls.push({ params: JSON.parse(JSON.stringify(params)) as Loose, hasSignal: options?.signal instanceof AbortSignal });
            const next = steps.shift();
            if (!next) throw new Error("fake: no more responses");
            if (next instanceof Error) throw next;
            return next;
          },
        },
      },
    };
    return { client, calls };
  };
  const executor = () => {
    const seen: Array<{ name: string; input: unknown }> = [];
    const execute = async (name: string, input: unknown): Promise<ToolExecResult> => {
      seen.push({ name, input });
      if (name === "find_open_slots") return { content: "A: today 4:30 pm; B: tomorrow 10:00 am" };
      if (name === "reply_with_template") return { content: "ok", terminal: true };
      throw new Error("SECRET_TOOL_FAILURE");
    };
    return { seen, execute };
  };
  const session = (steps: Step[], opts: { maxCalls?: number; deadlineAt?: number } = {}) => {
    const log = createMemoryLogger();
    const fake = fakeClient(steps);
    const exec = executor();
    const llm = createLlmPort({ apiKey: "sk-test", model: "claude-opus-5-5", effort: "low", maxTokens: 8000, log, client: fake.client as never });
    const s = llm.startSession({ system: SYSTEM, tools: TOOLS, userContent: USER, executeTool: exec.execute, maxCalls: opts.maxCalls ?? 3, deadlineAt: opts.deadlineAt ?? Date.now() + 240_000 });
    return { s, log, fake, exec };
  };
  const leaks: string[] = [];
  const noSecrets = (lines: string[]) => leaks.push(...lines.filter((l) => /SECRET/.test(l)));

  section("llm: the tool loop on a fake client");
  {
    const { s, log, fake, exec } = session([message({ content: [thinking("sig1"), toolUse("toolu_1", "reply_with_template", { template_id: "offer_times" })], stop_reason: "tool_use" })]);
    const r = await s.run();
    const p = fake.calls[0].params;
    check(
      "a terminal tool on the first call ends the loop (tool ran once, usage and cost)",
      r.kind === "terminal" &&
        r.toolName === "reply_with_template" &&
        j(r.input) === j({ template_id: "offer_times" }) &&
        r.calls === 1 &&
        exec.seen.length === 1 &&
        r.usage.costMicros === 100 * 4 + 20 * 20 &&
        !r.usage.usedFallback,
      r
    );
    check(
      "request shape: model, max_tokens, fallback beta + fallbacks default, effort, cached system, strict tools, one tool per call, no sampling params",
      p.model === "claude-opus-5-5" &&
        p.max_tokens === 8000 &&
        j(p.betas) === j(["server-side-fallback-2026-07-01"]) &&
        p.fallbacks === "default" &&
        j(p.output_config) === j({ effort: "low" }) &&
        j(p.system) === j([{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }]) &&
        j(p.tools) === j(TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema, strict: true }))) &&
        j(p.tool_choice) === j({ type: "auto", disable_parallel_tool_use: true }) &&
        j(Object.keys(p).sort()) === j(["betas", "fallbacks", "max_tokens", "messages", "model", "output_config", "system", "tool_choice", "tools"]) &&
        j(p.messages) === j([{ role: "user", content: USER }]) &&
        fake.calls[0].hasSignal,
      p
    );
    noSecrets(log.lines);
  }
  {
    const c1 = [thinking("sigA"), toolUse("toolu_a", "find_open_slots", { part_of_day: "afternoon" })];
    const { s, fake, exec } = session([
      message({ content: c1, stop_reason: "tool_use", usage: { input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 } }),
      message({
        content: [thinking("sigB"), toolUse("toolu_b", "reply_with_template", { template_id: "offer_times" })],
        stop_reason: "tool_use",
        usage: { input_tokens: 70, output_tokens: 15, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200 },
      }),
    ]);
    const r = await s.run();
    const [a, b] = fake.calls.map((x) => x.params);
    check(
      "a tool step then the terminal: tools in order, history append-only, thinking kept, tool_result shape",
      r.kind === "terminal" &&
        r.calls === 2 &&
        j(exec.seen.map((x) => x.name)) === j(["find_open_slots", "reply_with_template"]) &&
        j(a.system) === j(b.system) &&
        j(a.tools) === j(b.tools) &&
        j(b.messages.slice(0, a.messages.length)) === j(a.messages) &&
        j(b.messages[1]) === j({ role: "assistant", content: c1 }) &&
        j(b.messages[2]) === j({ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_a", content: "A: today 4:30 pm; B: tomorrow 10:00 am", is_error: false }] })
    );
    check(
      "usage and cost add up over the session",
      r.usage.inputTokens === 120 && r.usage.outputTokens === 25 && r.usage.cacheReadTokens === 2000 && r.usage.cacheWriteTokens === 200 && r.usage.costMicros === 120 * 4 + 25 * 20 + 400 + 1000,
      r.usage
    );
  }
  {
    const { s, log } = session([message({ content: [], stop_reason: "refusal", stop_details: { category: "cyber", explanation: "SECRET_EXPLANATION", fallback_credit_token: null } })]);
    const r = await s.run();
    const { s: s2 } = session([message({ content: [], stop_reason: "refusal", stop_details: null })]);
    const r2 = await s2.run();
    check("refusal → refused with the category (or 'refusal')", r.kind === "refused" && r.detail === "cyber" && r2.kind === "refused" && r2.detail === "refusal", [r, r2]);
    noSecrets(log.lines);
  }
  {
    const c1 = [thinking("sig1"), toolUse("toolu_t1", "reply_with_template", { template_id: "x" })];
    const { s, fake } = session([message({ content: c1, stop_reason: "tool_use" }), message({ content: [toolUse("toolu_t2", "reply_with_template", { template_id: "y" })], stop_reason: "tool_use" })]);
    const r1 = await s.run();
    const again = await s.run();
    const r2 = await s.retryWith("Your draft failed these checks: emoji.");
    const m = fake.calls[1].params.messages;
    check(
      "retryWith answers the pending terminal tool with an error result; run() alone refuses to call",
      r1.kind === "terminal" &&
        again.kind === "error" &&
        again.detail === "pending_tool_use" &&
        r2.kind === "terminal" &&
        r2.calls === 2 &&
        j(r2.input) === j({ template_id: "y" }) &&
        j(m[1]) === j({ role: "assistant", content: c1 }) &&
        j(m[2]) === j({ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_t1", content: "Your draft failed these checks: emoji.", is_error: true }] }) &&
        r2.usage.inputTokens === 200
    );
  }
  {
    const { s, fake } = session([message({ content: [text("I think we should wait.")], stop_reason: "end_turn" }), message({ content: [toolUse("toolu_z", "reply_with_template", {})], stop_reason: "tool_use" })]);
    const r1 = await s.run();
    const r2 = await s.retryWith("End with one terminal tool.");
    const m = fake.calls[1].params.messages;
    check(
      "no tool → no_action with the text; retryWith then appends plain user text",
      r1.kind === "no_action" && r1.text === "I think we should wait." && r2.kind === "terminal" && j(m[1]) === j({ role: "assistant", content: [text("I think we should wait.")] }) && j(m[2]) === j({ role: "user", content: "End with one terminal tool." })
    );
  }
  {
    const { s, fake } = session([message({ content: [], stop_reason: "end_turn" })], { deadlineAt: Date.now() + 4_000 });
    const r = await s.run();
    check("no call starts within 5 s of the deadline", r.kind === "deadline" && r.calls === 0 && fake.calls.length === 0 && r.usage.model === "claude-opus-5-5");
    const slots = () => message({ content: [toolUse(`toolu_${idSeq}`, "find_open_slots", { part_of_day: "any" })], stop_reason: "tool_use" });
    const capped = session([slots(), slots(), slots()], { maxCalls: 2 });
    const r2 = await capped.s.run();
    const after = await capped.s.retryWith("try again");
    check("maxCalls caps run() and retryWith()", r2.kind === "error" && r2.detail === "max_calls" && r2.calls === 2 && after.kind === "error" && capped.fake.calls.length === 2);
  }
  {
    const { s, fake, log } = session([message({ content: [toolUse("toolu_boom", "boom")], stop_reason: "tool_use" }), message({ content: [toolUse("toolu_ok", "reply_with_template", {})], stop_reason: "tool_use" })]);
    const r = await s.run();
    check(
      "a throwing tool → 'internal error' result, the loop goes on, the log names only the error class",
      r.kind === "terminal" &&
        j(fake.calls[1].params.messages[2]) === j({ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_boom", content: "internal error", is_error: true }] }) &&
        log.lines.some((l) => l.startsWith("warn tool threw") && l.includes('"error":"Error"'))
    );
    noSecrets(log.lines);
  }
  {
    const { s, fake } = session([message({ content: [text("partial")], stop_reason: "pause_turn" }), message({ content: [toolUse("toolu_p", "reply_with_template", {})], stop_reason: "tool_use" })]);
    const r = await s.run();
    const cut = await session([message({ content: [toolUse("toolu_cut", "reply_with_template", {})], stop_reason: "max_tokens" })]).s.run();
    const joined = await session([message({ content: [thinking("s"), text("a"), text("b")], stop_reason: "end_turn" })]).s.run();
    check(
      "pause_turn continues; max_tokens never runs the cut-off tool; end_turn joins the text",
      r.kind === "terminal" && j(fake.calls[1].params.messages[1]) === j({ role: "assistant", content: [text("partial")] }) && cut.kind === "max_tokens" && joined.kind === "no_action" && joined.text === "a\nb"
    );
  }
  {
    const iterations = [
      { type: "message", input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null, model: "claude-opus-5-5" },
      { type: "fallback_message", input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null, model: "claude-opus-5" },
    ];
    const r = await session([message({ content: [toolUse("toolu_f", "reply_with_template", {})], stop_reason: "tool_use", model: "claude-opus-5", usage: { iterations } })]).s.run();
    check(
      "a fallback model (usage.iterations) → usedFallback; each attempt at its own model's rates (the declined one too)",
      r.usage.usedFallback && r.usage.model === "claude-opus-5" && r.usage.costMicros === 10 * 4 + 100 * 5 + 20 * 25 && r.usage.inputTokens === 110,
      r.usage
    );
    const unknown = [{ type: "fallback_message", input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null, model: "claude-new-model" }];
    const ru = await session([message({ content: [toolUse("toolu_u", "reply_with_template", {})], stop_reason: "tool_use", model: "claude-new-model", usage: { iterations: unknown } })]).s.run();
    check("an unlisted fallback model is priced at the highest rates (the cap never under-counts)", ru.usage.costMicros === 100 * 10 + 10 * 50, ru.usage);
    const c = [fallbackBlock(), thinking("sigF"), toolUse("toolu_g", "reply_with_template", {})];
    const f2 = session([message({ content: c, stop_reason: "tool_use" }), message({ content: [toolUse("toolu_h", "reply_with_template", {})], stop_reason: "tool_use" })]);
    const r2 = await f2.s.run();
    await f2.s.retryWith("fix");
    const split = [thinking("sigOld"), toolUse("toolu_old", "reply_with_template", {}), fallbackBlock(), thinking("sigNew"), toolUse("toolu_new", "find_open_slots", { part_of_day: "am" })];
    const f3 = session([message({ content: split, stop_reason: "tool_use" }), message({ content: [toolUse("toolu_end", "reply_with_template", {})], stop_reason: "tool_use" })]);
    await f3.s.run();
    check(
      "a fallback block: usedFallback; echoed unchanged; only the tool after the boundary runs and is echoed",
      r2.usage.usedFallback &&
        j(f2.fake.calls[1].params.messages[1]) === j({ role: "assistant", content: c }) &&
        f3.exec.seen[0]?.name === "find_open_slots" &&
        j(f3.fake.calls[1].params.messages[1]) === j({ role: "assistant", content: [fallbackBlock(), thinking("sigNew"), toolUse("toolu_new", "find_open_slots", { part_of_day: "am" })] }) &&
        f3.fake.calls[1].params.messages[2].content.length === 1
    );
  }
  {
    const cases: Array<[Error, string]> = [
      [Anthropic.APIError.generate(429, { type: "error", error: { type: "rate_limit_error", message: "SECRET_BODY" } }, "SECRET_MSG", new Headers()), "429:RateLimitError"],
      [Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error", message: "SECRET" } }, "SECRET", new Headers()), "529:OverloadedError"],
      [Anthropic.APIError.generate(500, { type: "error", error: { type: "api_error", message: "SECRET" } }, "SECRET", new Headers()), "500:InternalServerError"],
      [Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "SECRET" } }, "SECRET", new Headers()), "400:BadRequestError"],
      [new Anthropic.APIConnectionTimeoutError({ message: "SECRET" }), "network:APIConnectionTimeoutError"],
      [new Anthropic.APIConnectionError({ message: "SECRET" }), "network:APIConnectionError"],
      [new Error("SECRET_PLAIN"), "unknown:Error"],
      [new TypeError("SECRET_TYPE"), "unknown:TypeError"],
    ];
    const bad: unknown[] = [];
    for (const [err, want] of cases) {
      const { s, log } = session([err]);
      const r = await s.run();
      if (r.kind !== "error" || r.detail !== want || r.calls !== 1) bad.push({ want, r });
      noSecrets(log.lines);
    }
    check("SDK errors → '<status|network>:<Class>' and nothing else", bad.length === 0, bad);
  }

  section("llm: the real SDK on a stubbed fetch (nothing leaves the machine)");
  const realFetch = globalThis.fetch;
  try {
    const seen: Array<{ url: string; method: string; headers: Headers; body: Loose }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url: String(url), method: String(init.method), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) as Loose });
      const body = message({ content: [thinking("sigR"), toolUse("toolu_r", "reply_with_template", { template_id: "who" })], stop_reason: "tool_use" });
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", "request-id": "req_1" } });
    }) as typeof fetch;
    const log = createMemoryLogger();
    const llm = createLlmPort({ apiKey: "sk-ant-dummy-not-real", model: "claude-opus-5-5", effort: "low", maxTokens: 8000, log });
    const r = await llm.startSession({ system: SYSTEM, tools: TOOLS, userContent: USER, executeTool: executor().execute, maxCalls: 3, deadlineAt: Date.now() + 240_000 }).run();
    const req = seen[0];
    check(
      "POST /v1/messages, beta header, our key, betas moved to the header, strict tools on the wire",
      r.kind === "terminal" &&
        req.method === "POST" &&
        req.url === "https://api.anthropic.com/v1/messages" &&
        (req.headers.get("anthropic-beta") ?? "").split(",").map((x) => x.trim()).includes("server-side-fallback-2026-07-01") &&
        req.headers.get("authorization") === "Bearer sk-ant-dummy-not-real" &&
        j(Object.keys(req.body).sort()) === j(["fallbacks", "max_tokens", "messages", "model", "output_config", "system", "tool_choice", "tools"]) &&
        (req.body.tools as Loose[]).every((t) => t.strict === true && t.input_schema.additionalProperties === false),
      { url: req?.url, keys: req ? Object.keys(req.body) : null }
    );
    noSecrets(log.lines);

    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "SECRET_RATE_BODY" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after-ms": "5" },
      });
    }) as typeof fetch;
    const log429 = createMemoryLogger();
    const r429 = await createLlmPort({ apiKey: "sk-ant-dummy-not-real", model: "claude-opus-5-5", effort: "low", maxTokens: 8000, log: log429 })
      .startSession({ system: SYSTEM, tools: TOOLS, userContent: USER, executeTool: executor().execute, maxCalls: 3, deadlineAt: Date.now() + 240_000 })
      .run();
    check("429: the SDK's single retry (2 attempts), then '429:RateLimitError'", r429.kind === "error" && r429.detail === "429:RateLimitError" && attempts === 2, { r429, attempts });
    noSecrets(log429.lines);

    attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "SECRET" } }), { status: 400, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const r400 = await createLlmPort({ apiKey: "sk-ant-dummy-not-real", model: "claude-opus-5-5", effort: "low", maxTokens: 8000, log: createMemoryLogger() })
      .startSession({ system: SYSTEM, tools: TOOLS, userContent: USER, executeTool: executor().execute, maxCalls: 3, deadlineAt: Date.now() + 240_000 })
      .run();
    check("400 is not retried", r400.kind === "error" && r400.detail === "400:BadRequestError" && attempts === 1);

    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed SECRET");
    }) as typeof fetch;
    const logNet = createMemoryLogger();
    const rNet = await createLlmPort({ apiKey: "sk-ant-dummy-not-real", model: "claude-opus-5-5", effort: "low", maxTokens: 8000, log: logNet })
      .startSession({ system: SYSTEM, tools: TOOLS, userContent: USER, executeTool: executor().execute, maxCalls: 3, deadlineAt: Date.now() + 240_000 })
      .run();
    check("network failure → 'network:APIConnectionError'", rNet.kind === "error" && rNet.detail === "network:APIConnectionError", rNet);
    noSecrets(logNet.lines);

    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      })) as typeof fetch;
    const started = Date.now();
    const rDeadline = await createLlmPort({ apiKey: "sk-ant-dummy-not-real", model: "claude-opus-5-5", effort: "low", maxTokens: 8000, log: createMemoryLogger() })
      .startSession({ system: SYSTEM, tools: TOOLS, userContent: USER, executeTool: executor().execute, maxCalls: 3, deadlineAt: Date.now() + 5_300 })
      .run();
    const ms = Date.now() - started;
    check("a call in flight at the deadline is aborted (~5 s, not 60 s)", rDeadline.kind === "deadline" && rDeadline.detail === "deadline_in_call" && ms >= 5_000 && ms < 8_000, { rDeadline, ms });
  } finally {
    globalThis.fetch = realFetch;
  }
  check("logs never carry prompts, tool errors or API error bodies", leaks.length === 0, leaks);
}

// ═══ Fakes for the turn engine ═══════════════════════════════════════════════════════════════

type Clock = { now: () => Date; advance: (ms: number) => void; set: (iso: string) => void };

function makeClock(startIso: string): Clock {
  let t = Date.parse(startIso);
  return {
    now: () => new Date(t),
    advance: (ms) => {
      t += ms;
    },
    set: (iso) => {
      t = Date.parse(iso);
    },
  };
}

/** Yields like real IO would, so concurrent jobs interleave. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const clone = <T>(v: T): T => structuredClone(v);

/** What a lead patch may write (store.ts `leadColumns`): never the fence, the id or timestamps. */
const LEAD_PATCH_KEYS = [
  "firstName",
  "status",
  "language",
  "register",
  "product",
  "leadTimezone",
  "stateCode",
  "lastHandledInboundId",
  "lastHandledInboundAt",
  "lastInboundAt",
  "lastAiOutboundAt",
  "disclosedChannels",
  "pausedUntil",
  "pauseReason",
  "offeredSlots",
  "offeredAt",
  "rejectionsCount",
  "appointmentId",
  "appointmentAt",
  "calendarId",
  "bookingIntent",
  "callNowState",
  "callNowRequestedAt",
  "turnsDay",
  "turnsToday",
  "threadTurns",
  "optOutPending",
] as const satisfies ReadonlyArray<keyof LeadRecord>;

/** What a message patch may write (store.ts `messageColumns`): never id, contactId, status or timestamps. */
const MESSAGE_PATCH_KEYS = [
  "channel",
  "kind",
  "templateId",
  "templateHash",
  "body",
  "originalBody",
  "intent",
  "inReplyToInboundId",
  "turnRunId",
  "ghlMessageId",
  "decision",
  "guardFlags",
  "model",
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "costMicros",
  "usedFallback",
  "approvedBy",
  "approvedAt",
  "sentAt",
  "notBefore",
  "expiresAt",
  "error",
] as const satisfies ReadonlyArray<keyof MessageRecord>;

const COUNT_KEYS = new Set<string>(["rejectionsCount", "turnsToday", "threadTurns", "inputTokens", "outputTokens", "cacheReadTokens", "costMicros"]);
const STALE_TURN_MS = 6 * MIN;
const PENDING_STATUSES: MessageStatus[] = ["draft", "approved", "shadow"];

function toCount(value: number): number {
  return Number.isFinite(value) ? Math.min(2_147_483_647, Math.max(0, Math.round(value))) : 0;
}

function applyPatch(target: object, patch: object, keys: readonly string[]): void {
  const t = target as Record<string, unknown>;
  const p = patch as Record<string, unknown>;
  for (const key of keys) {
    const value = p[key];
    if (value === undefined) continue;
    t[key] = COUNT_KEYS.has(key) ? toCount(value as number) : key === "error" && typeof value === "string" ? value.slice(0, 300) : clone(value);
  }
}

function leadRecord(over: Partial<LeadRecord> = {}): LeadRecord {
  const now = new Date("2026-11-17T15:00:00.000Z");
  return {
    contactId: CID,
    firstName: null,
    status: "active",
    language: null,
    register: null,
    product: null,
    leadTimezone: null,
    stateCode: null,
    runId: null,
    attempt: 0,
    turnState: "idle",
    armedAt: null,
    lastHandledInboundId: null,
    lastHandledInboundAt: null,
    lastInboundAt: null,
    lastAiOutboundAt: null,
    disclosedChannels: {},
    pausedUntil: null,
    pauseReason: null,
    offeredSlots: [],
    offeredAt: null,
    rejectionsCount: 0,
    appointmentId: null,
    appointmentAt: null,
    calendarId: null,
    bookingIntent: null,
    callNowState: null,
    callNowRequestedAt: null,
    turnsDay: null,
    turnsToday: 0,
    threadTurns: 0,
    optOutPending: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

type Suppression = { e164: string; scope: SuppressionScope; source: string; rawText: string | null; contactId: string | null; createdAt: Date; liftedAt: Date | null; liftReason: string | null };

/** In-memory StorePort with the exact semantics of lib/ai-setter/store.ts (one SQL statement = one method). */
class FakeStore implements StorePort {
  leads = new Map<string, LeadRecord>();
  messages: MessageRecord[] = [];
  events: Array<{ contactId: string; type: string; detail: Record<string, unknown> | null; at: Date }> = [];
  suppressions = new Map<string, Suppression>();
  usage = new Map<string, { turns: number; reservedMicros: number; costMicros: number; sends: number }>();
  private seq = 0;

  constructor(private clock: Clock) {}

  private nextId(prefix: string): string {
    this.seq++;
    return `${prefix}_${String(this.seq).padStart(4, "0")}`;
  }

  private fenced(f: TurnFence): LeadRecord | null {
    const lead = this.leads.get(f.contactId);
    return lead && lead.runId === f.runId && lead.attempt === f.attempt && lead.turnState === "running" ? lead : null;
  }

  async getLead(contactId: string): Promise<LeadRecord | null> {
    await tick();
    const lead = this.leads.get(contactId);
    return lead ? clone(lead) : null;
  }

  async ensureLead(contactId: string, init: Partial<LeadRecord>): Promise<LeadRecord> {
    await tick();
    if (!this.leads.has(contactId)) {
      const now = this.clock.now();
      const lead = leadRecord({ contactId, createdAt: now, updatedAt: now });
      applyPatch(lead, init, LEAD_PATCH_KEYS);
      this.leads.set(contactId, lead);
    }
    return clone(this.leads.get(contactId) as LeadRecord);
  }

  async armTurn(contactId: string, now: Date): Promise<{ armed: boolean; runId: string | null }> {
    await tick();
    const runId = this.nextId("ais");
    const lead = this.leads.get(contactId);
    if (!lead) {
      this.leads.set(contactId, leadRecord({ contactId, runId, turnState: "armed", attempt: 0, armedAt: now, createdAt: now, updatedAt: now }));
      return { armed: true, runId };
    }
    if (lead.turnState === "idle" || lead.updatedAt.getTime() <= now.getTime() - STALE_TURN_MS) {
      Object.assign(lead, { runId, turnState: "armed", attempt: 0, armedAt: now, updatedAt: now });
      this.pokePending.delete(contactId);
      return { armed: true, runId };
    }
    // Same as the real store: a poke during a RUNNING turn makes that turn re-arm on finish.
    if (lead.turnState === "running") this.pokePending.add(contactId);
    return { armed: false, runId: null };
  }

  /** Contacts whose running turn got a webhook poke (store.ts `poke_pending`). */
  readonly pokePending = new Set<string>();

  async claimTurn(contactId: string, runId: string, now: Date): Promise<LeadRecord | null> {
    await tick();
    const lead = this.leads.get(contactId);
    if (!lead || lead.runId !== runId) return null;
    const stale = lead.turnState === "running" && lead.updatedAt.getTime() <= now.getTime() - STALE_TURN_MS;
    if (lead.turnState !== "armed" && !stale) return null;
    Object.assign(lead, { turnState: "running", attempt: lead.attempt + 1, updatedAt: now });
    return clone(lead);
  }

  async updateLead(fence: TurnFence, patch: Partial<LeadRecord>): Promise<boolean> {
    await tick();
    const lead = this.fenced(fence);
    if (!lead) return false;
    applyPatch(lead, patch, LEAD_PATCH_KEYS);
    lead.updatedAt = this.clock.now();
    return true;
  }

  async finishTurn(fence: TurnFence, patch: Partial<LeadRecord>, opts: { rearm: boolean }): Promise<{ ok: boolean; rearmedRunId: string | null }> {
    await tick();
    const lead = this.fenced(fence);
    if (!lead) return { ok: false, rearmedRunId: null };
    const now = this.clock.now();
    applyPatch(lead, patch, LEAD_PATCH_KEYS);
    const rearm = opts.rearm || this.pokePending.has(fence.contactId);
    this.pokePending.delete(fence.contactId);
    const rearmedRunId = rearm ? this.nextId("ais") : null;
    if (rearmedRunId) Object.assign(lead, { turnState: "armed", runId: rearmedRunId, attempt: 0, armedAt: now });
    else lead.turnState = "idle";
    lead.updatedAt = now;
    return { ok: true, rearmedRunId };
  }

  async updateLeadUnfenced(contactId: string, patch: Partial<LeadRecord>): Promise<void> {
    await tick();
    const lead = this.leads.get(contactId);
    if (!lead) return;
    applyPatch(lead, patch, LEAD_PATCH_KEYS);
    lead.updatedAt = this.clock.now();
  }

  async createMessage(msg: NewMessage): Promise<MessageRecord> {
    await tick();
    const now = this.clock.now();
    const record: MessageRecord = {
      id: this.nextId("aim"),
      contactId: msg.contactId,
      channel: msg.channel,
      kind: msg.kind,
      templateId: null,
      templateHash: null,
      body: null,
      originalBody: null,
      status: msg.status,
      intent: null,
      inReplyToInboundId: null,
      turnRunId: null,
      ghlMessageId: null,
      decision: null,
      guardFlags: [],
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costMicros: 0,
      usedFallback: false,
      approvedBy: null,
      approvedAt: null,
      sentAt: null,
      notBefore: null,
      expiresAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    applyPatch(record, msg, MESSAGE_PATCH_KEYS);
    this.messages.push(record);
    return clone(record);
  }

  async getMessage(id: string): Promise<MessageRecord | null> {
    await tick();
    const m = this.messages.find((x) => x.id === id);
    return m ? clone(m) : null;
  }

  async transitionMessage(id: string, from: MessageStatus[], to: MessageStatus, patch: Partial<MessageRecord> = {}): Promise<MessageRecord | null> {
    await tick();
    if (from.length === 0) return null;
    const m = this.messages.find((x) => x.id === id);
    if (!m || !from.includes(m.status)) return null;
    applyPatch(m, patch, MESSAGE_PATCH_KEYS);
    m.status = to;
    m.updatedAt = this.clock.now();
    return clone(m);
  }

  async supersedePendingDrafts(contactId: string, reason: string): Promise<number> {
    await tick();
    let n = 0;
    for (const m of this.messages) {
      if (m.contactId !== contactId || !PENDING_STATUSES.includes(m.status)) continue;
      m.status = "superseded";
      m.error = reason.slice(0, 300);
      m.updatedAt = this.clock.now();
      n++;
    }
    return n;
  }

  async listContactMessages(contactId: string, limit: number): Promise<MessageRecord[]> {
    await tick();
    return clone(this.messages.filter((m) => m.contactId === contactId).reverse().slice(0, Math.min(500, Math.max(1, limit))));
  }

  async knownGhlMessageIds(contactId: string): Promise<Set<string>> {
    await tick();
    return new Set(this.messages.flatMap((m) => (m.contactId === contactId && m.ghlMessageId ? [m.ghlMessageId] : [])));
  }

  async recordEvent(contactId: string, type: string, detail?: Record<string, unknown>): Promise<void> {
    await tick();
    this.events.push({ contactId, type, detail: detail ? clone(detail) : null, at: this.clock.now() });
  }

  async isSuppressed(e164: string): Promise<boolean> {
    await tick();
    const s = this.suppressions.get(e164.trim());
    return Boolean(s && !s.liftedAt);
  }

  async addSuppression(s: { e164: string; scope: SuppressionScope; source: string; rawText: string | null; contactId: string | null }): Promise<void> {
    await tick();
    const key = s.e164.trim();
    const existing = this.suppressions.get(key);
    const now = this.clock.now();
    if (!existing || existing.liftedAt) {
      this.suppressions.set(key, { e164: key, scope: s.scope, source: s.source, rawText: s.rawText?.slice(0, 1000) ?? null, contactId: s.contactId ?? existing?.contactId ?? null, createdAt: now, liftedAt: null, liftReason: null });
      return;
    }
    // Live: a repeat only widens it and keeps the FIRST opt-out's evidence.
    existing.scope = existing.scope === s.scope ? s.scope : "all";
    existing.rawText = existing.rawText ?? s.rawText;
    existing.contactId = existing.contactId ?? s.contactId;
  }

  async liftSuppression(e164: string, reason: string): Promise<boolean> {
    await tick();
    const s = this.suppressions.get(e164.trim());
    if (!s || s.liftedAt) return false;
    s.liftedAt = this.clock.now();
    s.liftReason = reason.slice(0, 300);
    return true;
  }

  async reserveBudget(day: string, micros: number, limitMicros: number): Promise<boolean> {
    await tick();
    if (!Number.isFinite(micros) || !Number.isFinite(limitMicros)) return false;
    const amount = Math.ceil(Math.max(0, micros));
    const limit = Math.floor(limitMicros);
    if (limit <= 0 || amount > Math.min(limit, 2_147_483_647)) return false;
    const row = this.usage.get(day);
    if (!row) {
      this.usage.set(day, { turns: 0, reservedMicros: amount, costMicros: 0, sends: 0 });
      return true;
    }
    if (row.reservedMicros + row.costMicros + amount > limit) return false;
    row.reservedMicros += amount;
    return true;
  }

  async settleBudget(day: string, reservedMicros: number, actualMicros: number): Promise<void> {
    await tick();
    const row = this.usage.get(day);
    if (!row) {
      this.usage.set(day, { turns: 1, reservedMicros: 0, costMicros: toCount(actualMicros), sends: 0 });
      return;
    }
    row.reservedMicros = Math.max(row.reservedMicros - toCount(reservedMicros), 0);
    row.costMicros += toCount(actualMicros);
    row.turns += 1;
  }

  async countTurnsSince(since: Date): Promise<number> {
    await tick();
    return this.events.filter((e) => e.type === "turn" && e.at.getTime() >= since.getTime()).length;
  }
}

const isoFormatters = new Map<string, Intl.DateTimeFormat>();
/** An instant as GHL writes free slots: local wall time in `zone` with its offset ("…T11:30:00-05:00"). */
function isoInZone(ms: number, zone: string): string {
  let f = isoFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    isoFormatters.set(zone, f);
  }
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(ms)) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  const offset = Math.round((local - ms) / MIN);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${pad(hour)}:${p.minute}:${p.second}${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

/** Every :00 / :30 in [startMs, endMs): GHL's free slots for an open calendar (Isaac's hours are applied by filterSlots). */
function halfHourSlots(startMs: number, endMs: number, zone: string): string[] {
  const step = 30 * MIN;
  const out: string[] = [];
  for (let t = Math.ceil(startMs / step) * step; t < endMs; t += step) out.push(isoInZone(t, isValidTimeZone(zone) ? zone : NY));
  return out;
}

type GhlWrite = { op: string; contactId: string | null; input: unknown; at: string };
type SendMode = "sent" | "unknown_delivered" | "unknown_lost" | "rate_limited" | "dnd" | "invalid";

/** In-memory GHL: contacts, threads, calendars; records every write. */
class FakeGhl implements GhlPort {
  contacts = new Map<string, ContactSnapshot>();
  threads = new Map<string, ThreadMessage[]>();
  appointments: AppointmentRef[] = [];
  userEvents: AppointmentRef[] = [];
  writes: GhlWrite[] = [];
  reads: Array<{ op: string; input: unknown }> = [];
  fail: Partial<Record<"getContact" | "listMessages" | "getFreeSlots" | "listContactAppointments" | "updateAppointment", GhlFailure>> = {};
  createFailure: (GhlFailure & { slotTaken: boolean }) | null = null;
  sendModes: SendMode[] = [];
  private seq = 0;

  constructor(private clock: Clock) {}

  thread(contactId: string): ThreadMessage[] {
    let t = this.threads.get(contactId);
    if (!t) {
      t = [];
      this.threads.set(contactId, t);
    }
    return t;
  }

  add(contactId: string, m: Omit<ThreadMessage, "id" | "conversationId"> & { id?: string }): ThreadMessage {
    this.seq++;
    const message: ThreadMessage = { conversationId: "conv_test_1", ...m, id: m.id ?? `${m.direction === "inbound" ? "in" : "out"}_${String(this.seq).padStart(3, "0")}` };
    this.thread(contactId).push(message);
    return message;
  }

  private write(op: string, contactId: string | null, input: unknown): void {
    this.writes.push({ op, contactId, input: clone(input), at: this.clock.now().toISOString() });
  }

  async getContact(contactId: string): Promise<GhlResult<ContactSnapshot>> {
    await tick();
    this.reads.push({ op: "getContact", input: contactId });
    if (this.fail.getContact) return this.fail.getContact;
    const c = this.contacts.get(contactId);
    return c ? { ok: true, value: clone(c) } : { ok: false, status: 404, retryable: false, error: "http_404" };
  }

  async listMessages(contactId: string, opts: { limit: number; sinceDays: number }): Promise<GhlResult<ThreadMessage[]>> {
    await tick();
    this.reads.push({ op: "listMessages", input: opts });
    if (this.fail.listMessages) return this.fail.listMessages;
    const cutoff = this.clock.now().getTime() - opts.sinceDays * DAY;
    const sorted = this.thread(contactId)
      .filter((m) => m.dateAdded.getTime() >= cutoff)
      .sort((a, b) => a.dateAdded.getTime() - b.dateAdded.getTime());
    const kept: ThreadMessage[] = [];
    let counted = 0;
    for (const m of [...sorted].reverse()) {
      if (counted >= opts.limit) break;
      kept.push(m);
      if (m.channel !== "Activity") counted++;
    }
    return { ok: true, value: clone(kept.reverse()) };
  }

  async sendMessage(input: { contactId: string; channel: Channel; text: string }): Promise<SendOutcome> {
    await tick();
    this.write("sendMessage", input.contactId, input);
    const mode = this.sendModes.shift() ?? "sent";
    const deliver = () =>
      this.add(input.contactId, {
        id: `ghl_out_${String(this.writes.filter((w) => w.op === "sendMessage").length).padStart(2, "0")}`,
        direction: "outbound",
        channel: input.channel,
        messageType: input.channel === "WhatsApp" ? "TYPE_WHATSAPP" : "TYPE_SMS",
        source: "api",
        userId: null,
        body: input.text,
        attachmentKinds: [],
        dateAdded: this.clock.now(),
        status: "delivered",
        fromNumber: null,
      });
    switch (mode) {
      case "sent": {
        const m = deliver();
        return { kind: "sent", messageId: m.id, conversationId: m.conversationId };
      }
      case "unknown_delivered":
        deliver();
        return { kind: "unknown", status: 0 };
      case "unknown_lost":
        return { kind: "unknown", status: 504 };
      case "rate_limited":
        return { kind: "rejected", status: 429, reason: "rate_limited" };
      case "dnd":
        return { kind: "rejected", status: 400, reason: "dnd" };
      default:
        return { kind: "rejected", status: 422, reason: "invalid" };
    }
  }

  async getFreeSlots(input: { calendarId: string; startMs: number; endMs: number; timeZone: string; userId: string | null }): Promise<GhlResult<string[]>> {
    await tick();
    this.reads.push({ op: "getFreeSlots", input });
    if (this.fail.getFreeSlots) return this.fail.getFreeSlots;
    const taken = new Set(this.appointments.filter((a) => a.status !== "cancelled").map((a) => a.startTime.getTime()));
    return { ok: true, value: halfHourSlots(input.startMs, input.endMs, input.timeZone).filter((iso) => !taken.has(Date.parse(iso))) };
  }

  async listUserEvents(input: { userId: string; startMs: number; endMs: number }): Promise<GhlResult<AppointmentRef[]>> {
    await tick();
    this.reads.push({ op: "listUserEvents", input });
    return { ok: true, value: clone(this.userEvents.filter((e) => e.startTime.getTime() >= input.startMs && e.startTime.getTime() < input.endMs)) };
  }

  async listContactAppointments(contactId: string): Promise<GhlResult<AppointmentRef[]>> {
    await tick();
    this.reads.push({ op: "listContactAppointments", input: contactId });
    if (this.fail.listContactAppointments) return this.fail.listContactAppointments;
    return { ok: true, value: clone(this.appointments.filter((a) => a.contactId === contactId)) };
  }

  async createAppointment(input: {
    calendarId: string;
    contactId: string;
    startIso: string;
    endIso: string;
    title: string;
    description: string;
    assignedUserId: string | null;
  }): Promise<{ ok: true; value: AppointmentRef } | (GhlFailure & { slotTaken: boolean })> {
    await tick();
    this.write("createAppointment", input.contactId, input);
    if (this.createFailure) return this.createFailure;
    this.seq++;
    const appt: AppointmentRef = {
      id: `appt_${String(this.seq).padStart(3, "0")}`,
      calendarId: input.calendarId,
      contactId: input.contactId,
      startTime: new Date(input.startIso),
      endTime: new Date(input.endIso),
      status: "confirmed",
      title: input.title,
    };
    this.appointments.push(appt);
    return { ok: true, value: clone(appt) };
  }

  async updateAppointment(input: { appointmentId: string; startIso?: string; endIso?: string; status: "confirmed" | "cancelled" }): Promise<GhlResult<AppointmentRef>> {
    await tick();
    this.write("updateAppointment", null, input);
    if (this.fail.updateAppointment) return this.fail.updateAppointment;
    const appt = this.appointments.find((a) => a.id === input.appointmentId);
    if (!appt) return { ok: false, status: 404, retryable: false, error: "http_404" };
    if (input.startIso) appt.startTime = new Date(input.startIso);
    if (input.endIso) appt.endTime = new Date(input.endIso);
    appt.status = input.status;
    return { ok: true, value: clone(appt) };
  }

  async setDnd(contactId: string, channels: DndChannel[]): Promise<boolean> {
    await tick();
    this.write("setDnd", contactId, channels);
    const c = this.contacts.get(contactId);
    if (c) for (const ch of channels) c.dndChannels[ch] = "permanent";
    return true;
  }

  async addTags(contactId: string, tags: string[]): Promise<boolean> {
    await tick();
    this.write("addTags", contactId, tags);
    const c = this.contacts.get(contactId);
    if (c) c.tags = [...new Set([...c.tags, ...tags])];
    return true;
  }

  async removeTags(contactId: string, tags: string[]): Promise<boolean> {
    await tick();
    this.write("removeTags", contactId, tags);
    const c = this.contacts.get(contactId);
    if (c) c.tags = c.tags.filter((t) => !tags.includes(t));
    return true;
  }

  async addNote(contactId: string, body: string): Promise<boolean> {
    await tick();
    this.write("addNote", contactId, body);
    return true;
  }
}

type ScriptStep = { tool: string; input: Record<string, unknown> };
type ScriptRound = {
  /** Runs first: e.g. the lead writes again while the model thinks. */
  during?: () => void | Promise<void>;
  /** Tool calls, one API call each, through the REAL executor; the first terminal one ends the round. */
  steps?: ScriptStep[];
  /** How the round ends when no terminal tool ran (default: no_action). */
  end?: { kind: "refused" | "max_tokens" | "deadline" | "error"; detail: string };
  /** The worker dies after the steps (the turn throws). */
  crash?: boolean;
  usedFallback?: boolean;
};
type SessionRecord = {
  system: string;
  userContent: string;
  maxCalls: number;
  trace: Array<{ tool: string; input: unknown; result: ToolExecResult }>;
  feedback: string[];
};

/** A scripted model: each session replays its rounds (run() takes one, each retryWith() the next). */
class FakeLlm implements LlmPort {
  sessions: SessionRecord[] = [];
  private scripts: ScriptRound[][] = [];

  script(...rounds: ScriptRound[]): void {
    this.scripts.push(rounds);
  }

  startSession(input: Parameters<LlmPort["startSession"]>[0]): LlmSession {
    const rounds = this.scripts.shift() ?? [];
    const rec: SessionRecord = { system: input.system, userContent: input.userContent, maxCalls: input.maxCalls, trace: [], feedback: [] };
    this.sessions.push(rec);
    let calls = 0;
    let pending = false;
    let fallback = false;
    const usage = (): LlmUsage => ({
      model: fallback ? "claude-opus-5" : "claude-opus-5-5",
      inputTokens: 1000 * calls,
      outputTokens: 100 * calls,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costMicros: 6000 * calls,
      usedFallback: fallback,
    });
    const play = async (): Promise<LlmLoopResult> => {
      const round = rounds.shift();
      if (!round) {
        calls++;
        return { kind: "no_action", text: "", usage: usage(), calls };
      }
      if (round.during) await round.during();
      if (round.usedFallback) fallback = true;
      for (const step of round.steps ?? []) {
        if (calls >= input.maxCalls) return { kind: "error", detail: "max_calls", usage: usage(), calls };
        calls++;
        const result = await input.executeTool(step.tool, step.input);
        rec.trace.push({ tool: step.tool, input: step.input, result });
        if (result.terminal) {
          pending = true;
          return { kind: "terminal", toolName: step.tool, input: step.input, usage: usage(), calls };
        }
      }
      if (round.crash) throw new Error("simulated worker crash");
      calls++;
      return round.end ? { ...round.end, usage: usage(), calls } : { kind: "no_action", text: "", usage: usage(), calls };
    };
    return {
      run: async () => (pending ? { kind: "error", detail: "pending_tool_use", usage: usage(), calls } : play()),
      retryWith: async (feedback: string) => {
        rec.feedback.push(feedback);
        pending = false;
        return play();
      },
    };
  }
}

class FakeNotify implements NotifyPort {
  events: NotifyEvent[] = [];
  async notify(event: NotifyEvent): Promise<void> {
    await tick();
    this.events.push(clone(event));
  }
}

type QueueJob =
  | { kind: "turn"; contactId: string; runId: string; delaySeconds: number; retry: number; reason: TurnReason; done: boolean }
  | { kind: "send"; messageId: string; notBefore: Date | null; done: boolean }
  | { kind: "verify"; messageId: string; delaySeconds: number; done: boolean }
  | { kind: "call_now_timeout"; contactId: string; requestedAt: string; delaySeconds: number; done: boolean };

class FakeQueue implements QueuePort {
  jobs: QueueJob[] = [];
  async publishTurn(contactId: string, runId: string, delaySeconds: number, opts?: { retry?: number; reason?: TurnReason }): Promise<boolean> {
    this.jobs.push({ kind: "turn", contactId, runId, delaySeconds, retry: opts?.retry ?? 0, reason: opts?.reason ?? "inbound", done: false });
    return true;
  }
  async publishSend(messageId: string, notBefore: Date | null): Promise<boolean> {
    this.jobs.push({ kind: "send", messageId, notBefore: notBefore ? new Date(notBefore) : null, done: false });
    return true;
  }
  async publishVerifySend(messageId: string, delaySeconds: number): Promise<boolean> {
    this.jobs.push({ kind: "verify", messageId, delaySeconds, done: false });
    return true;
  }
  async publishCallNowTimeout(contactId: string, requestedAt: string, delaySeconds: number): Promise<boolean> {
    this.jobs.push({ kind: "call_now_timeout", contactId, requestedAt, delaySeconds, done: false });
    return true;
  }
  of<K extends QueueJob["kind"]>(kind: K): Array<Extract<QueueJob, { kind: K }>> {
    return this.jobs.filter((x): x is Extract<QueueJob, { kind: K }> => x.kind === kind);
  }
}

class FakeCalls implements CallsPort {
  client = false;
  last: CallSignal | null = null;
  async latestCall(): Promise<CallSignal | null> {
    return this.last;
  }
  async isClient(): Promise<boolean> {
    return this.client;
  }
}

class FakeLicense implements LicensePort {
  constructor(public codes: string[] | null) {}
  async licensedStateCodes(): Promise<string[] | null> {
    return this.codes ? [...this.codes] : null;
  }
}

class FakeSettings implements SettingsPort {
  constructor(public value: AiSetterSettings) {}
  async read(): Promise<AiSetterSettings> {
    await tick();
    return clone(this.value);
  }
}

// ─── The world a scenario runs in ──────────────────────────────────────────────────────────

const CID = "cLeadTest0000000001";
const ISAAC_USER = "uIsaacTest000000001";
const LOCATION = "locTest000000000001";
/** Tuesday 2026-11-17, 10:00 a.m. ET: inside Isaac's 9:00–24:00 window. */
const TEST_NOW = "2026-11-17T15:00:00.000Z";
const LICENSED = ["FL", "TX", "GA", "VA", "NC", "SC", "PA", "CA", "AZ", "IL", "TN", "OH"];
const ALL_DND: DndChannel[] = ["SMS", "WhatsApp", "Email", "FB", "Call"];

type LeadPreset = Pick<ContactSnapshot, "firstName" | "phone" | "state" | "postalCode" | "timezone" | "tags">;
/** Synthetic leads: fake first names, 555-01xx numbers (valid strict NANP). */
const LEADS = {
  es: { firstName: "Lucia", phone: "+13055550142", state: "FL", postalCode: "33101", timezone: NY, tags: ["ai_setter", "spanish", "final expense lead"] },
  en: { firstName: "Kevin", phone: "+12145550147", state: "TX", postalCode: "75201", timezone: CHI, tags: ["ai_setter", "iul lead"] },
  es_pa: { firstName: "Marta", phone: "+12155550143", state: "PA", postalCode: "19103", timezone: NY, tags: ["ai_setter", "spanish", "aca lead"] },
  en_pa: { firstName: "Dana", phone: "+12155550148", state: "PA", postalCode: "19103", timezone: NY, tags: ["ai_setter", "aca lead"] },
  es_ny: { firstName: "Jorge", phone: "+12125550144", state: "NY", postalCode: "10001", timezone: NY, tags: ["ai_setter", "spanish", "aca lead"] },
  en_ny: { firstName: "Brian", phone: "+12125550149", state: "NY", postalCode: "10001", timezone: NY, tags: ["ai_setter", "aca lead"] },
  es_ca: { firstName: "Rosa", phone: "+12135550146", state: "CA", postalCode: "90012", timezone: LA, tags: ["ai_setter", "spanish", "final expense lead"] },
  en_ca: { firstName: "Grace", phone: "+12135550150", state: "CA", postalCode: "90012", timezone: LA, tags: ["ai_setter", "final expense lead"] },
  es_unknown: { firstName: "Ana", phone: "+15005550145", state: null, postalCode: null, timezone: null, tags: ["ai_setter", "spanish"] },
  en_unknown: { firstName: "Tom", phone: "+15005550151", state: null, postalCode: null, timezone: null, tags: ["ai_setter"] },
} satisfies Record<string, LeadPreset>;

type WorldOptions = {
  now?: string;
  lead?: LeadPreset;
  contact?: Partial<ContactSnapshot>;
  approve?: "all" | "none" | TemplateId[];
  licensed?: string[] | null;
  env?: Record<string, string>;
  llm?: LlmPort;
};

function approvals(which: "all" | "none" | TemplateId[]): Record<string, string> {
  const ids = which === "all" ? TEMPLATE_IDS : which === "none" ? [] : which;
  return Object.fromEntries(ids.map((id) => [id, templateHash(id)]));
}

class World {
  readonly cid = CID;
  clock: Clock;
  store: FakeStore;
  ghl: FakeGhl;
  llm: FakeLlm;
  notify = new FakeNotify();
  queue = new FakeQueue();
  calls = new FakeCalls();
  license: FakeLicense;
  settings: FakeSettings;
  config: AiSetterConfig;
  ports: AiSetterPorts;

  constructor(o: WorldOptions = {}) {
    this.clock = makeClock(o.now ?? TEST_NOW);
    this.store = new FakeStore(this.clock);
    this.ghl = new FakeGhl(this.clock);
    this.llm = new FakeLlm();
    this.license = new FakeLicense(o.licensed === undefined ? LICENSED : o.licensed);
    this.settings = new FakeSettings({ paused: false, busyUntil: null, schedule: DEFAULT_SCHEDULE, approvedTemplates: approvals(o.approve ?? "all"), failedClosed: false });
    this.config = getAiSetterConfig(envOf({
      AI_SETTER_ENABLED: "true",
      AI_SETTER_DRY_RUN: "false",
      AI_SETTER_GHL_USER_ID: ISAAC_USER,
      AGENT_CRM_LOCATION_ID: LOCATION,
      ...o.env,
    }));
    const preset = o.lead ?? LEADS.es;
    this.ghl.contacts.set(CID, {
      id: CID,
      locationId: LOCATION,
      lastName: "Ejemplo",
      email: null,
      source: "web",
      dnd: false,
      dndChannels: {},
      dateAdded: new Date(Date.parse(TEST_NOW) - 2 * DAY),
      ...preset,
      tags: [...preset.tags],
      ...o.contact,
    });
    this.ports = {
      ghl: this.ghl,
      llm: o.llm ?? this.llm,
      store: this.store,
      settings: this.settings,
      notify: this.notify,
      calls: this.calls,
      license: this.license,
      queue: this.queue,
      now: () => this.clock.now(),
      deadlineAt: Date.now() + 10 * MIN,
      log: createMemoryLogger(),
      config: this.config,
    };
  }

  /** The lead writes (GHL thread). */
  say(body: string, o: { channel?: Channel; attachments?: AttachmentKind[]; agoMs?: number } = {}): ThreadMessage {
    const channel = o.channel ?? "SMS";
    return this.ghl.add(this.cid, {
      direction: "inbound",
      channel,
      messageType: channel === "WhatsApp" ? "TYPE_WHATSAPP" : "TYPE_SMS",
      source: null,
      userId: null,
      body,
      attachmentKinds: o.attachments ?? [],
      dateAdded: new Date(this.clock.now().getTime() - (o.agoMs ?? 0)),
      status: null,
      fromNumber: null,
    });
  }

  /** Someone else writes to the lead (Isaac by hand, a workflow, a calendar confirmation…). */
  outbound(body: string, o: { source: string | null; messageType?: string; userId?: string | null; channel?: ThreadChannel; agoMs?: number }): ThreadMessage {
    const channel = o.channel ?? "SMS";
    return this.ghl.add(this.cid, {
      direction: "outbound",
      channel,
      messageType: o.messageType ?? (channel === "WhatsApp" ? "TYPE_WHATSAPP" : channel === "Call" ? "TYPE_CALL" : "TYPE_SMS"),
      source: o.source,
      userId: o.userId ?? null,
      body,
      attachmentKinds: [],
      dateAdded: new Date(this.clock.now().getTime() - (o.agoMs ?? 0)),
      status: "delivered",
      fromNumber: null,
    });
  }

  advance(ms: number): void {
    this.clock.advance(ms);
  }

  /** The webhook poke: arm one turn for the contact. */
  arm(): Promise<{ armed: boolean; runId: string | null }> {
    return this.store.armTurn(this.cid, this.clock.now());
  }

  /** QStash runs the armed turn after the debounce. */
  async turn(o: { reason?: TurnReason; retry?: number; debounceMs?: number; runId?: string } = {}): Promise<TurnResult> {
    this.clock.advance(o.debounceMs ?? this.config.debounceSeconds * 1000);
    const runId = o.runId ?? (await this.store.getLead(this.cid))?.runId;
    if (!runId) throw new Error("turn(): nothing armed");
    return runTurn(this.cid, runId, this.ports, { reason: o.reason ?? "inbound", retry: o.retry ?? 0 });
  }

  /** The lead writes, the webhook arms, the turn runs. */
  async incoming(body: string, o: { channel?: Channel; attachments?: AttachmentKind[] } = {}): Promise<TurnResult> {
    this.say(body, o);
    await this.arm();
    return this.turn();
  }

  /** Pending send jobs, marked as taken. */
  takeSends(): string[] {
    return this.queue.of("send").filter((x) => !x.done).map((x) => {
      x.done = true;
      return x.messageId;
    });
  }

  /** Runs every pending send job once, in order. */
  async sendPending(): Promise<SendResult[]> {
    const out: SendResult[] = [];
    for (const id of this.takeSends()) out.push(await runSend(id, this.ports));
    return out;
  }

  /** What actions.ts `approve` does: draft → approved (conditional) and a send job. */
  async approve(messageId: string): Promise<boolean> {
    const updated = await this.store.transitionMessage(messageId, ["draft"], "approved", { approvedBy: "admin_test", approvedAt: this.clock.now() });
    if (updated) await this.queue.publishSend(updated.id, updated.notBefore);
    return Boolean(updated);
  }

  async seedLead(patch: Partial<LeadRecord>): Promise<void> {
    await this.store.ensureLead(this.cid, {});
    await this.store.updateLeadUnfenced(this.cid, patch);
  }

  async lead(): Promise<LeadRecord> {
    return (await this.store.getLead(this.cid)) as LeadRecord;
  }

  msgs(): MessageRecord[] {
    return clone(this.store.messages.filter((m) => m.contactId === this.cid));
  }

  last(): MessageRecord {
    return this.msgs().at(-1) as MessageRecord;
  }

  async message(id: string): Promise<MessageRecord> {
    return (await this.store.getMessage(id)) as MessageRecord;
  }

  alerts<K extends NotifyEvent["kind"]>(kind: K): Array<Extract<NotifyEvent, { kind: K }>> {
    return this.notify.events.filter((e): e is Extract<NotifyEvent, { kind: K }> => e.kind === kind);
  }

  writes(op: string): GhlWrite[] {
    return this.ghl.writes.filter((w) => w.op === op);
  }

  events(type: string): Array<{ detail: Record<string, unknown> | null }> {
    return this.store.events.filter((e) => e.contactId === this.cid && e.type === type);
  }

  /** Two offers the lead has already seen (as if the AI sent them 10 minutes ago). */
  async seedLiveOffers(lang: Lang = "es"): Promise<OfferedSlot[]> {
    const contact = this.ghl.contacts.get(this.cid) as ContactSnapshot;
    const zone = contact.timezone ?? NY;
    const sentAt = new Date(this.clock.now().getTime() - 10 * MIN);
    const free = halfHourSlots(sentAt.getTime(), sentAt.getTime() + 8 * DAY, zone);
    const picks = pickTwoSlots(filterSlots({ slotsIso: free, schedule: DEFAULT_SCHEDULE, leadZone: zone, now: sentAt, minNoticeMinutes: 60, durationMinutes: 30, busy: [] }), { now: sentAt, leadZone: zone });
    const showZone = shouldShowZone(zone, contact.timezone ? "ghl" : "none");
    const offers = picks.map((iso, i) => ({ id: ["A", "B"][i], startIso: iso, label: formatSlotForText(iso, { lang, leadZone: zone, now: sentAt, showZone }) }));
    this.say(lang === "es" ? "Hola, me interesa" : "Hi, I'm interested", { agoMs: 12 * MIN });
    const asked = this.ghl.thread(this.cid).at(-1) as ThreadMessage;
    const text = renderTemplate("offer_times", lang, "usted", { slotA: offers[0]?.label, slotB: offers[1]?.label }).text;
    const out = this.outbound(text, { source: "api", agoMs: 10 * MIN });
    await this.store.createMessage({ contactId: this.cid, channel: "SMS", kind: "template", status: "sent", templateId: "offer_times", body: text, ghlMessageId: out.id, decision: { offeredSlots: offers } });
    await this.seedLead({
      firstName: contact.firstName,
      language: lang,
      register: "usted",
      offeredSlots: offers,
      offeredAt: sentAt,
      lastAiOutboundAt: sentAt,
      disclosedChannels: { SMS: sentAt.toISOString() },
      lastHandledInboundId: asked.id,
      lastHandledInboundAt: asked.dateAdded,
      lastInboundAt: asked.dateAdded,
    });
    return offers;
  }

  /** A booked call tomorrow at 11 a.m. lead time. */
  async seedUpcoming(): Promise<AppointmentRef> {
    const contact = this.ghl.contacts.get(this.cid) as ContactSnapshot;
    const zone = contact.timezone ?? NY;
    const tomorrow = zonedParts(new Date(this.clock.now().getTime() + DAY), zone);
    const start = zonedTimeToDate(tomorrow, 11 * 60, zone);
    const appt: AppointmentRef = {
      id: "apptSeed0000000001",
      calendarId: CALENDAR_IDS.final_expense.es,
      contactId: this.cid,
      startTime: start,
      endTime: new Date(start.getTime() + 30 * MIN),
      status: "confirmed",
      title: "Llamada con Isaac",
    };
    this.ghl.appointments.push(appt);
    await this.seedLead({ status: "booked", appointmentId: appt.id, appointmentAt: start, calendarId: appt.calendarId });
    return appt;
  }
}

// Script helpers (the model's tool calls).
const slots = (pref: Record<string, unknown> = {}): ScriptStep => ({
  tool: "find_open_slots",
  input: { after_local: null, before_local: null, part_of_day: null, weekday: null, date_local: null, lead_works: false, lead_declined_offered_times: false, ...pref },
});
const tpl = (template_id: string, slot_ids: string[] = []): ScriptStep => ({ tool: "reply_with_template", input: { template_id, slot_ids } });
const draft = (text: string, intent = "free_text"): ScriptStep => ({ tool: "draft_reply", input: { text, intent } });
const book = (slot_id: string): ScriptStep => ({ tool: "book_appointment", input: { slot_id } });
const tool = (name: string, input: Record<string, unknown> = { reason: "test" }): ScriptStep => ({ tool: name, input });

const ES_ASK = "Hola, ¿me pueden llamar? Quiero información.";

function offeredOf(m: MessageRecord): OfferedSlot[] {
  const v = m.decision?.offeredSlots;
  return Array.isArray(v) ? (v as OfferedSlot[]) : [];
}

/** S1 + S2 in one go: the AI offered two times and they went out (the offers are live). */
async function worldWithSentOffer(o: WorldOptions = {}): Promise<{ w: World; offer: MessageRecord }> {
  const w = new World(o);
  w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
  await w.incoming(ES_ASK);
  const offer = w.last();
  await w.sendPending();
  return { w, offer: await w.message(offer.id) };
}

// ═══ Turn-engine scenarios ═══════════════════════════════════════════════════════════════════

async function scenarioTests(): Promise<void> {
  section("S1 ES lead asks for a call → find_open_slots → offer_times");
  let s1: { w: World; offerId: string } | null = null;
  {
    const w = new World();
    w.outbound("Hola Lucia, gracias por su interés. Isaac le escribe pronto.", { source: "workflow", agoMs: 60 * MIN });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    const r = await w.incoming(ES_ASK);
    const m = w.last();
    const lead = await w.lead();
    const offered = offeredOf(m);
    const free = w.ghl.reads.find((x) => x.op === "getFreeSlots")?.input as { calendarId: string; timeZone: string; userId: string } | undefined;
    check("S1 acted with the template, one model session, 4-call cap", r.kind === "acted" && r.reason === "template_offer_times" && r.messageId === m.id && w.llm.sessions.length === 1 && w.llm.sessions[0].maxCalls === 4, r);
    check(
      "S1 find_open_slots read the product+language calendar in the lead's zone for Isaac",
      free?.calendarId === CALENDAR_IDS.final_expense.es && free.timeZone === NY && free.userId === ISAAC_USER,
      free
    );
    check("S1 an approved template → status approved and a send job right away", m.status === "approved" && w.queue.of("send").some((x) => x.messageId === m.id && x.notBefore === null) && w.alerts("draft_ready").length === 0, m.status);
    eq("S1 decision.offeredSlots holds the two offered times", offered.map((s) => [s.id, s.startIso, s.label]), [
      ["A", "2026-11-17T11:30:00-05:00", "hoy a las 11:30 de la mañana"],
      ["B", "2026-11-17T13:30:00-05:00", "hoy a la 1:30 de la tarde"],
    ]);
    check("S1 lead.offeredSlots are NOT live before the send", lead.offeredSlots.length === 0 && lead.offeredAt === null, lead.offeredSlots);
    eq(
      "S1 golden first message: greeting + AI disclosure + template ('u hoy') + STOP footer",
      m.body,
      "Hola Lucia, le responde el asistente de IA (inteligencia artificial) de Isaac Plans Insurance. ¿Le puede llamar Isaac hoy a las 11:30 de la mañana u hoy a la 1:30 de la tarde? Responda STOP para no recibir más mensajes."
    );
    check(
      "S1 decision snapshot: consumer-initiated, fresh reply window, approval mode, disclosure + STOP, no message text",
      m.decision?.consentBasis === "consumer_initiated" &&
        (m.decision?.replyWindow as { allowedNow: boolean; reason: string }).reason === "fresh_reply" &&
        m.decision?.mode === "approval" &&
        m.decision?.includesDisclosure === true &&
        m.decision?.includesStop === true &&
        m.decision?.approvedTemplate === true &&
        !JSON.stringify(m.decision).includes("Quiero"),
      m.decision
    );
    check(
      "S1 lead context saved: es/usted/final_expense/zone/state, watermark, turn counters",
      lead.language === "es" &&
        lead.register === "usted" &&
        lead.product === "final_expense" &&
        lead.leadTimezone === NY &&
        lead.stateCode === "FL" &&
        lead.firstName === "Lucia" &&
        lead.lastHandledInboundId === w.ghl.thread(CID).find((x) => x.body === ES_ASK)?.id &&
        lead.turnsDay === "2026-11-17" &&
        lead.turnsToday === 1 &&
        lead.threadTurns === 1 &&
        lead.turnState === "idle",
      lead
    );
    const usage = w.store.usage.get("2026-11-17");
    check("S1 budget reserved then settled to the real cost (2 calls), turn counted", usage?.reservedMicros === 0 && usage.costMicros === 12_000 && usage.turns === 1 && w.events("turn").length === 1, usage);
    check("S1 the model saw facts, the masked thread and the workflow text as automation", w.llm.sessions[0].userContent.includes("lead_state: FL | licensed_state: yes") && w.llm.sessions[0].userContent.includes("· SMS · automation]"));
    s1 = { w, offerId: m.id };
  }
  {
    const w = new World({ approve: "none" });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    const m = w.last();
    const alert = w.alerts("draft_ready")[0];
    check(
      "S1b template not approved → draft for Isaac + draft_ready card (no lead text in it), no send job, expires in 2 h",
      m.status === "draft" &&
        w.queue.of("send").length === 0 &&
        alert?.messageId === m.id &&
        alert.firstName === "Lucia" &&
        alert.product === "final_expense" &&
        alert.state === "FL" &&
        alert.sendsAt === "ahora" &&
        !JSON.stringify(alert).includes("Quiero") &&
        m.expiresAt?.getTime() === m.createdAt.getTime() + 2 * HOUR,
      { m: m.status, alert }
    );
  }
  {
    const w = new World({ approve: [] });
    w.settings.value.approvedTemplates = { offer_times: "0000000000000000" };
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    const stale = w.last().status;
    const fb = new World();
    fb.llm.script({ usedFallback: true, steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await fb.incoming(ES_ASK);
    check("S1c an approval of an older wording (hash) → draft; S1d a fallback model's pick → draft", stale === "draft" && fb.last().status === "draft" && fb.last().usedFallback, [stale, fb.last().status]);
  }

  section("S2 the send job: two-phase, idempotent");
  if (s1) {
    const { w, offerId } = s1;
    const [job] = w.takeSends();
    const results = await Promise.all([runSend(job, w.ports), runSend(job, w.ports)]);
    const sent = await w.message(offerId);
    const lead = await w.lead();
    check("S2 two concurrent send jobs → exactly one POST", w.writes("sendMessage").length === 1 && j(results.map((r) => r.kind).sort()) === j(["noop", "sent"]), results);
    check(
      "S2 sent: GHL id recorded and known as ours; sentAt set",
      sent.status === "sent" && sent.ghlMessageId === "ghl_out_01" && sent.sentAt !== null && (await w.store.knownGhlMessageIds(CID)).has("ghl_out_01"),
      sent
    );
    check(
      "S2 only now are the offers live; the disclosure is stamped on SMS",
      lead.offeredSlots.length === 2 && lead.offeredAt !== null && typeof lead.disclosedChannels.SMS === "string" && lead.lastAiOutboundAt !== null,
      lead
    );
    const again = await runSend(job, w.ports);
    check("S2 a QStash redelivery of the same job sends nothing", again.kind === "noop" && w.writes("sendMessage").length === 1, again);

    section("S3 the lead picks 'el primero' → book_appointment → confirm_booking");
    const offered = offeredOf(sent);
    w.advance(5 * MIN);
    w.llm.script({ steps: [book("A"), tpl("confirm_booking")] });
    const r = await w.incoming("El primero");
    const creates = w.writes("createAppointment");
    const input = creates[0]?.input as { calendarId: string; startIso: string; endIso: string; assignedUserId: string; title: string; description: string };
    const booked = await w.lead();
    const confirm = w.last();
    check("S3 the model saw the live offers by id", w.llm.sessions[1].userContent.includes('live_offered_times (the lead has seen these): A = "hoy a las 11:30 de la mañana", B = "hoy a la 1:30 de la tarde"'));
    check(
      "S3 one appointment: product+language calendar, the offered start, 30 min, Isaac assigned, fixed title",
      creates.length === 1 &&
        input.calendarId === CALENDAR_IDS.final_expense.es &&
        input.startIso === offered[0].startIso &&
        input.endIso === "2026-11-17T17:00:00.000Z" &&
        input.assignedUserId === ISAAC_USER &&
        input.title === "Llamada con Isaac" &&
        input.description.includes("Producto: Gastos finales"),
      input
    );
    check(
      "S3 lead booked: appointment id/time/calendar, booking intent cleared, offers cleared",
      r.reason === "template_confirm_booking" &&
        booked.status === "booked" &&
        booked.appointmentId === w.ghl.appointments[0]?.id &&
        booked.appointmentAt?.toISOString() === "2026-11-17T16:30:00.000Z" &&
        booked.calendarId === CALENDAR_IDS.final_expense.es &&
        booked.bookingIntent === null &&
        booked.offeredSlots.length === 0 &&
        booked.rejectionsCount === 0,
      { r, booked }
    );
    check(
      "S3 ai_booked tag + CRM note + booked alert",
      w.writes("addTags").some((x) => j(x.input) === j([AI_BOOKED_TAG])) &&
        w.writes("addNote").some((x) => String(x.input).includes("Cita agendada por el asistente de IA")) &&
        w.alerts("booked")[0]?.whenLabel.endsWith(" ET") === true
    );
    eq(
      "S3 confirm_booking: no second disclosure, the date in the lead's zone, Isaac's number and vCard",
      confirm.body,
      "¡Listo! Isaac le llamará el martes 17 de nov. a las 11:30 de la mañana (su hora) desde el (540) 426-1804. Guarde su número: isaacplans.com/isaac-orraiz.vcf. ¿Necesita otro horario? Responda aquí."
    );
    const confirmSend = await w.sendPending();
    check("S3 the confirmation goes out (lead is booked = status at creation)", confirmSend[0]?.kind === "sent", confirmSend);
  }
  {
    // A booked turn is retried after the worker died right after the POST.
    const w = new World();
    const offers = await w.seedLiveOffers();
    w.say("Sí, el primero");
    const armed = await w.arm();
    w.llm.script({ steps: [book("A")], crash: true });
    const first = await w.turn();
    const mid = await w.lead();
    check(
      "S3b a throw right after the POST: one appointment, intent saved, the turn re-arms itself (not stuck running)",
      first.reason === "threw" && first.rearm?.retry === 1 && w.writes("createAppointment").length === 1 && mid.turnState === "armed" && mid.bookingIntent?.slotIso === offers[0].startIso,
      { first, mid }
    );
    const early = await runTurn(CID, armed.runId as string, w.ports, { reason: "inbound", retry: 0 });
    check("S3b the old run id can no longer claim", early.kind === "noop" && early.reason === "not_claimable", early);
    w.advance(60_000);
    w.llm.script({ steps: [book("A"), tpl("confirm_booking")] });
    const retried = await runTurn(CID, first.rearm?.runId as string, w.ports, { reason: "inbound", retry: 1 });
    const after = await w.lead();
    check("S3b the retry books nothing twice", w.writes("createAppointment").length === 1, { retried });
    check(
      "S3b a retried booking turn recognizes its own booking (status booked, ai_booked tag, booked alert, confirm_booking)",
      after.status === "booked" && w.writes("addTags").length > 0 && w.alerts("booked").length === 1 && w.last().templateId === "confirm_booking",
      { retried, status: after.status, bookingIntent: after.bookingIntent, tool: w.llm.sessions[1]?.trace[0]?.result.content }
    );
    const stuck = new World();
    stuck.say("Sí, el primero");
    const stuckArmed = await stuck.arm();
    await stuck.store.claimTurn(CID, stuckArmed.runId as string, stuck.clock.now());
    stuck.advance(30_000);
    const alive = await runTurn(CID, stuckArmed.runId as string, stuck.ports, { reason: "inbound", retry: 0 });
    check("S3b a worker killed mid-turn: a QStash retry while the claim looks alive is not claimable", alive.kind === "noop" && alive.reason === "not_claimable", alive);
    stuck.advance(7 * MIN);
    stuck.llm.script({ steps: [tool("end_without_reply", { reason: "test" })] });
    const retaken = await runTurn(CID, stuckArmed.runId as string, stuck.ports, { reason: "inbound", retry: 0 });
    check("S3b …after 6 minutes the dead claim is retaken (attempt 2)", (await stuck.lead()).attempt === 2 && retaken.kind !== "noop", retaken);
  }

  section("S4 STOP on SMS: code-only opt-out, the carrier confirms");
  {
    const { w } = await worldWithSentOffer();
    const sessions = w.llm.sessions.length;
    const r = await w.incoming("STOP");
    const sup = w.store.suppressions.get("+13055550142");
    const lead = await w.lead();
    check("S4 opted out by code, no model call", r.reason === "opted_out" && w.llm.sessions.length === sessions, r);
    check("S4 suppression by E.164, for everything, with the raw text as evidence", sup?.scope === "all" && sup.source === "keyword" && sup.rawText === "STOP" && sup.contactId === CID && sup.liftedAt === null, sup);
    check("S4 no confirmation of ours (GHL/the carrier already answers STOP on SMS)", w.msgs().every((m) => m.templateId !== "optout_confirm") && w.writes("sendMessage").length === 1);
    check("S4 permanent DND on every channel at once", w.writes("setDnd").length === 1 && j(w.writes("setDnd")[0].input) === j(ALL_DND));
    check("S4 lead opted_out, offers cleared, opted_out alert", lead.status === "opted_out" && lead.offeredSlots.length === 0 && w.alerts("opted_out").length === 1, lead.status);
    const later = await w.incoming("¿Hola?");
    check("S4 anything after: skipped as suppressed, no model call", later.reason === "suppressed" && w.llm.sessions.length === sessions, later);
    const start = await w.incoming("START");
    check(
      "S4 START lifts the suppression (row kept) and reactivates the lead",
      start.reason === "start" && !(await w.store.isSuppressed("+13055550142")) && w.store.suppressions.get("+13055550142")?.liftReason === "start_keyword" && (await w.lead()).status === "active",
      start
    );
  }
  {
    const w = new World();
    const r = await w.incoming("STOP", { channel: "WhatsApp" });
    const m = w.last();
    check(
      "S4b STOP on WhatsApp: our confirmation on WhatsApp (no carrier there); DND at once on every other channel, WhatsApp's after the send",
      r.reason === "opted_out" &&
        m?.templateId === "optout_confirm" &&
        m.channel === "WhatsApp" &&
        j(m.decision?.setDndAfterSend) === j(["WhatsApp"]) &&
        w.writes("setDnd").length === 1 &&
        j(w.writes("setDnd")[0].input) === j(ALL_DND.filter((c) => c !== "WhatsApp")),
      m
    );
    const paused = new World();
    paused.settings.value.paused = true;
    const rp = await paused.incoming("No me escriban más");
    check("S4c an opt-out is honored even while everything is paused (FL 501.059)", rp.reason === "opted_out" && (await paused.store.isSuppressed("+13055550142")), rp);
  }

  section("S5 'no me escriban más' / wrong number: DND on the other channels at once, the reply channel's right after the confirmation");
  for (const text of ["No me escriban más", "Número equivocado"]) {
    const w = new World();
    const r = await w.incoming(text);
    const m = w.last();
    check(
      `S5 "${text}": opted out by code, optout_confirm approved (compliance), SMS DND after the send, the other channels now`,
      r.reason === "opted_out" &&
        w.llm.sessions.length === 0 &&
        m.templateId === "optout_confirm" &&
        m.status === "approved" &&
        m.decision?.compliance === true &&
        j(m.decision?.setDndAfterSend) === j(["SMS"]) &&
        m.body === "Entendido. No le enviaremos más mensajes. - Isaac Plans Insurance" &&
        w.writes("setDnd").length === 1 &&
        j(w.writes("setDnd")[0].input) === j(ALL_DND.filter((c) => c !== "SMS")),
      { r, m }
    );
    const sent = await w.sendPending();
    const ops = w.ghl.writes.map((x) => x.op);
    check(
      `S5 "${text}": the confirmation goes out to an opted-out lead, then SMS DND`,
      sent[0]?.kind === "sent" && ops.lastIndexOf("setDnd") > ops.indexOf("sendMessage") && j(w.writes("setDnd")[1]?.input) === j(["SMS"]),
      ops
    );
  }
  {
    const w = new World({ contact: { dndChannels: { SMS: "active" } } });
    await w.incoming("No me escriban más");
    const sent = await w.sendPending();
    const covered = new Set(w.writes("setDnd").flatMap((x) => x.input as DndChannel[]));
    check(
      "S5b an app-detected opt-out still sets permanent DND on every channel when its confirmation can't be sent (SMS DND already active)",
      sent[0]?.kind === "blocked" && ALL_DND.every((c) => covered.has(c)) && w.writes("sendMessage").length === 0,
      { sent, covered: [...covered] }
    );
  }

  section("S6 'Quiero cancelar la cita' is not an opt-out → cancel_appointment");
  {
    const w = new World();
    const appt = await w.seedUpcoming();
    w.llm.script({ steps: [tool("cancel_appointment", { reason: "lead asked to cancel" }), tpl("confirm_cancel")] });
    const r = await w.incoming("Quiero cancelar la cita");
    const lead = await w.lead();
    check("S6 reached the model, no suppression", w.llm.sessions.length === 1 && w.store.suppressions.size === 0 && r.reason === "template_confirm_cancel", r);
    check("S6 the model saw the appointment", w.llm.sessions[0].userContent.includes("upcoming_appointment: Wed, Nov 18 at 11am (your time)"));
    check("S6 PUT status cancelled (no new time) on the right appointment", j(w.writes("updateAppointment")[0]?.input) === j({ appointmentId: appt.id, status: "cancelled" }), w.writes("updateAppointment"));
    check(
      "S6 lead active again without an appointment; note; confirm_cancel text",
      lead.status === "active" &&
        lead.appointmentId === null &&
        w.writes("addNote").some((x) => String(x.input).includes("canceló")) &&
        w.last().body?.includes(". Listo, cancelé su llamada con Isaac. Si quiere otro horario, responda aquí.") === true,
      { lead: lead.status, body: w.last().body }
    );
  }

  section("S7 ambiguous ('can you stop by tomorrow?') → one clarification, Isaac alerted");
  {
    const w = new World({ lead: LEADS.en });
    const r = await w.incoming("can you stop by tomorrow?");
    const m = w.last();
    check(
      "S7 optout_clarify (compliance, EN), optOutPending, optout_ambiguous alert, no model, no suppression",
      r.reason === "optout_clarify" &&
        m.templateId === "optout_clarify" &&
        m.status === "approved" &&
        m.body === "Do you want us to stop messaging you completely? Reply STOP to confirm. - Isaac Plans Insurance" &&
        (await w.lead()).optOutPending &&
        w.alerts("optout_ambiguous").length === 1 &&
        w.llm.sessions.length === 0 &&
        w.store.suppressions.size === 0,
      { r, body: m.body }
    );
    await w.sendPending();
    w.advance(2 * MIN);
    const unclear = await w.incoming("Sorry, I meant: can Isaac call me tomorrow?");
    check(
      "S7 while the clarification is pending, an unclear answer stays frozen: no model, Isaac alerted again",
      unclear.reason === "optout_pending" && (await w.lead()).optOutPending && w.llm.sessions.length === 0 && w.alerts("optout_ambiguous").length === 2,
      unclear
    );
    w.advance(2 * MIN);
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    const later = await w.incoming("No, keep texting");
    check("S7 a clear 'no' lifts the freeze and goes to the model", later.reason === "template_offer_times" && !(await w.lead()).optOutPending, later);
    check("S7 Central-time lead: offers name the zone", offeredOf(w.last())[0]?.label.endsWith("(Central time)") === true, offeredOf(w.last()));
    const yes = new World({ lead: LEADS.en });
    await yes.incoming("can you stop by tomorrow?");
    await yes.sendPending();
    yes.advance(MIN);
    const confirmed = await yes.incoming("yes");
    check(
      "S7 'yes' to the clarification is an opt-out decided by code (suppression, opted_out, no model)",
      confirmed.reason === "opted_out" && (await yes.store.isSuppressed("+12145550147")) && yes.llm.sessions.length === 0,
      confirmed
    );
  }

  section("S8 HELP → fixed answer, even with no template approved or everything paused");
  {
    const w = new World({ lead: LEADS.en, approve: "none" });
    const r = await w.incoming("HELP");
    const m = w.last();
    const sent = await w.sendPending();
    check(
      "S8 HELP: approved compliance template, sent; no model",
      r.reason === "help" &&
        m.status === "approved" &&
        m.body === "Isaac Plans Insurance: Isaac Orraiz, licensed agent. Call (540) 426-1804 or visit isaacplans.com. Reply STOP to opt out." &&
        sent[0]?.kind === "sent" &&
        w.llm.sessions.length === 0,
      { r, body: m.body, sent }
    );
    const paused = new World({ approve: "none" });
    paused.settings.value.paused = true;
    await paused.incoming("AYUDA");
    const ps = await paused.sendPending();
    check("S8 AYUDA while paused: Spanish HELP, still sent", paused.last().body?.startsWith("Isaac Plans Insurance: Isaac Orraiz, agente con licencia.") === true && ps[0]?.kind === "sent", ps);
    const carrier = new World({ env: { AI_SETTER_REPLY_HELP: "false" } });
    const rc = await carrier.incoming("HELP");
    check("S8 AI_SETTER_REPLY_HELP=false → the carrier answers, we send nothing", rc.reason === "help_answered_by_carrier" && carrier.msgs().length === 0);
  }

  section("S9 Isaac replies by hand → the AI pauses; automation never does");
  {
    const { w } = await worldWithSentOffer();
    w.advance(5 * MIN);
    w.llm.script({ steps: [draft("¡Buena pregunta! Isaac le explica todo en una llamada corta. ¿Le parece bien?", "price_question")] });
    await w.incoming("¿Y cuánto cuesta?");
    const pending = w.last();
    w.advance(10 * MIN);
    const human = w.outbound("Hola Lucia, soy Isaac. Le llamo en un rato.", { source: "app", userId: ISAAC_USER });
    await w.arm();
    const sessions = w.llm.sessions.length;
    const r = await w.turn({ debounceMs: 5_000 });
    const lead = await w.lead();
    check("S9 the user_replied poke (no new inbound) pauses: human_took_over, no model call", r.reason === "human_took_over" && w.llm.sessions.length === sessions, r);
    check("S9 the AI's pending draft is superseded", (await w.message(pending.id)).status === "superseded" && (await w.message(pending.id)).error === "isaac_replied");
    check(
      "S9 paused 48 h from Isaac's message, disclosure reset",
      lead.status === "paused" && lead.pausedUntil?.getTime() === human.dateAdded.getTime() + 48 * HOUR && lead.pauseReason === "isaac_replied" && j(lead.disclosedChannels) === "{}",
      lead
    );
    const during = await w.incoming("¿Hola?");
    check("S9 while paused the lead's messages are skipped", during.reason === "paused" && w.llm.sessions.length === sessions, during);
    w.advance(49 * HOUR);
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    const back = await w.incoming("¿Siguen ahí?");
    check("S9 after 48 h the AI resumes, with the AI disclosure again", back.reason === "template_offer_times" && (await w.lead()).status === "active" && w.last().body?.includes("le responde el asistente de IA") === true, back);
  }
  for (const [label, o] of [
    ["a workflow SMS", { source: "workflow" }],
    ["a GHL calendar confirmation (no source, no user)", { source: null }],
    ["a campaign step", { source: "campaign", messageType: "TYPE_CAMPAIGN_SMS" }],
  ] as const) {
    const { w } = await worldWithSentOffer();
    w.advance(5 * MIN);
    w.outbound("Su cita ha sido confirmada / Recordatorio", o);
    w.advance(MIN);
    w.llm.script({ steps: [book("A"), tpl("confirm_booking")] });
    const r = await w.incoming("El primero");
    check(`S9b ${label} after the AI's message does NOT pause`, r.reason === "template_confirm_booking", r);
  }
  for (const [label, o] of [
    ["a Kixie text (TYPE_CUSTOM_SMS)", { source: "api", messageType: "TYPE_CUSTOM_SMS" }],
    ["Isaac's outbound call", { source: null, channel: "Call" as ThreadChannel, messageType: "TYPE_CALL" }],
    ["a WhatsApp from Isaac's phone", { source: null, channel: "WhatsApp" as ThreadChannel }],
  ] as const) {
    const { w } = await worldWithSentOffer();
    w.advance(5 * MIN);
    w.outbound("Hola", o);
    w.advance(MIN);
    const r = await w.incoming("El primero");
    check(`S9c ${label} pauses the AI`, r.reason === "human_took_over" && (await w.lead()).status === "paused", r);
  }

  section("S10–S11 stale messages and who the AI never answers");
  {
    const w = new World();
    w.say(ES_ASK, { agoMs: 13 * HOUR });
    await w.arm();
    const r = await w.turn();
    const m = w.last();
    check("S10 an inbound older than 12 h → stale inbox item, watermark saved, no model", r.reason === "stale_inbound" && m.status === "stale" && m.intent === "stale_inbound" && w.llm.sessions.length === 0 && (await w.lead()).lastHandledInboundId !== null, r);
  }
  const skips: Array<[string, WorldOptions, (w: World) => void | Promise<void>, string]> = [
    ["not tagged ai_setter", { contact: { tags: ["spanish", "final expense lead"] } }, () => undefined, "not_enrolled"],
    ["legal_shield tag", { contact: { tags: ["ai_setter", "legal_shield"] } }, () => undefined, "excluded_tag"],
    ["ai_setter_off tag", { contact: { tags: ["ai_setter", "ai_setter_off"] } }, () => undefined, "excluded_tag"],
    ["suppressed phone (another contact's opt-out)", {}, (w) => w.store.addSuppression({ e164: "+13055550142", scope: "all", source: "admin", rawText: null, contactId: "cOtherContact000001" }), "suppressed"],
    ["GHL DND on", { contact: { dnd: true } }, () => undefined, "dnd"],
    ["SMS DND permanent", { contact: { dndChannels: { SMS: "permanent" } } }, () => undefined, "dnd"],
    ["another GHL location", { contact: { locationId: "locSomewhereElse001" } }, () => undefined, "wrong_location"],
    ["not a NANP phone", { contact: { phone: "+525512345678" } }, () => undefined, "no_valid_phone"],
    ["settings unreadable (fail closed)", {}, (w) => void (w.settings.value.failedClosed = true), "settings_unavailable"],
    ["everything paused", {}, (w) => void (w.settings.value.paused = true), "paused_all"],
    ["daily cap per contact", {}, (w) => w.seedLead({ turnsDay: "2026-11-17", turnsToday: 8 }), "contact_daily_cap"],
    ["lead stopped", {}, (w) => w.seedLead({ status: "stopped" }), "status_stopped"],
    ["lead with Isaac", {}, (w) => w.seedLead({ status: "handoff" }), "with_isaac"],
  ];
  for (const [label, o, setup, reason] of skips) {
    const w = new World(o);
    await setup(w);
    const r = await w.incoming(ES_ASK);
    check(`S11 ${label} → skipped (${reason}), no model, nothing sent`, r.reason === reason && w.llm.sessions.length === 0 && w.queue.of("send").length === 0, r);
  }
  {
    const w = new World();
    w.calls.client = true;
    const r = await w.incoming(ES_ASK);
    const alert = w.alerts("handoff")[0];
    check("S11 a current client (app DB) → handoff existing_client, no model", r.reason === "existing_client" && (await w.lead()).status === "handoff" && alert?.reason === "existing_client" && w.llm.sessions.length === 0, r);
  }

  section("S12 the lead's hours: held replies");
  {
    const w = new World({ now: "2026-11-18T03:30:00.000Z" });
    w.say("Hola, ¿me pueden llamar mañana?", { agoMs: 40 * MIN });
    await w.arm();
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.turn();
    const m = w.last();
    check(
      "S12 10:30 pm, message 40 min old → notBefore = 8:00 am lead time, send job held for it",
      m.notBefore?.toISOString() === "2026-11-18T13:00:00.000Z" &&
        (m.decision?.replyWindow as { reason: string }).reason === "outside_hours" &&
        w.queue.of("send").some((x) => x.messageId === m.id && x.notBefore?.toISOString() === "2026-11-18T13:00:00.000Z"),
      { notBefore: m.notBefore, decision: m.decision?.replyWindow }
    );
    const early = await w.sendPending();
    check("S12 the send job run early is held again (not_before)", early[0]?.kind === "held" && early[0].reason === "not_before" && w.writes("sendMessage").length === 0, early);
    w.clock.set("2026-11-18T13:00:00.000Z");
    const onTime = await w.sendPending();
    const body = (await w.message(m.id)).body ?? "";
    check("S12 at 8:00 am it goes out", onTime[0]?.kind === "sent", onTime);
    const wording = offeredOf(m).map((s) => formatSlotForText(s.startIso, { lang: "es", leadZone: NY, now: w.clock.now(), showZone: false }));
    check(
      "S12 a reply held overnight names the right day when it is delivered",
      wording.every((label) => body.includes(label)),
      { body, atDelivery: wording }
    );
  }
  {
    const w = new World({ now: "2026-11-22T20:00:00.000Z", lead: LEADS.es_pa });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming("Hola, ¿me pueden llamar?");
    const m = w.last();
    check("S12b a Pennsylvania lead on Sunday (even a fresh reply) → held until Monday 9:00 am", m.notBefore?.toISOString() === "2026-11-23T14:00:00.000Z" && (m.decision?.replyWindow as { reason: string }).reason === "pa_window", m.notBefore);
    const held = await w.sendPending();
    check("S12b the send job is held on Sunday", held[0]?.kind === "held" && w.writes("sendMessage").length === 0, held);
    check(
      "S12b a reply held until Monday never offers times that have already passed by then",
      offeredOf(m).every((s) => Date.parse(s.startIso) > Date.parse("2026-11-23T14:00:00.000Z")),
      offeredOf(m).map((s) => s.label)
    );
  }

  section("S13 WhatsApp 24-hour window");
  {
    const w = new World({ env: { AI_SETTER_INBOUND_MAX_AGE_HOURS: "48" } });
    w.say("Hola, ¿me pueden llamar?", { channel: "WhatsApp", agoMs: 25 * HOUR });
    await w.arm();
    const r = await w.turn();
    check("S13 newest inbound is a WhatsApp older than 24 h → whatsapp_window_closed, no model", r.reason === "whatsapp_window_closed" && w.llm.sessions.length === 0, r);
  }
  {
    const w = new World({ approve: "none", env: { AI_SETTER_DRAFT_TTL_HOURS: "24" } });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK, { channel: "WhatsApp" });
    const d = w.last();
    check("S13 a reply to a WhatsApp goes on WhatsApp", d.channel === "WhatsApp" && d.status === "draft", d.channel);
    w.advance(24 * HOUR + 5_000);
    await w.approve(d.id);
    const res = await w.sendPending();
    check("S13 approved after the window closed → stale, nothing sent", res[0]?.kind === "stale" && res[0].reason === "whatsapp_window_closed" && w.writes("sendMessage").length === 0, res);
  }

  section("S14 free text: the guard, one regeneration, then Isaac");
  {
    const w = new World();
    w.llm.script({ steps: [draft("Isaac le explica su póliza hoy mismo.", "explain")] }, { steps: [draft("Con gusto, Isaac le explica todo en una llamada corta. ¿Le parece bien?", "explain")] });
    const r = await w.incoming("¿Me explican cómo funciona?");
    const m = w.last();
    check("S14 the guard's violations go back to the model once", w.llm.sessions[0].feedback.length === 1 && w.llm.sessions[0].feedback[0].includes("banned_word:poliza"), w.llm.sessions[0].feedback);
    check(
      "S14 the second draft passes → free text ALWAYS waits for Isaac (draft + draft_ready), cost recorded",
      r.reason === "draft" && m.kind === "free_text" && m.status === "draft" && m.intent === "explain" && w.alerts("draft_ready").length === 1 && m.costMicros === 12_000 && m.body?.endsWith("¿Le parece bien? Responda STOP para no recibir más mensajes.") === true,
      { r, m: m.status, body: m.body }
    );
  }
  {
    const w = new World();
    w.llm.script({ steps: [draft("Su póliza sale barata.", "price")] }, { steps: [draft("La prima es baja, solo $20 al mes.", "price")] });
    const r = await w.incoming("¿Cuánto cuesta?");
    const blocked = w.msgs().find((x) => x.status === "blocked");
    const lead = await w.lead();
    check(
      "S14 failing twice → blocked (flags kept), handoff guard_failed; the lead only gets the fixed hold message",
      r.reason === "handoff_guard_failed" &&
        blocked?.guardFlags.includes("banned_word:prima") === true &&
        blocked.guardFlags.includes("money:$") &&
        lead.status === "handoff" &&
        lead.pauseReason === "guard_failed" &&
        w.alerts("handoff")[0]?.reason === "guard_failed" &&
        w.msgs().filter((x) => x.status === "approved").every((x) => x.templateId === "handoff_hold"),
      { r, flags: blocked?.guardFlags }
    );
  }
  {
    const w = new World();
    await w.seedLiveOffers();
    w.llm.script({ steps: [draft("¡Perfecto! Su póliza queda lista.", "confirm")] }, { steps: [book("A"), tpl("confirm_booking")] });
    const r = await w.incoming("Sí, la primera");
    const lead = await w.lead();
    check(
      "S14b a booking made on the guard-retry round is applied and confirmed (lead booked, tag, alert, confirm_booking with the time)",
      lead.status === "booked" && w.alerts("booked").length === 1 && w.msgs().some((x) => x.templateId === "confirm_booking"),
      { reason: r.reason, status: lead.status, appointments: w.writes("createAppointment").length }
    );
  }
  {
    const w = new World({ lead: LEADS.es_ny });
    w.llm.script({ steps: [draft("Lo siento, su seguro no aplica aquí.", "close")] }, { steps: [tpl("out_of_license")] });
    await w.incoming("Hola, vivo en Nueva York, ¿me pueden ayudar?");
    const lead = await w.lead();
    check(
      "S14c out_of_license chosen on the guard-retry round still stops the lead and tags out_of_license_state",
      lead.status === "stopped" && w.writes("addTags").some((x) => j(x.input) === j([OUT_OF_LICENSE_STATE_TAG])),
      { status: lead.status, template: w.last().templateId }
    );
  }

  section("S15 shadow mode (AI_SETTER_DRY_RUN=true)");
  {
    const w = new World({ env: { AI_SETTER_DRY_RUN: "true" } });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    const m = w.last();
    check("S15 the reply is stored as 'shadow': no send job, no card, decision mode shadow", m.status === "shadow" && w.queue.of("send").length === 0 && w.alerts("draft_ready").length === 0 && m.decision?.mode === "shadow", m.status);
    const offers = offeredOf(m);
    await w.seedLead({ offeredSlots: offers, offeredAt: w.clock.now() });
    w.advance(5 * MIN);
    w.llm.script({ steps: [book("A"), tpl("confirm_booking")] });
    await w.incoming("El primero");
    const lead = await w.lead();
    check(
      "S15 booking is simulated: no createAppointment, no tag, no booked alert, a would_booked event, the confirmation is shadow",
      w.writes("createAppointment").length === 0 && w.writes("addTags").length === 0 && w.alerts("booked").length === 0 && w.events("would_booked").length === 1 && w.last().status === "shadow",
      w.ghl.writes.map((x) => x.op)
    );
    check(
      "S15 a simulated booking leaves the lead's status and booking intent alone",
      lead.status !== "booked" && lead.bookingIntent === null,
      { status: lead.status, bookingIntent: lead.bookingIntent }
    );
  }

  section("S16 budget: reserved before the model, fails safe");
  {
    const w = new World({ env: { AI_SETTER_DAILY_BUDGET_USD: "1" } });
    w.store.usage.set("2026-11-17", { turns: 9, reservedMicros: 0, costMicros: 600_000, sends: 0 });
    const r = await w.incoming(ES_ASK);
    const m = w.last();
    check(
      "S16 over budget → no model call, budget alert, handoff with a hold message and a note",
      r.reason === "handoff_other" &&
        w.llm.sessions.length === 0 &&
        w.alerts("budget")[0]?.percent === 100 &&
        w.alerts("handoff")[0]?.reason === "other" &&
        m.templateId === "handoff_hold" &&
        m.body?.includes("¡Gracias! Isaac le responde personalmente en breve.") === true &&
        w.writes("addNote").some((x) => String(x.input).includes("Presupuesto diario")) &&
        (await w.lead()).status === "handoff",
      { r, body: m?.body }
    );
    check("S16 the hold message still goes out to a lead in handoff", (await w.sendPending())[0]?.kind === "sent");
    const tiny = new World({ env: { AI_SETTER_DAILY_BUDGET_USD: "0.1" } });
    const rt = await tiny.incoming(ES_ASK);
    check("S16 a budget below one turn's reservation (~$0.54) never calls the model", rt.reason === "handoff_other" && tiny.llm.sessions.length === 0, rt);
  }

  section("S17 loops: an auto-responder talking to the AI");
  {
    const w = new World();
    for (let i = 3; i >= 1; i--) w.say("Gracias por escribirnos, en breve le contestamos", { agoMs: i * MIN });
    await w.arm();
    const r = await w.turn();
    check("S17 the same long message 3 times → paused 24 h + loop alert, no model", r.reason === "loop" && (await w.lead()).status === "paused" && (await w.lead()).pauseReason === "loop" && w.alerts("loop_paused").length === 1 && w.llm.sessions.length === 0, r);
  }
  {
    const w = new World();
    for (let i = 0; i < 3; i++) {
      const at = (40 - i * 10) * MIN;
      const ours = w.outbound(`Mensaje del asistente ${i}`, { source: "api", agoMs: at });
      await w.store.createMessage({ contactId: CID, channel: "SMS", kind: "template", status: "sent", ghlMessageId: ours.id, body: ours.body });
      w.say(`respuesta automática número ${i}`, { agoMs: at - 4_000 });
    }
    await w.arm();
    const r = await w.turn();
    check("S17 3 of our messages answered within 15 s → loop", r.reason === "loop" && w.llm.sessions.length === 0, r);
  }

  section("S18 model failures: refusal, transient and permanent API errors");
  {
    const w = new World();
    w.llm.script({ end: { kind: "refused", detail: "cyber" } });
    const r = await w.incoming(ES_ASK);
    const lead = await w.lead();
    check(
      "S18 refusal → handoff model_refused, alert, nothing sent to the lead, budget settled",
      r.reason === "handoff_model_refused" && lead.status === "handoff" && lead.pauseReason === "model_refused" && w.alerts("handoff")[0]?.reason === "model_refused" && w.msgs().length === 0 && w.store.usage.get("2026-11-17")?.reservedMicros === 0,
      r
    );
  }
  {
    const w = new World();
    w.llm.script({ end: { kind: "error", detail: "529:OverloadedError" } });
    const r = await w.incoming(ES_ASK);
    const lead = await w.lead();
    check(
      "S18 '529:OverloadedError' → re-armed for 120 s (retry 1), watermark NOT saved",
      r.rearm?.delaySeconds === 120 && r.rearm.retry === 1 && lead.turnState === "armed" && lead.runId === r.rearm.runId && lead.lastHandledInboundId === null && w.msgs().length === 0,
      { r, lead: lead.turnState }
    );
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    const retry = await runTurn(CID, r.rearm?.runId as string, w.ports, { reason: "inbound", retry: r.rearm?.retry ?? 0 });
    check("S18 the re-armed turn answers", retry.reason === "template_offer_times", retry);
    const last = new World();
    last.llm.script({ end: { kind: "error", detail: "529:OverloadedError" } });
    last.say(ES_ASK);
    await last.arm();
    const r3 = await last.turn({ retry: 2 });
    check("S18 at retry 2 a 529 hands off instead", r3.reason === "handoff_model_refused" && !r3.rearm, r3);
  }
  {
    const w = new World();
    w.llm.script({ end: { kind: "error", detail: "400:BadRequestError" } });
    const r = await w.incoming(ES_ASK);
    check("S18 '400:BadRequestError' is not retried → handoff", r.reason === "handoff_model_refused" && !r.rearm, r);
  }

  section("S19 'call me now'");
  {
    const w = new World();
    w.llm.script({ steps: [tool("request_call_now", { reason: "lead can talk now" })] });
    const r = await w.incoming("Llámeme ya, estoy libre");
    const m = w.last();
    const lead = await w.lead();
    const timeout = w.queue.of("call_now_timeout")[0];
    check(
      "S19 Isaac free → call_now_checking, call_now card, timeout job (180 s), lead waiting",
      r.reason === "call_now_waiting" &&
        m.templateId === "call_now_checking" &&
        m.body?.includes("Perfecto, déjeme ver si Isaac está libre ahora mismo.") === true &&
        w.alerts("call_now")[0]?.firstName === "Lucia" &&
        timeout?.delaySeconds === 180 &&
        timeout.requestedAt === lead.callNowRequestedAt?.toISOString() &&
        lead.callNowState === "waiting",
      { r, timeout }
    );
    await w.sendPending();
    w.advance(3 * MIN);
    await w.store.updateLeadUnfenced(CID, { callNowState: "timeout" });
    await w.arm();
    w.llm.script({ steps: [slots(), tpl("call_now_unavailable", ["A", "B"])] });
    const t = await w.turn({ reason: "call_now_timeout", debounceMs: 0 });
    check(
      "S19 no tap in 3 min → a call_now_timeout turn offers two times",
      t.reason === "template_call_now_unavailable" &&
        w.llm.sessions[1].userContent.includes("call_now_followup: Isaac could not call within a few minutes") &&
        w.llm.sessions[1].userContent.includes("call_now already used today") &&
        offeredOf(w.last()).length === 2,
      t
    );
  }
  {
    // Isaac didn't tap, and the follow-up turn hits a transient API error.
    const w = new World();
    w.llm.script({ steps: [tool("request_call_now", { reason: "lead can talk now" })] });
    await w.incoming("Llámeme ya, estoy libre");
    await w.sendPending();
    w.advance(3 * MIN);
    await w.store.updateLeadUnfenced(CID, { callNowState: "timeout" });
    await w.arm();
    w.llm.script({ end: { kind: "error", detail: "529:OverloadedError" } });
    const t = await w.turn({ reason: "call_now_timeout", debounceMs: 0 });
    check("S19b a 529 on the call-now follow-up re-arms it", Boolean(t.rearm), t);
    // What process.ts does with result.rearm: publishTurn(..., { retry, reason: "inbound" }).
    const republished = (t.rearm as { reason?: TurnReason } | undefined)?.reason ?? "inbound";
    w.llm.script({ steps: [slots(), tpl("call_now_unavailable", ["A", "B"])] });
    const retried = await runTurn(CID, t.rearm?.runId as string, w.ports, { reason: republished, retry: t.rearm?.retry ?? 0 });
    check(
      "S19b the retried call-now follow-up still offers the two times",
      retried.reason === "template_call_now_unavailable",
      retried
    );
  }
  {
    const w = new World();
    w.settings.value.busyUntil = new Date(Date.parse(TEST_NOW) + HOUR);
    w.llm.script({ steps: [tool("request_call_now", { reason: "now" })] });
    const r = await w.incoming("Llámeme ya");
    const m = w.last();
    check(
      "S19 Isaac busy → call_now_unavailable with 2 times picked by code, no card, no timeout job",
      r.reason === "call_now_call_now_unavailable" && m.templateId === "call_now_unavailable" && offeredOf(m).length === 2 && w.alerts("call_now").length === 0 && w.queue.of("call_now_timeout").length === 0,
      r
    );
  }

  section("S20–S22 license, Medicare, the lead's state");
  {
    const w = new World({ lead: LEADS.es_ny });
    w.llm.script({ steps: [tpl("out_of_license")] });
    const r = await w.incoming("Hola, vivo en Nueva York, ¿me pueden ayudar?");
    const lead = await w.lead();
    check(
      "S20 unlicensed state → out_of_license, lead stopped, out_of_license_state tag",
      r.reason === "template_out_of_license" && w.llm.sessions[0].userContent.includes("licensed_state: NO") && lead.status === "stopped" && w.writes("addTags").some((x) => j(x.input) === j([OUT_OF_LICENSE_STATE_TAG])),
      r
    );
    check("S20 the close still goes out; later messages are skipped", (await w.sendPending())[0]?.kind === "sent" && (await w.incoming("¿Por qué?")).reason === "status_stopped");
  }
  {
    const w = new World();
    const r = await w.incoming("Tengo Medicare, ¿me pueden ayudar?");
    const m = w.last();
    check(
      "S21 Medicare → handoff by code, hold message with the AI notice, note, alert",
      r.reason === "handoff_medicare" &&
        w.llm.sessions.length === 0 &&
        m.body === "Hola Lucia, le responde el asistente de IA (inteligencia artificial) de Isaac Plans Insurance. ¡Gracias! Isaac le responde personalmente en breve. Responda STOP para no recibir más mensajes." &&
        w.writes("addNote").some((x) => String(x.input).includes("(medicare)")) &&
        w.alerts("handoff")[0]?.reason === "medicare" &&
        (await w.lead()).pauseReason === "medicare",
      { r, body: m?.body }
    );
  }
  {
    const w = new World({ lead: LEADS.es_unknown });
    w.llm.script({ steps: [tool("set_lead_state", { state: "California" }), slots(), tpl("offer_times", ["A", "B"])] });
    const r = await w.incoming("Vivo en California, ¿me pueden llamar?");
    const free = w.ghl.reads.find((x) => x.op === "getFreeSlots")?.input as { timeZone: string; calendarId: string };
    const offers = offeredOf(w.last());
    const lead = await w.lead();
    check("S22 facts started with the state unknown", w.llm.sessions[0].userContent.includes("lead_state: unknown | licensed_state: unknown"));
    check(
      "S22 set_lead_state → find_open_slots asks in Pacific time; labels name the zone; the general ES calendar",
      r.reason === "template_offer_times" && free.timeZone === LA && free.calendarId === CALENDAR_IDS.general.es && offers.every((s) => s.label.endsWith("(hora del Pacífico)")) && offers[0]?.label === "hoy a las 9 de la mañana (hora del Pacífico)",
      { free, offers }
    );
    check("S22 the reported state and zone are saved", lead.stateCode === "CA" && lead.leadTimezone === LA, lead);
  }

  section("S23–S25 stale approvals, unknown sends, bursts");
  {
    const w = new World({ approve: "none" });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    const d = w.last();
    w.advance(MIN);
    w.say("Mejor después de las 5");
    await w.approve(d.id);
    const res = await w.sendPending();
    const turnJob = w.queue.of("turn")[0];
    check(
      "S23 a newer inbound after the draft → approval goes stale, a fresh turn is armed and published",
      res[0]?.kind === "stale" && res[0].reason === "newer_inbound" && (await w.message(d.id)).status === "stale" && w.writes("sendMessage").length === 0 && turnJob?.runId === (await w.lead()).runId && (await w.lead()).turnState === "armed",
      res
    );
  }
  {
    const w = new World({ approve: "none" });
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    const d = w.last();
    w.advance(10 * MIN);
    w.outbound("Hola, le llamo ahorita", { source: "app", userId: ISAAC_USER });
    await w.approve(d.id);
    const res = await w.sendPending();
    check("S23b Isaac answered by hand after the draft → stale + the lead paused", res[0]?.reason === "isaac_replied" && (await w.lead()).status === "paused" && w.writes("sendMessage").length === 0, res);
  }
  {
    const w = new World();
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    const m = w.last();
    w.ghl.sendModes.push("unknown_delivered");
    const res = await w.sendPending();
    const verify = w.queue.of("verify")[0];
    check(
      "S24 outcome unknown → send_unknown + a verify job in 120 s; offers not live yet; never re-sent blindly",
      res[0]?.kind === "unknown" && (await w.message(m.id)).status === "send_unknown" && verify?.delaySeconds === 120 && (await w.lead()).offeredSlots.length === 0,
      res
    );
    w.advance(2 * MIN);
    const v = await runVerifySend(m.id, w.ports);
    const after = await w.message(m.id);
    check("S24 the verify job finds the body in the thread → sent with that GHL id; offers live", v.kind === "sent" && after.status === "sent" && after.ghlMessageId === "ghl_out_01" && (await w.lead()).offeredSlots.length === 2 && w.writes("sendMessage").length === 1, v);
  }
  {
    const w = new World();
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    w.ghl.sendModes.push("unknown_lost");
    await w.sendPending();
    const v = await runVerifySend(w.last().id, w.ports);
    check("S24 not found in the thread → failed + error alert, nothing re-sent", v.kind === "failed" && v.reason === "unknown_not_found" && w.alerts("error").length === 1 && w.writes("sendMessage").length === 1, v);
  }
  {
    const w = new World();
    w.say("Hola");
    const a1 = await w.arm();
    w.advance(5_000);
    w.say("¿Me pueden llamar mañana?");
    const a2 = await w.arm();
    check("S25 a burst: the second poke does not arm (one turn per contact)", a1.armed && !a2.armed && a2.runId === null, [a1, a2]);
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    const r = await w.turn();
    check(
      "S25 one turn answers both messages: one model call that saw both, one reply, watermark at the newest",
      r.reason === "template_offer_times" &&
        w.llm.sessions.length === 1 &&
        w.llm.sessions[0].userContent.includes("] Hola") &&
        w.llm.sessions[0].userContent.includes("¿Me pueden llamar mañana?") &&
        w.msgs().length === 1 &&
        (await w.lead()).lastHandledInboundId === w.ghl.thread(CID).at(-1)?.id,
      r
    );
    const dup = await runTurn(CID, a1.runId as string, w.ports, { reason: "inbound", retry: 0 });
    check("S25 a duplicate QStash delivery of the finished turn is not claimable", dup.kind === "noop" && dup.reason === "not_claimable" && w.llm.sessions.length === 1, dup);
    const a3 = await w.arm();
    check("S25 after the turn, the next message arms again", a3.armed);
    const stuck = new World();
    await stuck.arm();
    const first = await stuck.store.claimTurn(CID, (await stuck.lead()).runId as string, stuck.clock.now());
    stuck.advance(7 * MIN);
    const replaced = await stuck.arm();
    const lost = await stuck.store.finishTurn({ contactId: CID, runId: first?.runId as string, attempt: first?.attempt as number }, { status: "stopped" }, { rearm: false });
    check("S25 a turn dead for 6+ min is replaced; the dead worker's fenced writes are refused", replaced.armed && !lost.ok && (await stuck.lead()).status === "active", { replaced, lost });
  }
  {
    const w = new World();
    w.say("¿Cuánto cuesta?");
    await w.arm();
    w.advance(3_000);
    w.say("Ok");
    w.llm.script({ steps: [slots(), tpl("price_redirect", ["A", "B"])] });
    const r = await w.turn();
    check(
      "S25b a burst that ends in 'Ok' still answers the question before it",
      w.llm.sessions.length === 1,
      r
    );
  }
  {
    const w = new World();
    w.llm.script({
      during: () => {
        w.advance(2_000);
        w.say("Mejor después de las 5");
      },
      steps: [slots(), tpl("offer_times", ["A", "B"])],
    });
    const r = await w.incoming(ES_ASK);
    const lead = await w.lead();
    check("S25c the lead writes while the model thinks → the turn re-arms itself (debounce)", r.rearm?.delaySeconds === 20 && lead.turnState === "armed" && lead.runId === r.rearm.runId, r);
    const stale = w.last();
    const res = await w.sendPending();
    check("S25c …the reply it queued waits while the next turn is armed", res[0]?.kind === "held" && res[0].reason === "turn_armed", res);
    // The old offer never went out, so its ids aren't live: the new turn's ids start at A again.
    w.llm.script({ steps: [slots({ after_local: "17:00" }), tpl("offer_times", ["A", "B"])] });
    const next = await w.turn();
    const later = await w.sendPending();
    const sentBodies = w.writes("sendMessage").map((x) => (x.input as { text: string }).text);
    check(
      "S25c …the next turn answers both messages: the old reply is superseded and never sent, one reply goes out",
      next.reason === "template_offer_times" &&
        (await w.message(stale.id)).status === "superseded" &&
        sentBodies.length === 1 &&
        sentBodies[0] === w.last().body &&
        later.some((x) => x.kind === "sent"),
      { next, later, stale: (await w.message(stale.id)).status, sentBodies }
    );
  }
  {
    // The same, when the next turn sends nothing (the new message was just "ok"): the queued
    // reply is regenerated with the full context instead of going out stale.
    const w = new World();
    w.llm.script({
      during: () => {
        w.advance(2_000);
        w.say("Mejor después de las 5");
      },
      steps: [slots(), tpl("offer_times", ["A", "B"])],
    });
    await w.incoming(ES_ASK);
    const queued = w.last();
    await w.sendPending();
    w.llm.script({ steps: [tool("end_without_reply", { reason: "test" })] });
    await w.turn();
    const res = await w.sendPending();
    const lead = await w.lead();
    check(
      "S25d a queued reply older than a message the next turn didn't answer → stale and a regeneration that re-reads both",
      res[0]?.kind === "stale" &&
        res[0].reason === "newer_inbound" &&
        (await w.message(queued.id)).status === "stale" &&
        lead.turnState === "armed" &&
        lead.lastHandledInboundId === null &&
        w.writes("sendMessage").length === 0,
      { res, lead: { turnState: lead.turnState, lastHandledInboundId: lead.lastHandledInboundId } }
    );
  }

  section("more turns: tú, media, not interested, model opt-out, reschedule, redirects, caps");
  {
    const w = new World();
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming("Oye, ¿me puedes llamar mañana?");
    const body = w.last().body ?? "";
    check("tú: the lead's tú is kept for the lead; disclosure, template and footer in tú", (await w.lead()).register === "tu" && body.startsWith("Hola Lucia, te responde") && body.includes("¿Te puede llamar Isaac") && body.endsWith("Responde STOP para no recibir más mensajes."), body);
  }
  {
    const w = new World();
    const r = await w.incoming("", { attachments: ["audio"] });
    check("media only → handoff media + media_received, no model", r.reason === "handoff_media" && w.last().templateId === "media_received" && w.last().body?.includes("¡Gracias! Isaac revisará lo que nos envió y le responde en breve.") === true && w.llm.sessions.length === 0, r);
  }
  {
    const { w } = await worldWithSentOffer();
    w.llm.script({ steps: [tool("mark_not_interested", { reason: "already covered" })] });
    const r = await w.incoming("Ya tengo, gracias, no me interesa");
    const lead = await w.lead();
    check("not interested → one polite close, lead stopped, offers cleared, no reason text kept", r.reason === "not_interested" && w.last().templateId === "not_interested_close" && lead.status === "stopped" && lead.offeredSlots.length === 0 && j(w.events("not_interested")[0]?.detail) === "{}", r);
  }
  {
    const w = new World();
    w.llm.script({ steps: [tool("mark_opt_out", { reason: "does not want contact" })] });
    const r = await w.incoming("Ya no quiero saber nada de esto");
    const m = w.last();
    check("the model's mark_opt_out → suppression (source model) + confirmation with DND after it", r.reason === "opted_out" && w.store.suppressions.get("+13055550142")?.source === "model" && m.templateId === "optout_confirm" && j(m.decision?.setDndAfterSend) === j(["SMS"]), r);
  }
  {
    const w = new World();
    const appt = await w.seedUpcoming();
    const offers = await w.seedLiveOffers();
    await w.seedLead({ status: "booked" });
    w.llm.script({ steps: [tool("reschedule_appointment", { slot_id: "B" }), tpl("confirm_reschedule")] });
    const r = await w.incoming("Mejor la segunda opción");
    const lead = await w.lead();
    check(
      "reschedule → PUT with the new start AND status confirmed; lead booked at the new time; note + alert",
      r.reason === "template_confirm_reschedule" &&
        j(w.writes("updateAppointment")[0]?.input) === j({ appointmentId: appt.id, startIso: offers[1].startIso, endIso: new Date(Date.parse(offers[1].startIso) + 30 * MIN).toISOString(), status: "confirmed" }) &&
        lead.appointmentAt?.getTime() === Date.parse(offers[1].startIso) &&
        w.alerts("booked")[0]?.whenLabel.endsWith("(cambio)") === true &&
        w.last().body?.startsWith("¡Listo! Su llamada con Isaac quedó para") === true,
      { r, input: w.writes("updateAppointment")[0]?.input }
    );
  }
  {
    const w = new World();
    w.llm.script({ steps: [slots(), tpl("price_redirect", ["A", "B"])] });
    await w.incoming("¿Cuánto cuesta?");
    const body = w.last().body ?? "";
    check("price question → price_redirect: no $ or amount, steers to the 15-minute call", !body.includes("$") && body.includes("llamada de 15 minutos") && !guardFreeText(body, guardCtx("es", "usted")).violations.some((v) => v.startsWith("money:")), body);
  }
  {
    const w = new World();
    await w.seedLiveOffers();
    await w.seedLead({ rejectionsCount: 2 });
    w.llm.script({ steps: [tpl("self_booking_link")] });
    await w.incoming("Ninguna de esas me sirve");
    check("2 rejections → self_booking_link to the product+language page", w.llm.sessions[0].userContent.includes("turned down offered times): 2") && w.last().body === "Sin problema. Puede elegir la hora que mejor le quede aquí: isaacplans.com/es/gastos-finales/calendario", w.last().body);
  }
  {
    const w = new World();
    await w.seedLiveOffers();
    w.llm.script({ steps: [slots({ after_local: "17:00", lead_declined_offered_times: true }), tpl("offer_times", ["C", "D"])] });
    await w.incoming("Ninguna, mejor después de las 5");
    const lead = await w.lead();
    const offers = offeredOf(w.last());
    check(
      "asking for new times counts a rejection; new ids continue (C, D); every new time is from 5 pm",
      lead.rejectionsCount === 1 && j(offers.map((s) => s.id)) === j(["C", "D"]) && offers.every((s) => zonedParts(new Date(s.startIso), NY).hour >= 17),
      offers
    );
  }
  {
    const w = new World();
    w.llm.script({ steps: [tool("handoff_to_isaac", { reason: "complaint", urgent: true, note: "Se queja de muchas llamadas" })] });
    const r = await w.incoming("Ya me llamaron 5 veces hoy, esto es acoso");
    check("the model's urgent handoff → hold message, note with Isaac's line, urgent alert", r.reason === "handoff_complaint" && w.last().templateId === "handoff_hold" && w.alerts("handoff")[0]?.urgent === true && w.writes("addNote").some((x) => String(x.input).includes("Se queja")), r);
  }
  {
    const w = new World();
    await w.seedUpcoming();
    w.llm.script({ steps: [tool("end_without_reply", { reason: "closing ok" })] });
    const r = await w.incoming("Perfecto, ahí estaré");
    check("end_without_reply → nothing sent, turn done", r.reason === "end_without_reply" && w.msgs().length === 0, r);
  }
  {
    const w = new World();
    const r = await w.incoming("Gracias");
    check("a plain 'Gracias' with nothing on the table → skipped trivial_ack, no model", r.reason === "trivial_ack" && w.llm.sessions.length === 0, r);
    const offered = new World();
    await offered.seedLiveOffers();
    offered.llm.script({ steps: [tool("end_without_reply", { reason: "ack" })] });
    const ro = await offered.incoming("Ok gracias");
    check("…but with live offers it goes to the model (it may accept a time)", ro.reason === "end_without_reply" && offered.llm.sessions.length === 1, ro);
  }
  {
    const w = new World();
    for (let i = 0; i < 60; i++) await w.store.recordEvent(`cOther${String(i).padStart(14, "0")}`, "turn", {});
    const r = await w.incoming(ES_ASK);
    check("hourly cap (60 turns/h) → re-armed in 10 min, no model", r.reason === "hourly_cap" && r.rearm?.delaySeconds === 600 && w.llm.sessions.length === 0, r);
    const t = new World();
    await t.seedLead({ threadTurns: 40 });
    const rt = await t.incoming(ES_ASK);
    check("40 turns in one thread → handoff 'confused'", rt.reason === "handoff_confused" && t.llm.sessions.length === 0, rt);
  }

  section("send.ts gates (re-checked right before the POST)");
  const approvedReply = async (o: WorldOptions = {}) => {
    const w = new World(o);
    w.llm.script({ steps: [slots(), tpl("offer_times", ["A", "B"])] });
    await w.incoming(ES_ASK);
    return { w, id: w.last().id };
  };
  {
    const { w, id } = await approvedReply();
    w.settings.value.approvedTemplates = {};
    const res = await w.sendPending();
    const m = await w.message(id);
    check("template approval revoked after it was queued → back to draft (with a new expiry), not sent", res[0]?.reason === "template_not_approved" && m.status === "draft" && m.expiresAt !== null && w.writes("sendMessage").length === 0, res);
  }
  {
    const { w } = await approvedReply();
    await w.store.addSuppression({ e164: "+13055550142", scope: "all", source: "admin", rawText: null, contactId: CID });
    const res = await w.sendPending();
    check("suppressed after it was queued → blocked", res[0]?.kind === "blocked" && res[0].reason === "suppressed" && w.writes("sendMessage").length === 0, res);
  }
  {
    const { w } = await approvedReply();
    (w.ghl.contacts.get(CID) as ContactSnapshot).dndChannels.SMS = "active";
    const res = await w.sendPending();
    check("DND turned on after it was queued → blocked", res[0]?.kind === "blocked" && res[0].reason === "dnd", res);
  }
  {
    const { w } = await approvedReply();
    w.settings.value.paused = true;
    const res = await w.sendPending();
    check("everything paused after it was queued → stale", res[0]?.kind === "stale" && res[0].reason === "paused_all", res);
  }
  {
    const { w } = await approvedReply();
    await w.store.updateLeadUnfenced(CID, { status: "paused", pauseReason: "isaac_took_over" });
    const res = await w.sendPending();
    check("Isaac took the lead after it was queued → stale", res[0]?.kind === "stale" && res[0].reason === "lead_paused", res);
  }
  {
    const { w } = await approvedReply();
    await w.arm();
    await w.store.claimTurn(CID, (await w.lead()).runId as string, w.clock.now());
    const res = await w.sendPending();
    check("a turn is running for the lead → held 30 s", res[0]?.kind === "held" && res[0].reason === "turn_running" && w.queue.of("send").at(-1)?.notBefore?.getTime() === w.clock.now().getTime() + 30_000, res);
  }
  {
    const { w } = await approvedReply();
    w.ghl.sendModes.push("rate_limited");
    const res = await w.sendPending();
    check("429 from GHL → back to approved, retried in 60 s", res[0]?.reason === "rate_limited" && w.last().status === "approved" && w.queue.of("send").at(-1)?.notBefore?.getTime() === w.clock.now().getTime() + 60_000, res);
  }
  {
    const { w } = await approvedReply();
    w.ghl.sendModes.push("dnd");
    const res = await w.sendPending();
    const lead = await w.lead();
    check("GHL rejects for DND → failed, lead paused (ghl_dnd), never a permanent suppression", res[0]?.kind === "failed" && lead.status === "paused" && lead.pauseReason === "ghl_dnd" && w.store.suppressions.size === 0, res);
  }
  {
    const { w } = await approvedReply();
    (w.ghl.contacts.get(CID) as ContactSnapshot).phone = "+13055550199";
    const res = await w.sendPending();
    check(
      "the contact's phone changed after the turn read it → stale phone_changed, Isaac told, nothing sent",
      res[0]?.kind === "stale" && res[0].reason === "phone_changed" && w.alerts("error").length === 1 && w.writes("sendMessage").length === 0,
      res
    );
  }
  {
    const { w } = await approvedReply();
    (w.ghl.contacts.get(CID) as ContactSnapshot).tags.push("ai_setter_off");
    const res = await w.sendPending();
    check("an exclusion tag added after it was queued → stale not_ai_managed", res[0]?.kind === "stale" && res[0].reason === "not_ai_managed" && w.writes("sendMessage").length === 0, res);
  }
  {
    const { w } = await approvedReply();
    await w.store.updateLeadUnfenced(CID, { optOutPending: true });
    const res = await w.sendPending();
    check("an opt-out clarification pending after it was queued → stale optout_pending", res[0]?.kind === "stale" && res[0].reason === "optout_pending", res);
  }
  {
    const { w } = await approvedReply();
    w.settings.value.failedClosed = true;
    const held = await w.sendPending();
    check("settings unreadable at send time → held (retried), not dropped", held[0]?.kind === "held" && held[0].reason === "settings_unavailable" && w.last().status === "approved", held);
    w.advance(2 * HOUR + MIN);
    const gaveUp = await w.sendPending();
    check(
      "…an error hold gives up after 2 hours: stale gave_up_*, Isaac told, nothing sent",
      gaveUp[0]?.kind === "stale" && gaveUp[0].reason === "gave_up_settings_unavailable" && w.alerts("error").length === 1 && w.writes("sendMessage").length === 0,
      gaveUp
    );
  }
  {
    const { w } = await approvedReply();
    w.ghl.fail.getContact = { ok: false, status: 503, retryable: true, error: "http_503" };
    const held = await w.sendPending();
    check("GHL 503 on the contact read → held 60 s", held[0]?.kind === "held" && held[0].reason === "contact_503", held);
  }
  {
    const { w } = await approvedReply();
    const offered = offeredOf(w.last());
    const first = Math.min(...offered.map((s) => Date.parse(s.startIso)));
    w.advance(first - w.clock.now().getTime() - 30 * MIN);
    const res = await w.sendPending();
    const lead = await w.lead();
    check(
      "an offered time under 60 min away when the reply would go out → stale, a new turn re-reads the message (watermark rewound)",
      res[0]?.kind === "stale" &&
        (res[0].reason === "offer_too_soon" || res[0].reason === "day_changed") &&
        lead.turnState === "armed" &&
        lead.lastHandledInboundId === null &&
        w.queue.of("turn").length > 0 &&
        w.writes("sendMessage").length === 0,
      { res, lead: { turnState: lead.turnState, lastHandledInboundId: lead.lastHandledInboundId } }
    );
  }
  {
    const w = new World({ lead: LEADS.en });
    await w.incoming("HELP");
    w.advance(31 * MIN);
    const res = await w.sendPending();
    check("a HELP reply that couldn't go out within 30 min expires (stale expired), never sent late", res[0]?.kind === "stale" && res[0].reason === "expired" && w.writes("sendMessage").length === 0, res);
  }
  {
    const w = new World();
    w.llm.script({
      during: () => {
        w.advance(3_000);
        w.outbound("Hola Lucia, soy Isaac. Ya le llamo.", { source: "app", userId: ISAAC_USER });
      },
      steps: [slots(), tpl("offer_times", ["A", "B"])],
    });
    const r = await w.incoming(ES_ASK);
    const reply = w.last();
    const held = await w.sendPending();
    check("Isaac replied by hand while the model was thinking → the turn's re-check re-arms, the reply waits", Boolean(r.rearm) && held[0]?.reason === "turn_armed", { r, held });
    const next = await w.turn({ debounceMs: 5_000 });
    await w.sendPending();
    const lead = await w.lead();
    check(
      "…the next turn pauses the lead and the AI's reply never goes out",
      next.reason === "human_took_over" && lead.status === "paused" && (await w.message(reply.id)).status === "superseded" && w.writes("sendMessage").length === 0,
      { next, status: lead.status }
    );
  }
  {
    // A poke that lands while a turn runs is never dropped, even on an early exit (here: paused).
    const w = new World();
    await w.seedLead({ status: "paused", pausedUntil: null, pauseReason: "paused_by_isaac" });
    const read = w.ghl.listMessages.bind(w.ghl);
    let injected = false;
    w.ghl.listMessages = async (contactId, opts) => {
      const r = await read(contactId, opts);
      if (!injected) {
        injected = true;
        w.advance(2_000);
        w.say("No me escriban más");
        await w.arm();
      }
      return r;
    };
    const first = await w.incoming("hola");
    const lead = await w.lead();
    check(
      "a poke during a running turn → that turn re-arms when it finishes (even on the paused exit)",
      first.reason === "paused" && Boolean(first.rearm) && lead.turnState === "armed" && lead.runId === first.rearm?.runId,
      first
    );
    const second = await w.turn({ runId: first.rearm?.runId });
    check("…and the re-armed turn catches the opt-out that arrived mid-turn", second.reason === "opted_out" && (await w.lead()).status === "opted_out", second);
  }

  section("tools.ts validators (the model can only act on what code allows)");
  await toolValidatorTests();
}

async function toolValidatorTests(): Promise<void> {
  const harness = async (o: { facts?: Partial<TurnFacts>; upcoming?: AppointmentRef | null; dryRun?: boolean; world?: World } = {}) => {
    const w = o.world ?? new World();
    const armed = await w.arm();
    const claimed = (await w.store.claimTurn(CID, armed.runId as string, w.clock.now())) as LeadRecord;
    const facts: TurnFacts = {
      now: w.clock.now(),
      channel: "SMS",
      lang: "es",
      register: "usted",
      firstName: "Lucia",
      product: "final_expense",
      topic: topicPhrase("final_expense", "es", "usted"),
      leadZone: NY,
      zoneSource: "ghl",
      stateCode: "FL",
      license: "licensed",
      isaacFreeNow: true,
      nextIsaacWindow: null,
      upcomingAppointment: null,
      liveOffers: [],
      rejections: 0,
      lastCall: null,
      whatsappWindowOpen: false,
      callNowOutcome: null,
      callNowActive: null,
      callNowUsedToday: false,
      ...o.facts,
    } as TurnFacts;
    const ctx: ToolContext = {
      ports: w.ports,
      fence: { contactId: CID, runId: armed.runId as string, attempt: claimed.attempt },
      lead: claimed,
      contact: w.ghl.contacts.get(CID) as ContactSnapshot,
      facts,
      schedule: DEFAULT_SCHEDULE,
      calendarId: CALENDAR_IDS.final_expense.es,
      licensed: LICENSED,
      upcoming: o.upcoming ?? null,
      appointmentsKnown: true,
      referenceNow: w.clock.now(),
      loadIsaacEvents: async () => [],
      dryRun: o.dryRun ?? false,
    };
    const state = newToolState();
    return { w, exec: createToolExecutor(ctx, state), state, ctx };
  };
  const code = (r: ToolExecResult) => {
    try {
      return (JSON.parse(r.content) as { error?: string }).error ?? (r.terminal ? "terminal" : "ok");
    } catch {
      return r.terminal ? "terminal" : r.content;
    }
  };
  const live: OfferedSlot[] = [
    { id: "A", startIso: "2026-11-18T10:00:00-05:00", label: "mañana a las 10 de la mañana" },
    { id: "B", startIso: "2026-11-18T13:00:00-05:00", label: "mañana a la 1 de la tarde" },
  ];
  {
    const { exec } = await harness();
    const results = [
      await exec("teleport", {}),
      await exec("find_open_slots", "not an object"),
      await exec("reply_with_template", { template_id: "help", slot_ids: [] }),
      await exec("reply_with_template", { template_id: "offer_times", slot_ids: ["A"] }),
      await exec("reply_with_template", { template_id: "offer_times", slot_ids: ["A", "B"] }),
      await exec("reply_with_template", { template_id: "confirm_booking", slot_ids: [] }),
      await exec("reply_with_template", { template_id: "existing_appointment", slot_ids: [] }),
      await exec("reply_with_template", { template_id: "out_of_license", slot_ids: [] }),
      await exec("find_open_slots", { after_local: "5pm", before_local: null, part_of_day: null, weekday: null, date_local: null, lead_works: false }),
      await exec("book_appointment", { slot_id: "A" }),
      await exec("reschedule_appointment", { slot_id: "A" }),
      await exec("cancel_appointment", { reason: "x" }),
      await exec("set_lead_state", { state: "Atlantis" }),
      await exec("draft_reply", { text: "   ", intent: "x" }),
      await exec("draft_reply", { text: "x".repeat(1201), intent: "x" }),
    ].map(code);
    eq(
      "refusals: unknown tool, bad input, compliance template, slot count, slots not from this turn, confirm without booking, no appointment, licensed, bad time, not a live offer, no appointment ×2, unknown state, empty/long draft",
      results,
      [
        "unknown_tool",
        "invalid_input",
        "unknown_template",
        "wrong_slot_count",
        "unknown_slot",
        "not_booked",
        "no_appointment",
        "licensed",
        "invalid_time",
        "not_a_live_offer",
        "no_appointment",
        "no_appointment",
        "unknown_state",
        "empty_text",
        "empty_text",
      ]
    );
  }
  {
    const { exec, state } = await harness({ facts: { liveOffers: live } });
    const r = await exec("find_open_slots", { after_local: "17:00", before_local: null, part_of_day: null, weekday: null, date_local: null, lead_works: false, lead_declined_offered_times: true });
    const payload = JSON.parse(r.content) as { slots: Array<{ id: string; label: string }> };
    check(
      "find_open_slots with live offers: those count as turned down, new ids C/D, never the same instants, from 5 pm",
      state.rejectedPrevious && j(payload.slots.map((s) => s.id)) === j(["C", "D"]) && state.offeredThisTurn.every((s) => !live.some((l) => Date.parse(l.startIso) === Date.parse(s.startIso)) && zonedParts(new Date(s.startIso), NY).hour >= 17),
      payload
    );
    const t = await exec("reply_with_template", { template_id: "offer_times", slot_ids: ["C", "D"] });
    check("…and a reply may offer them (terminal)", t.terminal === true && state.terminal?.kind === "template");
  }
  {
    const w = new World();
    w.ghl.fail.getFreeSlots = { ok: false, status: 503, retryable: true, error: "http_503" };
    const { exec } = await harness({ world: w });
    const failedRead = code(await exec("find_open_slots", { after_local: null, before_local: null, part_of_day: null, weekday: null, date_local: "2020-01-01", lead_works: false }));
    const w2 = new World();
    const h2 = await harness({ world: w2 });
    const none = JSON.parse((await h2.exec("find_open_slots", { after_local: null, before_local: null, part_of_day: null, weekday: null, date_local: "2020-01-01", lead_works: false })).content) as { slots: unknown[]; note: string };
    check("calendar unreadable → calendar_unavailable; nothing matches the preference → empty + ask_time_preference hint", failedRead === "calendar_unavailable" && none.slots.length === 0 && none.note.includes("ask_time_preference"), [failedRead, none]);
  }
  {
    const upcoming: AppointmentRef = { id: "apptX", calendarId: "c", contactId: CID, startTime: new Date("2026-11-19T15:00:00Z"), endTime: null, status: "confirmed", title: null };
    const a = await harness({ facts: { liveOffers: live }, upcoming });
    const b = await harness({ facts: { liveOffers: live, license: "not_licensed" } });
    check("book_appointment refuses a second future appointment and an unlicensed state", code(await a.exec("book_appointment", { slot_id: "A" })) === "already_booked" && code(await b.exec("book_appointment", { slot_id: "A" })) === "not_licensed");
  }
  {
    const shadow = await harness({ facts: { liveOffers: live }, dryRun: true });
    const r = JSON.parse((await shadow.exec("book_appointment", { slot_id: "A" })).content) as { simulated?: boolean };
    check("dry run: booking is simulated, nothing written to GHL", r.simulated === true && shadow.state.booking?.simulated === true && shadow.w.writes("createAppointment").length === 0);
    const w = new World();
    w.ghl.createFailure = { ok: false, status: 400, retryable: false, error: "http_400", slotTaken: true };
    const taken = await harness({ world: w, facts: { liveOffers: live } });
    check("slot taken at booking → slot_taken (offer new times)", code(await taken.exec("book_appointment", { slot_id: "A" })) === "slot_taken" && taken.state.booking === null);
  }
  {
    const { exec, ctx, state } = await harness({ world: new World({ lead: LEADS.es_unknown }), facts: { stateCode: null, license: "unknown", zoneSource: "none" } });
    const r = JSON.parse((await exec("set_lead_state", { state: "Texas" })).content) as { state: string; licensed: string };
    check("set_lead_state 'Texas' → TX, Central time, licensed yes (facts updated for the next tool)", r.state === "TX" && r.licensed === "yes" && ctx.facts.leadZone === CHI && ctx.facts.zoneSource === "reported" && state.reportedState === "TX", r);
    const h = await exec("handoff_to_isaac", { reason: "nonsense", urgent: "yes", note: "x" });
    check("handoff with an unknown reason → 'other'; urgent only when literally true", h.terminal === true && state.terminal?.kind === "handoff" && state.terminal.reason === "other" && state.terminal.urgent === false);
  }
}

// ═══ Live mode ═══════════════════════════════════════════════════════════════════════════════

type Persona = {
  id: string;
  title: string;
  text: Partial<Record<Lang, string[]>>;
  setup?: {
    lead?: "ca" | "ny" | "pa" | "unknown";
    liveOffers?: boolean;
    upcoming?: boolean;
    isClient?: boolean;
    attachments?: AttachmentKind[];
    agoMinutes?: number;
    now?: string;
  };
  rules?: string[];
  expect: string;
};

type RecordedSession = { userContent: string; tools: Array<{ name: string; input: unknown; result: ToolExecResult }>; results: LlmLoopResult[] };

/** Wraps the real LlmPort so a live run can print what the model saw and did. */
function recordingLlm(inner: LlmPort): LlmPort & { sessions: RecordedSession[] } {
  const sessions: RecordedSession[] = [];
  return {
    sessions,
    startSession(input) {
      const rec: RecordedSession = { userContent: input.userContent, tools: [], results: [] };
      sessions.push(rec);
      const s = inner.startSession({
        ...input,
        executeTool: async (name, args) => {
          const result = await input.executeTool(name, args);
          rec.tools.push({ name, input: args, result });
          return result;
        },
      });
      return {
        run: async () => {
          const r = await s.run();
          rec.results.push(r);
          return r;
        },
        retryWith: async (feedback) => {
          const r = await s.retryWith(feedback);
          rec.results.push(r);
          return r;
        },
      };
    },
  };
}

function loadPersonas(): Persona[] {
  const file = path.join(__dirname, "data", "ai-setter", "live-personas.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as { personas?: unknown };
  if (!Array.isArray(raw.personas)) throw new Error(`${file}: "personas" must be an array`);
  return raw.personas as Persona[];
}

function presetFor(lang: Lang, lead: NonNullable<Persona["setup"]>["lead"]): LeadPreset {
  if (!lead) return lang === "es" ? LEADS.es : LEADS.en;
  return LEADS[`${lang}_${lead}` as keyof typeof LEADS];
}

const indent = (text: string, pad = "            ") => text.split("\n").join(`\n${pad}`);

async function runPersona(p: Persona, lang: Lang, apiKey: string): Promise<number> {
  const texts = p.text[lang] ?? [];
  const env = { ANTHROPIC_API_KEY: apiKey };
  const base = getAiSetterConfig(envOf(env));
  const recorder = recordingLlm(createLlmPort({ apiKey, model: base.model, effort: base.effort, maxTokens: base.maxTokens, log: createMemoryLogger() }));
  const w = new World({ llm: recorder, now: p.setup?.now, lead: presetFor(lang, p.setup?.lead), approve: "all", env });
  if (p.setup?.isClient) w.calls.client = true;
  if (p.setup?.upcoming) await w.seedUpcoming();
  if (p.setup?.liveOffers) await w.seedLiveOffers(lang);
  const before = w.msgs().length;
  const ago = (p.setup?.agoMinutes ?? 0) * MIN;
  texts.forEach((t, i) => w.say(t, { attachments: p.setup?.attachments, agoMs: ago + (texts.length - 1 - i) * 5_000 }));
  await w.arm();
  const started = Date.now();
  const result = await w.turn();
  const ms = Date.now() - started;
  const created = w.msgs().slice(before);
  const lead = await w.lead();

  console.log(`\n── ${lang} · ${p.id} — ${p.title}`);
  console.log(`  lead      ${texts.map((t) => (t ? `"${t}"` : "(no text)")).join(" + ")}${p.setup?.attachments ? ` [${p.setup.attachments.join(", ")}]` : ""}`);
  console.log(`  expected  ${p.expect}`);
  const facts = recorder.sessions[0]?.userContent.match(/<facts>\n([\s\S]*?)\n<\/facts>/)?.[1];
  console.log(`  facts     ${facts ? indent(facts) : "(the model was not called)"}`);
  for (const s of recorder.sessions) {
    for (const t of s.tools) console.log(`  tool      ${t.name} ${JSON.stringify(t.input)} → ${t.result.terminal ? "terminal" : clip(t.result.content, 160)}`);
    const lastResult = s.results.at(-1);
    if (lastResult && lastResult.kind !== "terminal") console.log(`  model     ${lastResult.kind}${"detail" in lastResult ? ` (${lastResult.detail})` : ""}`);
  }
  console.log(`  result    ${result.kind} · ${result.reason}${result.rearm ? ` · re-armed in ${result.rearm.delaySeconds}s` : ""} · lead ${lead.status}${lead.pauseReason ? ` (${lead.pauseReason})` : ""} · ${ms} ms`);
  const offerLabels = [...lead.offeredSlots, ...created.flatMap(offeredOf)].map((s) => s.label);
  for (const m of created) {
    const seg = smsSegments(m.body ?? "");
    console.log(`  message   ${m.status} · ${m.kind === "template" ? `template ${m.templateId}` : `free text (${m.intent})`} · ${m.channel}${m.notBefore ? ` · held until ${m.notBefore.toISOString()}` : ""}`);
    console.log(`            ${indent(m.body ?? "(no body)")}`);
    const g = guardFreeText(m.body ?? "", guardCtx(lang, lead.register ?? "usted", { firstName: lead.firstName, offeredSlotLabels: offerLabels, threadText: texts.join("\n"), allowedLinks: allowedLinks(w.ports, lead.product, lang), maxSmsSegments: 4 }));
    console.log(`  guard     ${seg.segments} segment(s) ${seg.encoding}${m.guardFlags.length ? ` · flags ${m.guardFlags.join(", ")}` : ""}${g.violations.length ? ` · would flag (informative): ${g.violations.join(", ")}` : " · clean"}`);
  }
  const usage = recorder.sessions.map((s) => s.results.at(-1)?.usage).filter((u): u is LlmUsage => Boolean(u));
  const cost = usage.reduce((sum, u) => sum + u.costMicros, 0);
  const tokens = usage.reduce((acc, u) => ({ i: acc.i + u.inputTokens, o: acc.o + u.outputTokens, c: acc.c + u.cacheReadTokens }), { i: 0, o: 0, c: 0 });
  console.log(`  cost      $${(cost / 1_000_000).toFixed(4)} · in ${tokens.i} / out ${tokens.o} / cache read ${tokens.c}${usage.some((u) => u.usedFallback) ? " · FALLBACK MODEL" : ""}`);

  // Rules (scored) — the model must never break these, whatever it chose.
  const rules = new Set(p.rules ?? []);
  const bodies = created.map((m) => m.body ?? "");
  const families = (prefix: string) =>
    bodies.flatMap((b) => guardFreeText(b, guardCtx(lang, lead.register ?? "usted", { firstName: lead.firstName, offeredSlotLabels: offerLabels, threadText: texts.join("\n") })).violations.filter((v) => v.startsWith(prefix)));
  check(`${p.id}: no money talk (no $ / amounts / per month)`, families("money:").length === 0, families("money:"));
  check(`${p.id}: no banned brand words`, families("banned_word:").length === 0, families("banned_word:"));
  check(`${p.id}: never claims to be human`, families("human_claim:").length === 0, families("human_claim:"));
  if (lang === "es" && !rules.has("tu") && !rules.has("any_register") && !rules.has("opted_out")) {
    check(`${p.id}: Spanish in usted by default`, lead.register !== "tu" && families("register:").length === 0, { register: lead.register, flags: families("register:") });
  }
  if (rules.has("tu") && lang === "es") check(`${p.id}: the lead's tú is used`, lead.register === "tu" && bodies.every((b) => !/\ble responde\b|\bResponda\b/.test(b)), lead.register);
  if (rules.has("no_model_call")) check(`${p.id}: decided by code, the model is never called`, recorder.sessions.length === 0, recorder.sessions.length);
  if (rules.has("opted_out")) check(`${p.id}: opted out`, lead.status === "opted_out", lead.status);
  if (rules.has("held")) check(`${p.id}: the reply is held for the lead's hours`, created.length > 0 && created.every((m) => m.notBefore !== null), created.map((m) => m.notBefore));
  for (const rule of rules) {
    if (rule.startsWith("handoff:")) {
      const reason = rule.slice("handoff:".length);
      check(`${p.id}: handoff ${reason}`, lead.status === "handoff" && lead.pauseReason === reason, { status: lead.status, reason: lead.pauseReason });
    }
  }
  const actions = recorder.sessions.flatMap((s) => s.tools.map((t) => (t.name === "reply_with_template" ? `template ${(t.input as { template_id?: string }).template_id}` : t.name)));
  console.log(`  rubric    expected: ${p.expect} | got: ${actions.length ? actions.join(" → ") : result.reason}`);
  return cost;
}

async function liveMain(): Promise<void> {
  const i = process.argv.indexOf("--live");
  const arg = process.argv[i + 1];
  const lang: Lang = arg === "en" ? "en" : "es";
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg >= 0 ? new Set((process.argv[onlyArg + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    console.log(
      "Live mode skipped: ANTHROPIC_API_KEY is not set. Put the AI Setter's DEVELOPMENT key in .env (AI_SETTER_SETUP.md §6) and run `pnpm test:ai-setter --live es` (or `--live en`)."
    );
    process.exit(0);
  }
  if (arg !== "en" && arg !== "es") console.log("(no language given: running Spanish; use --live en for English)");
  const personas = loadPersonas().filter((p) => (p.text[lang]?.length ?? 0) > 0 && (!only || only.has(p.id)));
  const config = getAiSetterConfig(envOf({ ANTHROPIC_API_KEY: key }));
  console.log(`AI Setter LIVE (${lang}) · ${config.model} · effort ${config.effort} · ${personas.length} personas · GHL, DB, Telegram and QStash are fakes: nothing real is sent or written`);
  let total = 0;
  for (const p of personas) {
    try {
      total += await runPersona(p, lang, key);
    } catch (error) {
      failed++;
      console.log(`  ✗ ${p.id} crashed: ${error instanceof Error ? error.name : "unknown"}`);
    }
  }
  console.log(`\nTotal model cost: $${(total / 1_000_000).toFixed(4)}`);
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

// ═══ Main ════════════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  if (LIVE_MODE) return liveMain();
  // Offline means offline: any network call nobody stubbed fails loudly instead of going out.
  globalThis.fetch = (async (input: string | URL | Request) => {
    throw new Error(`offline test: network call blocked (${String(input).slice(0, 80)})`);
  }) as typeof fetch;
  console.log("AI Setter offline tests: no network, no database, no keys");
  configTests();
  complianceTests();
  textTests();
  availabilityTests();
  contextAndToolStaticTests();
  purityTests();
  await ghlTests();
  await llmTests();
  await scenarioTests();
  if (knownBugs.length > 0) {
    console.log(`\n${knownBugs.length} known bug(s) in other files (reported, not failing the run):`);
    for (const b of knownBugs) console.log(`  ! ${b}`);
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.log("  ✗ the test run crashed:", error);
  process.exit(1);
});
