import {
  createCallSummaryLogger,
  previewText,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";
import type { MissedCallDraftsConfig } from "@/lib/missed-call-drafts/config";
import { buildMissedCallDraftPrompt, type MissedCallDraftPromptInput } from "@/lib/missed-call-drafts/prompts";

export type MissedCallDrafts = { sms: string; whatsapp: string };

export async function generateMissedCallDrafts(
  input: MissedCallDraftPromptInput,
  config: MissedCallDraftsConfig,
  log: CallSummaryLogger = createCallSummaryLogger(config.callSummary.debug)
): Promise<MissedCallDrafts> {
  const apiKey = config.callSummary.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const { system, user } = buildMissedCallDraftPrompt(input);

  log.step("Missed-call draft: OpenAI chat completion", {
    model: config.callSummary.openaiModel,
    language: input.language,
    lineOfBusiness: input.lineOfBusiness,
  });
  const t0 = Date.now();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.callSummary.openaiModel,
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const raw = await res.text();
  log.elapsed("Missed-call draft: OpenAI chat completion", t0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    throw new Error(`OpenAI chat failed (${res.status}): ${raw.slice(0, 500)}`);
  }

  let parsed: { choices?: { message?: { content?: string } }[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  let data: { sms?: unknown; whatsapp?: unknown };
  try {
    data = JSON.parse(content) as typeof data;
  } catch {
    throw new Error("OpenAI draft was not valid JSON");
  }

  const sms = typeof data.sms === "string" ? data.sms.trim() : "";
  const whatsapp = typeof data.whatsapp === "string" ? data.whatsapp.trim() : "";
  if (!sms || !whatsapp) throw new Error("OpenAI draft missing sms or whatsapp text");

  log.debug("Missed-call drafts generated", {
    smsPreview: previewText(sms, 100),
    whatsappPreview: previewText(whatsapp, 100),
  });

  return { sms, whatsapp };
}
