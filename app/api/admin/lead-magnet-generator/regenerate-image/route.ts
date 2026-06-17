import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { regenerateSingleLeadMagnetImage } from "@/lib/lead-magnet-generator/image-generator";
import type {
  LeadMagnetRegenerateImageResponse,
  LeadMagnetRegenerateImageErrorResponse,
  LeadMagnetImageSlot,
  LeadMagnetOutline,
  LeadMagnetPromptInput,
  GeneratedLeadMagnet,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 60;

const VALID_LOCALES = ["en", "es"] as const;

export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadMagnetRegenerateImageResponse | LeadMagnetRegenerateImageErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let locale: "en" | "es";
  let slot: LeadMagnetImageSlot;
  let outline: LeadMagnetOutline;
  let promptInput: LeadMagnetPromptInput | undefined;
  let generatedContent: GeneratedLeadMagnet | undefined;

  try {
    const body = await request.json();
    locale = body?.locale;
    slot = body?.slot;
    outline = body?.outline;
    promptInput = body?.promptInput;
    generatedContent = body?.generatedContent;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!VALID_LOCALES.includes(locale)) {
    return NextResponse.json(
      { success: false, error: 'locale must be "en" or "es"' },
      { status: 400 }
    );
  }

  if (slot !== "cover" && !/^section-\d+$/.test(slot)) {
    return NextResponse.json(
      { success: false, error: 'slot must be "cover" or "section-N" (e.g. "section-0")' },
      { status: 400 }
    );
  }

  if (!outline || !outline.sections || !Array.isArray(outline.sections)) {
    return NextResponse.json(
      { success: false, error: "outline with sections array is required" },
      { status: 400 }
    );
  }

  if (slot !== "cover") {
    const sectionIndex = parseInt(slot.replace("section-", ""));
    if (isNaN(sectionIndex) || sectionIndex < 0 || sectionIndex >= outline.sections.length) {
      return NextResponse.json(
        { success: false, error: `Section index ${sectionIndex} is out of range (0-${outline.sections.length - 1})` },
        { status: 400 }
      );
    }
  }

  try {
    const imageUrl = await regenerateSingleLeadMagnetImage(
      { outline, promptInput, generatedContent },
      locale,
      slot
    );
    return NextResponse.json({ success: true, data: { locale, slot, imageUrl } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image regeneration failed";
    console.error("[lead-magnet-generator/regenerate-image]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
