import { normalizeForSearch } from "./search";
import { appliesToLob, visibleIn, type Objection } from "./types";

/**
 * Live objection matching, for a transcript that arrives a few words at a time.
 *
 * The one decision everything else follows from: A WRONG CARD MID-CALL IS WORSE THAN NO CARD.
 * So this is precision-first and deliberately dumb. There is no fuzzy string distance and no
 * unordered word-bag; the only ways to match are the exact phrase, or the trigger's content words
 * in order inside a short span. Everything smarter belongs in the CORPUS, which Isaac edits in
 * Sanity with no deploy — that is the tuning surface, not this file.
 *
 * WHY NOT EDIT DISTANCE. Levenshtein exists to repair TYPOS, and speech recognition does not make
 * typos: it makes whole-word substitutions ("cannot" for "can't", "call me black" for "call me
 * back"). Character-level fuzz therefore fixes an error class that does not occur here while
 * blurring the one that does.
 *
 * WHY NOT BAG-OF-WORDS. With this corpus, unordered overlap fires the "won't share personal info"
 * objection on "sure, let me give you my personal information" — the exact opposite of an
 * objection. Order plus a bounded span is what separates "talk to my kids" from "my kids talk to
 * me about it".
 *
 * WHY WORDS AND NOT SECONDS. The window is 24 tokens (~10-12s of speech; the longest seeded
 * trigger is 7 tokens). A word window is deterministic and testable by hand; a time window makes
 * every test depend on a clock and drifts with speech rate and with how the vendor chunks partials.
 */

/** ~10-12s of speech: one whole objection utterance, and nothing from the paragraph before it. */
export const WINDOW_TOKENS = 24;
/** A match must END in the newer half, so old text cannot fire late once a cooldown lapses. */
export const RECENCY_TOKENS = 12;
/** Filler tokens tolerated inside an ordered match: "can't REALLY EVEN afford". */
export const MAX_FILLER_TOKENS = 3;
export const FIRE_THRESHOLD = 0.7;
/** Equal to the card's on-screen life, so two cards can never be up at once. */
export const COOLDOWN_MS = 12_000;
/** Passes a partial-only match must survive before firing (~150-400ms each). */
export const MIN_CONFIRMATIONS = 2;

/**
 * ASR punctuation, stripped.
 *
 * normalizeForSearch() handles diacritics and curly quotes but leaves punctuation alone, which is
 * right for a keyboard and WRONG for a transcript: "Can you call me back." tokenizes with a
 * trailing "back." and the trigger "call me back" never matches at end of sentence — which is
 * exactly where an objection lands. This is not a second normalizer; it CALLS the existing one and
 * adds the single step a transcript needs that typing does not.
 *
 * Apostrophes go too, so "can't" becomes "cant". Safe, because triggers run through this same
 * function and reduce identically.
 */
const SPOKEN_PUNCTUATION = /[.,!?;:¿¡"'`()\[\]{}…—–-]/g;

export function normalizeSpokenText(value: string): string {
  return normalizeForSearch(value).replace(SPOKEN_PUNCTUATION, " ").replace(/\s+/g, " ").trim();
}

export function tokenizeSpoken(value: string): string[] {
  const normalized = normalizeSpokenText(value);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Stopwords, with negation deliberately absent.
 *
 * "not", "no", "nunca", "nada" stay in. Dropping negation collapses "I'm not interested" and
 * "I'm interested" into the same content bag, which is the worst false positive this feature could
 * possibly produce. Note that being too aggressive here is SAFE in the other direction: a trigger
 * left with fewer than two content tokens is demoted to exact-phrase-only, so an over-long list
 * costs recall, never precision. Written unaccented — normalizeForSearch already stripped them.
 */
export const SPOKEN_STOPWORDS = new Set([
  // English
  "a", "an", "the", "is", "it", "its", "this", "that", "to", "of", "in", "on", "for", "and", "or",
  "but", "so", "we", "you", "your", "i", "im", "me", "my", "do", "did", "was", "be", "been", "am",
  "are", "at", "with", "just", "really", "well", "okay", "ok", "yeah", "um", "uh", "like", "gonna",
  "going", "there", "then", "can", "could", "would", "will", "have", "has",
  // Spanish
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "en", "y", "o", "pero",
  "que", "se", "es", "son", "mi", "mis", "su", "sus", "lo", "le", "por", "para", "con", "yo", "tu",
  "usted", "muy", "bien", "este", "esta", "eso", "esto", "pues", "como",
]);

export interface CompiledTrigger {
  objectionId: string;
  /** The trigger as authored. Never shown on the card; kept for debugging. */
  raw: string;
  tokens: string[];
  content: string[];
  /** Fewer than two content tokens: only the verbatim phrase may fire it. */
  exactOnly: boolean;
}

export interface LiveTriggerIndex {
  triggers: CompiledTrigger[];
  objectionCount: number;
}

export interface LiveMatchCandidate {
  objectionId: string;
  trigger: string;
  /**
   * A RANKER, not a probability. 1.0 exact phrase, 0.75 / 0.70 ordered content. Never surface it
   * to the agent as a confidence — it is not calibrated and cannot be.
   */
  score: number;
  /** Index of the last matched token; drives the recency guard and committed-vs-partial. */
  endToken: number;
  matchedTokens: number;
}

/**
 * Keyed on the objections array identity, so it survives every render of the dashboard but is
 * discarded the moment Sanity Live hands down a new array. Compilation runs on every partial
 * transcript — several times a second — over ~90 triggers, so this is not premature.
 */
const indexCache = new WeakMap<Objection[], Map<string, LiveTriggerIndex>>();

/**
 * Candidates for THIS product in THIS language, and nothing else.
 *
 * Reuses appliesToLob + visibleIn so the live matcher can never suggest a card the grid would not
 * show — including visibleIn's rule that an objection with no written answer is not a candidate,
 * because a card that opens onto an empty panel costs dead air.
 *
 * Only the ACTIVE language's triggers are compiled. Cross-language matching is where nonsense
 * comes from (short Spanish triggers collide with English filler), and the client speaks one
 * language; the dashboard's existing EN/ES toggle is the switch.
 */
export function buildLiveIndex(
  objections: Objection[],
  lob: string,
  language: "en" | "es"
): LiveTriggerIndex {
  let perArray = indexCache.get(objections);
  if (!perArray) {
    perArray = new Map();
    indexCache.set(objections, perArray);
  }
  const key = `${lob}|${language}`;
  const cached = perArray.get(key);
  if (cached) return cached;

  const triggers: CompiledTrigger[] = [];
  let objectionCount = 0;

  for (const objection of objections) {
    if (!appliesToLob(objection, lob) || !visibleIn(objection, language)) continue;
    objectionCount += 1;
    const raws = (language === "en" ? objection.triggersEn : objection.triggersEs) ?? [];
    for (const raw of raws) {
      const tokens = tokenizeSpoken(raw);
      if (tokens.length === 0) continue;
      const content = tokens.filter((token) => !SPOKEN_STOPWORDS.has(token));
      triggers.push({
        objectionId: objection._id,
        raw,
        tokens,
        content,
        exactOnly: content.length < 2,
      });
    }
  }

  const index: LiveTriggerIndex = { triggers, objectionCount };
  perArray.set(key, index);
  return index;
}

/** Last exact occurrence of a token sequence. Word boundaries are free: we compare whole tokens. */
function findLastSequence(hay: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > hay.length) return -1;
  for (let start = hay.length - needle.length; start >= 0; start -= 1) {
    let ok = true;
    for (let i = 0; i < needle.length; i += 1) {
      if (hay[start + i] !== needle[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return start + needle.length - 1;
  }
  return -1;
}

/** Latest in-order occurrence within maxSpan tokens. Anchored at the END, so recency wins. */
function findLastOrdered(
  hay: string[],
  needle: string[],
  maxSpan: number
): { start: number; end: number } | null {
  if (needle.length === 0) return null;
  const last = needle[needle.length - 1];
  for (let end = hay.length - 1; end >= 0; end -= 1) {
    if (hay[end] !== last) continue;
    let need = needle.length - 2;
    let i = end - 1;
    while (need >= 0 && i >= 0 && end - i + 1 <= maxSpan) {
      if (hay[i] === needle[need]) need -= 1;
      i -= 1;
    }
    if (need < 0) {
      const start = i + 1;
      if (end - start + 1 <= maxSpan) return { start, end };
    }
  }
  return null;
}

/**
 * Better of two candidates: higher score, then longer match (specificity), then later (recency).
 *
 * A free function rather than a closure over an outer `let`, which is what the earlier draft did.
 * TypeScript does not narrow an outer mutable through an arrow function, and the result is either
 * a spurious "possibly null" or a genuine `never`, depending on the compiler's mood.
 */
function better(a: LiveMatchCandidate | null, b: LiveMatchCandidate): LiveMatchCandidate {
  if (!a) return b;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  if (b.matchedTokens !== a.matchedTokens) return b.matchedTokens > a.matchedTokens ? b : a;
  return b.endToken > a.endToken ? b : a;
}

/**
 * Best candidate in the window, or null.
 *
 * Two tiers, and nothing in between:
 *   1.00  the exact phrase, as tokens
 *   0.75  >=3 content tokens, in order, within content.length + MAX_FILLER_TOKENS
 *   0.70  exactly 2 content tokens, in order, with at most 1 filler between them
 */
export function scoreWindow(index: LiveTriggerIndex, tokens: string[]): LiveMatchCandidate | null {
  if (tokens.length === 0) return null;
  const recencyFloor = Math.max(0, tokens.length - RECENCY_TOKENS);
  let best: LiveMatchCandidate | null = null;

  for (const trigger of index.triggers) {
    const exactEnd = findLastSequence(tokens, trigger.tokens);
    if (exactEnd >= 0) {
      if (exactEnd >= recencyFloor) {
        best = better(best, {
          objectionId: trigger.objectionId,
          trigger: trigger.raw,
          score: 1,
          endToken: exactEnd,
          matchedTokens: trigger.tokens.length,
        });
      }
      continue;
    }
    if (trigger.exactOnly) continue;

    const maxSpan = trigger.content.length + MAX_FILLER_TOKENS;
    const ordered = findLastOrdered(tokens, trigger.content, maxSpan);
    if (!ordered || ordered.end < recencyFloor) continue;

    const gaps = ordered.end - ordered.start + 1 - trigger.content.length;
    const score = trigger.content.length >= 3 ? 0.75 : gaps <= 1 ? 0.7 : 0;
    if (score < FIRE_THRESHOLD) continue;

    best = better(best, {
      objectionId: trigger.objectionId,
      trigger: trigger.raw,
      score,
      endToken: ordered.end,
      matchedTokens: trigger.content.length,
    });
  }

  return best;
}

/**
 * The rolling window: committed text plus the live partial, capped at WINDOW_TOKENS.
 *
 * Both are matched. Partials are what make this feel instant; the gate below is what stops a
 * retracted hypothesis from popping a card.
 */
export class LiveTranscriptWindow {
  private committed: string[] = [];
  private partial: string[] = [];

  commit(text: string): void {
    this.committed.push(...tokenizeSpoken(text));
    this.partial = [];
    if (this.committed.length > WINDOW_TOKENS) {
      this.committed = this.committed.slice(-WINDOW_TOKENS);
    }
  }

  setPartial(text: string): void {
    this.partial = tokenizeSpoken(text);
  }

  snapshot(): { tokens: string[]; committedCount: number } {
    const all = [...this.committed, ...this.partial];
    const offset = Math.max(0, all.length - WINDOW_TOKENS);
    return {
      tokens: all.slice(offset),
      committedCount: Math.max(0, this.committed.length - offset),
    };
  }

  reset(): void {
    this.committed = [];
    this.partial = [];
  }
}

/**
 * The fire gate: dedup, cooldown, and partial confirmation.
 *
 * Rules, in order:
 *   - already fired this session -> never again (the grid and Ctrl+K are still there)
 *   - inside the cooldown        -> suppressed, and confirmations do NOT accumulate
 *   - span lands in committed text -> fire now
 *   - partial only               -> fire on the MIN_CONFIRMATIONS-th consecutive pass
 *
 * The confirmation rule is the whole reason partials are safe to match. ASR emits a hypothesis and
 * then rewrites it — "I can't afford" becomes "I can order" — and holding a partial-only hit for
 * one more pass costs about a third of a second and kills that entire failure mode.
 */
export class ObjectionFireGate {
  private fired = new Set<string>();
  private lastFiredAt = 0;
  private pending: { objectionId: string; count: number } | null = null;

  constructor(
    private readonly cooldownMs = COOLDOWN_MS,
    private readonly minConfirmations = MIN_CONFIRMATIONS
  ) {}

  reset(): void {
    this.fired.clear();
    this.lastFiredAt = 0;
    this.pending = null;
  }

  accept(
    candidate: LiveMatchCandidate | null,
    committedCount: number,
    now: number
  ): LiveMatchCandidate | null {
    if (!candidate || this.fired.has(candidate.objectionId)) {
      this.pending = null;
      return null;
    }
    if (now - this.lastFiredAt < this.cooldownMs) {
      this.pending = null;
      return null;
    }

    const inCommitted = candidate.endToken < committedCount;
    if (!inCommitted) {
      if (this.pending?.objectionId === candidate.objectionId) {
        this.pending.count += 1;
      } else {
        this.pending = { objectionId: candidate.objectionId, count: 1 };
      }
      if (this.pending.count < this.minConfirmations) return null;
    }

    this.fired.add(candidate.objectionId);
    this.lastFiredAt = now;
    this.pending = null;
    return candidate;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * TESTS-IN-COMMENTS — the cases this file is designed against. Every trigger
 * below is real, from scripts/migrate-objections-to-library.ts.
 *
 * NORMALISATION
 *   normalizeSpokenText("Can you call me back?")   -> "can you call me back"
 *   normalizeSpokenText("I can’t afford it.") -> "i cant afford it"
 *   REGRESSION: without the punctuation strip, "call me back." never matched "call me back",
 *   which is precisely where an objection lands — at the end of a sentence.
 *
 * TIER 1 — exact phrase
 *   "well i cant afford it right now"  + "can't afford"  -> 1.0  FIRES
 *   "can you just call me back tomorrow" + "call me back" -> 1.0  FIRES
 *
 * TIER 2 — ordered content, bounded span
 *   "i really cant even afford that" + "can't afford"
 *     -> content [cant,afford], gap 1 -> 0.70 FIRES
 *   "i need to talk it over with my kids" + "talk to my kids"
 *     -> content [talk,kids], span 6 > 2+3 -> REJECTED.
 *        An honest miss. The fix is a trigger, not an algorithm: add "talk it over with my kids".
 *
 * DEMOTION TO EXACT-ONLY (the safety valve)
 *   "pensarlo"   -> content [pensarlo] -> exactOnly. Cannot fuzzy-fire.
 *   "por correo" -> "por" is a stopword -> content [correo] -> exactOnly, but the exact phrase
 *        still appears inside "se lo mando por correo electronico" and DOES fire. This one is a
 *        CORPUS problem, not a code problem — lengthen it to "mandeme algo por correo".
 *   "despues" / "mas tarde" -> 1 content token -> exactOnly, and still short enough to fire on
 *        scheduling chatter. Prune or lengthen before go-live.
 *
 * NEGATION
 *   "not interested" keeps "not": "im not interested" -> exact FIRES.
 *   "im very interested" -> no "not", and [interested] alone is exactOnly -> NO FIRE. Correct.
 *
 * KNOWN FALSE POSITIVE, accepted and documented
 *   "personal information" has two content tokens, so it fires on "what personal information do
 *   you need" — a buying signal. Costs one glance at a corner card that expires in 12s.
 *
 * TIE-BREAKING
 *   "im not interested just call me back" matches both "not interested" and
 *   "not interested call me back". Equal score 1.0 -> the longer trigger wins, which is the more
 *   specific and more useful card.
 *
 * RECENCY GUARD
 *   A 24-token window whose match ends at token 3 (recencyFloor 12) is dropped, so nothing fires
 *   on something said twenty words ago the instant a cooldown lapses.
 *
 * GATE
 *   partial "i cant afford"    pass 1 -> null (pending 1)
 *   partial "i cant afford it" pass 2 -> FIRES
 *   partial "i can order" (ASR rewrote it) after pass 1 -> pending cleared, nothing fires
 *   committed "i cant afford it" -> FIRES on pass 1, no wait
 *   same objection 5s later      -> null (already fired)
 *   different objection 5s later -> null (cooldown); at 13s -> fires
 *   reset() on stop -> everything eligible again for the next call
 * ──────────────────────────────────────────────────────────────────────────── */
