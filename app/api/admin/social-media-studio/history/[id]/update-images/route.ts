import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { generateSocialImages } from "@/lib/social-media-studio/image-generator";
import type { ImageGenerationRequest, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 120;

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: ImageGenerationRequest = await req.json();

  if (!body.headline) {
    return NextResponse.json({ success: false, error: "headline is required" }, { status: 400 });
  }

  try {
    const { images, warnings } = await generateSocialImages(body);

    if (!images.square && !images.vertical) {
      const msg = warnings[0] ?? "Image generation failed. Please try again.";
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }

    // Persist new image URLs back to the Sanity document
    const sanity = getWriteClient();
    await sanity
      .patch(id)
      .set({
        squareImageUrl:   images.square,
        verticalImageUrl: images.vertical,
        imageHeadline:    images.headline,
        updatedAt:        new Date().toISOString(),
      })
      .commit();

    const response: SocialStudioResponse<{
      squareImageUrl: string;
      verticalImageUrl: string;
      imageHeadline: string;
    }> = {
      success: true,
      data: {
        squareImageUrl:   images.square,
        verticalImageUrl: images.vertical,
        imageHeadline:    images.headline,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[update-images] unhandled error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message ?? "Image generation failed" },
      { status: 500 }
    );
  }
}
