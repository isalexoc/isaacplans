/**
 * Giving the speakers their real names.
 *
 * Scribe labels turns `agent` and `customer`, which is accurate but reads like a system log. What
 * Isaac asked for is "Will:" and "Dennis:" — and on a sales call the names are almost always right
 * there in the first thirty seconds, because that is how phone calls open.
 *
 * Best-effort by design: this runs after a transcript has already been saved, and a failure leaves
 * the perfectly usable Agent/Client labels in place. Names are never invented — the prompt is
 * explicit that an absent name stays absent, since a confidently wrong name in a transcript is
 * worse than an honest generic one.
 *
 * Server-only.
 */

import "server-only";
import { renderDialogue } from "./dialogue";
import { chatJson } from "./openai";
import type { SpeakerMap, SpeakerRole, Turn } from "./types";

/**
 * How much of the call to show the model.
 *
 * Introductions happen at the start. Sending an hour of dialogue to learn two names would cost real
 * money per call and add nothing — by turn thirty, if nobody has said a name, nobody is going to.
 */
const INTRO_TURNS = 30;
const MAX_INTRO_CHARS = 6000;

type NamingResponse = {
  speakers?: { id?: string; name?: string | null; role?: string | null }[];
};

const SYSTEM_PROMPT = `You identify the real names of speakers in a sales call transcript.

You are given the opening of a call. Each line is prefixed with a speaker id.

Return JSON: { "speakers": [ { "id": "<the speaker id exactly as given>", "name": "<first name or null>", "role": "agent" | "client" | "other" } ] }

Rules:
- Use ONLY names actually spoken in the transcript. Someone saying "this is Will" names that speaker Will; someone saying "am I speaking with Dennis?" names the OTHER speaker Dennis.
- If a speaker's name is never said, return null for name. Never guess, never invent, never use a placeholder.
- Use the first name alone unless two speakers share it.
- The agent is the person selling; the client is the person being sold to.
- Redaction markers like {NAME_0} are not names. Return null if that is all you have.
- Include an entry for every speaker id you were given, and no others.`;

/**
 * Propose names for each speaker id from the opening of the call.
 *
 * Returns a map that merges over the existing one, so a speaker the model had nothing to say about
 * keeps whatever label it already had.
 */
export async function proposeSpeakerNames(
  turns: readonly Turn[],
  current: SpeakerMap
): Promise<SpeakerMap> {
  if (turns.length === 0) return current;

  // Raw ids, not display names: the model must echo back something we can key on, and showing it
  // "Agent:" would invite it to answer with "Agent".
  const intro = turns.slice(0, INTRO_TURNS);
  const dialogue = renderDialogue(intro).slice(0, MAX_INTRO_CHARS);
  const ids = [...new Set(turns.map((t) => t.speaker))];

  const result = await chatJson<NamingResponse>({
    system: SYSTEM_PROMPT,
    user: `Speaker ids in this call: ${ids.join(", ")}\n\nOpening of the call:\n\n${dialogue}`,
    maxTokens: 400,
  });

  if (!result.ok) {
    console.warn("[CALL_STUDY] Speaker naming failed, keeping default labels:", result.error);
    return current;
  }

  const next: SpeakerMap = { ...current };
  for (const speaker of result.data.speakers ?? []) {
    const id = typeof speaker.id === "string" ? speaker.id : null;
    if (!id || !next[id]) continue; // ignore ids the model made up

    const name = cleanName(speaker.name);
    const role = cleanRole(speaker.role) ?? next[id].role;
    next[id] = { name: name ?? next[id].name, role };
  }
  return next;
}

/**
 * Accept a plausible first name and nothing else.
 *
 * The guards matter more than they look: a model that answers "Unknown", "Agent" or "{NAME_0}"
 * would otherwise write that string into the transcript as though it were a person.
 */
function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name) return null;
  if (name.length > 40) return null;
  if (name.includes("{") || name.includes("}")) return null;
  const lowered = name.toLowerCase();
  if (["unknown", "null", "none", "n/a", "agent", "client", "customer", "speaker"].includes(lowered)) {
    return null;
  }
  return name;
}

function cleanRole(value: unknown): SpeakerRole | null {
  if (value === "agent" || value === "client" || value === "other") return value;
  return null;
}
