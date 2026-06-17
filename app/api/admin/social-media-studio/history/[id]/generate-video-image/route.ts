import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { regenerateSceneImage } from "@/lib/social-media-studio/video-generator";
import type { SingleVideoImageRequest, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 60;

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
  const body: SingleVideoImageRequest = await req.json();
  if (!body.concept?.trim()) {
    return NextResponse.json({ success: false, error: "concept is required" }, { status: 400 });
  }

  try {
    const url = await regenerateSceneImage(body.concept, body.category, body.locale);

    const sanity = getWriteClient();
    const patch = sanity
      .patch(id)
      .setIfMissing({ videoImages: [] })
      .append("videoImages", [
        { _key: `${Date.now().toString(36)}_r`, url, concept: body.concept, createdAt: new Date().toISOString() },
      ])
      .set({ updatedAt: new Date().toISOString() });

    // Update the active storyboard scene's image so a re-render uses this image.
    if (typeof body.sceneIndex === "number") {
      patch.set({ [`videoStoryboard.scenes[_key=="sc_${body.sceneIndex}"].imageUrl`]: url });
    }
    await patch.commit();

    const response: SocialStudioResponse<{ url: string }> = { success: true, data: { url } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video-image] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
