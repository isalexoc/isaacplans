/**
 * Finding objections in a finished transcript, using the trigger phrases Isaac already wrote.
 *
 * The second of two detectors. The model in `analysis.ts` catches novel and softly-worded
 * resistance; this catches everything the objection library already knows how to answer, and — the
 * real prize — hands back the Sanity `_id`, so a highlighted line in the transcript opens the
 * rebuttal written for it on /presentations.
 *
 * **Why this does not reuse `scoreWindow` from lib/objections/live-match.ts.** That function is the
 * live dock's matcher and its whole design is precision-first for a different situation: a rolling
 * 24-token window, a recency floor, one best match, fire-once per objection, and a 12-second
 * cooldown. Every one of those is wrong here. Reading a finished call, the goal is to find EVERY
 * occurrence anywhere in two hours, and a spurious highlight costs a glance rather than a wrong card
 * in front of a client. Reaching into that file to add an offline mode would put this policy inside
 * the one component whose 10/12-with-zero-false-positives measurement is load-bearing.
 *
 * **The tokeniser is deliberately the one in `./reading`, not the live matcher's.** In
 * `normalizeSpokenText` an apostrophe is replaced by a SPACE, so "can't afford" tokenises to
 * ["can","t","afford"] — the file's own doc comment and its tests-in-comments both say it yields
 * "cant", and both are wrong; verified by running it. That leaves triggers compiled with a bare "t"
 * as a content token, which offline (with all the suppressors removed) fires on things like "I
 * don't need to decide right now". `foldWithMap` drops apostrophes instead, so "can't" and "cant"
 * are the same word on both sides of the match and that whole class of false positive cannot occur.
 *
 * Pure and dependency-free: the objections are passed in. Tested in `scripts/test-call-study.ts`.
 */

import { SPOKEN_STOPWORDS } from "@/lib/objections/live-match";
import { appliesToLob, objectionTitle, type Objection } from "@/lib/objections/types";
import { foldTokensWithOffsets, type CharRange } from "./reading";
import type { CallObjection, SpeakerMap, Turn } from "./types";

/** Filler tokens tolerated between the content words of an ordered match. */
const MAX_FILLER = 3;

/** More than this from one line is noise, not a finding. */
const MAX_PER_TURN = 3;

/**
 * How strong a library match must be to stand as an objection ON ITS OWN.
 *
 * The weakest tier — two content words in order — is fine as corroboration and too loose as
 * evidence. Measured against the real corpus: the trigger "i don't want it" reduces to the content
 * pair [dont, want], which fires on "My daughter mostly, I don't want her stuck with a bill" — a
 * BUYING signal, labelled "I'm not interested". No matching algorithm can separate those two uses
 * of the same words, so the split is by role instead:
 *
 *   - a weak match on a turn the model ALSO called an objection still attaches the library link,
 *     because the model has already judged the meaning and only the rebuttal was missing;
 *   - a weak match on its own is not enough to put a new row on the page.
 *
 * Nothing the model caught is lost, and the corpus stays the place to fix a loose trigger — editing
 * it in Sanity needs no deploy.
 */
const MIN_STANDALONE_SCORE = 0.75;

export type CompiledTrigger = {
  objectionId: string;
  /** The phrase as authored. Kept for tuning the corpus, never shown as content. */
  raw: string;
  /** Every token, folded. */
  tokens: string[];
  /** Tokens minus stopwords — what an ordered match is allowed to look for. */
  content: string[];
  /** Fewer than two content tokens: only the verbatim phrase may fire it. */
  exactOnly: boolean;
};

export type ScanIndex = {
  triggers: CompiledTrigger[];
  /** Display title per objection id, in the language being scanned. */
  titles: Map<string, string>;
  types: Map<string, string>;
};

export type ScanMatch = {
  turnIndex: number;
  objectionId: string;
  title: string;
  objectionType: string;
  trigger: string;
  /** 1.0 exact phrase, 0.75 / 0.70 ordered content. A ranker, never a probability. */
  score: number;
  range: CharRange;
};

export type ScanLanguage = "en" | "es" | "both";

/**
 * Which trigger list to scan, from whatever Scribe reported.
 *
 * Only when the language is genuinely unknown are both scanned. Mixing them by default is how short
 * Spanish triggers start matching English filler — the reasoning is the live matcher's and it holds
 * here too; this is only the fallback for a call with no detected language at all.
 */
export function scanLanguageFor(languageCode: string | null | undefined): ScanLanguage {
  const code = languageCode?.trim().toLowerCase();
  if (!code) return "both";
  if (code.startsWith("es")) return "es";
  return "en";
}

export function buildScanIndex(
  objections: readonly Objection[],
  options: { language: ScanLanguage; lob?: string | null } = { language: "both" }
): ScanIndex {
  const triggers: CompiledTrigger[] = [];
  const titles = new Map<string, string>();
  const types = new Map<string, string>();

  for (const objection of objections) {
    // `lob` is normally left undefined. The line-of-business vocabularies do not match between
    // this feature and the objection library (`final_expense` vs `finalExpense`, and `term_life`
    // has no counterpart at all), so scoping by a value that does not exist in the other list
    // silently reduces the corpus to universal objections only. Recall is the point here, so the
    // default is to scan everything and let the reader judge.
    if (options.lob && !appliesToLob(objection, options.lob)) continue;

    const languages: ("en" | "es")[] =
      options.language === "both" ? ["en", "es"] : [options.language];

    const title =
      objectionTitle(objection, options.language === "es" ? "es" : "en").trim() ||
      objectionTitle(objection, options.language === "es" ? "en" : "es").trim();
    // No title in any language means nothing could be displayed if it matched.
    if (!title) continue;

    titles.set(objection._id, title);
    types.set(objection._id, objection.objectionType ?? "other");

    for (const language of languages) {
      const raws = (language === "en" ? objection.triggersEn : objection.triggersEs) ?? [];
      for (const raw of raws) {
        const compiled = compileTrigger(objection._id, raw);
        if (compiled) triggers.push(compiled);
      }
    }
  }

  return { triggers, titles, types };
}

export function compileTrigger(objectionId: string, raw: string): CompiledTrigger | null {
  const tokens = foldTokensWithOffsets(raw).map((t) => t.token);
  if (tokens.length === 0) return null;
  const content = tokens.filter((token) => !SPOKEN_STOPWORDS.has(token));
  return {
    objectionId,
    raw,
    tokens,
    content,
    // A single content word is far too easy to hit across two hours of speech.
    exactOnly: content.length < 2,
  };
}

/** Every start index at which `needle` occurs contiguously in `hay`. */
function allSequences(hay: readonly string[], needle: readonly string[]): number[] {
  const out: number[] = [];
  if (needle.length === 0 || needle.length > hay.length) return out;
  for (let start = 0; start + needle.length <= hay.length; start += 1) {
    let ok = true;
    for (let i = 0; i < needle.length; i += 1) {
      if (hay[start + i] !== needle[i]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(start);
  }
  return out;
}

/**
 * Every in-order occurrence of `needle` within `maxSpan` tokens, scanned forwards.
 *
 * Greedy from each starting position, so the span reported is the tightest one available from that
 * start and the bound is always evaluated against the strictest reading.
 */
function allOrdered(
  hay: readonly string[],
  needle: readonly string[],
  maxSpan: number
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  if (needle.length === 0) return out;

  for (let start = 0; start < hay.length; start += 1) {
    if (hay[start] !== needle[0]) continue;
    let need = 1;
    let i = start + 1;
    while (need < needle.length && i < hay.length && i - start + 1 <= maxSpan) {
      if (hay[i] === needle[need]) need += 1;
      i += 1;
    }
    if (need === needle.length) {
      const end = i - 1;
      if (end - start + 1 <= maxSpan) out.push({ start, end });
    }
  }
  return out;
}

/**
 * Scan one stretch of text for every trigger in the index.
 *
 * Two tiers, the same ones the live matcher uses and for the same reasons — this is where its
 * measured behaviour is worth inheriting:
 *   1.00  the exact phrase
 *   0.75  three or more content tokens, in order, within content.length + MAX_FILLER
 *   0.70  exactly two content tokens, in order, with at most one filler between them
 */
export function scanText(index: ScanIndex, text: string): Omit<ScanMatch, "turnIndex">[] {
  const tokens = foldTokensWithOffsets(text);
  if (tokens.length === 0) return [];
  const words = tokens.map((t) => t.token);

  const found: Omit<ScanMatch, "turnIndex">[] = [];

  const push = (trigger: CompiledTrigger, start: number, end: number, score: number) => {
    found.push({
      objectionId: trigger.objectionId,
      title: index.titles.get(trigger.objectionId) ?? "",
      objectionType: index.types.get(trigger.objectionId) ?? "other",
      trigger: trigger.raw,
      score,
      range: { start: tokens[start].start, end: tokens[end].end },
    });
  };

  for (const trigger of index.triggers) {
    const exact = allSequences(words, trigger.tokens);
    if (exact.length > 0) {
      for (const start of exact) push(trigger, start, start + trigger.tokens.length - 1, 1);
      continue;
    }
    if (trigger.exactOnly) continue;

    const maxSpan = trigger.content.length + MAX_FILLER;
    for (const span of allOrdered(words, trigger.content, maxSpan)) {
      const gaps = span.end - span.start + 1 - trigger.content.length;
      const score = trigger.content.length >= 3 ? 0.75 : gaps <= 1 ? 0.7 : 0;
      if (score === 0) continue;
      push(trigger, span.start, span.end, score);
    }
  }

  return dedupeOverlaps(found);
}

/**
 * One finding per stretch of speech.
 *
 * Several triggers of the same objection routinely match the same words, and two different
 * objections can overlap. Keep the strongest, then the longest, then the earliest — earliest rather
 * than latest, because this reads a transcript in order rather than ranking recency.
 */
function dedupeOverlaps(matches: Omit<ScanMatch, "turnIndex">[]): Omit<ScanMatch, "turnIndex">[] {
  const sorted = [...matches].sort(
    (a, b) =>
      b.score - a.score ||
      b.range.end - b.range.start - (a.range.end - a.range.start) ||
      a.range.start - b.range.start
  );

  const kept: Omit<ScanMatch, "turnIndex">[] = [];
  for (const match of sorted) {
    const clashes = kept.some(
      (k) => match.range.start < k.range.end && match.range.end > k.range.start
    );
    if (!clashes) kept.push(match);
  }
  return kept.sort((a, b) => a.range.start - b.range.start).slice(0, MAX_PER_TURN);
}

/**
 * Scan the whole call.
 *
 * Everything the agent did NOT say is scanned — client, "other", and anything unattributed — so a
 * mis-diarized line is not silently skipped. The agent's own turns are excluded because every
 * seeded trigger is a thing the client says, and scanning the agent quoting an objection back
 * ("so it's the price that's the problem?") would flag the rebuttal as the objection.
 */
export function scanTurns(
  turns: readonly Turn[],
  speakerMap: SpeakerMap | null,
  index: ScanIndex
): ScanMatch[] {
  if (index.triggers.length === 0) return [];
  const out: ScanMatch[] = [];

  turns.forEach((turn, turnIndex) => {
    if (speakerMap?.[turn.speaker]?.role === "agent") return;
    for (const match of scanText(index, turn.text)) out.push({ ...match, turnIndex });
  });

  return out;
}

/**
 * Fold the library's findings into the model's list.
 *
 * A turn both detectors flagged becomes ONE entry marked `both`, keeping the model's wording (it
 * read the conversation; the trigger only matched a phrase) and gaining the library link, which is
 * the half the model cannot supply. Anything only the library found is added as its own entry,
 * marked `soft`: a trigger match is evidence that the words were said, not that the client meant
 * them as a blocker.
 */
export function mergeScanIntoObjections(
  objections: readonly CallObjection[],
  matches: readonly ScanMatch[],
  turns: readonly Turn[]
): CallObjection[] {
  const merged = objections.map((objection) => ({ ...objection }));

  for (const match of matches) {
    const existing = merged.find(
      (objection) =>
        objection.turnIndex === match.turnIndex &&
        (objection.objectionType === match.objectionType || overlapsQuote(objection, match, turns))
    );

    if (existing) {
      existing.source = "both";
      existing.libraryObjectionId = match.objectionId;
      existing.matchedTrigger = match.trigger;
      if (!existing.quoteRange) existing.quoteRange = match.range;
      continue;
    }

    // Nothing corroborates this one, so it has to carry itself.
    if (match.score < MIN_STANDALONE_SCORE) continue;

    merged.push({
      objection: match.title,
      objectionType: match.objectionType,
      clientQuote: turns[match.turnIndex]?.text.slice(match.range.start, match.range.end) ?? "",
      agentResponse: "",
      resolved: null,
      turnIndex: match.turnIndex,
      quoteRange: match.range,
      strength: "soft",
      source: "library",
      libraryObjectionId: match.objectionId,
      matchedTrigger: match.trigger,
    });
  }

  return merged.sort((a, b) => (a.turnIndex ?? Infinity) - (b.turnIndex ?? Infinity));
}

/** Does the model's quote cover the same words the trigger matched? */
function overlapsQuote(
  objection: CallObjection,
  match: ScanMatch,
  turns: readonly Turn[]
): boolean {
  const range = objection.quoteRange;
  if (!range || objection.turnIndex !== match.turnIndex) return false;
  if (!turns[match.turnIndex]) return false;
  return range.start < match.range.end && range.end > match.range.start;
}
