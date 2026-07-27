import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cancelVideoJob } from "@/lib/social-media-studio/video-job-store";
import { cancelJob } from "@/lib/qstash/client";

/** Cancel an in-progress video job: flip status → cancelled and drop its next QStash tick. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  try {
    const { cancelled, qstashMessageId } = await cancelVideoJob(jobId, userId);
    // Best-effort: stop the already-scheduled continuation tick (the worker also
    // re-checks status, so an in-flight tick will stop on its own too).
    await cancelJob(qstashMessageId);
    return NextResponse.json({ success: true, data: { cancelled } });
  } catch (err) {
    console.error("[history/video-job/cancel] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
