/**
 * Turning a finished Scribe transcript into a stored, named, queued-for-analysis call.
 *
 * There are three ways a transcript can reach us — the webhook, the delayed poll, and the daily
 * reconcile — and they must all do exactly the same thing with it. They used not to: the reconcile
 * path skipped the speaker-naming pass entirely, so a call recovered that way came back labelled
 * "Agent" and "Client" while the same call delivered by webhook came back as "Will" and "Dennis".
 *
 * Server-only.
 */

import "server-only";
import { computeMetrics, defaultSpeakerMap, wordsToTurns } from "./dialogue";
import { proposeSpeakerNames } from "./naming";
import { publishJob } from "@/lib/qstash/client";
import { saveTranscript, updateSpeakerMap } from "./store";
import type { ScribeTranscript } from "./types";

export type IngestResult = {
  /** False when another path had already stored this transcript, or it was empty. */
  landed: boolean;
  turns: number;
  reason?: string;
};

export async function ingestTranscript(input: {
  recordingId: string;
  transcript: ScribeTranscript | null | undefined;
  /** Used when the transcript itself does not report a duration. */
  fallbackDurationSeconds: number | null;
  requestOrigin?: string;
}): Promise<IngestResult> {
  const turns = wordsToTurns(input.transcript?.words);
  if (turns.length === 0) return { landed: false, turns: 0, reason: "empty transcript" };

  const seeded = defaultSpeakerMap(turns);
  const landed = await saveTranscript(input.recordingId, {
    turns,
    speakerMap: seeded,
    metrics: computeMetrics(turns),
    languageCode: input.transcript?.language_code ?? null,
    durationSeconds: input.transcript?.audio_duration_secs
      ? Math.round(input.transcript.audio_duration_secs)
      : input.fallbackDurationSeconds,
  });

  // Guarded on the row still being "transcribing", so whichever path gets there first wins and the
  // others are no-ops. That is what makes the webhook and the poll safe to race.
  if (!landed) return { landed: false, turns: turns.length, reason: "already stored" };

  // Best-effort and deliberately after the transcript is durable: if naming fails the agent still
  // has a complete dialogue labelled Agent/Client.
  try {
    const named = await proposeSpeakerNames(turns, seeded);
    await updateSpeakerMap(input.recordingId, named);
  } catch (error) {
    console.warn("[CALL_STUDY] Speaker naming failed:", error);
  }

  // Queued rather than run inline: analysing a long call is several model calls and would blow the
  // caller's time budget wherever it was called from.
  const queued = await publishJob({
    path: "/api/queue/call-study-analyze",
    body: { recordingId: input.recordingId },
    requestOrigin: input.requestOrigin,
  });
  if (!queued) {
    console.warn("[CALL_STUDY] Analysis not queued for", input.recordingId, "- QStash unavailable");
  }

  return { landed: true, turns: turns.length };
}
