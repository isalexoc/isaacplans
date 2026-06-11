import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateSocialImages } from "@/lib/social-media-studio/image-generator";
import type {
  ImageGenerationRequest,
  SocialStudioResponse,
  SocialCreativeImages,
} from "@/lib/social-media-studio/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body: ImageGenerationRequest = await req.json();

  if (!body.headline) {
    return NextResponse.json(
      { success: false, error: "headline is required" },
      { status: 400 }
    );
  }

  // Always returns success: true — failures surface as empty URLs + warnings
  const { images, warnings } = await generateSocialImages(body);

  const response: SocialStudioResponse<SocialCreativeImages> = {
    success: true,
    data:    images,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
  return NextResponse.json(response);
}
