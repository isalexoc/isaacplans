import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateBlogImages } from "@/lib/blog-generator/image-generator";
import type {
  GenerateImagesResponse,
  GenerateImagesErrorResponse,
  GeneratedBlogContent,
} from "@/lib/blog-generator/types";

export const maxDuration = 120;

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateImagesResponse | GenerateImagesErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let content: GeneratedBlogContent;
  try {
    const body = await request.json();
    content = body?.content;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!content?.title || !content?.category) {
    return NextResponse.json(
      { success: false, error: "content with title and category is required" },
      { status: 400 }
    );
  }

  try {
    const images = await generateBlogImages(content);
    return NextResponse.json({ success: true, data: images });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    console.error("[blog-generator/generate-images]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
