import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildVideoStoryboard, generateVideoSceneImages } from "@/lib/social-media-studio/video-generator";
import type {
  VideoImagesRequest,
  VideoImagesResult,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

// Generating 10-12 portrait images in parallel needs headroom.
export const maxDuration = 300;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: VideoImagesRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json({ success: false, error: "source.title is required" }, { status: 400 });
  }
  if (!body.videoScript?.fullScript) {
    return NextResponse.json(
      { success: false, error: "A video script is required. Generate the script first." },
      { status: 400 }
    );
  }

  try {
    const storyboard = await buildVideoStoryboard(body.source, body.videoScript, body.locale);
    const images = await generateVideoSceneImages(storyboard, body.source);

    const response: SocialStudioResponse<VideoImagesResult> = {
      success: true,
      data: { storyboard, images },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-video-images] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
