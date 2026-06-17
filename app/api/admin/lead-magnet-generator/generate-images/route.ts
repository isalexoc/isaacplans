import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateBilingualLeadMagnetImages } from "@/lib/lead-magnet-generator/image-generator";
import type {
  LeadMagnetApiResponse,
  BilingualLeadMagnetImages,
  LeadMagnetOutline,
  LeadMagnetPromptInput,
  GeneratedLeadMagnet,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 300;

export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadMagnetApiResponse<BilingualLeadMagnetImages>>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let outline: LeadMagnetOutline;
  let promptInput: LeadMagnetPromptInput | undefined;
  let generatedContent: GeneratedLeadMagnet | undefined;
  try {
    const body = await request.json();
    outline = body?.outline;
    promptInput = body?.promptInput;
    generatedContent = body?.generatedContent;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!outline || !outline.sections || !Array.isArray(outline.sections)) {
    return NextResponse.json(
      { success: false, error: "outline is required and must include a sections array" },
      { status: 400 }
    );
  }

  try {
    const { images, warnings } = await generateBilingualLeadMagnetImages({
      outline,
      promptInput,
      generatedContent,
    });
    const response: LeadMagnetApiResponse<BilingualLeadMagnetImages> = {
      success: true,
      data: images,
      ...(warnings.length > 0 && { warnings }),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during image generation";
    console.error("[lead-magnet-generator/generate-images]", err);
    return NextResponse.json({
      success: true,
      data: { en: { coverImage: "", sectionImages: [] }, es: { coverImage: "", sectionImages: [] } },
      warnings: [message],
    });
  }
}
