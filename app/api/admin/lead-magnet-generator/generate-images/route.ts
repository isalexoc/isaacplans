import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateLeadMagnetImages } from "@/lib/lead-magnet-generator/image-generator";
import type {
  LeadMagnetApiResponse,
  LeadMagnetImages,
  LeadMagnetOutline,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 120;

export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadMagnetApiResponse<LeadMagnetImages>>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let outline: LeadMagnetOutline;
  try {
    const body = await request.json();
    outline = body?.outline;
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
    const { images, warnings } = await generateLeadMagnetImages(outline);
    const response: LeadMagnetApiResponse<LeadMagnetImages> = {
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
      data: { coverImage: "", sectionImages: [] },
      warnings: [message],
    });
  }
}
