import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { regenerateField } from "@/lib/blog-generator/content-generator";
import type {
  RegenerateResponse,
  RegenerateErrorResponse,
  RegenerateField,
  YouTubeExtractionResult,
  GeneratedBlogContent,
} from "@/lib/blog-generator/types";

export const maxDuration = 30;

export async function POST(
  request: NextRequest
): Promise<NextResponse<RegenerateResponse | RegenerateErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let field: RegenerateField;
  let extraction: YouTubeExtractionResult;
  let currentContent: GeneratedBlogContent;

  try {
    const body = await request.json();
    field = body?.field;
    extraction = body?.extraction;
    currentContent = body?.currentContent;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!["title", "excerpt", "body"].includes(field)) {
    return NextResponse.json(
      { success: false, error: 'field must be "title", "excerpt", or "body"' },
      { status: 400 }
    );
  }

  if (!extraction?.transcript || !currentContent?.title) {
    return NextResponse.json(
      { success: false, error: "extraction and currentContent are required" },
      { status: 400 }
    );
  }

  try {
    const value = await regenerateField(field, extraction, currentContent);
    return NextResponse.json({ success: true, data: { field, value } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during regeneration";
    console.error("[blog-generator/regenerate]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
