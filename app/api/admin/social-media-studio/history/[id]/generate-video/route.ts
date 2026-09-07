import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { createVideoJob, findReusablePresenter } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { runVideoJobInline, renderStages } from "@/lib/social-media-studio/video-job-processor";
import { latestScriptHash } from "@/lib/social-media-studio/history-storyboard";
import type { VideoRenderRequest, SocialStudioResponse } from "@/lib/social-media-studio/types";
import type { SocialVideoJobState } from "@/lib/social-media-studio/video-job-types";

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

  // A presenter ad needs the recording and nothing else: a take with no cutaways at all still
  // renders as him with captions and music, which is a real deliverable rather than an error.
  // A faceless video has nothing to show without its scenes, so it keeps the hard requirement.
  if (!storyboard?.aRoll && !storyboard?.scenes?.length) {
    return NextResponse.json(
      { success: false, error: "A storyboard with scenes is required. Generate the video images first." },
      { status: 400 },
    );
  }
  if (storyboard.aRoll && !storyboard.aRoll.publicId) {
    return NextResponse.json(
      { success: false, error: "This ad has no usable recording. Upload your take again." },
      { status: 400 },
    );
  }
  // On a presenter ad a shot without an image is simply dropped from the cut — that stretch is
  // his face — so only a faceless render has to insist on every scene having one.
  if (!storyboard.aRoll && storyboard.scenes.some((s) => !s.imageUrl)) {
    return NextResponse.json(
      { success: false, error: "Every scene needs an image. Re-run the image step." },
      { status: 400 },
    );
  }

  try {
    let jobState: SocialVideoJobState = { step: "queued", progress: 0, stageLabel: "Preparing" };

    // A prior render on this post may have already paid to render the HeyGen avatar clip
    // (e.g. it failed later, during compose/render). Reuse it instead of re-rendering the
    // avatar, as long as the LATEST SAVED SCRIPT + picked avatar/voice it was rendered for
    // haven't changed — the render job re-syncs to this same latest script either way, so
    // this check is what actually decides "does the reused clip still speak the right words."
    if (storyboard.presenter) {
      const hash = await latestScriptHash(id, storyboard.voiceLanguage);
      const reusable = await findReusablePresenter(
        id, hash, storyboard.presenterAvatarId, storyboard.presenterVoiceId,
      );
      if (reusable) {
        const stages = renderStages(true);
        jobState = {
          ...jobState,
          step: "compose",
          stages,
          stageLabel: "Composing",
          stepIndex: stages.indexOf("Composing"),
          stepCount: stages.length,
          progress: 46,
          presenterVideoId: reusable.presenterVideoId,
          presenterVideoUrl: reusable.presenterVideoUrl,
          presenterDurationSec: reusable.presenterDurationSec,
          notice: "Reusing the previously rendered avatar clip — skipping HeyGen re-render.",
        };
      }
    }

    const job = await createVideoJob({
      userId,
      sanityPostId:  id,
      kind:          "render",
      category:      storyboard.category ?? null,
      voiceLanguage: storyboard.voiceLanguage,
      input:         { storyboard, presenter: Boolean(storyboard.presenter) },
      jobState,
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
