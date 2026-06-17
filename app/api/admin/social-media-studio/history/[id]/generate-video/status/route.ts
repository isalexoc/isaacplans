import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { getVideoRenderStatus } from "@/lib/social-media-studio/video-generator";
import type { SocialStudioResponse, VideoRenderStatus } from "@/lib/social-media-studio/types";

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category  = searchParams.get("category") ?? undefined;

  if (!projectId) {
    return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  }

  try {
    const result = await getVideoRenderStatus(projectId, category);

    // Persist the finished video URL back to the Sanity document.
    if (result.status === "done" && result.videoUrl) {
      const sanity = getWriteClient();
      await sanity.patch(id).set({ videoUrl: result.videoUrl, updatedAt: new Date().toISOString() }).commit();
    }

    const response: SocialStudioResponse<{
      status: VideoRenderStatus;
      videoUrl?: string;
      progress?: number;
    }> = {
      success: true,
      data: { status: result.status, videoUrl: result.videoUrl, progress: result.progress },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video/status] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
