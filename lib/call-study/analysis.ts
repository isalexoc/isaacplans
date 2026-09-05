/**
 * Reading a finished dialogue for the things a sales script is built from.
 *
 * The output is two different shapes for two different jobs. The **anatomy** — phases, objections,
 * discovery questions, closing language — is for studying one call. The **snippets** are for the
 * cross-call library, which is what actually turns twenty recordings into a script: tagged verbatim
 * lines that can later be filtered down to "every price rebuttal on an IUL call that closed".
 *
 * Quotes are required to be verbatim, and the reason is practical rather than pedantic: a
 * paraphrase cannot be said out loud on the next call.
 *
 * Server-only.
 */

import "server-only";
import { numberedDialogue, windowTurnsWithIndex } from "./dialogue";
import { chatJson } from "./openai";
import type {
  CallAnalysis,
  CallObjection,
  CallPhase,
  CallPhaseName,
  ExtractedSnippet,
  SnippetCategory,
  SpeakerMap,
  SpeakerRole,
  Turn,
} from "./types";

/**
 * Characters of dialogue per model call.
 *
 * Roughly 30k tokens, comfortably inside a 128k context with room for the response. A two-hour
 * call fits in one window; a very long one is split and merged.
 */
const WINDOW_CHARS = 120_000;

const CATEGORIES: SnippetCategory[] = [
  "opening",
  "discovery",
  "rapport",
  "presentation",
  "objection",
  "rebuttal",
  "price",
  "trial_close",
  "close",
  "story",
];

/**
 * The stages of a call, in the order they normally happen.
 *
 * A superset of the original six: `rapport` and `trial_close` were added because "the hello part
 * and breaking the ice" and "asking for the business" are different pieces of script work, and
 * collapsing them made the segmentation too coarse to study. Widening is safe — analyses stored
 * before this change use only the original values and still render.
 *
 * Keep in lockstep with `CallPhaseName`, the enum in SYSTEM_PROMPT, and PHASE_LABELS in
 * components/admin/call-study/stage-theme: sanitizePhases DROPS any value not listed here, so a
 * name that appears in the prompt but not here is deleted silently.
 */
const PHASES = [
  "opening",
  "rapport",
  "discovery",
  "presentation",
  "objection",
  "trial_close",
  "close",
  "wrap",
] as const satisfies readonly CallPhaseName[];

/**
 * Compile error if a `CallPhaseName` is ever added without being listed above.
 *
 * The comment on PHASES asks for lockstep; this enforces it. Without it, adding a phase to the type
 * and the prompt but not here makes `sanitizePhases` drop every instance of the new phase, and the
 * only symptom is a stage that never appears.
 */
type UnlistedPhase = Exclude<CallPhaseName, (typeof PHASES)[number]>;
const _everyPhaseIsListed: UnlistedPhase extends never ? true : never = true;
void _everyPhaseIsListed;

const SYSTEM_PROMPT = `You analyse recorded insurance sales calls so an agent can build a better script.

You will be given a call transcript as a dialogue. Turns are numbered.

Return JSON with exactly this shape:
{
  "summary": "2-3 sentences on what happened and how it went",
  "phases": [{ "phase": "opening|rapport|discovery|presentation|objection|trial_close|close|wrap", "startTurn": 0, "endTurn": 12, "note": "short" }],
  "objections": [{ "objection": "short label", "objectionType": "price|spouse|trust|timing|already_covered|health|thinking_about_it|other", "clientQuote": "verbatim", "agentResponse": "verbatim", "resolved": true|false|null, "strength": "hard|soft", "turnIndex": 27 }],
  "discoveryQuestions": ["verbatim questions the agent asked to learn about the client"],
  "closeLanguage": ["verbatim lines the agent used to ask for the business"],
  "strengths": ["what the agent did well, specifically"],
  "improvements": ["what would have worked better, specifically"],
  "snippets": [{ "category": "opening|discovery|rapport|presentation|objection|rebuttal|price|trial_close|close|story", "objectionType": "only for objection/rebuttal, else null", "speakerRole": "agent|client|other", "quote": "verbatim", "why": "one sentence on why this is worth reusing", "startTurn": 14 }]
}

Rules:
- Every quote must be VERBATIM from the transcript. Never paraphrase, never clean up grammar, never invent a line. If you cannot quote it exactly, leave it out.
- Snippets are the reusable raw material for a script. Prefer lines that would work on a different call with a different client. 8-20 snippets for a normal call.
- Include the client's objections as "objection" snippets and the agent's answers as "rebuttal" snippets, so both sides can be studied.
- "resolved" means the client visibly moved on or agreed. Use null when the call gives no clear signal.

OBJECTIONS - BE EXHAUSTIVE. This is the most important part of the output.
- Report EVERY objection, hesitation and piece of resistance, no matter how small or how quickly it
  passed. Under-reporting is the failure to avoid: a borderline one that turns out to be nothing
  costs a glance, one you leave out is invisible forever.
- "hard" is an explicit refusal or blocker: "I can't afford that", "I'm not interested".
- "soft" is anything weaker that still points at resistance - hesitation ("I don't know..."), a
  stall ("let me think about it", "call me back"), a deflection ("I'd have to ask my wife"), a
  sceptical or challenging question ("how do I know this is real?", "why is it that much?"), a
  price flinch ("oh, wow"), reluctance to give information, or a doubt the client raises and drops.
  When in doubt, include it as "soft".
- The same concern raised again later is a SEPARATE entry, at its own turn.
- "turnIndex" is the turn number of the line where the CLIENT raised it - the line "clientQuote"
  comes from, not the agent's answer. It is what lets the objection be highlighted in place, so
  either get it right or omit it.
- Turn numbers refer to the numbers shown in the transcript.
- Redaction markers like {SSN_0} are removed sensitive data. Never treat them as content and never quote them.
- If a section has nothing worth recording, return an empty array. Do not pad.`;

type RawAnalysis = CallAnalysis & {
  snippets?: (Omit<ExtractedSnippet, "startSec"> & { startTurn?: number })[];
};

export type AnalysisResult =
  | { ok: true; analysis: CallAnalysis; snippets: ExtractedSnippet[] }
  | { ok: false; error: string };

export async function analyzeCall(
  turns: readonly Turn[],
  speakerMap: SpeakerMap | null
): Promise<AnalysisResult> {
  if (turns.length === 0) return { ok: false, error: "This call has no transcript to analyse." };

  const windows = windowTurnsWithIndex(turns, WINDOW_CHARS);
  const merged: CallAnalysis = {
    summary: "",
    phases: [],
    objections: [],
    discoveryQuestions: [],
    closeLanguage: [],
    strengths: [],
    improvements: [],
  };
  const snippets: ExtractedSnippet[] = [];

  const summaries: string[] = [];

  for (const [i, window] of windows.entries()) {
    // Each window carries its own absolute start. Accumulating `offset += window.length`
    // instead counts every window's overlap turns twice, drifting each turn number in
    // windows 2..n by +overlapTurns per boundary — which points phases and snippets at the
    // wrong lines on any call long enough to need a second window.
    const body = numberedDialogue(window.turns, speakerMap, window.startIndex);
    const context =
      windows.length > 1
        ? `This is part ${i + 1} of ${windows.length} of a long call. Turn numbers are absolute.\n\n`
        : "";

    const result = await chatJson<RawAnalysis>({
      system: SYSTEM_PROMPT,
      user: `${context}${body}`,
      maxTokens: 6000,
    });

    if (!result.ok) {
      // One failed window on a long call still leaves the rest usable, but an outright failure on
      // the only window is a real failure and must say so.
      if (windows.length === 1) return { ok: false, error: result.error };
      console.warn("[CALL_STUDY] A window failed to analyse, continuing:", result.error);
      continue;
    }

    const data = result.data;
    if (typeof data.summary === "string" && data.summary.trim()) summaries.push(data.summary.trim());
    merged.phases.push(...sanitizePhases(data.phases, turns.length));
    merged.objections.push(...sanitizeObjections(data.objections, turns.length));
    merged.discoveryQuestions.push(...strings(data.discoveryQuestions));
    merged.closeLanguage.push(...strings(data.closeLanguage));
    merged.strengths.push(...strings(data.strengths));
    merged.improvements.push(...strings(data.improvements));
    snippets.push(...sanitizeSnippets(data.snippets, turns));
  }

  merged.summary = summaries.join(" ");
  // A long call analysed in windows repeats itself at the seams, where the overlap is deliberate.
  merged.objections = dedupeObjections(merged.objections);
  merged.discoveryQuestions = dedupe(merged.discoveryQuestions);
  merged.closeLanguage = dedupe(merged.closeLanguage);
  merged.strengths = dedupe(merged.strengths);
  merged.improvements = dedupe(merged.improvements);

  return { ok: true, analysis: merged, snippets: dedupeSnippets(snippets) };
}

/* ─── Sanitisers ──────────────────────────────────────────────────────────────
 *
 * Everything the model returns is treated as untrusted shape. It is asked for JSON and usually
 * obliges, but a missing field or a category it invented must not reach the database.
 */

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizePhases(value: unknown, turnCount: number): CallPhase[] {
  if (!Array.isArray(value)) return [];
  const out: CallPhase[] = [];
  for (const raw of value) {
    const phase = (PHASES as readonly string[]).includes(raw?.phase) ? raw.phase : null;
    if (!phase) continue;
    const startTurn = clampIndex(raw?.startTurn, turnCount);
    const endTurn = clampIndex(raw?.endTurn, turnCount);
    if (startTurn === null || endTurn === null) continue;
    out.push({
      phase,
      startTurn: Math.min(startTurn, endTurn),
      endTurn: Math.max(startTurn, endTurn),
      note: typeof raw?.note === "string" ? raw.note.trim() : undefined,
    });
  }
  return out;
}

function clampIndex(value: unknown, turnCount: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(Math.floor(n), Math.max(0, turnCount - 1)));
}

function sanitizeObjections(value: unknown, turnCount: number): CallObjection[] {
  if (!Array.isArray(value)) return [];
  const out: CallObjection[] = [];
  for (const raw of value) {
    const objection = typeof raw?.objection === "string" ? raw.objection.trim() : "";
    if (!objection) continue;

    // An out-of-range turn index is dropped rather than clamped: clamping would silently pin the
    // objection to turn 0 and highlight the wrong line, which is worse than not highlighting it.
    const rawTurn = Number(raw?.turnIndex);
    const turnIndex =
      Number.isFinite(rawTurn) && rawTurn >= 0 && rawTurn < turnCount
        ? Math.floor(rawTurn)
        : undefined;

    out.push({
      objection,
      objectionType: typeof raw?.objectionType === "string" ? raw.objectionType.trim() : "other",
      clientQuote: typeof raw?.clientQuote === "string" ? raw.clientQuote.trim() : "",
      agentResponse: typeof raw?.agentResponse === "string" ? raw.agentResponse.trim() : "",
      resolved: raw?.resolved === true ? true : raw?.resolved === false ? false : null,
      ...(turnIndex === undefined ? {} : { turnIndex }),
      strength: raw?.strength === "soft" ? "soft" : "hard",
      source: "ai",
    });
  }
  return out;
}

function sanitizeSnippets(value: unknown, turns: readonly Turn[]): ExtractedSnippet[] {
  if (!Array.isArray(value)) return [];
  const out: ExtractedSnippet[] = [];
  for (const raw of value) {
    const quote = typeof raw?.quote === "string" ? raw.quote.trim() : "";
    if (!quote) continue;
    if (!CATEGORIES.includes(raw?.category)) continue;

    const role: SpeakerRole =
      raw?.speakerRole === "agent" || raw?.speakerRole === "client" || raw?.speakerRole === "other"
        ? raw.speakerRole
        : "other";

    // Turn index → seconds, so the UI can jump to the moment in the audio.
    const turnIndex = Number(raw?.startTurn);
    const startSec =
      Number.isFinite(turnIndex) && turns[turnIndex] ? Math.round(turns[turnIndex].start) : null;

    out.push({
      category: raw.category,
      objectionType: typeof raw?.objectionType === "string" && raw.objectionType.trim()
        ? raw.objectionType.trim()
        : null,
      speakerRole: role,
      quote,
      why: typeof raw?.why === "string" ? raw.why.trim() : "",
      startSec,
    });
  }
  return out;
}

/**
 * Drop seam duplicates without merging distinct objections.
 *
 * Keyed on the client's words, not the label: the same objection analysed in two windows comes
 * back with the same quote but often a differently worded label. The SAME concern raised twice
 * at different points in the call has different quotes and survives, which is deliberate — a
 * client who repeats a price objection after the rebuttal is the most interesting thing on the
 * call, and collapsing it would erase that.
 */
function dedupeObjections(objections: CallObjection[]): CallObjection[] {
  const seen = new Set<string>();
  return objections.filter((o) => {
    const key = `${o.objectionType}::${o.clientQuote.toLowerCase().replace(/s+/g, " ").trim()}`;
    if (o.clientQuote.trim() && seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeSnippets(snippets: ExtractedSnippet[]): ExtractedSnippet[] {
  const seen = new Set<string>();
  return snippets.filter((s) => {
    const key = `${s.category}::${s.quote.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
