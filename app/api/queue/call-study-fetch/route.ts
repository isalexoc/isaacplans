import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { publishJob } from "@/lib/qstash/client";
import { fetchTranscript } from "@/lib/call-study/scribe";
import { ingestTranscript } from "@/lib/call-study/ingest";
import { getRecording, setStatus } from "@/lib/call-study/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Collect a finished transcript by asking for it, rather than waiting to be handed one.
 *
 * **Why this exists at all.** ElevenLabs delivers the whole transcript in the webhook POST body,
 * and a two-hour call is around 3.8 MB of word objects. That is at Vercel's serverless request-body
 * limit, so the delivery is rejected with a 413 the function never sees — and the account has
 * `retry_enabled: false`, so one rejection loses it for good. Observed on a real 113-minute call:
 * transcribed perfectly, twice, and stuck on "transcribing" both times because neither delivery
 * could land. Short calls are unaffected, which is exactly why it looked like it worked.
 *
 * So the webhook stays as the fast path for calls small enough to deliver, and this is the path
 * that always works. They race, and `saveTranscript` is guarded on the row still being
 * "transcribing", so whichever arrives first wins and the other is a no-op.
 *
 * Published when a transcription starts, then re-published by itself on a widening backoff. Event
 * driven rather than a polling cron: nothing runs, and Neon is never touched, unless a
 * transcription is actually in flight.
 */

/**
 * Cumulative: 2, 5, 10, 20, 35, 55 minutes. A 113-minute call finished in about twelve, so the
 * useful checks are early; the long tail is there for a genuinely slow one.
 */
const BACKOFF_SECONDS = [120, 180, 300, 600, 900, 1200];

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[CALL_STUDY] fetch queue endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let recordingId: string | undefined;
  let attempt = 0;
  try {
    const body = JSON.parse(rawBody) as { recordingId?: string; attempt?: number };
    recordingId = body.recordingId;
    attempt = Number.isFinite(body.attempt) ? Number(body.attempt) : 0;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!recordingId) {
    return NextResponse.json({ error: "recordingId required" }, { status: 400 });
  }

  const row = await getRecording(recordingId);
  if (!row) return NextResponse.json({ ok: true, done: "unknown recording" });

  // The webhook beat us to it, or someone deleted the call. Either way there is nothing to do.
  if (row.status !== "transcribing") {
    return NextResponse.json({ ok: true, done: `status is ${row.status}` });
  }

  // Rows created before the transcription id was stored cannot be fetched. Say so plainly rather
  // than retrying something that can never succeed.
  if (!row.elevenTranscriptionId) {
    await setStatus(
      recordingId,
      "failed",
      "This call was started before transcripts could be collected by id, and its delivery did not arrive. Please upload it again."
    );
    return NextResponse.json({ ok: true, done: "no transcription id" });
  }

  const fetched = await fetchTranscript(row.elevenTranscriptionId);

  if (fetched.ok) {
    const result = await ingestTranscript({
      recordingId,
      transcript: fetched.data,
      fallbackDurationSeconds: row.durationSeconds,
      requestOrigin: req.nextUrl.origin,
    });
    if (result.landed || result.reason === "already stored") {
      return NextResponse.json({ ok: true, stored: result.landed, turns: result.turns });
    }
    // A 200 with no words means the transcription genuinely produced nothing.
    await setStatus(recordingId, "failed", "The transcription came back empty.");
    return NextResponse.json({ ok: true, done: "empty" });
  }

  // Still in progress reads as a fetch failure too, so keep asking rather than concluding anything.
  const next = BACKOFF_SECONDS[attempt];
  if (next === undefined) {
    await setStatus(
      recordingId,
      "failed",
      `The transcription did not arrive in time. ${fetched.error}`
    );
    return NextResponse.json({ ok: true, done: "gave up", error: fetched.error });
  }

  await publishJob({
    path: "/api/queue/call-study-fetch",
    body: { recordingId, attempt: attempt + 1 },
    delaySeconds: next,
    requestOrigin: req.nextUrl.origin,
  });

  return NextResponse.json({ ok: true, retryIn: next, attempt: attempt + 1 });
}
