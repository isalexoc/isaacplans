import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { loadSourceAndScript } from "@/lib/social-media-studio/history-storyboard";
import { createVideoJob } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { runVideoJobInline } from "@/lib/social-media-studio/video-job-processor";
import type { VideoImagesRequest, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 300;

/** Kicks off a durable image-build job (storyboard + one portrait image per scene, with
 *  per-image progress). Returns the jobId; the studio polls it and reattaches after a refresh. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: VideoImagesRequest = await req.json().catch(() => ({}) as VideoImagesRequest);

  try {
    // Validate up front so the user gets an immediate error instead of a failing job.
    const loaded = await loadSourceAndScript(id, body.locale);
    if (!loaded) {
      return NextResponse.json(
        { success: false, error: "This post has no video script. Add one first." },
        { status: 400 },
      );
    }

    const job = await createVideoJob({
      userId,
      sanityPostId:  id,
      kind:          "images",
      category:      loaded.source.category ?? null,
      voiceLanguage: loaded.locale,
      input:         { locale: loaded.locale },
      jobState:      { step: "queued", progress: 0, stageLabel: "Planning storyboard" },
    });
    const origin = new URL(req.url).origin;
    const messageId = await enqueueVideoJobTick(job.id, { delaySeconds: 1, requestOrigin: origin });
    if (!messageId) after(() => runVideoJobInline(job.id, origin));

    const response: SocialStudioResponse<{ jobId: string }> = { success: true, data: { jobId: job.id } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video-images] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
