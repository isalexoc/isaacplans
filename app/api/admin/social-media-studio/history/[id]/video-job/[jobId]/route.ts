import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getVideoJobView } from "@/lib/social-media-studio/video-job-store";

/** Single video-job status (DB-backed) — polled by the studio while a job runs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  try {
    const job = await getVideoJobView(jobId);
    if (!job) return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    console.error("[history/video-job] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
