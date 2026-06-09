import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateIntroConclusion } from "@/lib/lead-magnet-generator/section-generator";
import type {
  LeadMagnetApiResponse,
  LeadMagnetOutline,
  LeadMagnetSection,
  PortableTextBlock,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 60;

type IntroConclusionResult = {
  introduction: string;
  conclusion: string;
  introductionBlocks: PortableTextBlock[];
  conclusionBlocks: PortableTextBlock[];
};

export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadMagnetApiResponse<IntroConclusionResult>>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let outline: LeadMagnetOutline;
  let sections: LeadMagnetSection[];

  try {
    const body = await request.json();
    outline = body?.generatedContent?.outline;
    sections = body?.generatedContent?.sections;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!outline || !outline.title || !outline.targetAudience) {
    return NextResponse.json(
      { success: false, error: "generatedContent.outline is required with title and targetAudience" },
      { status: 400 }
    );
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json(
      { success: false, error: "generatedContent.sections must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    const data = await generateIntroConclusion({ outline, sections });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during intro/conclusion generation";
    console.error("[lead-magnet-generator/generate-intro-conclusion]", err);
    const status = message.includes("not configured") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
