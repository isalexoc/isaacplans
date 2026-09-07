import type { ScribeWord } from "@/lib/call-study/types";
import type { ArollSegment } from "./types";

// ─── Reading a word stream ────────────────────────────────────────────────────────
// Pure functions over the transcript. Separate from aroll-transcribe.ts, which holds the API
// key and is server-only, so these can be exercised directly by scripts/test-aroll-plan.ts —
// the same split lib/call-study/dialogue.ts makes, and for the same reason.

/** Join a word stream back into readable text, respecting Scribe's own spacing entries. */
export function wordsToText(words: readonly ScribeWord[]): string {
  return words
    .map((w) => (w.type === "spacing" ? " " : w.text ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only entries that are real words with usable timings — everything downstream assumes this. */
export function timedWords(words: readonly ScribeWord[]): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  for (const w of words) {
    if (w.type !== "word") continue;
    const text = typeof w.text === "string" ? w.text.trim() : "";
    if (!text) continue;
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
    out.push({ text, start: w.start as number, end: w.end as number });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Sentence-ending punctuation, including the Spanish inverted marks' closing partners. */
const SENTENCE_END = /[.!?…]["'”’)]?$/;

/**
 * Group words into sentence-level segments for the studio's transcript view.
 *
 * A long sentence is broken at MAX_SEGMENT_SEC so one rambling clause cannot become a
 * thirty-second block of text nobody can scan.
 */
export function wordsToSegments(
  words: readonly ScribeWord[],
  maxSegmentSec = 12
): ArollSegment[] {
  const timed = timedWords(words);
  if (!timed.length) return [];

  const segments: ArollSegment[] = [];
  let current: ArollSegment | null = null;

  for (const w of timed) {
    if (!current) {
      current = { text: w.text, start: w.start, end: w.end };
      continue;
    }
    current.text += ` ${w.text}`;
    current.end = Math.max(current.end, w.end);

    const finished = SENTENCE_END.test(w.text) || current.end - current.start >= maxSegmentSec;
    if (finished) {
      segments.push(current);
      current = null;
    }
  }
  if (current) segments.push(current);

  return segments.map((s) => ({ ...s, text: s.text.trim() }));
}

/**
 * The words actually spoken inside a window, verbatim.
 *
 * A word counts as inside when most of it is — a word straddling the boundary belongs to
 * whichever side holds the majority of it, which keeps a cutaway's caption from gaining or
 * losing a syllable it does not own.
 */
export function wordsInWindow(
  words: readonly { text: string; start: number; end: number }[],
  start: number,
  end: number
): string {
  return words
    .filter((w) => {
      const mid = (w.start + w.end) / 2;
      return mid >= start && mid < end;
    })
    .map((w) => w.text)
    .join(" ")
    .trim();
}
