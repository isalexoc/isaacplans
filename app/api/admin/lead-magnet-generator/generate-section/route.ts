import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateSection } from "@/lib/lead-magnet-generator/section-generator";
import type {
  LeadMagnetApiResponse,
  LeadMagnetOutline,
  LeadMagnetSection,
  PortableTextBlock,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 60;

type SectionResult = { content: string; contentBlocks: PortableTextBlock[]; wordCount: number };

export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadMagnetApiResponse<SectionResult>>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let outline: LeadMagnetOutline;
  let sectionIndex: number;
  let completedSections: LeadMagnetSection[];

  try {
    const body = await request.json();
    outline = body?.outline;
    sectionIndex = body?.sectionIndex;
    completedSections = body?.completedSections ?? [];
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!outline || !outline.sections || !Array.isArray(outline.sections)) {
    return NextResponse.json(
      { success: false, error: "outline is required and must include a sections array" },
      { status: 400 }
    );
  }

  if (typeof sectionIndex !== "number" || sectionIndex < 0 || sectionIndex >= outline.sections.length) {
    return NextResponse.json(
      {
        success: false,
        error: `sectionIndex must be a number between 0 and ${outline.sections.length - 1}`,
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(completedSections)) {
    return NextResponse.json(
      { success: false, error: "completedSections must be an array" },
      { status: 400 }
    );
  }

  try {
    const data = await generateSection({ outline, sectionIndex, completedSections });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during section generation";
    console.error("[lead-magnet-generator/generate-section]", err);
    const status = message.includes("not configured") || message.includes("too short") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
