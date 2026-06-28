import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createScheduledPost, listScheduledPosts, setQstashMessageId } from "@/lib/social-publishing/scheduler";
import type { SocialPlatform, PublishFormat } from "@/lib/social-publishing/types";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";
import { publishJob } from "@/lib/qstash/client";

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
    format?: PublishFormat;
    locale: string;
    scheduledFor: string; // ISO
    imageUrl?: string;
    videoUrl?: string;
    copySnapshot?: SocialPostCopy;
  };

  if (!body.sanityPostId || !body.platform || !body.scheduledFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (body.format === "reel" && !body.videoUrl) {
    return NextResponse.json({ error: "A video URL is required to schedule a reel" }, { status: 400 });
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
    format:          body.format ?? "post",
    locale:          body.locale ?? "en",
    scheduledFor,
    imageUrl:        body.imageUrl,
    videoUrl:        body.videoUrl,
    copySnapshot:    body.copySnapshot,
  });

  // Hand to QStash for exact-time, poll-free delivery. When QStash is disabled
  // or the publish fails, publishJob returns null and the daily reconcile cron
  // picks the post up instead — so scheduling never silently drops.
  const messageId = await publishJob({
    path: "/api/queue/social-publish",
    body: { scheduledPostId: post.id },
    notBefore: Math.floor(scheduledFor.getTime() / 1000),
    requestOrigin: req.nextUrl.origin,
    retries: 3,
  });
  if (messageId) {
    await setQstashMessageId(post.id, messageId);
    post.qstashMessageId = messageId;
  }

  return NextResponse.json({ success: true, data: post });
}
