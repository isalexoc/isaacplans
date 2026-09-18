import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { buildShareableCopy } from "@/lib/call-study/shareable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * QStash delivery endpoint: build the beeped, shareable copy of one recording.
 *
 * Authenticated by the Upstash-Signature header, not CRON_SECRET.
 *
 * Returns 200 even on failure. A retry would re-download ~50 MB and re-run a multi-minute encode
 * for something that is usually not transient, and `buildShareableCopy` has already written the
 * reason onto the row where the agent can read it and press the button again.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[CALL_STUDY] shareable queue endpoint: invalid signature");
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

  const result = await buildShareableCopy(recordingId);
  if (!result.ok) {
    console.warn("[CALL_STUDY] Shareable copy failed:", recordingId, result.error);
    return NextResponse.json({ ok: true, built: false, error: result.error });
  }
  return NextResponse.json({
    ok: true,
    built: true,
    spans: result.spans,
    maskedSeconds: result.maskedSeconds,
    unmaskedRuns: result.unmaskedRuns,
    scrubbedTurns: result.scrubbedTurns,
  });
}
