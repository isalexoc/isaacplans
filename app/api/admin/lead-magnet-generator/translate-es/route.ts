import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { translateLeadMagnet } from "@/lib/lead-magnet-generator/translator";
import type {
  GeneratedLeadMagnet,
  BilingualLeadMagnetImages,
  LeadMagnetOutline,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    generatedContent: GeneratedLeadMagnet;
    images: BilingualLeadMagnetImages;
    outline: LeadMagnetOutline;
    enSeoOverride: { metaTitle: string; metaDescription: string; focusKeyword: string };
    enLeadFormOverride: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { generatedContent, images, outline, enSeoOverride, enLeadFormOverride } = body;

  if (!generatedContent || !images || !outline || !enSeoOverride || !enLeadFormOverride) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  try {
    const esContent = await translateLeadMagnet(generatedContent, enSeoOverride, enLeadFormOverride);

    // Build the ES outline and GeneratedLeadMagnet shapes so the client can
    // pass them directly to /generate-pdf without a round-trip to re-derive them.
    const esOutline: LeadMagnetOutline = {
      ...outline,
      title: esContent.outline.title,
      subtitle: esContent.outline.subtitle,
      keyBenefits: esContent.outline.keyBenefits,
      sections: esContent.outline.sections.map((s, i) => ({
        ...outline.sections[i],
        sectionTitle: s.sectionTitle,
        keyPoints: s.keyPoints,
        content: esContent.sections[i]?.content ?? "",
        contentBlocks: esContent.sections[i]?.contentBlocks ?? [],
        sectionImage: images.es.sectionImages[i] ?? "",
      })),
    };

    const esGeneratedContent: GeneratedLeadMagnet = {
      outline: esOutline,
      sections: esOutline.sections,
      introduction: esContent.introduction,
      conclusion: esContent.conclusion,
      introductionBlocks: esContent.introductionBlocks,
      conclusionBlocks: esContent.conclusionBlocks,
    };

    return NextResponse.json({ success: true, data: { esContent, esOutline, esGeneratedContent } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lead-magnet-generator/translate-es]", err);
    return NextResponse.json(
      { success: false, error: `Translation failed: ${message}` },
      { status: 500 }
    );
  }
}
