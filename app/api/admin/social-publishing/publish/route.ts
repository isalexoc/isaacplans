import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runPublishJob } from "@/lib/social-publishing/publish-job";
import type { SocialPlatform, PublishFormat } from "@/lib/social-publishing/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    sanityPostId: string;
    platform: SocialPlatform;
    format?: PublishFormat;
    caption: string;
    imageUrl: string;
    videoUrl?: string;
  };

  const isReel = body.format === "reel";

  if (!body.sanityPostId || !body.platform || !body.caption) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (isReel && !body.videoUrl) {
    return NextResponse.json({ error: "A video URL is required to publish a reel" }, { status: 400 });
  }
  if (!isReel && body.platform !== "youtube" && !body.imageUrl) {
    return NextResponse.json({ error: "imageUrl is required for non-YouTube platforms" }, { status: 400 });
  }

  const result = await runPublishJob({
    userId,
    sanityPostId: body.sanityPostId,
    platform:     body.platform,
    format:       body.format ?? "post",
    caption:      body.caption,
    imageUrl:     body.imageUrl ?? "",
    videoUrl:     body.videoUrl,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({ success: true, platformPostId: result.platformPostId });
}
