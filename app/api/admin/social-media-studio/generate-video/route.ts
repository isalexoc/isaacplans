import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { submitVideoRender } from "@/lib/social-media-studio/video-generator";
import type {
  VideoRenderRequest,
  SocialStudioResponse,
  SocialLocale,
} from "@/lib/social-media-studio/types";

// TTS + caption transcription + per-scene uploads run before the render is submitted.
export const maxDuration = 300;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: VideoRenderRequest = await req.json();
  const storyboard = body.storyboard;

  if (!storyboard?.scenes?.length) {
    return NextResponse.json(
      { success: false, error: "A storyboard with scenes is required. Generate the video images first." },
      { status: 400 }
    );
  }
  if (storyboard.scenes.some((s) => !s.imageUrl)) {
    return NextResponse.json(
      { success: false, error: "Every scene needs an image. Re-run the image step." },
      { status: 400 }
    );
  }

  const presenter =
    storyboard.presenter && body.presenterVideoUrl && body.presenterDurationSec
      ? { url: body.presenterVideoUrl, durationSec: body.presenterDurationSec }
      : undefined;

  try {
    const { projectId } = await submitVideoRender(storyboard, presenter);

    const response: SocialStudioResponse<{
      projectId: string;
      durationSeconds: number;
      voiceLanguage: SocialLocale;
    }> = {
      success: true,
      data: {
        projectId,
        durationSeconds: storyboard.durationSeconds,
        voiceLanguage:   storyboard.voiceLanguage,
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-video] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
