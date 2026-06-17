import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { regenerateSceneImage } from "@/lib/social-media-studio/video-generator";
import type { SingleVideoImageRequest, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: SingleVideoImageRequest = await req.json();
  if (!body.concept?.trim()) {
    return NextResponse.json({ success: false, error: "concept is required" }, { status: 400 });
  }

  try {
    const url = await regenerateSceneImage(body.concept, body.category, body.locale);
    const response: SocialStudioResponse<{ url: string }> = { success: true, data: { url } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-video-image] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
