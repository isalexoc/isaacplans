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

const SYSTEM_PROMPT = `You are an assistant for an independent insurance agent (ACA, IUL, final expense, dental, hospital indemnity, short-term medical).
Summarize phone calls clearly for CRM contact notes. Be factual; do not invent products or commitments not in the transcript.
Output valid JSON only with keys: title (short, under 80 chars), body (markdown string with sections:
Summary, Client needs, Objections or concerns, Next steps as bullet checklist).
Write in the same language as the transcript (English or Spanish).`;

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

  const durationMin = Math.max(1, Math.round(input.callDurationSeconds / 60));
  const userContent = [
    `Direction: ${input.direction}`,
    `Duration: ~${durationMin} min`,
    `Call status: ${input.callStatus}`,
    input.dateAdded ? `Date: ${input.dateAdded}` : null,
    `Contact ID: ${input.contactId}`,
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
