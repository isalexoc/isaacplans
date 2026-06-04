import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractYouTubeData } from "@/lib/blog-generator/youtube-extractor";
import type { ExtractResponse, ExtractErrorResponse } from "@/lib/blog-generator/types";

export const maxDuration = 30;

export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractResponse | ExtractErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ success: false, error: "url is required" }, { status: 400 });
  }

  try {
    const data = await extractYouTubeData(url.trim());
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during extraction";
    console.error("[blog-generator/extract]", err);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
