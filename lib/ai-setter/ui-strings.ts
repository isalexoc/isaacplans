/**
 * The fixed words the CODE puts around every AI Setter message: the lead's cleaned first name,
 * the greeting, the AI disclosure and the STOP footer. The model never writes any of them.
 *
 * Brand voice (lib/missed-call-drafts/prompts.ts): no "insurance / policy / premium" and no
 * "seguro / póliza / prima", except the registered SMS brand "Isaac Plans Insurance", which only
 * arrives through `brand` and stays exact. English uses ASCII punctuation; Spanish keeps accents.
 *
 * Pure: no DB, no server-only, no Node APIs (safe in client components).
 */

import type { Lang, Register } from "./types";

/** Longer "first names" are sentences or company names, not names. */
const MAX_FIRST_NAME_LENGTH = 30;

/** Values forms and imports leave in the first-name field (compared lowercase, without accents). */
const PLACEHOLDER_NAMES = new Set([
  "test",
  "testing",
  "tester",
  "prueba",
  "pruebas",
  "unknown",
  "desconocido",
  "desconocida",
  "n/a",
  "na",
  "lead",
  "leads",
  "none",
  "null",
  "nil",
  "undefined",
  "cliente",
  "client",
  "customer",
  "contact",
  "contacto",
  "name",
  "first",
  "last",
  "firstname",
  "nombre",
  "noname",
  "no name",
  "sin nombre",
  "user",
  "usuario",
  "anonymous",
  "anonimo",
  "anonima",
  "asdf",
  "xx",
  "xxx",
  "nn",
]);

/** One of these anywhere in the name marks a test or junk record ("Maria Test"). */
const JUNK_NAME_WORDS = new Set(["test", "testing", "prueba", "asdf", "unknown", "desconocido", "null", "undefined"]);

/** Spanish particles stay lowercase inside a name: "María del Carmen". */
const NAME_PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);

/** Letters (accents included) in words joined by single spaces, hyphens or apostrophes. */
const NAME_SHAPE = /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u;

/** Deliberate mixed case that title-casing would break: DeShawn, McKenzie, LaToya. */
const CAMEL_CASE_NAME = /^\p{Lu}\p{Ll}+(?:\p{Lu}\p{Ll}+)+$/u;

/**
 * Proper nouns that keep their capital after "Hi Maria," — the templates name Isaac, and a
 * sentence may open with a weekday or a month. ("May" is left out: it is also a verb.)
 */
const KEEP_CAPITALIZED = new Set([
  "isaac",
  "medicare",
  "medicaid",
  "obamacare",
  "english",
  "spanish",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

/** Accented letters the GSM-7 SMS alphabet has; any other accent makes the whole SMS UCS-2. */
const GSM7_ACCENTED = new Set(Array.from("ÄÅÆÇÉÑÖØÜßàäåæèéìñòöøùü"));

/** A body that already greets ("Hi Maria, …") does not get a second greeting. */
const STARTS_WITH_GREETING = /^(?:hi|hello|hey|hola|buen[oa]s)\b/i;

/** Options for {@link withDisclosure}. */
export type DisclosureOptions = {
  lang: Lang;
  register: Register;
  firstName: string | null;
  brand: string;
  /** Prefix "{greeting} {disclosure}." (first AI message on a channel, after 7 quiet days, after a handoff). */
  includeDisclosure: boolean;
  /** Prefix "{greeting}" when no disclosure is added. */
  includeGreeting: boolean;
  /** Append the STOP footer (skipped when the body already mentions STOP). */
  includeStop: boolean;
};

function foldName(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function letterCount(s: string): number {
  return (s.match(/\p{L}/gu) ?? []).length;
}

function isPlaceholderName(name: string): boolean {
  const folded = foldName(name);
  if (PLACEHOLDER_NAMES.has(folded)) return true;
  const words = folded.split(/[ '-]/).filter(Boolean);
  return words.every((w) => PLACEHOLDER_NAMES.has(w)) || words.some((w) => JUNK_NAME_WORDS.has(w));
}

function upperFirst(part: string): string {
  const [first = "", ...rest] = Array.from(part);
  return first.toUpperCase() + rest.join("").toLowerCase();
}

function caseNamePart(part: string): string {
  return CAMEL_CASE_NAME.test(part) ? part : upperFirst(part);
}

function caseNameWord(word: string, index: number): string {
  if (index > 0 && NAME_PARTICLES.has(foldName(word))) return word.toLowerCase();
  return word
    .split(/([-'])/)
    .map(caseNamePart)
    .join("");
}

/**
 * A first name that is safe to greet a lead with, or null.
 *
 * Keeps letters (accents included), spaces, hyphens and apostrophes; title-cases each part
 * ("MARIA" -> "Maria", "josé luis" -> "José Luis", "o'neil" -> "O'Neil") but keeps deliberate
 * mixed case ("DeShawn") and lowercase Spanish particles ("María del Carmen"). Null for empty,
 * placeholder or junk values (test, unknown, n/a, lead, cliente...), anything with a digit or a
 * symbol inside the name, fewer than 2 letters, or more than 30 characters. Idempotent.
 */
export function sanitizeFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || /\p{N}/u.test(raw)) return null;
  const cleaned = raw
    .normalize("NFC")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, "");
  if (!cleaned || isPlaceholderName(cleaned)) return null;
  if (Array.from(cleaned).length > MAX_FIRST_NAME_LENGTH) return null;
  if (!NAME_SHAPE.test(cleaned) || letterCount(cleaned) < 2) return null;
  return cleaned.split(" ").map(caseNameWord).join(" ");
}

/** "María" -> "Maria", "José" stays: only the accents GSM-7 lacks are dropped. */
function gsm7Letters(name: string): string {
  return Array.from(name)
    .map((ch) => (GSM7_ACCENTED.has(ch) ? ch : ch.normalize("NFD").replace(/\p{M}/gu, "")))
    .join("");
}

/**
 * "Hi Maria," / "Hola María,"; "Hi," / "Hola," without a usable name. The name is sanitized
 * here too, so a raw CRM value can never reach a lead. English drops the accents GSM-7 lacks
 * ("Hi Maria,"), so one name cannot turn an English SMS into UCS-2 (70 characters a segment);
 * Spanish keeps every accent.
 */
export function greeting(lang: Lang, firstName: string | null): string {
  const name = sanitizeFirstName(firstName);
  if (lang === "es") return name ? `Hola ${name},` : "Hola,";
  return name ? `Hi ${gsm7Letters(name)},` : "Hi,";
}

/**
 * The AI disclosure clause (lowercase: it follows the greeting). EN "this is {brand}'s AI
 * assistant (automated)"; ES "le/te responde el asistente de IA (inteligencia artificial) de {brand}".
 * A blank brand degrades to "an AI assistant" / "un asistente de IA" instead of a broken sentence.
 */
export function aiDisclosure(lang: Lang, register: Register, brand: string): string {
  const name = brand.trim();
  if (lang === "en") return name ? `this is ${name}'s AI assistant (automated)` : "this is an AI assistant (automated)";
  const pronoun = register === "tu" ? "te" : "le";
  return name
    ? `${pronoun} responde el asistente de IA (inteligencia artificial) de ${name}`
    : `${pronoun} responde un asistente de IA (inteligencia artificial)`;
}

/** "Reply STOP to opt out." / "Responda STOP para no recibir más mensajes." (tú: "Responde"). */
export function stopFooter(lang: Lang, register: Register): string {
  if (lang === "en") return "Reply STOP to opt out.";
  return `${register === "tu" ? "Responde" : "Responda"} STOP para no recibir más mensajes.`;
}

/** Uppercases the first letter, past any leading "¿", "¡", quote, parenthesis or space. */
export function capitalizeFirst(s: string): string {
  const match = /^([\s¿¡"'(«“‘]*)(\p{Ll})/u.exec(s);
  return match ? `${match[1]}${match[2].toUpperCase()}${s.slice(match[0].length)}` : s;
}

/** Single spaces, no spaces around line breaks, trimmed. */
function tidy(s: string): string {
  return s
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

function keepsCapital(word: string, keep: Set<string>): boolean {
  const base = word.split("'")[0];
  if (base === "I") return true;
  if (base.length > 1 && base === base.toUpperCase()) return true;
  if (/\p{Lu}/u.test(base.slice(1))) return true;
  return keep.has(foldName(base));
}

/** "Can Isaac call you…" -> "can Isaac call you…" after "Hi Maria,"; proper nouns keep their capital. */
function continueAfterComma(body: string, keep: Set<string>): string {
  const match = /^([¿¡"'(«“]*)(\p{L}[\p{L}\p{M}'-]*)/u.exec(body);
  if (!match || keepsCapital(match[2], keep)) return body;
  const [, openers, word] = match;
  const [first = "", ...rest] = Array.from(word);
  return `${openers}${first.toLowerCase()}${rest.join("")}${body.slice(openers.length + word.length)}`;
}

function properWords(...names: Array<string | null>): Set<string> {
  const keep = new Set(KEEP_CAPITALIZED);
  for (const name of names) {
    for (const word of (name ?? "").split(/[\s'-]+/)) if (word) keep.add(foldName(word));
  }
  return keep;
}

/** Ends the text with a period unless it already ends a sentence or ends with a link. */
function endSentence(s: string): string {
  if (!s || /[.!?…]$/.test(s)) return s;
  if (/(?:https?:\/\/|www\.)\S+$|[\w-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(s)) return s;
  return `${s.replace(/[,;:]+$/, "")}.`;
}

/**
 * Wraps a message body with what the code adds:
 * - `includeDisclosure`: "{greeting} {disclosure}. {Body}" (body capitalized as a new sentence);
 * - else `includeGreeting`: "{greeting} {body}" (first word lowercased unless a proper noun; no
 *   second greeting when the body already opens with one);
 * - `includeStop`: appends " {stopFooter}" (not when the body already mentions STOP).
 * Collapses spaces and ends the text before the footer with a period when it has none.
 */
export function withDisclosure(body: string, opts: DisclosureOptions): string {
  const text = tidy(body);
  let out = text;
  if (opts.includeDisclosure) {
    const lead = `${greeting(opts.lang, opts.firstName)} ${aiDisclosure(opts.lang, opts.register, opts.brand)}.`;
    out = text ? `${lead} ${capitalizeFirst(text)}` : lead;
  } else if (opts.includeGreeting && !STARTS_WITH_GREETING.test(text)) {
    const hi = greeting(opts.lang, opts.firstName);
    out = text ? `${hi} ${continueAfterComma(text, properWords(opts.brand, opts.firstName))}` : hi;
  }
  if (opts.includeStop && !/\bSTOP\b/.test(text)) {
    out = `${endSentence(out)} ${stopFooter(opts.lang, opts.register)}`;
  }
  return tidy(out);
}
