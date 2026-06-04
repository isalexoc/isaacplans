import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateBlogContent } from "@/lib/blog-generator/content-generator";
import type { GenerateResponse, GenerateErrorResponse, YouTubeExtractionResult } from "@/lib/blog-generator/types";

export const maxDuration = 60;

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateResponse | GenerateErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let extraction: YouTubeExtractionResult;
  try {
    const body = await request.json();
    extraction = body?.extraction;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!extraction || !extraction.transcript || !extraction.metadata) {
    return NextResponse.json(
      { success: false, error: "extraction is required and must be a valid YouTubeExtractionResult" },
      { status: 400 }
    );
  }

  try {
    const data = await generateBlogContent(extraction);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during content generation";
    console.error("[blog-generator/generate]", err);
    const status = message.includes("too short") || message.includes("not configured") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
