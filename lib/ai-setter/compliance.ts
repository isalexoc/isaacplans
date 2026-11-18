/**
 * Everything the CODE decides before the model sees a message: opt-out / HELP / START keywords,
 * trivial inbound messages (reactions, acks, auto-replies), Medicare and tú/usted signals, the
 * lead's states and time zones, the reply windows (lead hours, Pennsylvania, WhatsApp 24 h), the
 * license gate and loop detection.
 *
 * Conservative by design (legal review pending, see AI_SETTER_SETUP.md): when a rule is unsure it
 * blocks, holds or asks; it never guesses toward sending.
 *
 * Pure: no DB, no network, no clock: every time-dependent function takes `now`.
 */

import { areaCodeInfo } from "./area-codes";
import { newestInbound } from "./classify";
import type { AttachmentKind, Channel, ThreadMessage } from "./types";

// ─── Text ──────────────────────────────────────────────────────────────────────────────────

/** Straight, curly and modifier apostrophes, backtick and acute accent (Spanish keyboards type "don´t"). */
const APOSTROPHES = /['‘’ʼ`´＇]/g;

/** Zero-width and direction marks that phones add around text (never part of what the lead typed). */
const INVISIBLE = /[\u200B\u200C\u200E\u200F\u2060\uFEFF\u00AD\u202A-\u202E\u2066-\u2069]/g;

/**
 * Text for matching: lowercase; accents stripped (NFKD, so full-width and "𝐒𝐓𝐎𝐏"-style letters
 * fold too); apostrophes dropped so contractions join ("don't" → "dont"); every other punctuation
 * mark, symbol and emoji → a space; whitespace collapsed and trimmed.
 *
 * @example normalizeText("¡No más, por favor! 🙏") // "no mas por favor"
 */
export function normalizeText(s: string): string {
  return s
    .replace(APOSTROPHES, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function words(normalized: string): string[] {
  return normalized ? normalized.split(" ") : [];
}

/** `phrase` (normalized) occurs in `normalized` as whole words. */
function hasPhrase(normalized: string, phrase: string): boolean {
  return ` ${normalized} `.includes(` ${phrase} `);
}

function firstMatch(normalized: string, patterns: readonly RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = pattern.exec(normalized);
    if (m) return m[0];
  }
  return null;
}

/** Raw text without invisible marks, whitespace collapsed: what a person would see. */
function visible(raw: string): string {
  return raw.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

// ─── Opt-out ───────────────────────────────────────────────────────────────────────────────

/**
 * keyword      — the whole message is an opt-out keyword ("STOP", "Basta ya"): definitive
 * phrase       — an unmistakable do-not-contact phrase ("stop texting me", "no me escriban"): definitive
 * wrong_number — the number is not the lead's: definitive (the consent is void)
 * ambiguous    — an opt-out word inside a longer message ("can you stop by?"), or "don't call /
 *                text me" limited to a time or swapped for texting: freeze, one clarification,
 *                alert Isaac
 */
export type OptOutTier = "keyword" | "phrase" | "wrong_number" | "ambiguous";

export type OptOutMatch = { tier: OptOutTier; matched: string };

/** Said around a keyword without changing it: "STOP please", "ya basta", "no más por favor". */
const FILLER_WORDS = new Set(["please", "pls", "plz", "porfa", "porfavor", "now", "ya", "ahora"]);

/** Opt-out when they are the whole message (the FCC's 2025 revocation words + Spanish). Longest first. */
const OPT_OUT_KEYWORDS: readonly string[][] = [
  "stop all",
  "opt out",
  "no mas",
  "stop",
  "stopall",
  "quit",
  "end",
  "revoke",
  "optout",
  "cancel",
  "unsubscribe",
  "basta",
  "alto",
  "parar",
  "cancelar",
  "baja",
].map((k) => k.split(" "));

/** Unmistakable do-not-contact phrases, EN/ES, on normalized text. */
const DO_NOT_CONTACT: readonly RegExp[] = [
  /\bstop (?:texting|txting|texing|messaging|msging|calling|contacting|emailing|bothering|harassing|spamming)\b/,
  /\bstop sending (?:me )?(?:texts|text messages|messages|msgs|sms|these)\b/,
  /\b(?:stop|end|cancel) (?:all |these |the |your |my )?(?:texts|text messages|messages|msgs|subscription)\b/,
  /\bquit (?:texting|txting|messaging|calling|contacting|bothering|harassing) me\b/,
  /\bnever (?:text|txt|call|contact|message|msg|email) me\b/,
  /\bleave me alone\b/,
  /\bremove me\b/,
  /\bremove (?:my|this) (?:number|phone|info|information|name|contact)\b/,
  /\btake (?:me|my number|this number|my name|my info) off\b/,
  /\b(?:delete|erase|lose) (?:me|my number|this number|my info|my information|my contact)\b/,
  /\bunsubscribe me\b/,
  /\bopt me out\b/,
  /\b(?:i want|i wanna|i would like|id like|i wish|let me) (?:to )?(?:unsubscribe|opt out)\b/,
  /\bhow (?:do|can) i (?:unsubscribe|opt out)\b/,
  /\bno longer interested in (?:your |these |the |any )?(?:texts|text messages|messages|calls)\b/,
  /\bno more (?:texts|text messages|messages|msgs|calls)\b/,
  /\brevoke (?:my )?(?:consent|permission|authorization)\b/,
  /\bi revoke\b/,
  /\bno me vuelv(?:an|as|a) a (?:escribir|llamar|contactar|molestar|mandar|enviar|textear)\b/,
  /\bno me (?:manden|mandes|mande|envien|envies|envie) (?:mas )?(?:mensajes|mensajitos|mensaje|textos|texto|sms)\b/,
  /\bno (?:mas|quiero mas) (?:mensajes|mensajitos|textos|llamadas)\b/,
  /\b(?:borrenme|borrame|borreme|eliminenme|eliminame|elimineme)\b/,
  /\b(?:quitenme|quitame|quiteme|saquenme|sacame|saqueme) de\b/,
  /\b(?:borren|borra|borre|eliminen|elimina|elimine|quiten|quita|quite|saquen|saca|saque) (?:mi|este) (?:numero|telefono|informacion|info|nombre|contacto)\b/,
  /\b(?:darme|denme|deme|dame|me doy|me quiero dar) de baja\b/,
  /\b(?:dejenme|dejame|dejeme) (?:en paz|tranquil[oa])\b/,
  /\b(?:revoco|retiro) (?:mi )?(?:consentimiento|autorizacion|permiso)\b/,
  /\bno estoy interesad[oa]s? en (?:recibir )?(?:sus |tus )?(?:mensajes|textos|llamadas)\b/,
  /\bcancel(?:ar|en|a|e|o)? (?:la |mi |su )?suscripcion\b/,
];

/**
 * "Don't call / text me" phrases: definitive on their own, but a time next to them ("no me llame
 * antes de las 5", "don't text me at work") makes them a scheduling wish, and for calls a request
 * to text instead ("no me llame, escríbame", "text me, don't call") is a channel wish: those
 * become `ambiguous`.
 */
const LIMITABLE_DO_NOT_CONTACT: readonly RegExp[] = [
  /\b(?:do not|dont) (?:text|txt|call|contact|message|msg|email)(?: or (?:text|txt|call|contact|message|msg|email))? (?:me|us|this number|my number|my phone)\b/g,
  /\b(?:do not|dont) (?:call|text) or (?:call|text)\b/g,
  // Object-less, ending the message: "Do not text", "Don't contact.", "dont call please".
  /\b(?:do not|dont) (?:text|txt|call|contact|message|msg|email)(?: or (?:text|txt|call|contact|message|msg|email))?(?=(?: (?:please|pls|plz|thanks|thank you|thx|ty|again|anymore|ever|ok|okay|now|today|tonight|yet))*$)/g,
  /\b(?:do not|dont) want (?:any |your |more )*(?:texts|text messages|messages|calls)\b/g,
  /\bno me (?:escriban|escribas|escriba|llamen|llames|llame|contacten|contactes|contacte|texteen|textees|textee)\b/g,
  /\bno quiero que me (?:escriban|escribas|escriba|llamen|llames|llame|contacten|contactes|contacte|molesten|manden|mandes|mande|envien)\b/g,
  /\bno (?:escriban|llamen|contacten)\b/g,
  /\bno (?:me )?molest(?:en|es|e)\b/g,
  /\bno quiero (?:sus |tus |los |las |mas |recibir )*(?:mensajes|mensajitos|llamadas|textos|sms)\b/g,
  /\bno quiero (?:recibir )?(?:ninguna|ningun|ni una|ni un) (?:llamada|llamadas|mensaje|mensajes|mensajito|texto|textos|sms)\b/g,
];

const TIME_LIMIT_WORDS = new Set([
  "before", "after", "until", "till", "til", "today", "tonight", "tomorrow", "now", "yet", "during", "between",
  "while", "morning", "mornings", "afternoon", "afternoons", "evening", "evenings", "night", "nights", "early",
  "late", "work", "working", "busy", "driving", "weekday", "weekdays", "weekend", "weekends", "noon", "am", "pm",
  "oclock", "monday", "mondays", "tuesday", "tuesdays", "wednesday", "wednesdays", "thursday", "thursdays", "friday",
  "fridays", "saturday", "saturdays", "sunday", "sundays",
  "antes", "despues", "hasta", "hoy", "ahora", "ahorita", "horita", "manana", "mananas", "tarde", "tardes",
  "noche", "noches", "temprano", "mediodia", "trabajo", "trabajando", "manejando", "conduciendo", "ocupado", "ocupada",
  "durante", "entre", "mientras", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "sabados", "domingo",
  "domingos", "semana", "finde", "horario", "hora", "horas", "momento",
]);

/** "…, text me instead": words that ask for texts after a "don't call me". */
const TEXT_PREFERENCE_WORDS = new Set([
  "text", "texts", "texting", "txt", "message", "messages", "msg", "sms", "whatsapp", "wasap", "whats", "email",
  "mail", "chat", "texto", "textos", "mensaje", "mensajes", "mensajito", "mensajitos", "correo", "escribame",
  "escribeme", "escribanme", "escribirme", "escribir", "textear", "texteame", "texteeme",
]);

/** A preference word right after one of these extends the "don't" instead ("don't call or text me"). */
const NEGATORS = new Set(["or", "nor", "and", "dont", "not", "no", "never", "ni", "o", "y", "nunca"]);

/** Right after a "don't call/text me" these make it permanent, whatever follows ("no me llames más, ahora sí"). */
const PERMANENT_WORDS = new Set(["mas", "anymore", "ever", "nunca", "jamas"]);

/** Whole words that make a "cancel" about an appointment: the model handles it. */
const APPOINTMENT_WORDS = new Set([
  "cita", "citas", "appointment", "appointments", "appt", "appts", "llamada", "call", "reunion", "reuniones",
  "meeting", "meetings", "horario", "hora", "reschedule", "reprogramar", "cambiar",
]);
const CANCEL_WORDS = new Set([
  "cancel", "cancelar", "cancela", "cancelo", "cancele", "cancelen", "cancelarla", "cancelarlo", "canceled",
  "cancelled", "canceling", "cancelling", "cancellation", "cancelacion",
]);

/** Inside a longer message these may or may not mean opt-out. "end", "baja", "alto" are not here: weekend, "la presión baja". */
const AMBIGUOUS_WORDS = new Set(["stop", "stopall", "unsubscribe", "unsub", "cancel", "cancelar", "basta", "parar", "quit", "revoke", "optout"]);

/**
 * Besides the opt-out words that are not cancel words (stop, basta, unsubscribe, …), these keep a
 * "cancel … appointment" message an opt-out candidate ("Cancelar, no quiero ninguna llamada").
 */
const CANCEL_EXCEPTION_BLOCKERS: readonly RegExp[] = [
  /\bopt out\b/,
  /\bno (?:quiero|queremos) (?:recibir )?(?:ninguna|ningun|ni una|ni un) (?:llamada|llamadas|mensaje|mensajes|mensajito|texto|textos|sms)\b/,
];

/**
 * Spanish "stop <doing>": dejen / deje / deja / dejar / paren … de + escribir(me), llamar(me),
 * mandar(me), enviar(me), recibir … with an optional object ("de mandarme mensajes"). Run on one
 * normalized clause at a time (see `stopDoingHits`).
 */
const STOP_DOING =
  /\b(dejar|dejen|deje|deja|dejes|dejan|dejaran|dejarian|parar|paren|pare|para|pares) de (escribir|llamar|mandar|enviar|contactar|molestar|textear|acosar|recibir)(me|nos)?(?: (?:sus |tus |los |las |mas |estos |esos )*(?:mensajes|mensajitos|mensaje|textos|texto|sms|llamadas|llamada|correos))?\b/g;

/** Once accents are gone these are also "dejé / paré" (I stopped …): "dejé de escribir porque…". */
const PAST_LOOKALIKES = new Set(["deje", "pare"]);

const NEGATION_WORDS = new Set(["no", "nunca", "jamas"]);

/** May stand between a "no" and the verb it negates: "no ME dejen", "no QUIERO dejar", "no quiero QUE me dejen". */
const NEGATION_BRIDGE = new Set([
  "me", "te", "le", "nos", "les", "se", "lo", "la", "que", "a", "quiero", "queremos", "quisiera", "quiere", "puedo",
  "puede", "pueden", "podemos", "vayan", "vaya", "van", "va", "voy",
]);

const WRONG_NUMBER: readonly RegExp[] = [
  /\bwrong (?:number|num|person|phone|contact)\b/,
  /^(?:wrong|equivocad[oa]s?)$/,
  /\bnumero equivocado\b/,
  /\bequivoc(?:aron|o|ado|ada|ados|adas|a) de (?:numero|persona)\b/,
  /\bno conozco a (?:esa persona|esta persona|ese nombre|nadie (?:con ese nombre|asi|llamad[oa])|ningun[oa]?|ese senor|esa senora)\b/,
  /\bno conozco ese nombre\b/,
  /\bno soy (?:esa persona|esta persona|la persona que (?:busca|buscan)|quien (?:busca|buscan|usted busca))\b/,
  /\bno soy (?:el|ella)$/,
  /\b(?:este numero|este telefono) no es (?:de|del|para)\b/,
  /\bno es (?:el|su) (?:numero|telefono) de\b/,
  /\b(?:i am|im) not (?:him|her|that person|the person you|who you)\b/,
  /\b(?:no one|noone|nobody) (?:here )?(?:by|with|named) that name\b/,
  /\b(?:is not|isnt) (?:his|her|their) (?:number|phone)\b/,
];

function withoutFillers(tokens: string[]): string[] {
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "por" && tokens[i + 1] === "favor") {
      i++;
    } else if (!FILLER_WORDS.has(tokens[i])) {
      kept.push(tokens[i]);
    }
  }
  return kept;
}

/** "STOP", "Stop please", "STOP STOP", "Basta ya" → the keyword(s); null when anything else is said. */
function keywordOnly(normalized: string): string | null {
  const tokens = withoutFillers(words(normalized));
  const found: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const keyword = OPT_OUT_KEYWORDS.find((k) => k.every((t, j) => tokens[i + j] === t));
    if (!keyword) return null;
    const joined = keyword.join(" ");
    if (!found.includes(joined)) found.push(joined);
    i += keyword.length;
  }
  return found.length > 0 ? found.join(" ") : null;
}

function isTimeWord(token: string): boolean {
  return TIME_LIMIT_WORDS.has(token) || /^\d/.test(token);
}

function isCallOnly(phrase: string): boolean {
  return (
    /\b(?:call|calls|llamen|llames|llame|llamada|llamadas|llamar|llamarme|llamarnos)\b/.test(phrase) &&
    !/\b(?:text|texts|txt|message|messages|msg|email|contact\w*|escrib\w*|textee?\w*|molest\w*|mand\w*|envi\w*|mensaj\w*|sms)\b/.test(phrase)
  );
}

/** A request for texts among `tokens` ("text me", "escríbame"), not a negated one ("no texts"). */
function prefersText(tokens: string[]): boolean {
  return tokens.some((t, i) => TEXT_PREFERENCE_WORDS.has(t) && !NEGATORS.has(i > 0 ? tokens[i - 1] : ""));
}

/**
 * A time within 3 words before / 6 words after, or (for "don't call me") a request to text
 * instead, before or after it. "más / anymore / ever / nunca / jamás" right after the phrase
 * keeps it permanent.
 */
function isLimited(normalized: string, index: number, phrase: string): boolean {
  const before = words(normalized.slice(0, index).trim()).slice(-3);
  const after = words(normalized.slice(index + phrase.length).trim()).slice(0, 6);
  if (after.slice(0, 2).some((t) => PERMANENT_WORDS.has(t))) return false;
  if (before.some(isTimeWord) || after.some(isTimeWord)) return true;
  return isCallOnly(phrase) && (prefersText(after) || prefersText(before));
}

type PhraseHit = { matched: string; limited: boolean };

/** The message split at punctuation, symbols and emoji, each part normalized; empty parts dropped. */
function clauses(raw: string): Array<{ raw: string; normalized: string }> {
  return raw
    .replace(INVISIBLE, "")
    .replace(APOSTROPHES, "")
    .split(/[^\p{L}\p{M}\p{N}\s]+/u)
    .map((part) => ({ raw: part, normalized: normalizeText(part) }))
    .filter((part) => part.normalized !== "");
}

/** A "no / nunca / jamás" right before the verb, or before up to 3 bridge words ("no me dejen de…"). */
function isNegated(before: string[]): boolean {
  let bridged = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (NEGATION_WORDS.has(before[i])) return true;
    if (!NEGATION_BRIDGE.has(before[i]) || ++bridged > 3) return false;
  }
  return false;
}

/**
 * `STOP_DOING` requests, clause by clause, so "No, dejen de escribirme" stays definitive while
 * "No dejen de escribirme" (keep writing, or a "No, …" typed without the comma) is held back as
 * ambiguous. Also held back: "deje / pare" with no object pronoun, which may be "dejé / paré"
 * typed without the accent; with the accent typed it is skipped ("dejé de escribir porque…").
 * "recibir" only counts after "dejar / parar" ("quiero dejar de recibir mensajes"): "dejé de
 * recibir sus mensajes" is a complaint that they stopped arriving. Times and "text me instead"
 * limit them like any other phrase.
 */
function stopDoingHits(raw: string): PhraseHit[] {
  const parts = clauses(raw);
  const joined = parts.map((part) => part.normalized).join(" ");
  const hits: PhraseHit[] = [];
  let offset = 0;
  for (const part of parts) {
    const pastTyped = /(?:^|[^\p{L}])(?:dejé|paré)\s+de\s/u.test(part.raw.normalize("NFC").toLowerCase());
    for (const m of part.normalized.matchAll(STOP_DOING)) {
      const [phrase, form, verb, pronoun] = m;
      const index = m.index ?? 0;
      if (verb === "recibir" && form !== "dejar" && form !== "parar") continue;
      const lookalike = PAST_LOOKALIKES.has(form) && !pronoun;
      if (lookalike && pastTyped) continue;
      const negated = isNegated(words(part.normalized.slice(0, index).trim()));
      hits.push({ matched: phrase, limited: negated || lookalike || isLimited(joined, offset + index, phrase) });
    }
    offset += part.normalized.length + 1;
  }
  return hits;
}

/** The first definitive phrase, else the first held-back one (which `detectOptOut` makes ambiguous). */
function doNotContactPhrase(normalized: string, stopDoing: PhraseHit[]): PhraseHit | null {
  const definitive = firstMatch(normalized, DO_NOT_CONTACT);
  if (definitive) return { matched: definitive, limited: false };
  let limitedHit: PhraseHit | null = null;
  const limitable = LIMITABLE_DO_NOT_CONTACT.flatMap((pattern) =>
    Array.from(normalized.matchAll(pattern), (m): PhraseHit => ({ matched: m[0], limited: isLimited(normalized, m.index ?? 0, m[0]) }))
  );
  for (const hit of [...stopDoing, ...limitable]) {
    if (!hit.limited) return hit;
    limitedHit = limitedHit ?? hit;
  }
  return limitedHit;
}

/**
 * A cancel word plus an appointment word ("quiero cancelar la cita"), and nothing else that sounds
 * like an opt-out: no other opt-out word (stop, basta, unsubscribe, …), no "opt out", no "no quiero
 * ninguna llamada", no "dejen de …" request.
 */
function isAppointmentCancelOnly(normalized: string, stopDoing: PhraseHit[]): boolean {
  const tokens = words(normalized);
  if (!tokens.some((t) => APPOINTMENT_WORDS.has(t)) || !tokens.some((t) => CANCEL_WORDS.has(t))) return false;
  if (stopDoing.length > 0 || tokens.some((t) => AMBIGUOUS_WORDS.has(t) && !CANCEL_WORDS.has(t))) return false;
  return !CANCEL_EXCEPTION_BLOCKERS.some((pattern) => pattern.test(normalized));
}

/** The opt-out word of a longer message, preferring one that is not a cancel word ("Cancel my appointment. STOP" → "stop"). */
function ambiguousWord(normalized: string): string | null {
  const tokens = words(normalized);
  const hit = tokens.find((t) => AMBIGUOUS_WORDS.has(t) && !CANCEL_WORDS.has(t));
  if (hit) return hit;
  if (hasPhrase(normalized, "opt out")) return "opt out";
  return tokens.find((t) => AMBIGUOUS_WORDS.has(t)) ?? null;
}

/**
 * Does this inbound message ask to stop being contacted? Order:
 *  1. keyword: after dropping fillers (please, pls, plz, por favor, porfa, now, ya, ahora) the
 *     message is only opt-out keywords: STOP, STOP ALL, STOPALL, QUIT, END, REVOKE, OPT OUT, OPTOUT,
 *     CANCEL, UNSUBSCRIBE, BASTA, ALTO, PARAR, CANCELAR, BAJA, NO MÁS ("STOP STOP" counts).
 *  2. phrase: an EN/ES do-not-contact phrase, including "dejar de …" requests ("¿pueden dejar de
 *     escribirme?", "quiero dejar de recibir mensajes", "dejen de llamar") and an object-less "do
 *     not text / don't call" ending the message. Held back for step 5 instead: a "don't call/text
 *     me" with a time next to it, a "don't call me, text me" (either order), a negated "no dejen de
 *     escribirme", and a "deje de llamar" that may be "dejé" (I stopped).
 *  3. wrong_number: "wrong number", "número equivocado", "no conozco a esa persona", …
 *  4. an appointment word (cita, appointment, call, hora, reschedule, …) plus a cancel word
 *     ("quiero cancelar la cita") → null, the model handles it, but only when nothing else sounds
 *     like an opt-out: another opt-out word (stop, basta, unsubscribe, unsub, quit, revoke, …),
 *     "opt out", "no quiero ninguna llamada" or a "dejar de …" request keeps it going to step 5
 *     ("Cancel my appointment. STOP" → ambiguous).
 *  5. ambiguous: a held-back phrase from step 2, or stop / unsubscribe / cancel / cancelar / basta /
 *     parar / quit / revoke / optout / opt out as a whole word inside a longer message.
 * Tapback reactions are never opt-outs: they quote our own message (and its STOP footer).
 */
export function detectOptOut(text: string): OptOutMatch | null {
  if (isReaction(text)) return null;
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const keyword = keywordOnly(normalized);
  if (keyword) return { tier: "keyword", matched: keyword };
  const stopDoing = stopDoingHits(text);
  const phrase = doNotContactPhrase(normalized, stopDoing);
  if (phrase && !phrase.limited) return { tier: "phrase", matched: phrase.matched };
  const wrong = firstMatch(normalized, WRONG_NUMBER);
  if (wrong) return { tier: "wrong_number", matched: wrong };
  if (isAppointmentCancelOnly(normalized, stopDoing)) return null;
  if (phrase) return { tier: "ambiguous", matched: phrase.matched };
  const word = ambiguousWord(normalized);
  return word ? { tier: "ambiguous", matched: word } : null;
}

// ─── Opt-out clarification ─────────────────────────────────────────────────────────────────

/** Short yes answers (normalized); the opt-out keywords count too ("STOP", "sí, basta"). Longest first. */
const YES_ANSWERS: readonly string[][] = [
  "yes", "yeah", "yep", "yup", "si", "ok", "okay", "okey", "sure", "correct", "correcto", "confirm", "confirmed",
  "confirmo", "confirmado", "de acuerdo", "claro", "claro que si", "asi es", "exacto", "exactly",
]
  .map((answer) => answer.split(" "))
  .concat(OPT_OUT_KEYWORDS)
  .sort((a, b) => b.length - a.length);

const PLEASE_WORDS = new Set(["please", "pls", "plz", "porfa", "porfavor"]);
const NO_ANSWERS = new Set(["no", "nope", "nah", "nop"]);

/** "keep texting (me)", "you can keep texting", "please continue messaging": a whole clause. */
const KEEP_TEXTING_EN =
  /^(?:(?:please|pls|plz) )?(?:(?:you|u) (?:can|may) )?(?:keep|continue) (?:texting|txting|messaging|msging|writing|sending)(?: (?:me|us))?(?: (?:messages|texts|msgs))?(?: (?:please|pls|plz|thanks|thank you|thx))?$/;

/** "sigan escribiendo", "puede seguir escribiéndome", "sigue mandando mensajes": a whole clause. */
const KEEP_TEXTING_ES =
  /^(?:(?:por favor|porfa) )?(?:(?:pueden|puede|puedes|podrian|podria) (?:seguir|continuar)|sigan|siga|sigue|continuen|continue|continua) (?:escribiendo|escribiendome|escribiendonos|mandando|mandandome|enviando|enviandome)(?: (?:me|mensajes))?(?: (?:por favor|porfa|gracias))?$/;

/** Only short affirmatives / opt-out keywords, fillers aside; "please" / "por favor" alone count. */
function isAffirmative(tokens: string[]): boolean {
  const rest = withoutFillers(tokens);
  if (rest.length === 0) return tokens.some((t) => PLEASE_WORDS.has(t)) || hasPhrase(tokens.join(" "), "por favor");
  for (let i = 0; i < rest.length; ) {
    const answer = YES_ANSWERS.find((a) => a.every((t, j) => rest[i + j] === t));
    if (!answer) return false;
    i += answer.length;
  }
  return true;
}

/**
 * "No, keep texting" / "Nope. Sigan escribiendo": bare negatives, then a keep-texting clause.
 * English also without the comma ("no keep texting me"); Spanish needs it: "no sigan escribiendo"
 * means "stop writing".
 */
function isKeepTexting(raw: string): boolean {
  const parts = clauses(raw).map((part) => part.normalized);
  const isNo = (part: string) => words(part).every((t) => NO_ANSWERS.has(t));
  const last = parts[parts.length - 1] ?? "";
  if (parts.length >= 2 && parts.slice(0, -1).every(isNo) && (KEEP_TEXTING_EN.test(last) || KEEP_TEXTING_ES.test(last))) return true;
  const tokens = words(parts.join(" "));
  let negatives = 0;
  while (negatives < tokens.length && NO_ANSWERS.has(tokens[negatives])) negatives++;
  return negatives > 0 && KEEP_TEXTING_EN.test(tokens.slice(negatives).join(" "));
}

/**
 * The lead's answer to `optout_clarify` ("Do you want us to stop messaging you completely? Reply
 * STOP to confirm"), accent- and case-insensitive:
 *  yes   — a short affirmative, alone or with please / por favor: yes, yeah, yep, sí, ok, okay,
 *          okey, sure, correct(o), confirm(o), de acuerdo, claro (que sí), así es, exacto, or just
 *          "please" / "por favor"; opt-out keywords count too ("STOP", "sí, basta").
 *  no    — a bare negative (no, nope, nah, "no no") or "no, keep texting" / "no, sigan escribiendo".
 *  other — anything else, "no gracias" included (it can mean "no more messages, thanks").
 */
export function classifyClarification(text: string): "yes" | "no" | "other" {
  const tokens = words(normalizeText(text));
  if (tokens.length === 0) return "other";
  if (tokens.every((t) => NO_ANSWERS.has(t)) || isKeepTexting(text)) return "no";
  return isAffirmative(tokens) ? "yes" : "other";
}

// ─── HELP / START ──────────────────────────────────────────────────────────────────────────

const HELP_MESSAGES = new Set(["help", "ayuda", "info", "information", "informacion"]);
const START_MESSAGES = new Set(["start", "unstop", "subscribe", "reanudar", "iniciar"]);

/** The whole message is HELP / AYUDA / INFO / INFORMATION / INFORMACIÓN (fixed compliance reply). */
export function detectHelp(text: string): boolean {
  return HELP_MESSAGES.has(normalizeText(text));
}

/** The whole message is START / UNSTOP / SUBSCRIBE / REANUDAR / INICIAR (lifts the suppression). */
export function detectStart(text: string): boolean {
  return START_MESSAGES.has(normalizeText(text));
}

// ─── Trivial inbound ───────────────────────────────────────────────────────────────────────

export type TrivialKind = "reaction" | "emoji_only" | "ack" | "auto_reply" | "empty" | "media_only";

/** Phrases only machines write: one is enough. */
const AUTO_REPLY_MARKERS = [
  "auto-reply", "autoreply", "automatic reply", "automated reply", "auto response", "autoresponse",
  "automatic response", "automated message", "out of office", "out of the office", "fuera de la oficina",
  "i'm driving", "i am driving", "driving right now", "estoy manejando", "estoy conduciendo", "respuesta automatica",
  "mensaje automatico", "this is an automated", "do not reply", "no responda", "sent from my car", "driving focus",
  "do not disturb while driving", "when i get where i'm going", "cuando llegue a mi destino", "modo conduccion",
].map(normalizeText);

/** Polite phrases people write too ("Gracias por su mensaje, ¿me llama a las 5?"): two are needed. */
const WEAK_AUTO_REPLY_MARKERS = [
  "thank you for your message", "thanks for your message", "gracias por su mensaje", "i will get back to you",
  "we will get back to you", "le respondere", "le responderemos", "thank you for contacting", "thanks for contacting",
  "gracias por comunicarse", "gracias por contactarnos",
].map(normalizeText);

const OK_WORDS = ["ok", "okay", "okey", "k", "kk", "bueno", "vale"];
const THANKS_WORDS = [
  "thanks", "thank you", "thank u", "thx", "ty", "thank you so much", "thanks so much", "thank you very much",
  "thanks a lot", "gracias", "muchas gracias", "mil gracias", "muchisimas gracias",
];
/**
 * Acknowledgements that need no answer. Never "perfecto / listo / sí / yes / sure / claro": those
 * can accept an offered time.
 */
const ACK_MESSAGES = new Set([
  ...OK_WORDS,
  ...THANKS_WORDS,
  "de nada",
  ...OK_WORDS.flatMap((ok) => THANKS_WORDS.map((thanks) => `${ok} ${thanks}`)),
]);

const QUOTE = "[\"'“”„«‘’‚‹]";
const TAPBACK_EN = "liked|loved|laughed at|emphasized|emphasised|questioned|disliked|reacted (?:with )?\\S{1,16} to";
const TAPBACK_ES = "le gusto|le encanto|se rio de|enfatizo|cuestiono|no le gusto|reacciono con \\S{1,16} a";
const UNDO_TAPBACK = "removed an? .{1,30}? from|(?:elimino|quito) (?:un|una|el|la) .{1,30}? de";
const MEDIA_EN = "an image|a photo|a picture|a video|a movie|an attachment|a sticker|a gif|an audio message|a message";
const MEDIA_ES = "una imagen|una foto|un video|un archivo adjunto|un sticker|un gif|un mensaje de audio|un mensaje";

/** iOS / Android tapbacks, EN/ES: Liked "…", Reacted 😂 to "…", Le gustó "…", Reaccionó con 👍 a "…", Loved an image. */
const REACTION_PATTERNS: readonly RegExp[] = [
  new RegExp(`^(?:${TAPBACK_EN}|${TAPBACK_ES}|${UNDO_TAPBACK}) ?${QUOTE}`, "u"),
  new RegExp(`^(?:${TAPBACK_EN}|${TAPBACK_ES}) (?:${MEDIA_EN}|${MEDIA_ES})[.!]*$`, "u"),
];

function isReaction(raw: string): boolean {
  const folded = visible(raw).normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  return REACTION_PATTERNS.some((p) => p.test(folded));
}

function isAutoReply(normalized: string): boolean {
  if (AUTO_REPLY_MARKERS.some((m) => hasPhrase(normalized, m))) return true;
  return WEAK_AUTO_REPLY_MARKERS.filter((m) => hasPhrase(normalized, m)).length >= 2;
}

/**
 * Inbound messages that need no AI answer, or need a fixed path. Order:
 *  empty (blank, no attachments) / media_only (blank with attachments) → auto_reply (machine
 *  phrases; the polite ones need two) → reaction (tapbacks) → emoji_only (no letter or digit
 *  left; a lone "?" is a question, not trivial) → ack (ok / thanks / gracias / bueno / vale …).
 * Text WITH an attachment is only ever `auto_reply` or null: the attachment may matter.
 */
export function classifyTrivialInbound(body: string, attachments: AttachmentKind[]): TrivialKind | null {
  const raw = visible(body);
  if (!raw) return attachments.length > 0 ? "media_only" : "empty";
  const normalized = normalizeText(raw);
  if (isAutoReply(normalized)) return "auto_reply";
  if (attachments.length > 0) return null;
  if (isReaction(raw)) return "reaction";
  if (!normalized) return /[?¿]/.test(raw) ? null : "emoji_only";
  return ACK_MESSAGES.has(normalized) ? "ack" : null;
}

// ─── Topic & register ──────────────────────────────────────────────────────────────────────

const MEDICARE = /\b(?:medicare|medigap|part d|parte d)\b/;

/** Medicare, Medicare Advantage, Part D / Parte D, Medigap, suplemento de Medicare (not Medicaid). */
export function detectMedicare(text: string): boolean {
  return MEDICARE.test(normalizeText(text));
}

const TU_WORDS = new Set([
  "puedes", "tienes", "quieres", "eres", "dime", "llamame", "escribeme", "avisame", "contigo", "oye", "podrias",
  "sabes", "necesitas", "mandame", "marcame", "hablame", "contestame", "llamarte", "escribirte", "hablarte",
  "contactarte", "ayudame", "explicame", "cuentame",
]);
/** "estás" loses its accent in normalized text ("estas" is also "these"), so only verb contexts count. */
const TU_PHRASES = [
  "tu numero", "tu telefono", "como estas", "tu estas", "estas bien", "estas ahi", "estas libre", "estas ocupado",
  "estas ocupada", "estas disponible", "estas listo", "estas lista", "estas seguro", "estas segura",
];
const USTED_WORDS = new Set([
  "usted", "digame", "llameme", "escribame", "aviseme", "marqueme", "hableme", "contesteme", "mandeme", "ayudeme",
  "expliqueme", "cuenteme", "disculpe", "perdone",
]);

function hasAccentedTu(raw: string): boolean {
  const tokens = raw.normalize("NFC").toLowerCase().split(/[^\p{L}]+/u);
  return tokens.includes("estás") || tokens.includes("tú");
}

/**
 * The lead addresses us with tú (Spanish). Heuristic: an informal marker (puedes, tienes, quieres,
 * eres, estás, dime, llámame, escríbeme, avísame, contigo, tu número, tu teléfono, oye, …) and no
 * formal one (usted, dígame, llámeme, escríbame, avíseme, …). Call it on Spanish text only
 * ("dime" is also an English word).
 */
export function usesTu(text: string): boolean {
  const normalized = normalizeText(text);
  const tokens = words(normalized);
  if (tokens.some((t) => USTED_WORDS.has(t))) return false;
  if (tokens.some((t) => TU_WORDS.has(t))) return true;
  return TU_PHRASES.some((p) => hasPhrase(normalized, p)) || hasAccentedTu(text);
}

// ─── States ────────────────────────────────────────────────────────────────────────────────

/** Code → English and Spanish names (normalized), common misspellings included. */
const STATE_NAMES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["AL", ["alabama"]],
  ["AK", ["alaska"]],
  ["AZ", ["arizona"]],
  ["AR", ["arkansas"]],
  ["CA", ["california"]],
  ["CO", ["colorado"]],
  ["CT", ["connecticut", "conneticut"]],
  ["DE", ["delaware"]],
  ["DC", ["district of columbia", "distrito de columbia", "washington dc", "washington d c"]],
  ["FL", ["florida"]],
  ["GA", ["georgia"]],
  ["HI", ["hawaii", "hawai"]],
  ["ID", ["idaho"]],
  ["IL", ["illinois"]],
  ["IN", ["indiana"]],
  ["IA", ["iowa"]],
  ["KS", ["kansas"]],
  ["KY", ["kentucky"]],
  ["LA", ["louisiana", "luisiana"]],
  ["ME", ["maine"]],
  ["MD", ["maryland"]],
  ["MA", ["massachusetts", "massachusets"]],
  ["MI", ["michigan"]],
  ["MN", ["minnesota"]],
  ["MS", ["mississippi", "mississipi", "misisipi"]],
  ["MO", ["missouri", "misuri"]],
  ["MT", ["montana"]],
  ["NE", ["nebraska"]],
  ["NV", ["nevada"]],
  ["NH", ["new hampshire", "nuevo hampshire"]],
  ["NJ", ["new jersey", "nueva jersey"]],
  ["NM", ["new mexico", "nuevo mexico", "nuevo mejico"]],
  ["NY", ["new york", "nueva york"]],
  ["NC", ["north carolina", "n carolina", "carolina del norte"]],
  ["ND", ["north dakota", "n dakota", "dakota del norte"]],
  ["OH", ["ohio"]],
  ["OK", ["oklahoma"]],
  ["OR", ["oregon"]],
  ["PA", ["pennsylvania", "pensylvania", "pensilvania"]],
  ["RI", ["rhode island"]],
  ["SC", ["south carolina", "s carolina", "carolina del sur"]],
  ["SD", ["south dakota", "s dakota", "dakota del sur"]],
  ["TN", ["tennessee", "tennesse", "tenesi"]],
  ["TX", ["texas", "tejas"]],
  ["UT", ["utah"]],
  ["VT", ["vermont"]],
  ["VA", ["virginia"]],
  ["WA", ["washington", "washington state"]],
  ["WV", ["west virginia", "w virginia", "virginia occidental"]],
  ["WI", ["wisconsin"]],
  ["WY", ["wyoming"]],
  ["PR", ["puerto rico"]],
  ["VI", ["virgin islands", "us virgin islands", "u s virgin islands", "islas virgenes"]],
  ["GU", ["guam"]],
  ["MP", ["northern mariana islands", "islas marianas del norte"]],
  ["AS", ["american samoa", "samoa americana"]],
];

const STATE_CODES = new Set(STATE_NAMES.map(([code]) => code));
const STATE_BY_NAME = new Map(STATE_NAMES.flatMap(([code, names]) => names.map((name) => [name, code] as const)));

/**
 * 2-letter code from a code ("fl", "N.Y.") or a full English / Spanish name ("Florida", "Nueva
 * York", "Carolina del Norte"), case- and accent-insensitive. 50 states, DC, PR (and the other US
 * territories: VI, GU, MP, AS). Null when unrecognized.
 */
export function toStateCode(state: string | null | undefined): string | null {
  if (!state) return null;
  const normalized = normalizeText(state);
  if (!normalized) return null;
  const compact = normalized.replace(/ /g, "");
  if (compact.length === 2) {
    const code = compact.toUpperCase();
    return STATE_CODES.has(code) ? code : null;
  }
  return STATE_BY_NAME.get(normalized) ?? null;
}

// ─── Time zones ────────────────────────────────────────────────────────────────────────────

/** IANA-shaped names only: Intl also accepts offsets ("+05:00"), which do not place a person. */
const ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;
const canonicalZones = new Map<string, string | null>();

/** Intl's canonical id for a valid zone ("US/Eastern" → "America/New_York"), else null. */
function canonicalZone(zone: string): string | null {
  const name = zone.trim();
  if (!ZONE_NAME.test(name)) return null;
  const cached = canonicalZones.get(name);
  if (cached !== undefined) return cached;
  let canonical: string | null;
  try {
    canonical = new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions().timeZone;
  } catch {
    canonical = null;
  }
  canonicalZones.set(name, canonical);
  return canonical;
}

/** A valid IANA zone that places a person (trimmed), else null. UTC / GMT / Etc/* are placeholders. */
function usableZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  const canonical = canonicalZone(zone);
  if (!canonical || canonical === "UTC" || canonical.startsWith("Etc/")) return null;
  return zone.trim();
}

/** Valid zones, first occurrence wins, duplicates by canonical id dropped ("US/Eastern" = "America/New_York"). */
function uniqueZones(zones: ReadonlyArray<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const zone of zones) {
    const usable = usableZone(zone);
    if (!usable) continue;
    const key = canonicalZone(usable) ?? usable;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(usable);
  }
  return out;
}

export type LeadZones = {
  /** Every zone the lead may be in, primary first. A send must be fine in ALL of them. */
  zones: string[];
  primaryZone: string | null;
  /** Address state and area-code state, de-duplicated (both count for state rules like PA). */
  stateCodes: string[];
  /** Address state, else the area-code state. */
  licenseState: string | null;
  /** Where `primaryZone` came from. */
  source: "ghl" | "address" | "area_code" | "none";
};

function addressZone(
  lookup: (state: string | null, zip: string | null) => string | null,
  state: string | null,
  zip: string | null
): string | null {
  if (!state && !zip) return null;
  try {
    return lookup(state, zip);
  } catch {
    return null;
  }
}

/**
 * Where the lead is. zones = union of GHL's `timezone` (if a valid IANA zone), the address zone
 * (`stateZipToZone(code, zip)` — the address state is normalized to its 2-letter code first) and
 * the area-code zone; primaryZone by priority GHL → address → area code.
 */
export function resolveLeadZones(
  input: { ghlTimezone: string | null; state: string | null; postalCode: string | null; phone: string | null },
  stateZipToZone: (state: string | null, zip: string | null) => string | null
): LeadZones {
  const addressState = toStateCode(input.state);
  const area = areaCodeInfo(input.phone);
  const lookupState = addressState ?? (input.state?.trim() || null);
  const ranked: Array<{ source: LeadZones["source"]; zone: string | null }> = [
    { source: "ghl", zone: usableZone(input.ghlTimezone) },
    { source: "address", zone: usableZone(addressZone(stateZipToZone, lookupState, input.postalCode?.trim() || null)) },
    { source: "area_code", zone: area ? usableZone(area.timeZone) : null },
  ];
  const primary = ranked.find((r) => r.zone !== null) ?? null;
  const stateCodes = [addressState, area ? area.state : null].filter((s): s is string => s !== null);
  return {
    zones: uniqueZones(ranked.map((r) => r.zone)),
    primaryZone: primary ? primary.zone : null,
    stateCodes: Array.from(new Set(stateCodes)),
    licenseState: addressState ?? (area ? area.state : null),
    source: primary ? primary.source : "none",
  };
}

// ─── Local clock & reply windows ───────────────────────────────────────────────────────────

export type LocalClock = { weekday: number; minutes: number; dateKey: string };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = clockFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  clockFormatters.set(timeZone, formatter);
  return formatter;
}

/**
 * Wall clock in `timeZone`: weekday (0 = Sunday), minutes since local midnight, local date
 * "YYYY-MM-DD". Throws RangeError for an invalid zone (zones from `resolveLeadZones` are valid).
 */
export function localClock(date: Date, timeZone: string): LocalClock {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of clockFormatter(timeZone.trim()).formatToParts(date)) parts[part.type] = part.value;
  const hour = Number(parts.hour ?? 0) % 24;
  return {
    weekday: WEEKDAY_INDEX[parts.weekday ?? ""] ?? 0,
    minutes: hour * 60 + Number(parts.minute ?? 0),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export type ReplyWindow = {
  allowedNow: boolean;
  reason: "fresh_reply" | "within_hours" | "outside_hours" | "pa_window";
  /** Earliest instant every zone allows (on a 5-minute grid, ≤ 8 days ahead); null when allowed now or none found. */
  nextAllowedAt: Date | null;
};

/** Nothing places the lead: a send must be fine on both coasts. */
const UNKNOWN_LEAD_ZONES = ["America/New_York", "America/Los_Angeles"];
const FRESH_REPLY_MS = 30 * 60_000;
/** GHL's clock may run a little ahead of ours: an inbound up to this far "in the future" still counts. */
const CLOCK_SKEW_MS = 5 * 60_000;
const SCAN_STEP_MS = 5 * 60_000;
const SCAN_HORIZON_MS = 8 * 24 * 3_600_000;

type HoursRule = (clock: LocalClock) => boolean;

/** 8:00 a.m. to 9:00 p.m. local (TCPA quiet hours: nothing before 8 or from 9 p.m. on). */
const LEAD_HOURS: HoursRule = (c) => c.minutes >= 8 * 60 && c.minutes < 21 * 60;
/** Pennsylvania until counsel confirms: Monday–Saturday 9:00 a.m. to 7:00 p.m., never Sunday. */
const PA_HOURS: HoursRule = (c) => c.weekday !== 0 && c.minutes >= 9 * 60 && c.minutes < 19 * 60;

function windowZones(zones: string[]): string[] {
  const usable = uniqueZones(zones);
  return usable.length > 0 ? usable : UNKNOWN_LEAD_ZONES;
}

function isFreshReply(now: Date, lastInboundAt: Date | null): boolean {
  if (!lastInboundAt || Number.isNaN(lastInboundAt.getTime())) return false;
  const age = now.getTime() - lastInboundAt.getTime();
  return age >= -CLOCK_SKEW_MS && age <= FRESH_REPLY_MS;
}

function allZonesAllow(at: Date, zones: string[], rule: HoursRule): boolean {
  return zones.every((zone) => rule(localClock(at, zone)));
}

function nextAllowedInstant(now: Date, zones: string[], rule: HoursRule): Date | null {
  const end = now.getTime() + SCAN_HORIZON_MS;
  for (let t = Math.floor(now.getTime() / SCAN_STEP_MS) * SCAN_STEP_MS + SCAN_STEP_MS; t <= end; t += SCAN_STEP_MS) {
    const at = new Date(t);
    if (allZonesAllow(at, zones, rule)) return at;
  }
  return null;
}

/**
 * May the AI text this lead right now? Conservative rules, pending legal review:
 *  - No usable zone → America/New_York AND America/Los_Angeles must both allow.
 *  - Pennsylvania (any state code PA): every zone must be Mon–Sat 9:00–19:00 local, no Sunday,
 *    even right after the lead wrote ("pa_window" when blocked).
 *  - Otherwise allowed when the lead wrote in the last 30 minutes ("fresh_reply"), or when every
 *    zone is between 8:00 and 21:00 local ("within_hours").
 *  - Blocked → `nextAllowedAt` = the earliest 5-minute step (up to 8 days ahead) where every zone
 *    passes the hours rule (the PA rule for PA).
 */
export function replyWindowDecision(input: {
  now: Date;
  lastInboundAt: Date | null;
  zones: string[];
  stateCodes: string[];
}): ReplyWindow {
  const zones = windowZones(input.zones);
  if (input.stateCodes.some((s) => toStateCode(s) === "PA")) {
    if (allZonesAllow(input.now, zones, PA_HOURS)) return { allowedNow: true, reason: "within_hours", nextAllowedAt: null };
    return { allowedNow: false, reason: "pa_window", nextAllowedAt: nextAllowedInstant(input.now, zones, PA_HOURS) };
  }
  if (isFreshReply(input.now, input.lastInboundAt)) return { allowedNow: true, reason: "fresh_reply", nextAllowedAt: null };
  if (allZonesAllow(input.now, zones, LEAD_HOURS)) return { allowedNow: true, reason: "within_hours", nextAllowedAt: null };
  return { allowedNow: false, reason: "outside_hours", nextAllowedAt: nextAllowedInstant(input.now, zones, LEAD_HOURS) };
}

export type ChannelWindowState = { open: boolean; lastInboundAt: Date | null; closesAt: Date | null };

const WHATSAPP_WINDOW_MS = 24 * 3_600_000;

/**
 * Can we write on `channel` now? SMS: always (lastInboundAt = newest inbound SMS). WhatsApp: only
 * inside Meta's 24-hour customer-service window, from the newest inbound WhatsApp message.
 */
export function channelWindow(messages: ThreadMessage[], channel: Channel, now: Date): ChannelWindowState {
  const last = newestInbound(messages, [channel]);
  const lastInboundAt = last ? last.dateAdded : null;
  if (channel === "SMS") return { open: true, lastInboundAt, closesAt: null };
  if (!lastInboundAt) return { open: false, lastInboundAt: null, closesAt: null };
  const closesAt = new Date(lastInboundAt.getTime() + WHATSAPP_WINDOW_MS);
  return { open: now.getTime() < closesAt.getTime(), lastInboundAt, closesAt };
}

// ─── License & loops ───────────────────────────────────────────────────────────────────────

export type LicenseDecision = "licensed" | "not_licensed" | "unknown";

/** Is the lead's state one Isaac is licensed in? Unknown when either side is missing or unrecognized. */
export function licenseDecision(licenseState: string | null, licensed: string[] | null): LicenseDecision {
  if (!licenseState || !licensed || licensed.length === 0) return "unknown";
  const state = toStateCode(licenseState);
  const codes = new Set(licensed.map((s) => toStateCode(s)).filter((c): c is string => c !== null));
  if (!state || codes.size === 0) return "unknown";
  return codes.has(state) ? "licensed" : "not_licensed";
}

const LOOP_WINDOW_MS = 2 * 3_600_000;
const INSTANT_REPLY_MS = 15_000;
const LOOP_INSTANT_REPLIES = 3;
const LOOP_REPEATS = 3;
/** Short answers repeated ("yes", "ok", "sí") are a person answering different questions, not a bot. */
const LOOP_MIN_WORDS = 3;
const LOOP_MIN_CHARS = 15;

function hasValidDate(m: ThreadMessage): boolean {
  return m.dateAdded instanceof Date && !Number.isNaN(m.dateAdded.getTime());
}

/** How many of OUR messages in the last 2 hours got an inbound reply less than 15 s later. */
function instantReplies(sorted: ThreadMessage[], ourIds: Set<string>, now: Date): number {
  const since = now.getTime() - LOOP_WINDOW_MS;
  const until = now.getTime() + CLOCK_SKEW_MS;
  const answered = new Set<string>();
  let lastOurs: ThreadMessage | null = null;
  for (const m of sorted) {
    if (m.direction === "outbound") {
      if (ourIds.has(m.id)) lastOurs = m;
      continue;
    }
    const t = m.dateAdded.getTime();
    if (m.channel === "Call" || m.channel === "Activity" || t < since || t > until || !lastOurs) continue;
    if (t - lastOurs.dateAdded.getTime() < INSTANT_REPLY_MS) answered.add(lastOurs.id);
  }
  return answered.size;
}

function repeatsLastInbound(sorted: ThreadMessage[]): boolean {
  const bodies: string[] = [];
  for (let i = sorted.length - 1; i >= 0 && bodies.length < LOOP_REPEATS; i--) {
    if (sorted[i].direction !== "inbound") continue;
    const body = normalizeText(sorted[i].body);
    if (body) bodies.push(body);
  }
  if (bodies.length < LOOP_REPEATS || bodies.some((b) => b !== bodies[0])) return false;
  return words(bodies[0]).length >= LOOP_MIN_WORDS || bodies[0].length >= LOOP_MIN_CHARS;
}

/**
 * A bot (auto-responder, another AI) is talking to ours: in the last 2 hours 3+ of our messages
 * got an inbound reply under 15 s later, OR the last 3 non-empty inbound bodies are identical
 * (and at least 3 words / 15 characters, so "yes" three times is not a loop).
 */
export function detectLoop(messages: ThreadMessage[], ourIds: Set<string>, now: Date): boolean {
  const sorted = messages.filter(hasValidDate).sort((a, b) => a.dateAdded.getTime() - b.dateAdded.getTime());
  return instantReplies(sorted, ourIds, now) >= LOOP_INSTANT_REPLIES || repeatsLastInbound(sorted);
}
