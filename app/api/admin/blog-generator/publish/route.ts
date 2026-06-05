import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { translateBlogContent } from "@/lib/blog-generator/translator";
import { uploadThumbnail, publishBilingualPost } from "@/lib/blog-generator/sanity-publisher";
import type {
  PublishResponse,
  PublishErrorResponse,
  GeneratedBlogContent,
  YouTubeExtractionResult,
  CTASettings,
  BilingualImages,
} from "@/lib/blog-generator/types";

export const maxDuration = 60;

export async function POST(
  request: NextRequest
): Promise<NextResponse<PublishResponse | PublishErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let content: GeneratedBlogContent;
  let extraction: YouTubeExtractionResult;
  let cta: CTASettings | undefined;
  let status: "draft" | "published";
  let images: BilingualImages | undefined;
  try {
    const body = await request.json();
    content = body?.content;
    extraction = body?.extraction;
    cta = body?.cta;
    status = body?.status === "published" ? "published" : "draft";
    images = body?.images;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!content?.title || !content?.bodyBlocks) {
    return NextResponse.json(
      { success: false, error: "content is required and must be a valid GeneratedBlogContent" },
      { status: 400 }
    );
  }

  if (!extraction?.metadata?.thumbnailUrl) {
    return NextResponse.json(
      { success: false, error: "extraction is required and must include metadata.thumbnailUrl" },
      { status: 400 }
    );
  }

  try {
    // Translate and upload thumbnail in parallel
    const [esContent, thumbnailAssetId] = await Promise.all([
      translateBlogContent(content),
      uploadThumbnail(extraction.metadata.thumbnailUrl, extraction.metadata.title),
    ]);

    const result = await publishBilingualPost(content, esContent, thumbnailAssetId, cta, status, images);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during publishing";
    console.error("[blog-generator/publish]", err);
    const status = message.includes("not configured") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
