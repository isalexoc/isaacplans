import { NextRequest, NextResponse } from "next/server";
import { getCallStudyConfig } from "@/lib/call-study/config";
import { verifyElevenLabsSignature } from "@/lib/call-study/webhook-signature";
import { computeMetrics, defaultSpeakerMap, wordsToTurns } from "@/lib/call-study/dialogue";
import { proposeSpeakerNames } from "@/lib/call-study/naming";
import {
  getRecordingByRequestId,
  saveTranscript,
  updateSpeakerMap,
} from "@/lib/call-study/store";
import type { ScribeTranscript } from "@/lib/call-study/types";

/**
 * ElevenLabs delivers a finished transcription here.
 *
 * This is what makes long files work at all: a two-hour recording cannot be transcribed inside a
 * single request, so the create call returns immediately and the result arrives here minutes later.
 * No ffmpeg, no chunking, no function timeout — the whole problem the Kixie pipeline solves with
 * segment splitting simply does not exist on this path.
 *
 * Public by necessity, and outside the Clerk matcher in `middleware.ts` like every other
 * `/api/webhooks/*` route. The HMAC is the only thing standing between this and the open internet,
 * so it is checked before anything else happens and there is no unsigned fallback.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Naming is one small model call, but a slow one should not cost us the delivery. */
export const maxDuration = 120;

type WebhookBody = {
  type?: string;
  data?: {
    request_id?: string;
    transcription_id?: string;
    transcription?: ScribeTranscript;
  };
};

export async function POST(request: NextRequest) {
  const config = getCallStudyConfig();
  if (!config.webhookSecret) {
    console.error("[CALL_STUDY] ELEVENLABS_WEBHOOK_SECRET is not set; rejecting webhook.");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rawBody = await request.text();
  const signed = verifyElevenLabsSignature({
    rawBody,
    header: request.headers.get("elevenlabs-signature"),
    secret: config.webhookSecret,
  });
  if (!signed) {
    console.warn("[CALL_STUDY] Webhook signature rejected.");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const requestId = body.data?.request_id || body.data?.transcription_id;
    const transcript = body.data?.transcription;
    if (!requestId) {
      return NextResponse.json({ ok: true, ignored: "no request id" });
    }

    const recording = await getRecordingByRequestId(requestId);
    // 200 on an unknown id: ElevenLabs has nothing useful to do with a 404, and retrying a delivery
    // for a recording we deleted would just repeat forever.
    if (!recording) return NextResponse.json({ ok: true, ignored: "unknown recording" });

    const turns = wordsToTurns(transcript?.words);
    if (turns.length === 0) {
      return NextResponse.json({ ok: true, ignored: "empty transcript" });
    }

    const seeded = defaultSpeakerMap(turns);
    const landed = await saveTranscript(recording.id, {
      turns,
      speakerMap: seeded,
      metrics: computeMetrics(turns),
      languageCode: transcript?.language_code ?? null,
      durationSeconds: transcript?.audio_duration_secs
        ? Math.round(transcript.audio_duration_secs)
        : recording.durationSeconds,
    });

    // A duplicate delivery finds the row already out of `transcribing` and writes nothing. Stopping
    // here also avoids paying for a second naming call on a transcript that already has names.
    if (!landed) return NextResponse.json({ ok: true, duplicate: true });

    // Best-effort, and deliberately after the transcript is already durable: if naming fails the
    // agent still has a complete dialogue labelled Agent/Client.
    try {
      const named = await proposeSpeakerNames(turns, seeded);
      await updateSpeakerMap(recording.id, named);
    } catch (error) {
      console.warn("[CALL_STUDY] Speaker naming failed:", error);
    }

    return NextResponse.json({ ok: true, turns: turns.length });
  } catch (error) {
    // A 500 makes ElevenLabs retry, which is what we want for a transient database failure.
    console.error("[CALL_STUDY] Webhook handling failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
