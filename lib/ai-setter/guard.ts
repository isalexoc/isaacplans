/**
 * Checks on text the MODEL wrote, before it can reach a lead. Templates are pre-approved by Isaac
 * (lib/ai-setter/templates.ts) and never come through here.
 *
 * A violation is a short code plus detail ("banned_word:policy"). It goes back to the model on
 * the one regeneration and shows in Isaac's inbox; if the retry fails too, the draft goes to
 * Isaac. Details never carry the lead's data: phones are masked and links show only their host.
 * They can echo the draft's own words ("health:diabetes"), so callers store `flagCode(v)`, not `v`.
 *
 * Guard the model's own text, BEFORE `withDisclosure` adds the greeting, the AI notice and the
 * STOP footer (lower `maxSmsSegments` by what the code will add): the model must not write the
 * AI notice or "STOP" itself, so those two trip `self_notice` here.
 *
 * Pure: no DB, no server-only, no Node APIs (the admin editor can run it in the browser).
 */

import { maskPhone } from "./log";
import type { Channel, Lang, Register } from "./types";

export type SmsEncoding = "GSM-7" | "UCS-2";

export type SmsSegmentInfo = { encoding: SmsEncoding; segments: number; units: number };

export type GuardContext = {
  channel: Channel;
  lang: Lang;
  register: Register;
  firstName: string | null;
  /** "Isaac", "Isaac Orraiz"…: names the text may use and must never claim to be. */
  agentNames: string[];
  brand: string;
  agentPhone: string;
  site: string;
  /** Links the text may carry, compared exactly (a trailing slash is ignored). */
  allowedLinks: string[];
  /** Labels of the times offered to this lead: their numbers are grounded. */
  offeredSlotLabels: string[];
  /** The thread as the model saw it: every number in the text must come from here or above. */
  threadText: string;
  maxSmsSegments: number;
};

export type GuardResult = {
  ok: boolean;
  violations: string[];
  warnings: string[];
  segments: number;
  encoding: SmsEncoding;
};

// ─── SMS segments ──────────────────────────────────────────────────────────────────────────

/** GSM 03.38 basic set (escape excluded): 1 septet each. */
const GSM7_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
      "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  )
);

/** GSM 03.38 extension table: escape + char, 2 septets each, never split across segments. */
const GSM7_EXTENSION = new Set(Array.from("\f^{}\\[~]|€"));

const SEGMENT_LIMITS: Record<SmsEncoding, { single: number; part: number }> = {
  "GSM-7": { single: 160, part: 153 },
  "UCS-2": { single: 70, part: 67 },
};

function countSegments(sizes: number[], units: number, limits: { single: number; part: number }): number {
  if (units === 0) return 0;
  if (units <= limits.single) return 1;
  let segments = 1;
  let used = 0;
  for (const size of sizes) {
    if (used + size > limits.part) {
      segments += 1;
      used = 0;
    }
    used += size;
  }
  return segments;
}

/**
 * How carriers will bill the text. GSM-7 when every character is in the basic set or the
 * extension table (extension chars count 2 units); otherwise UCS-2 (UTF-16 units, so an emoji
 * counts 2). One segment holds 160 / 70 units; a concatenated one 153 / 67.
 */
export function smsSegments(text: string): SmsSegmentInfo {
  const chars = Array.from(text);
  const gsm = chars.every((c) => GSM7_BASIC.has(c) || GSM7_EXTENSION.has(c));
  const encoding: SmsEncoding = gsm ? "GSM-7" : "UCS-2";
  const sizes = chars.map((c) => (gsm ? (GSM7_EXTENSION.has(c) ? 2 : 1) : c.length));
  const units = sizes.reduce((sum, size) => sum + size, 0);
  return { encoding, segments: countSegments(sizes, units, SEGMENT_LIMITS[encoding]), units };
}

// ─── Text helpers ──────────────────────────────────────────────────────────────────────────

/** The registered SMS brand: the one allowed use of "Insurance". */
const REGISTERED_BRAND = "Isaac Plans Insurance";
const WHATSAPP_MAX_CHARS = 700;
const WHATSAPP_MAX_EMOJI = 2;

/** Lowercase, accents stripped, apostrophes straightened, single spaces: for word matching. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Like `fold` but accents kept (NFC): "llamó" (he called) stays apart from "llamo" (I call). */
function lowerWithAccents(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

const EDGE = "[^\\p{L}\\p{N}]";

/** Whole words or phrases (run on `fold`ed text, so accent- and case-insensitive). */
function wordPattern(alternatives: readonly string[]): RegExp {
  return new RegExp(`(?:^|${EDGE})(${alternatives.join("|")})(?=$|${EDGE})`, "gu");
}

function findAll(folded: string, pattern: RegExp): string[] {
  const found = new Set<string>();
  for (const match of folded.matchAll(pattern)) found.add(match[1]);
  return Array.from(found);
}

/** Folded words of the lead's and agents' names and the brand: ignored by the language checks. */
function nameWords(ctx: GuardContext): Set<string> {
  const words = [ctx.firstName ?? "", ctx.brand, ...ctx.agentNames].flatMap((n) => fold(n).split(/[\s'-]+/));
  return new Set(words.filter(Boolean));
}

function removeBrand(text: string, brand: string): string {
  return [brand.trim(), REGISTERED_BRAND].filter(Boolean).reduce((s, b) => s.split(b).join(" "), text);
}

// ─── Links and phones ──────────────────────────────────────────────────────────────────────

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"]+/giu;
const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const BARE_DOMAIN_RE =
  /(?:^|[^\p{L}\p{N}@.\/-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|us|io|co|info|biz|me|app|ly|gl|gd|gy|link|site|online|xyz|ai|gov|edu|page|health|insurance|life|mx|tv|cc|ws)(?:\/[^\s<>"]*)?)(?=$|[^\p{L}\p{N}])/giu;
const PHONE_RE = /(^|\D)((?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})(?!\d)/g;

function trimLinkEnd(link: string): string {
  return link.replace(/[.,!?;:)\]}'"…]+$/, "");
}

function withoutTrailingSlash(link: string): string {
  return link.replace(/\/+$/, "");
}

function linkHost(link: string): string {
  return link.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();
}

/** Text without links or email addresses (their words and digits are not the model's claims). */
function stripLinks(text: string): string {
  return text
    .replace(URL_RE, " ")
    .replace(EMAIL_RE, " ")
    .replace(BARE_DOMAIN_RE, (full: string, domain: string) => full.replace(domain, " "));
}

function linkViolations(text: string, allowedLinks: string[]): string[] {
  const allowed = new Set(allowedLinks.map((l) => withoutTrailingSlash(l.trim())).filter(Boolean));
  const out: string[] = [];
  const check = (raw: string) => {
    const link = trimLinkEnd(raw);
    if (!allowed.has(withoutTrailingSlash(link))) out.push(`link:${linkHost(link)}`);
  };
  const rest = text
    .replace(URL_RE, (url: string) => {
      check(url);
      return " ";
    })
    .replace(EMAIL_RE, () => {
      out.push("link:email");
      return " ";
    });
  for (const match of rest.matchAll(BARE_DOMAIN_RE)) check(match[1]);
  return out;
}

function phoneViolations(text: string, agentPhone: string): string[] {
  const agent = agentPhone.replace(/\D/g, "").slice(-10);
  const out: string[] = [];
  for (const match of text.matchAll(PHONE_RE)) {
    const digits = match[2].replace(/\D/g, "").slice(-10);
    if (digits !== agent) out.push(`phone:${maskPhone(digits)}`);
  }
  return out;
}

// ─── Grounded numbers ──────────────────────────────────────────────────────────────────────

const TIME_RE = /(\d{1,2}):(\d{2})(?!\d)/g;

type NumberToken = { raw: string; key: string };

/** Times compare as times ("4:00" = "4", "4:30" is not "4"); other digit runs as numbers. */
function numberTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  const rest = text.replace(TIME_RE, (raw: string, hour: string, minutes: string) => {
    tokens.push({ raw, key: minutes === "00" ? String(Number(hour)) : `${Number(hour)}:${minutes}` });
    return " ";
  });
  for (const match of rest.matchAll(/\d+/g)) tokens.push({ raw: match[0], key: match[0].replace(/^0+(?=\d)/, "") });
  return tokens;
}

function groundedNumbers(ctx: GuardContext): Set<string> {
  const sources = [...ctx.offeredSlotLabels, ctx.agentPhone, ctx.site, ctx.threadText];
  const keys = new Set(sources.flatMap((s) => numberTokens(s).map((t) => t.key)));
  const phoneDigits = ctx.agentPhone.replace(/\D/g, "");
  if (phoneDigits) keys.add(phoneDigits.slice(-10));
  return keys;
}

function ungroundedNumberViolations(text: string, ctx: GuardContext): string[] {
  const grounded = groundedNumbers(ctx);
  const tokens = numberTokens(text.replace(PHONE_RE, "$1 "));
  return tokens.filter((t) => !grounded.has(t.key)).map((t) => `ungrounded_number:${t.raw}`);
}

// ─── Word rules ────────────────────────────────────────────────────────────────────────────

/** Brand voice: never these words (the registered brand is removed before matching). */
const BANNED_WORDS = wordPattern([
  "insur(?:ances?|ed|ers?|es?|ing)",
  "polic(?:y|ies)",
  "premiums?",
  "underwrit(?:ing|ers?|es?|ten)",
  "seguros?",
  "polizas?",
  "primas?",
  "asegurad(?:[oa]s?|oras?)",
]);

const MONEY_WORDS = wordPattern(["usd", "dollars?", "dolar(?:es)?", "bucks", "cents?", "centavos?"]);
const PERCENT_WORDS = wordPattern(["percent", "por ?ciento"]);
const PER_MONTH = [
  /\d\s*(?:(?:a|per|each|every|al|por|cada)\s+(?:month|mes)(?![a-z])|\/\s*(?:mo|month|mes)(?![a-z])|monthly|mensual)/u,
  /(?:monthly|mensual(?:es)?|al mes|por mes)\s+(?:de\s+)?\$?\d/u,
];

const PROMISE_WORDS = wordPattern([
  "guarantee(?:s|d|ing)?",
  "guaranty",
  "garantiz\\p{L}*",
  "garantias?",
  "(?:pre-?)?approved",
  "(?:pre-?)?aprobad[oa]s?",
  "qualif\\p{L}*",
  "califica\\p{L}*",
  "gratis",
  "free",
  "no cost",
  "sin costo",
  "no charge",
  "sin cargo",
  "eligib(?:le|ility)",
  "elegib(?:les?|ilidad)",
  "subsid(?:y|ies)",
  "subsidios?",
]);

/** Health talk ("sin presión" is removed first: `withoutNoPressure`). */
const HEALTH_WORDS = wordPattern([
  "diabet\\p{L}*",
  "cancer(?:es|s)?",
  "heart attacks?",
  "infartos?",
  "strokes?",
  "derrames?",
  "medications?",
  "medicamentos?",
  "insulina?",
  "pregnan\\p{L}*",
  "embaraz\\p{L}*",
  "surger(?:y|ies)",
  "cirugias?",
  "diagnos\\p{L}*",
  "conditions?",
  "condicion(?:es)? (?:de salud|medicas?)",
  "pre[- ]?existing",
  "pre-?existentes?",
  "enfermedad(?:es)?",
  "presion(?:es)?",
  "blood pressure",
  "cholesterol",
  "colesterol",
]);

/** Claims to be a person. "I'm Isaac" and the like come from `humanClaimPattern` (agent names). */
const HUMAN_CLAIMS = [
  "real person",
  "persona real",
  "not a bot",
  "not a robot",
  "no soy un robot",
  "no soy un bot",
  "soy humano",
  "soy humana",
  "a human",
  "i'm human",
  "i am human",
  "soy una persona",
  "no soy una ia",
  "not an ai",
];

/** Agent names as regex alternatives (full name and first name), `fold`ed or, for `lowerWithAccents` text, accented. */
function agentNameForms(agentNames: string[], keepAccents = false): string[] {
  const norm = keepAccents ? lowerWithAccents : fold;
  const forms = ["isaac", ...agentNames.flatMap((n) => [norm(n), norm(n).split(" ")[0]])];
  return unique(forms.filter(Boolean)).map(escapeRegex);
}

/** "Isaac is free right now" is availability, not a price promise: those phrases are removed first. */
function withoutAvailabilityFree(folded: string, agentNames: string[]): string {
  const people = ["he", "she", "you", "i", "we", "they", ...agentNameForms(agentNames)].join("|");
  const subjectFree = new RegExp(
    `\\b(?:${people})(?:'s|'re|'m|\\s+(?:is|are|am|was|were|(?:will|would|might|may|should|could) be))\\s+free\\b`,
    "g"
  );
  const askFree = new RegExp(`\\b(?:is|are|am|was|were)\\s+(?:${people})\\s+free\\b`, "g");
  return folded.replace(/\bfeel free\b/g, " ").replace(subjectFree, " ").replace(askFree, " ");
}

/**
 * "Sin presión" / "cero presión" (no pressure) is a sales phrase, not blood pressure: removed
 * before the health check. (No lookbehind: this module also loads in the browser.)
 */
function withoutNoPressure(folded: string): string {
  return folded.replace(/(?:^|\s)(?:sin|cero|ninguna|nada de) presion(?:es)?(?=$|[^\p{L}\p{N}])/gu, " ");
}

/** "I'm Isaac" is a claim; "I'm Isaac's assistant" is not, so a possessive never matches. */
function humanClaimPattern(agentNames: string[]): RegExp {
  const byName = agentNameForms(agentNames).flatMap((n) => [
    `i am ${n}(?!'s)`,
    `i'm ${n}(?!'s)`,
    `im ${n}(?!'s)`,
    `soy ${n}`,
    `this is ${n}(?!'s)`,
    `it's ${n}(?!'s)`,
    `${n} here`,
    `aqui ${n}`,
    `my name is ${n}`,
    `my name's ${n}`,
    `le habla ${n}`,
    `te habla ${n}`,
    `le escribe ${n}`,
    `te escribe ${n}`,
  ]);
  return wordPattern(unique([...HUMAN_CLAIMS.map(escapeRegex), ...byName]));
}

/**
 * Claims that need the accents, so they run on `lowerWithAccents` text: "me llamo Isaac" (my name
 * is) but not "me llamó" (he called me); first-person call promises "le / te / lo / la llamo",
 * "le llamaré", "te voy a llamar" but not "Isaac le llamó" (he called you). The English call
 * promises ("I'll call you", "I can call you", "let me call you") sit here too: the AI never calls,
 * Isaac does.
 */
function accentedClaimPattern(agentNames: string[]): RegExp {
  const names = unique([...agentNameForms(agentNames, true), ...agentNameForms(agentNames)]);
  return wordPattern([
    "i(?:'ll|ll| will) (?:call|phone|ring) you",
    "i(?:'ll|ll| will) give you a (?:call|ring)",
    "i(?:'m|m| am) (?:going to|gonna) (?:call|phone|ring) you",
    "i can (?:call|phone|ring) you",
    "let me (?:call|phone|ring) you",
    "(?:le|te|lo|la) llamo",
    "(?:le|te|lo|la) llamar[ée]",
    "(?:le|te|lo|la) voy a llamar",
    "voy a llamar(?:le|te|lo|la)",
    ...names.map((n) => `me llamo ${n}`),
  ]);
}

/** Signed as an agent at the very end: "- Isaac", "— Isaac Orraiz", "Atte. Isaac", "Regards, Isaac". */
function signOffPattern(agentNames: string[]): RegExp {
  const names = agentNameForms(agentNames).join("|");
  const intro = "[-–—]|\\b(?:atte|atentamente|cordialmente|sincerely|regards)";
  return new RegExp(`((?:${intro})\\.?,?\\s*(?:${names}))[\\s.!]*$`, "u");
}

function moneyViolations(folded: string): string[] {
  const out = findAll(folded, MONEY_WORDS).map((w) => `money:${w}`);
  if (folded.includes("$")) out.push("money:$");
  if (PER_MONTH.some((re) => re.test(folded))) out.push("money:per_month");
  if (folded.includes("%") || findAll(folded, PERCENT_WORDS).length > 0) out.push("money:percent");
  return out;
}

/** `folded` = `fold(text)`; `accented` = `lowerWithAccents(text)`, for the claims accents decide. */
function wordRuleViolations(folded: string, accented: string, ctx: GuardContext): string[] {
  const signOff = signOffPattern(ctx.agentNames).exec(folded);
  return [
    ...findAll(folded, BANNED_WORDS).map((w) => `banned_word:${w}`),
    ...moneyViolations(folded),
    ...findAll(withoutAvailabilityFree(folded, ctx.agentNames), PROMISE_WORDS).map((w) => `promise:${w}`),
    ...findAll(withoutNoPressure(folded), HEALTH_WORDS).map((w) => `health:${w}`),
    ...findAll(folded, humanClaimPattern(ctx.agentNames)).map((w) => `human_claim:${w}`),
    ...findAll(accented, accentedClaimPattern(ctx.agentNames)).map((w) => `human_claim:${w}`),
    ...(signOff ? [`human_claim:${signOff[1]}`] : []),
  ];
}

// ─── What the code adds ────────────────────────────────────────────────────────────────────

/** The STOP footer's keyword as the code writes it: case-sensitive, so "Stop by anytime" passes. */
const STOP_KEYWORD_RE = /(?:^|[^\p{L}\p{N}])STOP(?=$|[^\p{L}\p{N}])/u;

/**
 * The code-only parts of the AI disclosure (`aiDisclosure` in lib/ai-setter/ui-strings.ts):
 * "(automated)" and "(inteligencia artificial)". Plain "I'm Isaac's AI assistant" /
 * "soy el asistente de IA de Isaac" is NOT flagged: it is the truthful answer to "are you a
 * bot?", which the prompt requires and some state bot-disclosure laws expect.
 */
const DISCLOSURE_WORDS = wordPattern(["automated", "automatizad[oa]"]);
const DISCLOSURE_PAREN_RE = /\(\s*(?:inteligencia artificial|ia|ai)\s*\)/u;

/**
 * The AI notice and the STOP footer are added by the code (`withDisclosure`) when they are due;
 * a draft that writes its own repeats them, and a "STOP" in the body even keeps the real footer
 * out (it is skipped when the body already says STOP).
 */
function selfNoticeViolations(text: string, folded: string): string[] {
  const out = findAll(folded, DISCLOSURE_WORDS).map((w) => `self_notice:${w}`);
  const paren = DISCLOSURE_PAREN_RE.exec(folded);
  if (paren) out.push(`self_notice:${paren[0]}`);
  if (STOP_KEYWORD_RE.test(text)) out.push("self_notice:STOP");
  return out;
}

// ─── Shape: emoji, length, placeholders, greeting ──────────────────────────────────────────

const EMOJI_RE =
  /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu;

/** "{name}", "[Name]", "<name>", "XXX", "___": template residue that must never reach a lead. */
const PLACEHOLDER_RE = /\{[^{}\n]{1,40}\}|\[[^\[\]\n]{1,40}\]|<[^<>\n]{1,40}>|\bX{3,}\b|_{3,}/u;

const GREETING_WORDS = "(?:[Hh]i|[Hh]ello|[Hh]ey|[Hh]ola|[Dd]ear|[Ee]stimad[oa]|[Qq]uerid[oa]|[Bb]uen[oa]s)";
/** "Hi Carlos," / "Hola Ana María!" — a name right after a greeting. */
const GREETING_NAME_RE = new RegExp(
  `^\\s*${GREETING_WORDS}(?:\\s+(?:d[ií]as|tardes|noches))?[\\s,!¡]+(\\p{Lu}[\\p{L}\\p{M}'’-]*(?:\\s+\\p{Lu}[\\p{L}\\p{M}'’-]*)?)\\s*[,!.]`,
  "u"
);

function shapeViolations(text: string, seg: SmsSegmentInfo, ctx: GuardContext): string[] {
  const out: string[] = [];
  const emoji = (text.match(EMOJI_RE) ?? []).length;
  if (ctx.channel === "SMS") {
    if (seg.segments > ctx.maxSmsSegments) out.push(`too_long:${seg.segments} segments (max ${ctx.maxSmsSegments})`);
    if (emoji > 0) out.push(`emoji:${emoji} (none allowed in SMS)`);
  } else {
    const chars = Array.from(text).length;
    if (chars > WHATSAPP_MAX_CHARS) out.push(`too_long:${chars} chars (max ${WHATSAPP_MAX_CHARS})`);
    if (emoji > WHATSAPP_MAX_EMOJI) out.push(`emoji:${emoji} (max ${WHATSAPP_MAX_EMOJI})`);
  }
  if (PLACEHOLDER_RE.test(text)) out.push("placeholder");
  return out;
}

/** A greeting may only name the lead or an agent, or someone the thread names. */
function greetingNameViolations(text: string, ctx: GuardContext): string[] {
  const match = GREETING_NAME_RE.exec(text);
  if (!match) return [];
  const known = nameWords(ctx);
  const name = fold(match[1]);
  if (name.split(/[\s'-]+/).every((w) => known.has(w))) return [];
  const inThread = new RegExp(`(?:^|${EDGE})${escapeRegex(name)}(?=$|${EDGE})`, "u").test(fold(ctx.threadText));
  return inThread ? [] : ["ungrounded_name:greeting"];
}

// ─── Language and register ─────────────────────────────────────────────────────────────────

/** Common Spanish words (folded). English collisions ("me", "no", "a", "son", "mi") are left out. */
const SPANISH_WORDS = new Set([
  "de", "del", "que", "la", "las", "el", "los", "su", "sus", "le", "les", "lo", "se", "por", "para", "con", "una",
  "es", "en", "y", "te", "nos", "gracias", "hola", "usted", "hoy", "puede", "quiere", "tiene", "llamar", "llamada",
  "cita", "horario", "estado", "sin", "muy", "bien", "buenas", "buenos", "tardes", "noches", "ahora", "hora", "otro",
  "otra", "esta", "este", "pero", "como", "cuando", "donde", "si", "perfecto", "claro", "listo", "entendido", "gusto",
  "favor", "saludos", "ayudar",
]);

/** tú markers that must not appear in an usted text (lowercase, accents as written). */
const TU_MARKERS = new Set([
  "puedes", "tienes", "quieres", "prefieres", "necesitas", "vives", "estás", "eres", "sabes", "deseas", "quieras",
  "puedas", "tengas", "necesites", "estés", "estes", "prefieras", "podrías", "podrias", "quisieras", "tendrías",
  "tendrias", "haces", "piensas", "crees", "buscas", "trabajas", "llamas", "escribes", "respondes", "avisas", "te",
  "tu", "tú", "tus", "contigo", "tuyo", "tuya", "tuyos", "tuyas", "escríbeme", "escribeme", "dime", "avísame",
  "avisame", "llámame", "llamame", "mándame", "mandame", "déjame", "dejame", "cuéntame", "cuentame", "oye",
]);

/** Words that end like an enclitic "-arte / -erte" but are not one. */
const ENCLITIC_LOOKALIKES = new Set(["parte", "aparte", "comparte", "reparte", "imparte", "suerte", "muerte", "fuerte", "marte"]);

/**
 * Enclitic pronouns: "llamarte", "darte", "ayudándote" are tú; "llamarle", "darle", "ayudándole"
 * are usted. Look-alikes ("suerte", "de parte de", "lo que invierte") are skipped.
 */
function encliticRegister(token: string): Register | null {
  if (ENCLITIC_LOOKALIKES.has(token) || token.endsWith("ierte")) return null;
  if (/^\p{L}+(?:[aei]r|ndo)te$/u.test(token)) return "tu";
  if (/^\p{L}+(?:[aei]r|ndo)le$/u.test(token)) return "usted";
  return null;
}

/** usted markers that must not appear in a tú text. */
const USTED_MARKERS = new Set([
  "usted", "su", "sus", "escríbame", "escribame", "dígame", "digame", "avíseme", "aviseme", "llámeme", "llameme",
  "mándeme", "mandeme", "déjeme", "dejeme", "cuénteme", "cuenteme", "oiga",
]);

const USTED_PHRASES = [
  "le puede", "le llamo", "le llama", "le llamará", "le llamara", "le escribo", "le interesa", "le queda", "le quedan",
  "le parece", "le gustaría", "le gustaria", "le responde", "le ayudo", "le ayuda",
];

/** Words of the text minus the brand and names, NFC, case kept. */
function contentTokens(text: string, ctx: GuardContext): string[] {
  const names = nameWords(ctx);
  return (text.normalize("NFC").match(/[\p{L}\p{M}]+/gu) ?? []).filter((t) => !names.has(fold(t)));
}

/** ¿/¡ count 2, any accented letter 1, each common Spanish word 1 (2-letter state codes skipped). */
function spanishScore(text: string, ctx: GuardContext): number {
  const tokens = contentTokens(text, ctx);
  const openers = /[¿¡]/.test(text) ? 2 : 0;
  const accents = tokens.some((t) => /[áéíóúñÁÉÍÓÚÑ]/.test(t)) ? 1 : 0;
  const words = tokens.filter((t) => !/^[A-Z]{2}$/.test(t) && SPANISH_WORDS.has(fold(t))).length;
  return openers + accents + words;
}

function languageViolations(text: string, ctx: GuardContext): string[] {
  const score = spanishScore(text, ctx);
  if (ctx.lang === "es") return score >= 1 ? [] : ["language:expected_es"];
  return score >= 2 ? ["language:expected_en"] : [];
}

function registerViolations(text: string, ctx: GuardContext): string[] {
  if (ctx.lang !== "es") return [];
  const tokens = contentTokens(text, ctx).map((t) => t.toLowerCase());
  if (ctx.register === "usted") {
    const tu = tokens.filter((t) => TU_MARKERS.has(t) || encliticRegister(t) === "tu");
    return unique(tu).map((t) => `register:${t}`);
  }
  const joined = ` ${tokens.join(" ")} `;
  const markers = [
    ...tokens.filter((t) => USTED_MARKERS.has(t) || encliticRegister(t) === "usted"),
    ...USTED_PHRASES.filter((p) => joined.includes(` ${p} `)),
  ];
  return unique(markers).map((m) => `register:${m}`);
}

function guardWarnings(text: string, noLinks: string, seg: SmsSegmentInfo, ctx: GuardContext): string[] {
  const out: string[] = [];
  if (ctx.lang === "en") {
    if (/[‘’‚‛“”„‟]/.test(text)) out.push("punctuation:curly_quotes");
    if (/[—–]/.test(text)) out.push("punctuation:em_dash");
    if (text.includes("…")) out.push("punctuation:ellipsis");
    if (ctx.channel === "SMS" && seg.encoding === "UCS-2") out.push("encoding:UCS-2");
    if (spanishScore(noLinks, ctx) === 1) out.push("language:possible_es");
  }
  return out;
}

// ─── Entry points ──────────────────────────────────────────────────────────────────────────

/**
 * Checks model-written text against the voice, compliance and grounding rules. `ok` is false when
 * there is any violation; warnings never block (`autoFixEnglishPunctuation` clears the
 * punctuation ones). Give it the model's own text, before `withDisclosure` adds the greeting, the
 * AI notice and the STOP footer: those trip `self_notice` here.
 *
 * Violation codes: empty, too_long, emoji, placeholder, banned_word, money (incl. percent),
 * promise, health, human_claim, self_notice, link, phone, ungrounded_number, ungrounded_name,
 * language, register. Persist `flagCode(v)`, not `v`: details can echo the text.
 */
export function guardFreeText(text: string, ctx: GuardContext): GuardResult {
  const seg = smsSegments(text);
  const counts = { segments: seg.segments, encoding: seg.encoding };
  if (!text.trim()) return { ok: false, violations: ["empty"], warnings: [], ...counts };
  const clean = text.normalize("NFC");
  const noBrand = removeBrand(clean, ctx.brand);
  const noLinks = stripLinks(noBrand);
  const folded = fold(noLinks);
  const violations = unique([
    ...shapeViolations(clean, seg, ctx),
    ...wordRuleViolations(folded, lowerWithAccents(noLinks), ctx),
    ...selfNoticeViolations(noLinks, folded),
    ...linkViolations(noBrand, ctx.allowedLinks),
    ...phoneViolations(noLinks, ctx.agentPhone),
    ...ungroundedNumberViolations(noLinks, ctx),
    ...greetingNameViolations(clean, ctx),
    ...languageViolations(noLinks, ctx),
    ...registerViolations(noLinks, ctx),
  ]);
  const warnings = unique(guardWarnings(clean, noLinks, seg, ctx));
  return { ok: violations.length === 0, violations, warnings, ...counts };
}

/**
 * The code of a violation or warning, the part before ":" ("health:diabetes" → "health",
 * "ungrounded_number:65" → "ungrounded_number", "empty" → "empty"). Store this, never the whole
 * flag: a detail can carry what the text said.
 */
export function flagCode(flag: string): string {
  const separator = flag.indexOf(":");
  return separator === -1 ? flag : flag.slice(0, separator);
}

/**
 * English SMS punctuation in ASCII: curly quotes -> straight, em/en dashes -> "-" (an unspaced em
 * dash gets spaces), "…" -> "...", non-breaking and thin spaces -> " ". Keeps an English text in
 * GSM-7 (a single curly apostrophe turns the whole SMS into UCS-2).
 */
export function autoFixEnglishPunctuation(text: string): string {
  return text
    .replace(/[‘’‚‛′ʼ]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/(\S)\s*—\s*(?=\S)/g, "$1 - ")
    .replace(/[—–‐‑‒−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\u00A0\u2007\u2009\u202F]/g, " ");
}
