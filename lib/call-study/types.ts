/**
 * ElevenLabs Scribe response shapes, and the dialogue types this feature works in.
 *
 * Written from live responses during planning rather than from the docs — the published reference
 * does not say that `speaker_id` becomes the literal strings "agent" and "customer" once
 * `detect_speaker_roles` is on, which is the single most useful thing about it here.
 */

export type ScribeWordType = "word" | "spacing" | "audio_event";

export type ScribeWord = {
  text: string;
  /** Seconds. Absent on some entries, which is why every consumer guards it. */
  start?: number;
  end?: number;
  type: ScribeWordType;
  /**
   * "agent" / "customer" when `detect_speaker_roles` is on, otherwise "speaker_0", "speaker_1"…
   * Both shapes are handled: the role names are a convenience, not something to depend on.
   */
  speaker_id?: string;
  logprob?: number;
};

/** One redaction Scribe performed, e.g. `{ entity_type: "ssn", text: "{SSN_0}" }`. */
export type ScribeEntity = {
  text: string;
  entity_type: string;
  start_char?: number;
  end_char?: number;
};

export type ScribeTranscript = {
  language_code?: string;
  language_probability?: number;
  text?: string;
  words?: ScribeWord[];
  entities?: ScribeEntity[];
  /** The id for `GET /v1/speech-to-text/transcripts/{id}` — the reconcile backstop uses it. */
  transcription_id?: string;
  audio_duration_secs?: number;
};

/** The async create call's immediate answer. */
export type ScribeAsyncAck = {
  request_id?: string;
  transcription_id?: string;
};

/** One uninterrupted stretch of speech by one speaker. The unit the whole feature works in. */
export type Turn = {
  /** The raw `speaker_id` from Scribe. Display names come from the speaker map, never from here. */
  speaker: string;
  text: string;
  start: number;
  end: number;
};

export type SpeakerRole = "agent" | "client" | "other";

/**
 * Display name and role per raw speaker id.
 *
 * Kept separate from `Turn[]` on purpose: renaming a speaker then rewrites a three-entry object
 * instead of every line of a two-hour call, so it is instant and cannot corrupt the transcript.
 */
export type SpeakerMap = Record<string, { name: string; role: SpeakerRole }>;

export type SpeakerStats = {
  speakingSeconds: number;
  words: number;
  turns: number;
};

export type CallMetrics = {
  totalSpeakingSeconds: number;
  bySpeaker: Record<string, SpeakerStats>;
  /** Share of speaking time per speaker id, 0–1. */
  talkRatio: Record<string, number>;
  longestMonologueSeconds: number;
  longestMonologueSpeaker: string | null;
};

export type CallStudyStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "ready"
  | "failed";

export type CallOutcome = "sold" | "not_sold" | "follow_up" | "unknown";

/* ─── Analysis ──────────────────────────────────────────────────────────────
 *
 * What GPT extracts from a finished dialogue. Deliberately concrete: a phase with turn indices
 * can be highlighted in the UI, and an objection with both the client's words and the agent's
 * answer is a script fragment on its own.
 */

/**
 * The stages of a call, in the order they normally happen.
 *
 * A superset of the original six. `rapport` and `trial_close` exist because the hello-and-
 * break-the-ice stretch and the moment of asking for the business are distinct pieces of script
 * work, and folding them into `opening` and `close` made the segmentation too coarse to study.
 * Widening is backward compatible: analyses stored before this used only the original six.
 */
export type CallPhaseName =
  | "opening"
  | "rapport"
  | "discovery"
  | "presentation"
  | "objection"
  | "trial_close"
  | "close"
  | "wrap";

export type CallPhase = {
  phase: CallPhaseName;
  /** Indices into the turn array, so the UI can jump to and highlight the stretch. */
  startTurn: number;
  endTurn: number;
  note?: string;
};

/** An explicit blocker, or the softer resistance that is easy to miss and easier to lose. */
export type ObjectionStrength = "hard" | "soft";

/** Which detector found it. `both` means the model and the trigger library agreed. */
export type ObjectionSource = "ai" | "library" | "both";

export type CallObjection = {
  /** Short label, e.g. "too expensive". */
  objection: string;
  /** Coarse bucket for filtering the library: price, spouse, trust, timing, already_covered… */
  objectionType: string;
  /** What the client actually said, verbatim. */
  clientQuote: string;
  /** How the agent answered, verbatim. */
  agentResponse: string;
  /** Whether the objection appeared to be resolved. Null when the call gives no signal. */
  resolved: boolean | null;

  /* Everything below is OPTIONAL and absent on analyses stored before the reading view landed.
   * `analysis` is a jsonb column, so widening this type needs no migration — but every renderer
   * must cope with an older row that has none of it. */

  /** Index into the turn array of the line where the CLIENT raised it. Absent = cannot anchor. */
  turnIndex?: number;
  /** Character range of the matched phrase within that turn's text, for the highlight. */
  quoteRange?: { start: number; end: number };
  strength?: ObjectionStrength;
  source?: ObjectionSource;
  /** Sanity `_id` of the matching objection card, so the saved rebuttal is one click away. */
  libraryObjectionId?: string | null;
  /** The trigger phrase that fired, kept for tuning the corpus. Never shown as content. */
  matchedTrigger?: string | null;
};

/** The categories the snippet library is organised by. */
export type SnippetCategory =
  | "opening"
  | "discovery"
  | "rapport"
  | "presentation"
  | "objection"
  | "rebuttal"
  | "price"
  | "trial_close"
  | "close"
  | "story";

export type ExtractedSnippet = {
  category: SnippetCategory;
  objectionType?: string | null;
  speakerRole: SpeakerRole;
  /** Verbatim. The whole value of the library is that these are real lines, not paraphrases. */
  quote: string;
  /** Why it is worth keeping — the note Isaac reads when assembling a script. */
  why: string;
  startSec?: number | null;
};

export type CallAnalysis = {
  summary: string;
  phases: CallPhase[];
  objections: CallObjection[];
  discoveryQuestions: string[];
  closeLanguage: string[];
  strengths: string[];
  improvements: string[];
};

export const LINES_OF_BUSINESS = [
  "iul",
  "final_expense",
  "term_life",
  "whole_life",
  "aca",
  "annuity",
  "other",
] as const;

export type CallLineOfBusiness = (typeof LINES_OF_BUSINESS)[number];
