import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishBilingualLeadMagnet } from "@/lib/lead-magnet-generator/sanity-publisher";
import { translateLeadMagnet } from "@/lib/lead-magnet-generator/translator";
import { generateAndUploadPdf } from "@/lib/lead-magnet-generator/pdf-generator";
import type {
  BilingualLeadMagnetPublishInput,
  LeadMagnetOutline,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: BilingualLeadMagnetPublishInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    outline,
    generatedContent,
    images,
    enPdfUrl,
    status,
    originalPromptInput,
    enSeoOverride,
    enLeadFormOverride,
  } = body;

  if (!outline || !generatedContent || !images || !enPdfUrl || !status || !originalPromptInput) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const seoOverride = enSeoOverride ?? {
    metaTitle: outline.title.slice(0, 60),
    metaDescription: outline.subtitle.slice(0, 160),
    focusKeyword: outline.sections[0]?.keyPoints[0] ?? outline.title,
  };
  const leadFormOverride = enLeadFormOverride ?? {
    ctaHeadline: "Get Your Free Guide",
    ctaSubtext: "Enter your info below to download instantly — no spam, ever.",
    ctaButtonText: "Download Free Guide",
    successMessage: "Your guide is downloading now!",
  };

  try {
    // Step 1: translate EN → ES
    const esContent = await translateLeadMagnet(
      generatedContent,
      seoOverride,
      leadFormOverride
    );

    // Step 2: build ES outline shape for PDF generator
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

    // Step 3: build GeneratedLeadMagnet-shaped object for ES PDF renderer
    const esGeneratedContent = {
      outline: esOutline,
      sections: esOutline.sections,
      introduction: esContent.introduction,
      conclusion: esContent.conclusion,
      introductionBlocks: esContent.introductionBlocks,
      conclusionBlocks: esContent.conclusionBlocks,
    };

    // Step 4: generate ES PDF
    const { pdfUrl: esPdfUrl } = await generateAndUploadPdf({
      generatedContent: esGeneratedContent,
      images: images.es,
      outline: esOutline,
      locale: "es",
    });

    // Step 5: publish both Sanity docs
    const result = await publishBilingualLeadMagnet({
      outline,
      generatedContent,
      images,
      enPdfUrl,
      status,
      originalPromptInput,
      enSeoOverride: seoOverride,
      enLeadFormOverride: leadFormOverride,
      esContent,
      esPdfUrl,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lead-magnet-generator/publish]", err);
    return NextResponse.json(
      { success: false, error: `Publish failed: ${message}` },
      { status: 500 }
    );
  }
}
