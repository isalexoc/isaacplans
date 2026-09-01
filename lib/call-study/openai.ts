/**
 * One small wrapper for the JSON-mode chat completions this feature makes.
 *
 * Mirrors the request shape already working in `lib/openai-call-summary.ts` — same endpoint, same
 * `response_format: json_object`, same low temperature — rather than reaching into that module,
 * whose signature is bound up with call-summary config and logging that mean nothing here.
 *
 * Server-only (API key).
 */

import "server-only";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const LOG = "[CALL_STUDY]";

export type ChatJsonResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function chatJson<T>(params: {
  system: string;
  user: string;
  /** Analysis output can be long; naming output is tiny. */
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatJsonResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY is not set." };
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        // Low but not zero: extraction, not invention, with enough slack to phrase a "why" note.
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error(`${LOG} OpenAI failed (${res.status}): ${raw.slice(0, 300)}`);
      return { ok: false, error: `OpenAI failed (${res.status}).` };
    }

    const parsed = JSON.parse(raw) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = parsed.choices?.[0];
    const content = choice?.message?.content;
    if (!content) return { ok: false, error: "OpenAI returned empty content." };
    if (choice.finish_reason === "length") {
      // Truncated JSON will not parse, so this becomes a clear error below rather than a silently
      // half-empty analysis — but say so, because the fix is a bigger budget, not a retry.
      console.warn(`${LOG} OpenAI hit max_tokens; output was truncated.`);
    }

    return { ok: true, data: JSON.parse(content) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`${LOG} OpenAI call threw:`, error);
    return { ok: false, error: message };
  }
}
