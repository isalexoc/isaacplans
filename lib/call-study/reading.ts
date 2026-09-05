/**
 * Turning a stored transcript into something that can be READ.
 *
 * `dialogue.ts` decides what was said and by whom. This decides how it is laid out: which stretch
 * of the call belongs to which stage of the script, where the "you are twenty minutes in" markers
 * fall, and which lines are just someone saying "mm-hm" while the other person talks.
 *
 * Everything here is pure, derived, and deliberately NOT stored. Deriving at render time means a
 * call analysed months ago gains stages and markers the moment this ships, with no backfill — and
 * it means none of this can drift out of sync with the transcript it describes.
 *
 * Pinned by `scripts/test-call-study.ts`.
 */

import type { CallPhase, CallPhaseName, Turn } from "./types";

/* ─── Stages ────────────────────────────────────────────────────────────────── */

/** One contiguous stretch of the call, as laid out for reading. */
export type Stage = {
  phase: CallPhaseName;
  /** Inclusive turn indices. Every turn in the call belongs to exactly one Stage. */
  startTurn: number;
  endTurn: number;
  startSec: number;
  endSec: number;
  note?: string;
};

type DraftStage = {
  phase: CallPhaseName;
  startTurn: number;
  endTurn: number;
  note?: string;
  /** Position in the model's own output. Only a deterministic tiebreak, never a ranking. */
  arrival: number;
};

/**
 * Lay the model's loose phase list out as a contiguous, non-overlapping timeline.
 *
 * What arrives is not a segmentation. It is a list of observations that can overlap, nest, leave
 * gaps, arrive out of order, and repeat themselves at the seams between analysis windows. What the
 * reading view needs is the opposite: every turn in exactly one stage, so scrolling always has an
 * answer to "what part of the script is this".
 *
 * **The turns are PAINTED longest span first, so the shortest span wins.** That single rule is what
 * makes the output useful, and the obvious alternatives both destroy it:
 *
 *   - The model reliably returns one broad stage with precise pockets inside it — a `presentation`
 *     over turns 10-60 containing an `objection` at 32-36. Letting the longer or the earlier span
 *     win swallows that pocket whole, and the objection stretch is the most valuable thing on the
 *     page. (This was the original implementation here, and it silently erased them.)
 *   - Letting the LATEST arrival win makes the result depend on how the call happened to be split
 *     into analysis windows, so re-analysing the same call could segment it differently.
 *
 * Gaps are then filled by carrying the previous stage forward — a call moves in one direction, and
 * a stage's stated start is where it becomes obvious, not where it began. A gap before the first
 * stage carries the first one backwards instead, because the call has to start somewhere.
 *
 * With no usable phases at all this returns NOTHING rather than inventing a stage: an un-analysed
 * call should say so by showing no stage headers, not by mislabelling itself "opening".
 */
export function buildStageTimeline(
  phases: readonly CallPhase[] | null | undefined,
  turns: readonly Turn[]
): Stage[] {
  const turnCount = turns.length;
  if (turnCount === 0) return [];

  const cleaned: DraftStage[] = [];
  for (const phase of phases ?? []) {
    if (!phase || typeof phase.phase !== "string") continue;
    const a = clampTurn(phase.startTurn, turnCount);
    const b = clampTurn(phase.endTurn, turnCount);
    if (a === null || b === null) continue;
    cleaned.push({
      phase: phase.phase,
      startTurn: Math.min(a, b),
      endTurn: Math.max(a, b),
      note: typeof phase.note === "string" && phase.note.trim() ? phase.note.trim() : undefined,
      arrival: cleaned.length,
    });
  }
  if (cleaned.length === 0) return [];

  // Longest first, so a narrower claim painted afterwards keeps the turns it names. Sorting a copy
  // and tiebreaking on arrival keeps this independent of Array.prototype.sort stability.
  const painted = [...cleaned].sort(
    (x, y) =>
      y.endTurn - y.startTurn - (x.endTurn - x.startTurn) ||
      x.startTurn - y.startTurn ||
      x.arrival - y.arrival
  );

  const owner = new Array<number>(turnCount).fill(-1);
  for (const stage of painted) {
    for (let t = stage.startTurn; t <= stage.endTurn; t += 1) owner[t] = stage.arrival;
  }

  // Every cleaned entry paints at least one turn, so there is always a first owned turn.
  const firstOwned = owner.findIndex((o) => o >= 0);
  for (let t = 0; t < firstOwned; t += 1) owner[t] = owner[firstOwned];
  for (let t = firstOwned + 1; t < turnCount; t += 1) {
    if (owner[t] < 0) owner[t] = owner[t - 1];
  }

  // Coalesce by PHASE rather than by owner, which collapses seam repeats of the same stage and the
  // adjacencies that gap-filling creates, and guarantees no two neighbouring stages share a name.
  const byArrival = new Map(cleaned.map((stage) => [stage.arrival, stage]));
  const out: Stage[] = [];
  for (let t = 0; t < turnCount; t += 1) {
    const draft = byArrival.get(owner[t]);
    if (!draft) continue;
    const previous = out[out.length - 1];
    if (previous && previous.phase === draft.phase) {
      previous.endTurn = t;
      if (!previous.note && draft.note) previous.note = draft.note;
    } else {
      out.push({
        phase: draft.phase,
        startTurn: t,
        endTurn: t,
        note: draft.note,
        startSec: 0,
        endSec: 0,
      });
    }
  }

  return out.map((stage) => ({
    ...stage,
    startSec: turns[stage.startTurn].start,
    endSec: turns[stage.endTurn].end,
  }));
}

/** Which stage each turn belongs to, as a lookup. `-1` where the call has no stages at all. */
export function stageIndexByTurn(stages: readonly Stage[], turnCount: number): number[] {
  const map = new Array<number>(turnCount).fill(-1);
  stages.forEach((stage, i) => {
    for (let t = stage.startTurn; t <= stage.endTurn && t < turnCount; t += 1) map[t] = i;
  });
  return map;
}

function clampTurn(value: unknown, turnCount: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(Math.floor(n), turnCount - 1));
}

/* ─── Time markers ──────────────────────────────────────────────────────────── */

/**
 * A "you are here" point in the call.
 *
 * Deliberately NOT a timestamp per line. What is wanted is the occasional marker saying this is
 * minute ten, this is minute twenty — a timestamp on every line is the subtitle-file look this
 * whole feature exists to avoid.
 */
export type TimeMarker = {
  /** The marker is drawn immediately BEFORE this turn. */
  atTurn: number;
  seconds: number;
  label: string;
  /** 0-1 through the call, for positioning on the stage rail. */
  percent: number;
};

/** Tried finest first, so a short call still gets useful granularity. */
export const MARKER_INTERVALS = [60, 120, 300, 600, 900, 1800] as const;

/** Above this many, the markers stop being landmarks and become a ruler. */
export const MAX_MARKERS = 10;

/** The finest interval that still keeps the call under MAX_MARKERS markers. */
export function pickMarkerInterval(durationSeconds: number): number {
  for (const interval of MARKER_INTERVALS) {
    if (Math.floor(durationSeconds / interval) <= MAX_MARKERS) return interval;
  }
  return MARKER_INTERVALS[MARKER_INTERVALS.length - 1];
}

export function buildTimeMarkers(
  turns: readonly Turn[],
  options: { intervalSeconds?: number | null } = {}
): TimeMarker[] {
  if (turns.length === 0) return [];
  const total = turns[turns.length - 1].end;
  if (!Number.isFinite(total) || total <= 0) return [];

  const override = options.intervalSeconds;
  const interval = override && override > 0 ? override : pickMarkerInterval(total);

  const markers: TimeMarker[] = [];
  let next = interval;

  for (let i = 0; i < turns.length; i += 1) {
    const start = turns[i].start;
    if (!Number.isFinite(start) || start < next) continue;
    // One long monologue can cross several boundaries at once. Label the marker with the boundary
    // actually reached, rather than stacking three markers between the same two lines.
    const reached = Math.floor(start / interval) * interval;
    markers.push({
      atTurn: i,
      seconds: reached,
      label: elapsedLabel(reached),
      percent: reached / total,
    });
    next = reached + interval;
  }

  return markers;
}

/** "10 min", "1 hr", "1 hr 15 min" — how far in, not what o'clock. */
export function elapsedLabel(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

/** "12:04", or "1:07:20" once a call passes the hour. */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/* ─── Locating a quote inside a turn ────────────────────────────────────────── */

/**
 * Decompose and drop the combining marks, so "cotización" and "cotizacion" are the same word.
 *
 * Length-unstable by design — NFD makes strings longer — which is exactly why `foldWithMap` below
 * has to record where every surviving character came from rather than measuring after the fact.
 */
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Every character speech-to-text and people actually use as an apostrophe.
 *
 * `\u00b4` (U+00B4, acute accent) is in here deliberately: it has only a compatibility decomposition, so
 * NFD leaves it alone, and it is common in typed Spanish. Without it "can\u00b4t" would fold to two
 * words and never match.
 */
const APOSTROPHES = new Set(["'", "\u2019", "\u2018", "\u02bc", "\u00b4", "`"]);

/** Half-open `[start, end)` into the ORIGINAL turn text — never into a rendered line. */
export type CharRange = { start: number; end: number };

/**
 * A folded copy of `text`, plus the map back to where every folded character came from.
 *
 * The map is what makes highlighting possible without touching the transcript. Folding is lossy —
 * accents are stripped, case is flattened, punctuation and whitespace collapse — so offsets cannot
 * survive it on their own, and re-folding a substring to measure it does not work either because
 * NFD makes strings LONGER ("café" is 4 characters and 5 after decomposition).
 *
 * Indexed per UTF-16 code unit rather than per code point, because every downstream operation —
 * `indexOf`, `slice`, `length` — is per code unit. Walking code points instead leaves the map short
 * the first time a transcript contains an emoji, and the highlight reads past the end of the array.
 */
function foldWithMap(text: string): { folded: string; startAt: number[]; endAt: number[] } {
  const chars: string[] = [];
  const startAt: number[] = [];
  const endAt: number[] = [];
  let lastWasSpace = true;

  for (let i = 0; i < text.length; i += 1) {
    const raw = text[i];
    // An apostrophe VANISHES rather than separating, so "can't" folds to "cant" and matches a
    // quote written either way. Every other punctuation mark collapses to a single separator —
    // "twenty-five" stays two words, because it is two words.
    if (APOSTROPHES.has(raw)) continue;

    const folded = stripDiacritics(raw).toLowerCase();
    for (const ch of folded) {
      if (/[a-z0-9]/.test(ch)) {
        chars.push(ch);
        startAt.push(i);
        endAt.push(i + 1);
        lastWasSpace = false;
      } else if (!lastWasSpace) {
        chars.push(" ");
        startAt.push(i);
        endAt.push(i + 1);
        lastWasSpace = true;
      }
    }
  }

  while (chars.length > 0 && chars[chars.length - 1] === " ") {
    chars.pop();
    startAt.pop();
    endAt.pop();
  }

  return { folded: chars.join(""), startAt, endAt };
}

/** The same folding, for the needle, where no map is needed. */
function fold(text: string): string {
  return foldWithMap(text).folded;
}

/** One folded word, and the span of the ORIGINAL text it came from. */
export type FoldedToken = { token: string; start: number; end: number };

/**
 * Split text into folded words, each carrying where it came from.
 *
 * The basis of trigger matching against a transcript: matching happens on the folded words, and the
 * spans are what let the matched phrase be highlighted in the real text without altering it.
 *
 * Note this folds an apostrophe AWAY rather than treating it as a separator, so "can't" is the
 * single token "cant". That differs from `normalizeSpokenText` in lib/objections/live-match.ts,
 * which replaces it with a space and yields ["can","t"] — the difference is deliberate and the
 * reason is written up in lib/call-study/objection-scan.ts.
 */
export function foldTokensWithOffsets(text: string): FoldedToken[] {
  const { folded, startAt, endAt } = foldWithMap(text);
  const out: FoldedToken[] = [];

  let at = 0;
  while (at < folded.length) {
    if (folded[at] === " ") {
      at += 1;
      continue;
    }
    let end = at;
    while (end < folded.length && folded[end] !== " ") end += 1;
    out.push({ token: folded.slice(at, end), start: startAt[at], end: endAt[end - 1] });
    at = end;
  }

  return out;
}

/**
 * Where in `text` does `quote` appear, ignoring case, accents and punctuation?
 *
 * Used to highlight the exact words of an objection inside the line that contains it. The model is
 * asked for verbatim quotes and mostly obliges, but "verbatim" from a model routinely differs in a
 * comma or a capital, and an exact `indexOf` would silently fail to highlight anything on those.
 *
 * Returns a range into the ORIGINAL string, so the caller wraps the real characters and never
 * substitutes the folded ones. Null when the quote is not in this turn — which is a normal answer,
 * not an error: a quote can span two turns, or the model can have paraphrased after all.
 */
export function findQuoteRange(text: string, quote: string): CharRange | null {
  if (!text || !quote) return null;
  const needle = fold(quote);
  if (!needle) return null;

  const hay = foldWithMap(text);
  const at = hay.folded.indexOf(needle);
  if (at < 0) return null;

  return { start: hay.startAt[at], end: hay.endAt[at + needle.length - 1] };
}

/* ─── Highlighting without touching the text ────────────────────────────────── */

export type Highlight<K extends string = string> = CharRange & { kind: K };

/** A run of the original text, either plain (`kind: null`) or to be wrapped. */
export type Segment<K extends string = string> = { text: string; kind: K | null };

/**
 * Cut a turn into plain and highlighted runs.
 *
 * **The contract, and the reason this is a tested function rather than three lines in a component:
 * joining the segments back together must reproduce the input string exactly.** Every highlight in
 * the reader — objections, search hits — is a wrapper around real characters; the transcript is
 * never rewritten, re-cased, trimmed or re-spaced. A slicing bug here would silently corrupt what
 * the agent believes was said on a recorded call, which is the one thing this feature must never do.
 *
 * Highlights are accepted in the order given, and a later one overlapping an accepted one is
 * dropped — so the caller expresses priority by ordering (objections before search hits) rather
 * than by a rank field that would then have to be kept in sync.
 */
export function splitByHighlights<K extends string>(
  text: string,
  highlights: readonly Highlight<K>[]
): Segment<K>[] {
  if (!text) return [];

  const accepted: Highlight<K>[] = [];
  for (const highlight of highlights) {
    const start = Math.max(0, Math.min(Math.floor(highlight.start), text.length));
    const end = Math.max(0, Math.min(Math.floor(highlight.end), text.length));
    if (!(end > start)) continue;
    if (accepted.some((a) => start < a.end && end > a.start)) continue;
    accepted.push({ start, end, kind: highlight.kind });
  }
  accepted.sort((a, b) => a.start - b.start);

  const out: Segment<K>[] = [];
  let at = 0;
  for (const highlight of accepted) {
    if (highlight.start > at) out.push({ text: text.slice(at, highlight.start), kind: null });
    out.push({ text: text.slice(highlight.start, highlight.end), kind: highlight.kind });
    at = highlight.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: null });
  return out;
}

/** Every occurrence of `needle` in `text`, case-insensitively. For the reader's search box. */
export function findAllOccurrences(text: string, needle: string): CharRange[] {
  const query = needle.trim();
  if (!text || !query) return [];

  // Folded on both sides so searching "cotizacion" finds "cotización", the way the objection
  // palette already behaves. Falls back to a plain scan when folding collapses the query away.
  const hay = foldWithMap(text);
  const folded = fold(query);
  if (!folded) return [];

  const out: CharRange[] = [];
  let at = hay.folded.indexOf(folded);
  while (at >= 0) {
    out.push({ start: hay.startAt[at], end: hay.endAt[at + folded.length - 1] });
    at = hay.folded.indexOf(folded, at + folded.length);
  }
  return out;
}

/* ─── Backchannel ───────────────────────────────────────────────────────────── */

/**
 * Acknowledgements that carry no content: "mm-hm", "right", "okay", "ajá".
 *
 * Negation is deliberately absent — no "no", "nope", "nunca". A client answering "no" is answering,
 * and demoting that to background noise would mute the most important word on the call. Same
 * reasoning as the stopword list in lib/objections/live-match.ts.
 */
const BACKCHANNEL_WORDS = new Set([
  // English. The hyphenated forms ASR actually emits — "mm-hm", "uh-huh" — split on the hyphen
  // into two words here, so both halves have to be listed in their own right.
  "mm", "mmm", "hm", "hmm", "mhm", "mmhm", "mmhmm", "huh", "uhhuh", "uhuh", "uh", "um", "er",
  "yeah", "yep", "yup", "yes", "ok", "okay", "right", "sure", "gotcha", "exactly", "absolutely",
  "wow", "oh", "ah", "aha", "alright", "true", "correct", "understood", "perfect", "great", "nice",
  // Spanish
  "si", "sii", "claro", "aja", "ajam", "bueno", "correcto", "exacto", "entiendo", "perfecto",
  "ya", "eh", "vale", "seguro", "okey",
]);

/** Strip punctuation and accents the way a reader's eye does — for this check only. */
function plainWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Is this turn pure acknowledgement?
 *
 * Used ONLY to give a line less visual weight. `wordsToTurns` is faithfully strict about starting a
 * new turn on every speaker change, so a five-minute pitch comes back chopped into twelve blocks by
 * the other person saying "mm-hm" — accurate, and unreadable. The text is still rendered, in full
 * and verbatim. Nothing is ever dropped.
 */
export function isBackchannel(text: string): boolean {
  const words = plainWords(text);
  if (words.length === 0 || words.length > 3) return false;
  return words.every((word) => BACKCHANNEL_WORDS.has(word));
}
