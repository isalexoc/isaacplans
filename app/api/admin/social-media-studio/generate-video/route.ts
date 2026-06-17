import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildVideoStoryboard, submitVideoRender } from "@/lib/social-media-studio/video-generator";
import type {
  VideoGenerationRequest,
  SocialStudioResponse,
  SocialLocale,
} from "@/lib/social-media-studio/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: VideoGenerationRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json({ success: false, error: "source.title is required" }, { status: 400 });
  }
  if (!body.videoScript?.fullScript) {
    return NextResponse.json(
      { success: false, error: "A video script is required. Generate the script first." },
      { status: 400 }
    );
  }
  if (!body.images?.sourceImageUrl && !body.images?.vertical && !body.images?.square) {
    return NextResponse.json(
      { success: false, error: "An image is required. Generate images first." },
      { status: 400 }
    );
  }

  try {
    const storyboard = await buildVideoStoryboard(
      body.source,
      body.videoScript,
      body.images,
      body.locale
    );
    const { projectId } = await submitVideoRender(storyboard);

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
