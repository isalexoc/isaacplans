import type { CallSummaryConfig } from "@/lib/agent-crm-call-summary-config";
import {
  createCallSummaryLogger,
  previewText,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

export type CallSummaryInput = {
  transcript: string;
  direction: string;
  callDurationSeconds: number;
  callStatus: string;
  contactId: string;
  dateAdded?: string;
};

export type CallSummaryResult = {
  title: string;
  body: string;
};

const SYSTEM_PROMPT = `You are an elite sales coach and CRM assistant for Isaac, an independent insurance agent whose PRIMARY focus is final expense (burial/funeral) life insurance. This is his dedicated work phone: every call is business-related (final expense, ACA/Marketplace, IUL, dental, hospital indemnity, STM, renewals, carriers, referrals, or operational calls).

RULES
- Be factual. Never invent products, prices, underwriting decisions, or commitments not stated in the transcript.
- Output valid JSON only: { "title": string, "body": string }.
- LANGUAGE (critical): Detect the dominant language of the transcript.
  - If the call is mainly in Spanish → write the ENTIRE title and body in Spanish (section headings, bullets, coaching — everything).
  - If mainly in English → write everything in English.
  - If clearly mixed, use the language the CLIENT spoke most; do not default to English.
- FORMATTING: Use Markdown in body. Put **double asterisks** around every important fact, e.g. **María López**, **DOB 03/15/1948**, **$8,000 face**, **diabetes**, **Social Security $1,200/mo**, **callback Tuesday 2pm**, **beneficiary: son Carlos**, phone numbers, emails, addresses, policy numbers, premium amounts, health conditions, medications, smoker status, and appointment times.
- Identify the call type from context (final expense, ACA, IUL, renewal, carrier, personal/work admin, etc.).

BODY STRUCTURE (use these section headings in the call's language):

English example headings:
## Summary
## Key facts
## Client needs
## Objections or concerns
## Next steps
## Coaching

Spanish example headings:
## Resumen
## Datos importantes
## Necesidades del cliente
## Objeciones o preocupaciones
## Próximos pasos
## Coaching

Section guidance:
- **Summary**: 2–4 sentences on what happened and outcome.
- **Key facts**: Bullet list of concrete details from the call; bold all PII and numbers.
- **Client needs / Necesidades**: What they want, budget, coverage goals, timeline.
- **Objections**: Stated hesitations (price, trust, health, "need to think", spouse, etc.).
- **Next steps**: Checkbox-style bullets (- [ ]) for agent follow-ups with dates when mentioned.
- **Coaching**: Actionable coaching for Isaac (2–5 bullets or short paragraphs):
  - For **final expense** calls: coach like a top FE producer — discovery depth, health/underwriting questions missed or done well, face amount vs budget, carrier fit, beneficiary clarity, trial close, appointment setting, referral ask, compliance (no guaranteeing approval), and what to do on the next touch.
  - For **other insurance** calls (ACA, IUL, etc.): professional insurance sales coaching — rapport, qualification, compliance, urgency, and next-touch plan.
  - For **non-sales** work calls: brief coaching on efficiency, documentation, or follow-up only if useful; keep it short.

Title: short (under 80 chars), in the call's language, specific to topic (e.g. "FE — cotización $10k" or "ACA renewal — missing documents").`;

function truncateTranscript(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Transcript truncated for length]`;
}

export async function summarizeCallTranscript(
  input: CallSummaryInput,
  config: CallSummaryConfig,
  log: CallSummaryLogger = createCallSummaryLogger(config.debug)
): Promise<CallSummaryResult> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const transcript = truncateTranscript(input.transcript.trim(), config.maxTranscriptChars);
  if (!transcript) throw new Error("Empty transcript");

  log.step("OpenAI chat completion", {
    model: config.openaiModel,
    contactId: input.contactId,
    transcript: previewText(transcript, 200),
  });
  const t0 = Date.now();

  const durationLine =
    input.callDurationSeconds > 0
      ? `Duration: ~${Math.round(input.callDurationSeconds / 60)} min`
      : null;
  const statusLine = input.callStatus ? `Call status: ${input.callStatus}` : null;
  const userContent = [
    `Direction: ${input.direction}`,
    durationLine,
    statusLine,
    input.dateAdded ? `Date: ${input.dateAdded}` : null,
    `Contact ID: ${input.contactId}`,
    "",
    "Instructions:",
    "- Summarize this work call for CRM.",
    "- Match the transcript language exactly (Spanish call → all Spanish output; English → all English).",
    "- Bold (**...**) all names, dates, amounts, health info, and follow-up times in Key facts / Datos importantes.",
    "- Include the Coaching section; prioritize final expense coaching when this is an FE call.",
    "",
    "Transcript:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  const raw = await res.text();
  log.elapsed("OpenAI chat completion", t0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    log.error("OpenAI chat failed", { status: res.status, bodyPreview: raw.slice(0, 300) });
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

  let data: { title?: string; body?: string };
  try {
    data = JSON.parse(content) as { title?: string; body?: string };
  } catch {
    throw new Error("OpenAI summary was not valid JSON");
  }

  const title = (data.title || "Call summary").trim().slice(0, 120);
  const body = (data.body || content).trim();
  if (!body) throw new Error("OpenAI returned empty summary body");

  log.debug("OpenAI summary parsed", {
    title,
    bodyLength: body.length,
    bodyPreview: previewText(body, 150),
  });

  return { title, body };
}

export async function transcribeRecordingWithWhisper(
  recordingUrl: string,
  config: CallSummaryConfig,
  log: CallSummaryLogger = createCallSummaryLogger(config.debug)
): Promise<string> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  log.step("Whisper: download recording", {
    urlLength: recordingUrl.length,
    urlHost: (() => {
      try {
        return new URL(recordingUrl).host;
      } catch {
        return "invalid-url";
      }
    })(),
  });
  const downloadT0 = Date.now();
  const audioRes = await fetch(recordingUrl);
  if (!audioRes.ok) {
    log.error("Recording download failed", { status: audioRes.status });
    throw new Error(`Failed to download recording (${audioRes.status})`);
  }

  const buffer = await audioRes.arrayBuffer();
  log.elapsed("Whisper: recording downloaded", downloadT0, {
    bytes: buffer.byteLength,
    contentType: audioRes.headers.get("content-type"),
  });
  const contentType = audioRes.headers.get("content-type") || "audio/mpeg";
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("mp4") || contentType.includes("m4a")
      ? "m4a"
      : "mp3";

  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  form.append("file", blob, `recording.${ext}`);
  form.append("model", config.whisperModel);
  form.append("response_format", "text");

  log.step("Whisper: transcribe", { model: config.whisperModel, ext });
  const whisperT0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await res.text();
  log.elapsed("Whisper: transcribe", whisperT0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    log.error("Whisper failed", { status: res.status, bodyPreview: text.slice(0, 300) });
    throw new Error(`Whisper failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const trimmed = text.trim();
  log.debug("Whisper transcript", previewText(trimmed, 200));
  return trimmed;
}
