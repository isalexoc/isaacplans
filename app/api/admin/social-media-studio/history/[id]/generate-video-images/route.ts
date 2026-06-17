import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { buildVideoStoryboard, generateVideoSceneImages } from "@/lib/social-media-studio/video-generator";
import type {
  VideoImagesRequest,
  VideoImagesResult,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 300;

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: VideoImagesRequest = await req.json();

  if (!body.videoScript?.fullScript) {
    return NextResponse.json(
      { success: false, error: "This post has no video script. Generate a script in the studio first." },
      { status: 400 }
    );
  }

  try {
    const storyboard = await buildVideoStoryboard(body.source, body.videoScript, body.locale);
    const images = await generateVideoSceneImages(storyboard, body.source);

    // Stack the freshly generated images into the post's videoImages library.
    const sanity = getWriteClient();
    const withKeys = images.map((img, i) => ({
      _key: `${Date.now().toString(36)}_${i}`,
      ...img,
    }));
    await sanity
      .patch(id)
      .setIfMissing({ videoImages: [] })
      .append("videoImages", withKeys)
      .set({ updatedAt: new Date().toISOString() })
      .commit();

    const response: SocialStudioResponse<VideoImagesResult> = {
      success: true,
      data: { storyboard, images },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video-images] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
