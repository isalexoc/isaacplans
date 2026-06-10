import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateAndUploadPdf } from "@/lib/lead-magnet-generator/pdf-generator";
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
    locale?: "en" | "es";
    // ES-specific content passed directly when locale=es
    esGeneratedContent?: GeneratedLeadMagnet;
    esOutline?: LeadMagnetOutline;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { generatedContent, images, outline, locale = "en", esGeneratedContent, esOutline } = body;

  if (!generatedContent || !images || !outline) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: generatedContent, images, outline" },
      { status: 400 }
    );
  }

  try {
    const isEs = locale === "es";
    const result = await generateAndUploadPdf({
      generatedContent: isEs ? (esGeneratedContent ?? generatedContent) : generatedContent,
      images: isEs ? images.es : images.en,
      outline: isEs ? (esOutline ?? outline) : outline,
      locale,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `PDF assembly failed: ${message}` },
      { status: 500 }
    );
  }
}
