import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateAndUploadPdf } from "@/lib/lead-magnet-generator/pdf-generator";
import type { GeneratedLeadMagnet, LeadMagnetImages, LeadMagnetOutline } from "@/lib/lead-magnet-generator/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    generatedContent: GeneratedLeadMagnet;
    images: LeadMagnetImages;
    outline: LeadMagnetOutline;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { generatedContent, images, outline } = body;

  if (!generatedContent || !images || !outline) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: generatedContent, images, outline" },
      { status: 400 }
    );
  }

  try {
    const result = await generateAndUploadPdf({ generatedContent, images, outline });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `PDF assembly failed: ${message}` },
      { status: 500 }
    );
  }
}
