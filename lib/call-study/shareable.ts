/**
 * Building a copy of a call that can be handed to another agent.
 *
 * Two artefacts come out of one pass, from one set of detected spans, so the audio and the text can
 * never disagree about what was removed:
 *   - an mp3 with the sensitive moments replaced by a tone, uploaded as a SECOND Cloudinary asset;
 *   - the stored transcript, scrubbed so the reader stops showing digits the audio no longer has.
 *
 * The original recording is never touched. It is the agent's own copy of the call and may be the
 * only one; this adds a shareable rendering beside it.
 *
 * **The word stream is re-fetched from ElevenLabs rather than stored.** It is several megabytes per
 * call and only needed at this moment, and `elevenTranscriptionId` is exactly the key that fetches
 * it. Calls recorded before that column existed cannot be processed and say so.
 *
 * Server-only.
 */

import "server-only";
import { nanoid } from "nanoid";
import cloudinary from "@/config/cloudinary";
import { cloudinaryAudioUrl } from "./cloudinary";
import { wordsToTurns } from "./dialogue";
import { redactAudio } from "./audio-redact";
import {
  collapseMarkers,
  findSensitiveSpans,
  findUnmaskedRuns,
  maskedSeconds,
  maskWords,
  type SensitiveSpan,
} from "./sensitive";
import { fetchTranscript } from "./scribe";
import {
  getRecording,
  saveShareableAudio,
  saveScrubbedTurns,
  setShareableStatus,
} from "./store";

export type ShareableResult =
  | {
      ok: true;
      spans: number;
      maskedSeconds: number;
      unmaskedRuns: number;
      scrubbedTurns: number;
    }
  | { ok: false; error: string };

/** Where the beeped copies live. Separate folder so they can be audited or purged as a set. */
const SHAREABLE_FOLDER = "call-study/shareable";

export async function buildShareableCopy(recordingId: string): Promise<ShareableResult> {
  const row = await getRecording(recordingId);
  if (!row) return { ok: false, error: "Not found" };
  if (!row.cloudinaryPublicId) {
    return { ok: false, error: "This call has no stored recording to redact." };
  }
  if (!row.elevenTranscriptionId) {
    return {
      ok: false,
      error:
        "This call was transcribed before the transcript id was stored, so the word timings needed to place the beeps cannot be fetched. Upload the recording again to enable sharing.",
    };
  }

  await setShareableStatus(recordingId, "building");

  try {
    // Word-level timings are the whole basis for placing a beep; turn-level timings would mute
    // thirty seconds of conversation to hide four digits.
    const fetched = await fetchTranscript(row.elevenTranscriptionId);
    if (!fetched.ok) {
      await setShareableStatus(recordingId, "failed", fetched.error);
      return { ok: false, error: fetched.error };
    }

    const words = fetched.data.words ?? [];
    const spans = findSensitiveSpans(words);
    const unmasked = findUnmaskedRuns(words, spans);

    const sourceUrl = cloudinaryAudioUrl(row.cloudinaryPublicId);
    if (!sourceUrl) {
      const error = "Could not build the audio URL for this recording.";
      await setShareableStatus(recordingId, "failed", error);
      return { ok: false, error };
    }

    const duration =
      fetched.data.audio_duration_secs ?? row.durationSeconds ?? estimateDuration(spans);

    const audio = await redactAudio({ sourceUrl, spans, durationSeconds: duration });
    if (!audio.ok) {
      await setShareableStatus(recordingId, "failed", audio.error);
      return { ok: false, error: audio.error };
    }

    // `authenticated` so the beeped copy is not itself sitting on a guessable public URL — it is
    // less sensitive than the original, not harmless.
    const uploaded = await uploadShareable(audio.buffer, recordingId);

    // The transcript is scrubbed from the SAME spans, so what the reader shows and what the audio
    // contains cannot drift apart.
    const scrubbedTurns = scrubTurns(words, spans);

    await saveShareableAudio(recordingId, {
      shareableAudioId: uploaded,
      redactionSpans: spans,
      unmaskedRuns: unmasked,
    });
    if (scrubbedTurns.length > 0) {
      await saveScrubbedTurns(recordingId, scrubbedTurns);
    }

    return {
      ok: true,
      spans: spans.length,
      maskedSeconds: Math.round(maskedSeconds(spans) * 10) / 10,
      unmaskedRuns: unmasked.length,
      scrubbedTurns: scrubbedTurns.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await setShareableStatus(recordingId, "failed", message);
    return { ok: false, error: message };
  }
}

function estimateDuration(spans: readonly SensitiveSpan[]): number {
  return spans.reduce((max, span) => Math.max(max, span.end), 0) + 60;
}

async function uploadShareable(buffer: Buffer, recordingId: string): Promise<string> {
  const result = await new Promise<{ public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${SHAREABLE_FOLDER}/${recordingId}`,
        public_id: nanoid(),
        // Audio uploads to Cloudinary as resource_type "video". That is correct, not a bug.
        resource_type: "video",
        type: "authenticated",
        overwrite: false,
      },
      (error, uploaded) => {
        if (error || !uploaded?.public_id) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(uploaded as { public_id: string });
      }
    );
    stream.end(buffer);
  });
  return result.public_id;
}

/**
 * Re-derive the stored turns from masked words.
 *
 * Safe to do only because `maskWords` replaces in place and removes nothing, so the speaker
 * sequence — and therefore the turn count and every index the stored analysis holds into it — comes
 * out identical. Pinned by a test.
 */
function scrubTurns(
  words: Parameters<typeof maskWords>[0],
  spans: readonly SensitiveSpan[]
): ReturnType<typeof wordsToTurns> {
  if (spans.length === 0) return [];
  const turns = wordsToTurns(maskWords(words, spans));
  return turns.map((turn) => ({ ...turn, text: collapseMarkers(turn.text) }));
}
