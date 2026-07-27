import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { createVideoJob } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { runVideoJobInline } from "@/lib/social-media-studio/video-job-processor";
import type { VideoRenderRequest, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 300;

/**
 * Kicks off a durable render job (presenter → compose → render → finalize) and returns its
 * jobId. The QStash worker runs the whole pipeline server-side with staged progress, so the
 * browser can close/refresh and reattach. When QStash is unavailable we drive it inline via
 * `after()` — same job row, same DB-polled progress UI.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: VideoRenderRequest = await req.json();
  const storyboard = body.storyboard;

  if (!storyboard?.scenes?.length) {
    return NextResponse.json(
      { success: false, error: "A storyboard with scenes is required. Generate the video images first." },
      { status: 400 },
    );
  }
  if (storyboard.scenes.some((s) => !s.imageUrl)) {
    return NextResponse.json(
      { success: false, error: "Every scene needs an image. Re-run the image step." },
      { status: 400 },
    );
  }

  try {
    const job = await createVideoJob({
      userId,
      sanityPostId:  id,
      kind:          "render",
      category:      storyboard.category ?? null,
      voiceLanguage: storyboard.voiceLanguage,
      input:         { storyboard, presenter: Boolean(storyboard.presenter) },
      jobState:      { step: "queued", progress: 0, stageLabel: "Preparing" },
    });
    const origin = new URL(req.url).origin;
    const messageId = await enqueueVideoJobTick(job.id, { delaySeconds: 1, requestOrigin: origin });
    if (!messageId) after(() => runVideoJobInline(job.id, origin));

    const response: SocialStudioResponse<{ jobId: string }> = { success: true, data: { jobId: job.id } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
