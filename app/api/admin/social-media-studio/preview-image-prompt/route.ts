import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { previewImagePrompt } from "@/lib/social-media-studio/image-generator";
import type { ImageGenerationRequest, SocialStudioResponse, ImagePromptPreview } from "@/lib/social-media-studio/types";

export const maxDuration = 60;

// Builds the exact image prompt that "Generate with AI" would use, broken into its
// component parts, without generating an image. Reads no document — it only assembles
// a prompt from the same inputs the generate call sends.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: ImageGenerationRequest = await req.json();

  if (!body.headline) {
    return NextResponse.json({ success: false, error: "headline is required" }, { status: 400 });
  }

  try {
    const preview = await previewImagePrompt(body);
    const response: SocialStudioResponse<ImagePromptPreview> = { success: true, data: preview };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[preview-image-prompt] error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message ?? "Failed to build prompt preview" },
      { status: 500 }
    );
  }
}
