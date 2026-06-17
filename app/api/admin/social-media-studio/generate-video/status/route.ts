import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getVideoRenderStatus } from "@/lib/social-media-studio/video-generator";
import type { SocialStudioResponse, VideoRenderStatus } from "@/lib/social-media-studio/types";

// Allow time for the Cloudinary upload that runs once the render completes.
export const maxDuration = 120;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category  = searchParams.get("category") ?? undefined;

  if (!projectId) {
    return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  }

  try {
    const result = await getVideoRenderStatus(projectId, category);
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
    console.error("[generate-video/status] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
