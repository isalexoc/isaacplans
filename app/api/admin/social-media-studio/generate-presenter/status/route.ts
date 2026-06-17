import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPresenterStatus } from "@/lib/social-media-studio/heygen-presenter";
import type { SocialStudioResponse } from "@/lib/social-media-studio/types";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const videoId = new URL(req.url).searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ success: false, error: "videoId is required" }, { status: 400 });
  }

  try {
    const result = await getPresenterStatus(videoId);
    const response: SocialStudioResponse<{
      status: "running" | "done" | "error";
      presenterVideoUrl?: string;
      presenterDurationSec?: number;
    }> = {
      success: true,
      data: {
        status:               result.status,
        presenterVideoUrl:    result.url,
        presenterDurationSec: result.durationSeconds,
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-presenter/status] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
