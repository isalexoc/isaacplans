import "server-only";
import { startTranscription } from "@/lib/call-study/scribe";
import type { ScribeWord } from "@/lib/call-study/types";
import { wordsToText } from "./aroll-words";
import type { SocialLocale } from "./types";

// ─── Transcribing the recorded clip ───────────────────────────────────────────────
// Reuses Call Study's ElevenLabs Scribe client. Scribe fetches the audio URL itself, so no
// bytes pass through this server, and it returns per-word timestamps — which is the whole
// reason it is used here rather than Whisper: the cutaway director needs to know WHEN each
// word was said, not just what was said.

export type ArollTranscript = {
  words:       ScribeWord[];
  text:        string;
  language:    SocialLocale;
  durationSec: number | null;
};

/**
 * Transcribe Isaac's clip.
 *
 * Synchronous — no webhook. A clip is capped at MAX_AROLL_SEC (3 minutes) and Scribe answers a
 * file that size in seconds, comfortably inside the worker's 200s budget, so the webhook
 * plumbing Call Study needs for hour-long calls would be pure overhead here.
 *
 * Redaction is OFF and so is diarization. Redaction exists to keep a client's SSN out of a
 * transcript of a sales call; this is a piece to camera Isaac intends to publish, and a
 * `{SSN_0}` token dropped into an ad's captions would be a bug. Diarization has nothing to
 * separate — there is one speaker — and only adds a way to be wrong.
 */
export async function transcribeAroll(
  audioUrl: string
): Promise<{ ok: true; data: ArollTranscript } | { ok: false; error: string }> {
  const res = await startTranscription({
    sourceUrl:      audioUrl,
    numSpeakers:    1,
    diarize:        false,
    redactEntities: false,
    webhook:        false,
  });
  if (!res.ok) return res;

  const transcript = res.data.transcript;
  const words = (transcript?.words ?? []).filter((w) => w.type !== "audio_event");
  const text = (transcript?.text ?? wordsToText(words)).trim();

  if (!text) {
    return {
      ok: false,
      error:
        "The transcription came back empty. Check that the video actually has an audio track, and that you are speaking in it.",
    };
  }

  return {
    ok: true,
    data: {
      words,
      text,
      // Scribe reports "eng"/"spa" (ISO 639-3) or "en"/"es" depending on the model. Anything
      // that is not recognisably Spanish is treated as English, which matches how the rest of
      // the studio defaults.
      language:    /^(es|spa)/i.test(transcript?.language_code ?? "") ? "es" : "en",
      durationSec: transcript?.audio_duration_secs ?? null,
    },
  };
}
