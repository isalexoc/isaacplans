/**
 * Turning Scribe's word stream into a readable dialogue.
 *
 * This is the heart of the feature and the whole reason it is not just "a transcription tool":
 * what Isaac studies is a conversation, not a wall of text and not a subtitle file. Every function
 * here is pure and has no dependencies, which is what makes the behaviour cheap to pin down in
 * tests — see `scripts/test-call-study.ts`.
 */

import type {
  CallMetrics,
  ScribeWord,
  SpeakerMap,
  SpeakerStats,
  Turn,
} from "./types";

/** Speaker id used when Scribe gives a word no attribution at all. */
export const UNKNOWN_SPEAKER = "unknown";

export type WordsToTurnsOptions = {
  /**
   * Keep `(laughter)`-style markers as part of the dialogue. Off by default: they are noise when
   * the goal is reading a sales conversation, and they interrupt the flow of a line mid-sentence.
   */
  includeAudioEvents?: boolean;
};

/**
 * Group a word stream into speaker turns.
 *
 * Strictly faithful: a new turn begins whenever the speaker changes, and nothing is merged across
 * an interruption. If an agent's pitch is broken into six turns by the client saying "mm-hm", that
 * is what the call sounded like, and smoothing it over would misrepresent who was actually talking.
 *
 * `spacing` entries are skipped for text — they carry the whitespace, not words — and crucially
 * they never trigger a speaker change, since a stray attribution on a space would split a turn in
 * half for no reason.
 */
export function wordsToTurns(
  words: readonly ScribeWord[] | null | undefined,
  options: WordsToTurnsOptions = {}
): Turn[] {
  if (!words || words.length === 0) return [];

  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const word of words) {
    if (word.type === "spacing") continue;
    if (word.type === "audio_event" && !options.includeAudioEvents) continue;

    const text = typeof word.text === "string" ? word.text.trim() : "";
    if (!text) continue;

    const speaker = word.speaker_id || UNKNOWN_SPEAKER;
    const start: number = Number.isFinite(word.start) ? (word.start as number) : (current?.end ?? 0);
    const end: number = Number.isFinite(word.end) ? (word.end as number) : start;

    if (!current || current.speaker !== speaker) {
      current = { speaker, text, start, end };
      turns.push(current);
    } else {
      current.text += ` ${text}`;
      // Never let a missing or out-of-order timestamp drag a turn's end backwards.
      if (end > current.end) current.end = end;
    }
  }

  return turns;
}

/** The display name for a raw speaker id, falling back to something readable. */
export function speakerLabel(speaker: string, speakerMap: SpeakerMap | null | undefined): string {
  const mapped = speakerMap?.[speaker]?.name?.trim();
  if (mapped) return mapped;
  // Scribe's own role labels read fine as names; its "speaker_0" ids do not.
  if (speaker === "agent") return "Agent";
  if (speaker === "customer") return "Client";
  if (speaker === UNKNOWN_SPEAKER) return "Speaker";
  const numbered = /^speaker[_-]?(\d+)$/i.exec(speaker);
  if (numbered) return `Speaker ${Number(numbered[1]) + 1}`;
  return speaker;
}

export type RenderDialogueOptions = {
  /**
   * Pad names to a common width so the spoken text lines up in a column. Matches how a screenplay
   * or an interview transcript reads, and makes it far easier to scan one speaker's lines.
   */
  align?: boolean;
  /** Blank line between turns. Easier to read on long calls; off keeps it compact. */
  blankLineBetweenTurns?: boolean;
};

/**
 * Render turns as `Name: text`, one turn per line.
 *
 * The output is deliberately plain text with no timestamps and no markup — it is meant to be
 * pasted into a document, read end to end, and marked up by hand.
 */
export function renderDialogue(
  turns: readonly Turn[],
  speakerMap?: SpeakerMap | null,
  options: RenderDialogueOptions = {}
): string {
  if (turns.length === 0) return "";

  const labels = turns.map((t) => speakerLabel(t.speaker, speakerMap));
  const width = options.align ? Math.max(...labels.map((l) => l.length)) : 0;

  const lines = turns.map((turn, i) => {
    const label = `${labels[i]}:`;
    const padded = options.align ? label.padEnd(width + 1, " ") : label;
    return `${padded} ${turn.text}`;
  });

  return lines.join(options.blankLineBetweenTurns ? "\n\n" : "\n");
}

/**
 * Render the dialogue with turn numbers, so a language model can point back into it.
 *
 * `offset` is the window's absolute start index, which keeps numbering continuous when a long call
 * is analysed in several windows — without it each window would restart at zero and a phase in the
 * third window would claim to begin at turn 0.
 *
 * **One line per turn BY CONSTRUCTION, never by splitting rendered text on newlines.** These
 * numbers are the only thing tying a model's answer back to the transcript: they decide which lines
 * a stage covers, where an objection is highlighted, and where the audio jumps to. Numbering the
 * result of `renderDialogue(...).split("\n")` meant one newline inside a single turn's text shifted
 * every number after it by one — permanently, inside a stored analysis — and it silently depended
 * on `blankLineBetweenTurns` staying off, since turning it on would have doubled every line count.
 * Neither failure is visible by eye.
 */
export function numberedDialogue(
  turns: readonly Turn[],
  speakerMap: SpeakerMap | null,
  offset = 0
): string {
  return turns
    .map(
      (turn, i) =>
        `[${offset + i}] ${speakerLabel(turn.speaker, speakerMap)}: ${flattenToOneLine(turn.text)}`
    )
    .join("\n");
}

/**
 * Collapse any line break inside a turn to a space.
 *
 * `wordsToTurns` joins words with single spaces, so this is a no-op on anything it produces — but
 * `turns` is a jsonb column read back without revalidation, and audio-event text is vendor prose
 * rather than a single token. Deliberately narrower than a general whitespace collapse: quotes are
 * required verbatim, so nothing but the line-breaking characters is touched.
 */
function flattenToOneLine(text: string): string {
  return text.split("\n").join(" ").split("\r").join(" ");
}

/**
 * Talk-time ratio, word counts and longest monologue.
 *
 * Computed from the timestamps rather than asked of a language model: these are arithmetic, and a
 * model would be slower, cost money, and occasionally be wrong about it. Talk ratio and longest
 * monologue are two of the most useful numbers in sales coaching — an agent who talks 80% of a
 * discovery call has a finding, not a transcript.
 */
export function computeMetrics(turns: readonly Turn[]): CallMetrics {
  const bySpeaker: Record<string, SpeakerStats> = {};
  let totalSpeakingSeconds = 0;
  let longestMonologueSeconds = 0;
  let longestMonologueSpeaker: string | null = null;

  for (const turn of turns) {
    // Clamp: a turn whose end precedes its start contributes nothing rather than a negative.
    const seconds = Math.max(0, turn.end - turn.start);
    const words = turn.text.split(/\s+/).filter(Boolean).length;

    const stats = bySpeaker[turn.speaker] ?? { speakingSeconds: 0, words: 0, turns: 0 };
    stats.speakingSeconds += seconds;
    stats.words += words;
    stats.turns += 1;
    bySpeaker[turn.speaker] = stats;

    totalSpeakingSeconds += seconds;
    if (seconds > longestMonologueSeconds) {
      longestMonologueSeconds = seconds;
      longestMonologueSpeaker = turn.speaker;
    }
  }

  const talkRatio: Record<string, number> = {};
  for (const [speaker, stats] of Object.entries(bySpeaker)) {
    talkRatio[speaker] = totalSpeakingSeconds > 0 ? stats.speakingSeconds / totalSpeakingSeconds : 0;
  }

  return {
    totalSpeakingSeconds,
    bySpeaker,
    talkRatio,
    longestMonologueSeconds,
    longestMonologueSpeaker,
  };
}

/**
 * Seed a speaker map from whatever Scribe attributed, before any naming pass has run.
 *
 * Gives a usable transcript immediately — "Agent:" and "Client:" beat "speaker_0:" — which the GPT
 * naming pass then refines into real names where the call contains introductions.
 */
export function defaultSpeakerMap(turns: readonly Turn[]): SpeakerMap {
  const map: SpeakerMap = {};
  for (const turn of turns) {
    if (map[turn.speaker]) continue;
    map[turn.speaker] = {
      name: speakerLabel(turn.speaker, null),
      role: turn.speaker === "agent" ? "agent" : turn.speaker === "customer" ? "client" : "other",
    };
  }
  return map;
}

/** A window of turns, plus where it begins in the original array. */
export type TurnWindow = {
  turns: Turn[];
  /** Absolute index of `turns[0]` in the array that was split. */
  startIndex: number;
};

/**
 * Split turns into windows small enough to analyse in one model call, keeping absolute positions.
 *
 * A two-hour call fits in context comfortably; a ten-hour one does not. Windows are measured in
 * characters of rendered dialogue and overlap by a couple of turns so an exchange that straddles a
 * boundary is not cut in half — an objection and its rebuttal landing in different windows is
 * exactly the thing that would be missed.
 *
 * **`startIndex` is why this function exists.** Because each window after the first REPEATS the
 * previous window's last `overlapTurns` turns, a caller that numbers windows by accumulating
 * `window.length` counts those turns twice and drifts +overlapTurns per boundary — which silently
 * points every phase boundary and every snippet in windows 2..n at the wrong line. Carrying the
 * true start index makes that class of bug unrepresentable rather than merely fixed.
 */
export function windowTurnsWithIndex(
  turns: readonly Turn[],
  maxChars: number,
  overlapTurns = 2
): TurnWindow[] {
  if (turns.length === 0) return [];

  const windows: TurnWindow[] = [];
  let current: Turn[] = [];
  let startIndex = 0;
  let size = 0;

  turns.forEach((turn, index) => {
    const cost = turn.text.length + 24; // rough allowance for the speaker label
    if (current.length > 0 && size + cost > maxChars) {
      windows.push({ turns: current, startIndex });
      const carried = current.slice(-overlapTurns);
      // The carried turns end at `index - 1`, so the new window starts that many turns earlier.
      startIndex = index - carried.length;
      current = carried;
      size = current.reduce((n, t) => n + t.text.length + 24, 0);
    }
    current.push(turn);
    size += cost;
  });

  if (current.length > 0) windows.push({ turns: current, startIndex });
  return windows;
}

/** Just the turns. Kept as the simple shape for callers that do not need absolute positions. */
export function windowTurns(
  turns: readonly Turn[],
  maxChars: number,
  overlapTurns = 2
): Turn[][] {
  return windowTurnsWithIndex(turns, maxChars, overlapTurns).map((w) => w.turns);
}
