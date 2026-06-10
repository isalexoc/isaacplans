import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishBilingualLeadMagnet } from "@/lib/lead-magnet-generator/sanity-publisher";
import type {
  BilingualLeadMagnetPublishInput,
  TranslatedLeadMagnet,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: BilingualLeadMagnetPublishInput & { esContent: TranslatedLeadMagnet; esPdfUrl: string };

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
    esContent,
    esPdfUrl,
  } = body;

  if (!outline || !generatedContent || !images || !enPdfUrl || !status || !originalPromptInput || !esContent || !esPdfUrl) {
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
    console.log("[publish] START — saving EN+ES docs to Sanity");
    const t0 = Date.now();
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

    console.log(`[publish] DONE — ${Date.now() - t0}ms en=${result.en.slug} es=${result.es.slug}`);
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
