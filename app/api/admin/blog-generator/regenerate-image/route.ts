import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { regenerateSingleImage } from "@/lib/blog-generator/image-generator";
import type {
  RegenerateImageResponse,
  RegenerateImageErrorResponse,
  ImageSlot,
  GeneratedBlogContent,
  YouTubeExtractionResult,
} from "@/lib/blog-generator/types";

export const maxDuration = 60;

const VALID_SLOTS: ImageSlot[] = ["featured", "body1", "body2", "body3"];
const VALID_LOCALES = ["en", "es"] as const;

export async function POST(
  request: NextRequest
): Promise<NextResponse<RegenerateImageResponse | RegenerateImageErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let locale: "en" | "es";
  let slot: ImageSlot;
  let content: GeneratedBlogContent;
  let extraction: YouTubeExtractionResult;

  try {
    const body = await request.json();
    locale = body?.locale;
    slot = body?.slot;
    content = body?.content;
    extraction = body?.extraction;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!VALID_LOCALES.includes(locale)) {
    return NextResponse.json(
      { success: false, error: 'locale must be "en" or "es"' },
      { status: 400 }
    );
  }

  if (!VALID_SLOTS.includes(slot)) {
    return NextResponse.json(
      { success: false, error: 'slot must be "featured", "body1", "body2", or "body3"' },
      { status: 400 }
    );
  }

  if (!content?.title || !content?.category) {
    return NextResponse.json(
      { success: false, error: "content with title and category is required" },
      { status: 400 }
    );
  }

  if (!extraction?.transcript) {
    return NextResponse.json(
      { success: false, error: "extraction with transcript is required" },
      { status: 400 }
    );
  }

  try {
    const image = await regenerateSingleImage(content, extraction, locale, slot);
    return NextResponse.json({ success: true, data: { locale, slot, image } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image regeneration failed";
    console.error("[blog-generator/regenerate-image]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
