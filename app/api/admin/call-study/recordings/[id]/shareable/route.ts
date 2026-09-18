import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { publishJob } from "@/lib/qstash/client";
import { buildShareableCopy } from "@/lib/call-study/shareable";
import { getRecording, toDetail } from "@/lib/call-study/store";

/**
 * Build a copy of this call that is safe to send to another agent.
 *
 * Queued through QStash rather than run inline: a two-hour recording is ~50 MB to download and a
 * multi-minute ffmpeg encode, which is well past what a request should hold open. When QStash is
 * unavailable the work runs here instead — the agent is watching this button, so failing silently
 * and waiting for a daily reconcile would be worse than a slow response.
 */

export const runtime = "nodejs";
export const maxDuration = 600;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await getRecording(id);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (row.shareableStatus === "building") {
      return NextResponse.json({ success: true, queued: true, alreadyRunning: true });
    }

    const queued = await publishJob({
      path: "/api/queue/call-study-shareable",
      body: { recordingId: id },
      requestOrigin: request.nextUrl.origin,
    });

    if (queued) {
      return NextResponse.json({ success: true, queued: true });
    }

    const result = await buildShareableCopy(id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    const updated = await getRecording(id);
    return NextResponse.json({
      success: true,
      queued: false,
      ...result,
      recording: updated ? toDetail(updated) : null,
    });
  } catch (error) {
    console.error("[call-study/recordings/:id/shareable] POST", error);
    return NextResponse.json({ success: false, error: "Could not build the copy" }, { status: 500 });
  }
}
