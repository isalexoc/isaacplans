import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createScheduledPost, listScheduledPosts } from "@/lib/social-publishing/scheduler";
import type { SocialPlatform } from "@/lib/social-publishing/types";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

export const maxDuration = 300;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const posts = await listScheduledPosts(userId);
  return NextResponse.json({ success: true, data: posts });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    sanityPostId: string;
    sanityPostTitle?: string;
    platform: SocialPlatform;
    locale: string;
    scheduledFor: string; // ISO
    imageUrl?: string;
    videoUrl?: string;
    copySnapshot?: SocialPostCopy;
  };

  if (!body.sanityPostId || !body.platform || !body.scheduledFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const scheduledFor = new Date(body.scheduledFor);
  if (isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledFor date" }, { status: 400 });
  }

  const post = await createScheduledPost({
    userId,
    sanityPostId:    body.sanityPostId,
    sanityPostTitle: body.sanityPostTitle,
    platform:        body.platform,
    locale:          body.locale ?? "en",
    scheduledFor,
    imageUrl:        body.imageUrl,
    videoUrl:        body.videoUrl,
    copySnapshot:    body.copySnapshot,
  });

  return NextResponse.json({ success: true, data: post });
}
