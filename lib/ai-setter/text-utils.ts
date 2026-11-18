/**
 * Small pure text helpers shared by the turn engine: strict US phone parsing, the language a
 * lead is writing in, and masking of anything sensitive before text reaches the model.
 */

import type { Lang } from "./types";

/**
 * Strict NANP E.164: 10 digits (or 11 with a leading 1), area code and exchange starting 2-9.
 * Anything else → null (never "keep the last 10 digits" — that turns a policy number into a phone).
 */
export function toE164Nanp(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `+1${digits}`;
}

const SPANISH_MARKERS = /[¿¡ñáéíóú]|\b(hola|gracias|por favor|cuanto|cuánto|cuesta|quiero|puede|puedo|llamar|llámeme|llamame|mañana|manana|hoy|tarde|noche|usted|para|pero|sí|seguro|póliza|no me|qué|que|cómo|como|dónde|donde)\b/i;
const ENGLISH_MARKERS = /\b(hi|hello|thanks|thank you|please|how much|cost|call me|tomorrow|today|tonight|morning|afternoon|evening|what|when|where|who|yes|yeah|sure|can you|i am|i'm|my)\b/i;

/** Best guess from the lead's own words. Null when it can't tell (e.g. "ok", "5pm"). */
export function detectMessageLanguage(text: string): Lang | null {
  const t = text.trim();
  if (t.length < 2) return null;
  const es = SPANISH_MARKERS.test(t);
  const en = ENGLISH_MARKERS.test(t);
  if (es && !en) return "es";
  if (en && !es) return "en";
  if (es && en) {
    // Spanglish: count markers and prefer the majority.
    const esCount = (t.match(new RegExp(SPANISH_MARKERS.source, "gi")) ?? []).length;
    const enCount = (t.match(new RegExp(ENGLISH_MARKERS.source, "gi")) ?? []).length;
    if (esCount === enCount) return null;
    return esCount > enCount ? "es" : "en";
  }
  return null;
}

/**
 * Bare domains: a "strong" link TLD (never a common EN/ES word), or ANY 2-6 letter TLD when a
 * path follows ("algo.mx/pago"). Word-like TLDs alone (es, me, do, to, be, us…) are not treated
 * as links, so "ok.gracias" or "hola.me interesa" stay readable.
 */
const STRONG_TLDS = "com|net|org|io|ly|info|biz|xyz|app|link|site|online|gl|gd|tk|ml|ga|cf|ws|cc|tv|ai";
const BARE_DOMAIN_RE = new RegExp(
  `\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:(?:${STRONG_TLDS})\\b(?:\\/\\S*)?|[a-z]{2,6}\\/\\S+)`,
  "gi"
);

/**
 * What the model is allowed to see of a message body: links, emails, phone numbers and long
 * digit runs (SSNs, account, policy or card numbers) are replaced by placeholders. Times like
 * "4:30" and short numbers ("5pm", "the 18th") survive — the model needs them to book.
 */
export function maskForModel(text: string, maxChars = 1000): string {
  let t = text.replace(/\r/g, "").trim();
  t = t.replace(/\bhttps?:\/\/\S+/gi, "[link]");
  t = t.replace(/\bwww\.\S+/gi, "[link]");
  t = t.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]");
  // Bare domains ("bit.ly/x", "pay-portal.co/abc"), limited to common link TLDs so an SMS typo
  // without a space after the period ("ok.gracias", "Hola.Quiero info") is left alone.
  t = t.replace(BARE_DOMAIN_RE, "[link]");
  // The optional "+1" prefix is matched only together with its separator, so the space BEFORE
  // the number survives ("al [phone]", not "al[phone]").
  t = t.replace(/(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]");
  t = t.replace(/\b\d[\d\s-]{4,}\d\b/g, (m) => (m.replace(/\D/g, "").length >= 5 ? "[number]" : m));
  if (t.length > maxChars) t = `${t.slice(0, maxChars)}…`;
  return t;
}

/**
 * Text the app writes into a CRM note or keeps as evidence: masked like the model's view and on
 * one line, so a lead can't plant links, numbers or fake instructions in a trusted-looking note.
 */
export function sanitizeForRecord(text: string, max: number): string {
  return clip(maskForModel(text, max * 2).replace(/[\r\n]+/g, " "), max);
}

/** A model-written label kept in records only when it is a plain code. */
export function safeCode(value: string | null | undefined, fallback: string): string {
  return value && /^[a-z_]{1,40}$/.test(value) ? value : fallback;
}

/** Collapse whitespace and cut to `max` characters (for event details and notes). */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
