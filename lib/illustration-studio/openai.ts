/**
 * One structured-output chat completion for the Illustration Studio.
 *
 * Same raw-fetch shape as `lib/call-study/openai.ts`, but with `response_format: json_schema` and
 * `strict: true` instead of `json_object`: the extraction is deeply nested (ledger rows, riders,
 * benefit examples), and strict mode guarantees the shape so a missing key can't silently empty a
 * column. The SDK's `zodResponseFormat` helper can't be used — it requires zod v4 and the repo
 * pins 3.24.1 — so the schema is written by hand in ./extract.ts.
 *
 * Deliberately not `server-only`: `scripts/test-illustration-studio.ts` runs the live extraction.
 * It only ever reads the key from `process.env`, which is empty in a browser bundle.
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const LOG = "[ILLUSTRATION_STUDIO]";

export type ChatSchemaResult<T> =
  | { ok: true; data: T; model: string; promptTokens: number | null; completionTokens: number | null }
  | { ok: false; error: string };

/** An override for this tool alone, so trying a stronger model doesn't touch call summaries. */
export function illustrationModel(): string {
  return (
    process.env.ILLUSTRATION_STUDIO_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o"
  );
}

/** Reasoning models (gpt-5, o-series) reject a custom temperature. */
function acceptsTemperature(model: string): boolean {
  return /^gpt-4/i.test(model);
}

interface ChatCompletionBody {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export async function chatJsonSchema<T>(params: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}): Promise<ChatSchemaResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY is not set." };
  const model = illustrationModel();

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        ...(acceptsTemperature(model) ? { temperature: 0 } : {}),
        max_completion_tokens: params.maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: params.schemaName, strict: true, schema: params.schema },
        },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      // The body echoes OpenAI's error, never the prompt, so it is safe to log.
      console.error(`${LOG} OpenAI failed (${res.status}): ${raw.slice(0, 300)}`);
      return { ok: false, error: `The AI service failed (${res.status}). Try again in a minute.` };
    }

    const parsed = JSON.parse(raw) as ChatCompletionBody;
    const choice = parsed.choices?.[0];
    if (choice?.message?.refusal) {
      return { ok: false, error: "The AI declined to read this document." };
    }
    if (choice?.finish_reason === "length") {
      console.warn(`${LOG} OpenAI hit max_completion_tokens (${params.maxTokens}); output truncated.`);
      return { ok: false, error: "The illustration was too long to read in one pass." };
    }
    const content = choice?.message?.content;
    if (!content) return { ok: false, error: "The AI returned an empty answer." };

    return {
      ok: true,
      data: JSON.parse(content) as T,
      model,
      promptTokens: parsed.usage?.prompt_tokens ?? null,
      completionTokens: parsed.usage?.completion_tokens ?? null,
    };
  } catch (error) {
    console.error(`${LOG} OpenAI call threw:`, error);
    return { ok: false, error: "Couldn't reach the AI service. Try again in a minute." };
  }
}
