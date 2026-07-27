import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getActiveJobsForPost } from "@/lib/social-media-studio/video-job-store";

/**
 * Active (pending|processing) video jobs for a post — polled on mount so the studio can
 * reattach its progress UI to a render/images/clip/music job started in a previous window.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const jobs = await getActiveJobsForPost(id);
    return NextResponse.json({ success: true, data: { jobs } });
  } catch (err) {
    console.error("[history/video-jobs] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
