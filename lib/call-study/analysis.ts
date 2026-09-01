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
import { renderDialogue, windowTurns } from "./dialogue";
import { chatJson } from "./openai";
import type {
  CallAnalysis,
  CallObjection,
  CallPhase,
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

const PHASES = ["opening", "discovery", "presentation", "objection", "close", "wrap"] as const;

const SYSTEM_PROMPT = `You analyse recorded insurance sales calls so an agent can build a better script.

You will be given a call transcript as a dialogue. Turns are numbered.

Return JSON with exactly this shape:
{
  "summary": "2-3 sentences on what happened and how it went",
  "phases": [{ "phase": "opening|discovery|presentation|objection|close|wrap", "startTurn": 0, "endTurn": 12, "note": "short" }],
  "objections": [{ "objection": "short label", "objectionType": "price|spouse|trust|timing|already_covered|health|thinking_about_it|other", "clientQuote": "verbatim", "agentResponse": "verbatim", "resolved": true|false|null }],
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
- Turn numbers refer to the numbers shown in the transcript.
- Redaction markers like {SSN_0} are removed sensitive data. Never treat them as content and never quote them.
- If a section has nothing worth recording, return an empty array. Do not pad.`;

type RawAnalysis = CallAnalysis & {
  snippets?: (Omit<ExtractedSnippet, "startSec"> & { startTurn?: number })[];
};

export type AnalysisResult =
  | { ok: true; analysis: CallAnalysis; snippets: ExtractedSnippet[] }
  | { ok: false; error: string };

/**
 * Render the dialogue with turn numbers so the model can point back into it.
 *
 * `offset` keeps numbering continuous across windows — without it, every window would restart at
 * zero and a phase in the third window would claim to begin at turn 0.
 */
function numberedDialogue(turns: readonly Turn[], speakerMap: SpeakerMap | null, offset: number): string {
  const lines = renderDialogue(turns, speakerMap).split("\n");
  return lines.map((line, i) => `[${offset + i}] ${line}`).join("\n");
}

export async function analyzeCall(
  turns: readonly Turn[],
  speakerMap: SpeakerMap | null
): Promise<AnalysisResult> {
  if (turns.length === 0) return { ok: false, error: "This call has no transcript to analyse." };

  const windows = windowTurns(turns, WINDOW_CHARS);
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

  let offset = 0;
  const summaries: string[] = [];

  for (const window of windows) {
    const body = numberedDialogue(window, speakerMap, offset);
    const context =
      windows.length > 1
        ? `This is part ${windows.indexOf(window) + 1} of ${windows.length} of a long call. Turn numbers are absolute.\n\n`
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
      offset += window.length;
      continue;
    }

    const data = result.data;
    if (typeof data.summary === "string" && data.summary.trim()) summaries.push(data.summary.trim());
    merged.phases.push(...sanitizePhases(data.phases, turns.length));
    merged.objections.push(...sanitizeObjections(data.objections));
    merged.discoveryQuestions.push(...strings(data.discoveryQuestions));
    merged.closeLanguage.push(...strings(data.closeLanguage));
    merged.strengths.push(...strings(data.strengths));
    merged.improvements.push(...strings(data.improvements));
    snippets.push(...sanitizeSnippets(data.snippets, turns));

    offset += window.length;
  }

  merged.summary = summaries.join(" ");
  // A long call analysed in windows repeats itself at the seams, where the overlap is deliberate.
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

function sanitizeObjections(value: unknown): CallObjection[] {
  if (!Array.isArray(value)) return [];
  const out: CallObjection[] = [];
  for (const raw of value) {
    const objection = typeof raw?.objection === "string" ? raw.objection.trim() : "";
    if (!objection) continue;
    out.push({
      objection,
      objectionType: typeof raw?.objectionType === "string" ? raw.objectionType.trim() : "other",
      clientQuote: typeof raw?.clientQuote === "string" ? raw.clientQuote.trim() : "",
      agentResponse: typeof raw?.agentResponse === "string" ? raw.agentResponse.trim() : "",
      resolved: raw?.resolved === true ? true : raw?.resolved === false ? false : null,
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

function dedupeSnippets(snippets: ExtractedSnippet[]): ExtractedSnippet[] {
  const seen = new Set<string>();
  return snippets.filter((s) => {
    const key = `${s.category}::${s.quote.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
