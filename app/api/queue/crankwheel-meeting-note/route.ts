import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { postMeetingNote } from "@/lib/crankwheel/note-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QStash delivery endpoint for one meeting's post-call CRM note.
 *
 * Published by the CrankWheel `create_hook` once a session actually starts, delayed long enough
 * for the consultation to have finished. Authenticated by the Upstash-Signature header, not
 * CRON_SECRET.
 *
 * Every outcome returns 200. The daily reconcile is the retry mechanism here, not QStash: a
 * meeting still running when this fires is the normal case, not a failure, and asking QStash to
 * back off and retry a 45-minute-scale wait is the wrong tool.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[CRANKWHEEL] meeting-note endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let meetingId: string | undefined;
  try {
    meetingId = (JSON.parse(rawBody) as { meetingId?: string }).meetingId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }

  const result = await postMeetingNote(meetingId);
  return NextResponse.json({ ok: true, ...result });
}
