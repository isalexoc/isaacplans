import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { runAnalysis } from "@/lib/call-study/run-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * QStash delivery endpoint: analyse one call that has just finished transcribing.
 *
 * Published by the ElevenLabs transcript webhook once the dialogue is durable, so a finished call
 * arrives already broken into stages with its objections highlighted, rather than waiting for
 * someone to press a button. Authenticated by the Upstash-Signature header, not CRON_SECRET.
 *
 * Not run inline in the webhook: that route is capped at 120 seconds and a two-hour call is several
 * model calls. A slow analysis there would make ElevenLabs time out and redeliver, which would then
 * be treated as a duplicate transcript.
 *
 * Returns 200 on a failed analysis rather than an error. QStash's retries would re-run a
 * multi-minute model job for something that is usually not transient, and `runAnalysis` has already
 * put the row back to "transcribed" with the reason on it — the transcript is intact and the
 * Analyse button still works.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[CALL_STUDY] analyze queue endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let recordingId: string | undefined;
  try {
    recordingId = (JSON.parse(rawBody) as { recordingId?: string }).recordingId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!recordingId) {
    return NextResponse.json({ error: "recordingId required" }, { status: 400 });
  }

  const result = await runAnalysis(recordingId);
  if (!result.ok) {
    console.warn("[CALL_STUDY] Queued analysis failed:", recordingId, result.error);
    return NextResponse.json({ ok: true, analysed: false, error: result.error });
  }

  return NextResponse.json({
    ok: true,
    analysed: true,
    snippetCount: result.snippetCount,
    objectionCount: result.objectionCount,
    libraryMatches: result.libraryMatches,
  });
}
