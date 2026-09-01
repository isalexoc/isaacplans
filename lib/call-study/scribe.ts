/**
 * ElevenLabs Scribe client.
 *
 * Unlike most integration clients in this repo, this one does **not** quietly return null on
 * failure. Transcription is the single thing this feature does, it costs money per call, and one of
 * its parameters controls whether a Social Security number ends up in a plain text file — so every
 * failure comes back with the API's own message attached and is surfaced to the agent.
 *
 * Server-only (API key).
 */

import "server-only";
import {
  getCallStudyConfig,
  REDACTED_ENTITY_TYPES,
  type CallStudyConfig,
} from "./config";
import type { ScribeTranscript } from "./types";

const LOG = "[CALL_STUDY]";
const API_BASE = "https://api.elevenlabs.io/v1";

export type ScribeResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  console.error(`${LOG} ${message}`);
  return { ok: false, error: message };
}

export type StartTranscriptionInput = {
  /** Publicly reachable URL. ElevenLabs fetches it directly, so no bytes pass through Vercel. */
  sourceUrl: string;
  /** Cap the diarizer. Two is right for a phone call and materially improves separation. */
  numSpeakers?: number;
  /** ISO code. Omit to auto-detect, which is right when calls are a mix of English and Spanish. */
  languageCode?: string;
  /** Async delivery. Required for anything long — a two-hour file will not answer in one request. */
  webhook?: boolean;
  config?: CallStudyConfig;
};

/**
 * Kick off a transcription.
 *
 * **On redaction.** `entity_redaction` is validated server-side by ElevenLabs — an unknown entity
 * type returns 422 with the offending value named. That is the guarantee this feature leans on:
 * because a bad list cannot succeed, a 200 means the redaction policy was applied as asked. What it
 * must never do is swallow that 422 and hand back a transcript that merely looks clean, which is
 * why this function has no fallback path and no catch that returns success.
 */
export async function startTranscription(
  input: StartTranscriptionInput
): Promise<ScribeResult<{ requestId: string; transcript: ScribeTranscript | null }>> {
  const config = input.config ?? getCallStudyConfig();
  if (!config.apiKey) return fail("ELEVENLABS_API_KEY is not set.");
  if (!input.sourceUrl) return fail("No audio URL to transcribe.");

  const entities = REDACTED_ENTITY_TYPES.join(",");
  const form = new FormData();
  form.append("model_id", config.model);
  form.append("source_url", input.sourceUrl);
  form.append("diarize", "true");
  // Labels every word "agent" or "customer" instead of "speaker_0" — the difference between a
  // transcript that reads like a conversation on arrival and one that needs interpreting.
  form.append("detect_speaker_roles", "true");
  form.append("entity_detection", entities);
  form.append("entity_redaction", entities);
  if (input.numSpeakers) form.append("num_speakers", String(input.numSpeakers));
  if (input.languageCode) form.append("language_code", input.languageCode);
  if (input.webhook) form.append("webhook", "true");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": config.apiKey },
      body: form,
    });
  } catch (error) {
    return fail(`Could not reach ElevenLabs: ${error instanceof Error ? error.message : "network error"}`);
  }

  const text = await res.text();
  if (!res.ok) {
    return fail(`Transcription rejected (${res.status}): ${extractApiMessage(text)}`);
  }

  let body: (ScribeTranscript & { request_id?: string }) | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("ElevenLabs returned a response that was not JSON.");
  }

  const requestId = body?.request_id || body?.transcription_id;
  if (!requestId) {
    return fail("ElevenLabs accepted the audio but returned no request id to track it by.");
  }

  return {
    ok: true,
    // Synchronous calls come back with the transcript attached; async ones do not, and it arrives
    // at the webhook instead.
    data: { requestId, transcript: input.webhook ? null : (body as ScribeTranscript) },
  };
}

/**
 * Fetch a transcript by id — the reconcile backstop for when a webhook never arrives.
 */
export async function fetchTranscript(
  transcriptionId: string,
  config: CallStudyConfig = getCallStudyConfig()
): Promise<ScribeResult<ScribeTranscript>> {
  if (!config.apiKey) return fail("ELEVENLABS_API_KEY is not set.");

  try {
    const res = await fetch(
      `${API_BASE}/speech-to-text/transcripts/${encodeURIComponent(transcriptionId)}`,
      { headers: { "xi-api-key": config.apiKey }, cache: "no-store" }
    );
    const text = await res.text();
    if (!res.ok) {
      return fail(`Could not fetch transcript ${transcriptionId} (${res.status}): ${extractApiMessage(text)}`);
    }
    return { ok: true, data: JSON.parse(text) as ScribeTranscript };
  } catch (error) {
    return fail(`Could not fetch transcript: ${error instanceof Error ? error.message : "network error"}`);
  }
}

/**
 * Pull the human-readable part out of an ElevenLabs error body.
 *
 * Their validation errors are genuinely useful — an invalid entity type comes back with the full
 * list of valid ones — so the message is worth surfacing to the agent rather than flattening to
 * "request failed".
 */
function extractApiMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    /* not JSON — fall through to the raw text */
  }
  return body.slice(0, 300);
}
