/**
 * Finding the moments in a call where someone reads out a number they should not have to trust us
 * with — so the audio can be beeped and the transcript masked before the call is shared.
 *
 * **This exists because the vendor's own redaction cannot be relied on.** Scribe marks entities it
 * recognises as `{SSN_0}`, `{ROUTING_NUMBER_3}` and so on, and on a block of contiguous numerals it
 * does that well. On digits DICTATED ONE AT A TIME — which is how every account number on a real
 * call arrives — it mostly fails. Measured on one 113-minute Spanish call, transcribed twice
 * through the same API: the first run produced 22 markers, the second produced 10, and in that
 * second run 133 spoken digits sat in the clear across all 18 dictated-number runs. Same audio.
 *
 * So the vendor markers are treated here as one input among several, never as the answer.
 *
 * Everything is pure and dependency-free, and pinned in `scripts/test-call-study.ts`. That matters
 * more here than anywhere else in this feature: a bug in this file does not produce a wrong screen,
 * it produces a file someone forwards to another agent believing it is safe.
 */

import type { ScribeWord } from "./types";

/* ─── Tuning ────────────────────────────────────────────────────────────────── */

/** Consecutive number-words needed before a run counts as "someone is dictating a number". */
export const MIN_RUN_WORDS = 4;

/** Longest pause inside one dictated number. People pause to check the next digit. */
export const MAX_GAP_SECONDS = 2.5;

/**
 * How long a cue phrase keeps looking forward for digits.
 *
 * Generous on purpose. "¿Me das el número de cuenta?" is followed by the client finding the card,
 * reading it, the agent repeating it back, and a correction — a minute is not unusual, and the cue
 * is not repeated for the read-back.
 */
export const CUE_WINDOW_SECONDS = 60;

/**
 * Widening applied to every masked span.
 *
 * ASR word boundaries are approximate, and the failure is asymmetric: an extra third of a second of
 * beep costs nothing, while a boundary that lands a fraction late leaves the first digit audible.
 */
export const PAD_SECONDS = 0.35;

/**
 * Spans closer together than this become one beep.
 *
 * Dictated digits arrive as separate words a few tenths apart. Beeping each one produces a stutter
 * with the real digit still audible in the gaps, because the gaps are exactly where the timing
 * error lives. One continuous tone over the whole run is both cleaner and safer.
 */
export const MERGE_WITHIN_SECONDS = 1.5;

/* ─── Vocabulary ────────────────────────────────────────────────────────────── */

/** Scribe's redaction markers, e.g. `{SSN_0}`, `{ROUTING_NUMBER_12}`. */
const MARKER = /\{([A-Z_]+)_\d+\}/;

/**
 * Number words in both languages, including the forms a dictated figure actually uses.
 *
 * Bare digits are matched separately — a client may say "one two three" and Scribe may render it
 * either way depending on the language model's mood.
 */
const NUMBER_WORDS = new Set([
  // Spanish
  "cero", "uno", "una", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho",
  "diecinueve", "veinte", "veintiuno", "veintidos", "veintitres", "treinta", "cuarenta",
  "cincuenta", "sesenta", "setenta", "ochenta", "noventa", "cien", "ciento",
  // English
  "zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred",
]);

/**
 * Phrases that mean a number is about to be read out.
 *
 * **This list IS the safety mechanism.** Context-gating was chosen deliberately over masking every
 * dictated number, so that premiums, ages and dates — the substance of a life insurance call —
 * survive. The cost of that choice is that a client who starts reciting an account number without
 * anyone naming it first is not caught here. `findUnmaskedRuns` exists to surface exactly that case
 * for a human to decide on, and the export flow must show it.
 *
 * Written unaccented and lowercase; `normalize` below strips accents before comparing.
 */
export const SENSITIVE_CUES: readonly string[] = [
  // Spanish — identity
  "seguro social", "numero social", "seguridad social", "numero de seguro",
  "fecha de nacimiento", "cumpleanos",
  "numero de licencia", "licencia de conducir", "pasaporte", "numero de identificacion",
  // Spanish — banking
  "numero de cuenta", "cuenta bancaria", "cuenta de banco", "numero de ruta",
  "numero de routing", "chequera", "numero de tarjeta", "codigo de seguridad", "cvv",
  "fecha de vencimiento", "fecha de expiracion",
  // English — identity
  "social security", "date of birth", "birth date", "driver license",
  "drivers license", "license number", "passport number",
  // English — banking
  "account number", "bank account", "checking account", "savings account",
  "routing number", "card number", "credit card number", "debit card number",
  "security code", "expiration date",
];

/*
 * **Why these are all multi-word phrases, and why the obvious single words are absent.**
 *
 * The first version of this list carried `ahorros`, `banco`, `cheque`, `tarjeta`, `credito` and a
 * bare `social`. Run against a real 113-minute IUL call it beeped the product itself: "tú tengas tu
 * dinero [redacted]" and "la mayoría de las familias [redacted] dólares" were both dollar figures
 * caught inside a window opened by the word "ahorros".
 *
 * On an IUL call savings, banks and cards ARE the subject — the entire pitch is about money moving
 * into an account. Those words carry no signal at all here. What does carry signal is someone
 * naming a FIELD they are about to read out: "número de cuenta", not "cuenta". Nothing in this list
 * is a word that appears in ordinary conversation about the product.
 */

/** Longest cue in words, so the matcher knows how far to look ahead. */
const MAX_CUE_WORDS = Math.max(...SENSITIVE_CUES.map((c) => c.split(" ").length));

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function isNumberWord(normalized: string): boolean {
  if (!normalized) return false;
  if (NUMBER_WORDS.has(normalized)) return true;
  // A bare run of digits, however Scribe chose to render it.
  return /^\d{1,4}$/.test(normalized);
}

/* ─── Output ────────────────────────────────────────────────────────────────── */

export type SpanReason = "vendor" | "context";

export type SensitiveSpan = {
  /** Seconds into the recording. Already padded and merged. */
  start: number;
  end: number;
  reason: SpanReason;
  /** The entity Scribe named, when it named one — ssn, routing_number, bank_account. */
  kind?: string;
  /** The cue phrase that opened the window, so a false beep can be traced to its cause. */
  cue?: string;
};

/** A dictated number that no cue vouched for — the blind spot of context-gating, surfaced. */
export type UnmaskedRun = {
  start: number;
  end: number;
  words: number;
  /** The words themselves, so the agent can see what it was before deciding. */
  text: string;
};

type Token = { text: string; norm: string; start: number; end: number };

function toTokens(words: readonly ScribeWord[] | null | undefined): Token[] {
  const out: Token[] = [];
  for (const word of words ?? []) {
    if (word.type !== "word") continue;
    const text = typeof word.text === "string" ? word.text : "";
    if (!text.trim()) continue;
    const start = Number.isFinite(word.start) ? (word.start as number) : null;
    if (start === null) continue;
    const end = Number.isFinite(word.end) ? (word.end as number) : start;
    out.push({ text, norm: normalize(text), start, end });
  }
  return out;
}

/** Windows opened by a cue phrase, each `[from, until]` in seconds. */
function cueWindows(tokens: readonly Token[]): { from: number; until: number; cue: string }[] {
  const windows: { from: number; until: number; cue: string }[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    for (let n = MAX_CUE_WORDS; n >= 1; n -= 1) {
      if (i + n > tokens.length) continue;
      const phrase = tokens.slice(i, i + n).map((t) => t.norm).filter(Boolean).join(" ");
      if (!phrase || !SENSITIVE_CUES.includes(phrase)) continue;
      windows.push({
        from: tokens[i].start,
        until: tokens[i + n - 1].end + CUE_WINDOW_SECONDS,
        cue: phrase,
      });
      break; // longest match wins; do not also count its shorter prefix
    }
  }
  return windows;
}

/** Contiguous stretches of number words, regardless of whether anything vouched for them. */
function digitRuns(tokens: readonly Token[]): { start: number; end: number; words: number; text: string }[] {
  const runs: { start: number; end: number; words: number; text: string }[] = [];
  let current: { start: number; end: number; words: number; parts: string[] } | null = null;

  for (const token of tokens) {
    const isNumber = isNumberWord(token.norm);
    const isMarker = MARKER.test(token.text);
    if (isNumber || isMarker) {
      if (current && token.start - current.end <= MAX_GAP_SECONDS) {
        current.end = token.end;
        current.words += 1;
        current.parts.push(token.text);
      } else {
        if (current && current.words >= MIN_RUN_WORDS) {
          runs.push({ start: current.start, end: current.end, words: current.words, text: current.parts.join(" ") });
        }
        current = { start: token.start, end: token.end, words: 1, parts: [token.text] };
      }
    }
  }
  if (current && current.words >= MIN_RUN_WORDS) {
    runs.push({ start: current.start, end: current.end, words: current.words, text: current.parts.join(" ") });
  }
  return runs;
}

/**
 * Every span that should be beeped out of the audio and masked in the transcript.
 *
 * Two sources, unioned:
 *   1. Every Scribe redaction marker, always — it costs nothing and it is sometimes right.
 *   2. Dictated number runs that fall inside a window opened by a sensitive cue phrase.
 */
export function findSensitiveSpans(words: readonly ScribeWord[] | null | undefined): SensitiveSpan[] {
  const tokens = toTokens(words);
  if (tokens.length === 0) return [];

  const spans: SensitiveSpan[] = [];

  for (const token of tokens) {
    const marker = MARKER.exec(token.text);
    if (marker) {
      spans.push({ start: token.start, end: token.end, reason: "vendor", kind: marker[1].toLowerCase() });
    }
  }

  const windows = cueWindows(tokens);
  for (const run of digitRuns(tokens)) {
    const window = windows.find((w) => run.start >= w.from && run.start <= w.until);
    if (!window) continue;
    spans.push({ start: run.start, end: run.end, reason: "context", cue: window.cue });
  }

  return mergeSpans(spans);
}

/**
 * Dictated numbers that no cue vouched for.
 *
 * The honest counterpart to context-gating: these are the runs the rules deliberately let through,
 * handed back so a person can look at them. An export flow that hides this list is claiming a
 * guarantee the detection does not make.
 */
export function findUnmaskedRuns(
  words: readonly ScribeWord[] | null | undefined,
  masked: readonly SensitiveSpan[]
): UnmaskedRun[] {
  const tokens = toTokens(words);
  return digitRuns(tokens).filter(
    (run) => !masked.some((span) => run.start < span.end && run.end > span.start)
  );
}

/** Pad, sort and coalesce, so the output is a clean non-overlapping timeline. */
export function mergeSpans(spans: readonly SensitiveSpan[]): SensitiveSpan[] {
  if (spans.length === 0) return [];

  const padded = spans
    .map((span) => ({
      ...span,
      start: Math.max(0, Math.min(span.start, span.end) - PAD_SECONDS),
      end: Math.max(span.start, span.end) + PAD_SECONDS,
    }))
    .sort((a, b) => a.start - b.start);

  const out: SensitiveSpan[] = [padded[0]];
  for (const span of padded.slice(1)) {
    const last = out[out.length - 1];
    if (span.start - last.end <= MERGE_WITHIN_SECONDS) {
      last.end = Math.max(last.end, span.end);
      // A vendor-named entity is the more specific label, so it survives the merge.
      if (!last.kind && span.kind) last.kind = span.kind;
      if (!last.cue && span.cue) last.cue = span.cue;
      if (last.reason === "context" && span.reason === "vendor") last.reason = "vendor";
    } else {
      out.push(span);
    }
  }
  return out;
}

/** Total seconds of audio that will be replaced by a tone. */
export function maskedSeconds(spans: readonly SensitiveSpan[]): number {
  return spans.reduce((total, span) => total + Math.max(0, span.end - span.start), 0);
}

export const REDACTION_MARKER = "[redacted]";

/**
 * Replace every word inside a masked span, IN PLACE.
 *
 * **Nothing is added or removed, and no timing or speaker attribution changes.** That constraint is
 * not tidiness: `wordsToTurns` groups on speaker changes, and the stored analysis addresses the
 * result by index — `CallPhase.startTurn`, `CallObjection.turnIndex`, every snippet. Dropping the
 * masked words would merge two turns wherever a dictated number crossed a speaker change (which it
 * does: on a real call the agent reads the digits back, so an SSN alternates speakers mid-run), and
 * every index after that point would quietly address the wrong line.
 *
 * So the run becomes a row of markers, and `collapseMarkers` tidies that up at the text level,
 * where it cannot affect structure.
 */
export function maskWords(
  words: readonly ScribeWord[] | null | undefined,
  spans: readonly SensitiveSpan[],
  replacement = REDACTION_MARKER
): ScribeWord[] {
  const list = [...(words ?? [])];
  if (spans.length === 0) return list;

  return list.map((word) => {
    if (word.type !== "word") return word;
    const start = Number.isFinite(word.start) ? (word.start as number) : null;
    if (start === null) return word;
    const end = Number.isFinite(word.end) ? (word.end as number) : start;
    const inSpan = spans.some((span) => start < span.end && end > span.start);
    return inSpan ? { ...word, text: replacement } : word;
  });
}

/** Collapse a row of markers into one, so a line reads "mi cuenta es [redacted], ¿cierto?". */
export function collapseMarkers(text: string, marker = REDACTION_MARKER): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(?:${escaped})(?:[\\s,.]*${escaped})+`, "g"), marker);
}
