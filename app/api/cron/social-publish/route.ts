import { NextRequest, NextResponse } from "next/server";
import { getDuePosts, markPublishing, markPublished, markFailed } from "@/lib/social-publishing/scheduler";
import { runPublishJob } from "@/lib/social-publishing/publish-job";
import type { SocialPlatform } from "@/lib/social-publishing/types";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duePosts = await getDuePosts(10);
  const results: { id: string; platform: string; success: boolean; error?: string }[] = [];

  for (const post of duePosts) {
    await markPublishing(post.id);

    const caption  = (post as unknown as { copySnapshot?: SocialPostCopy }).copySnapshot?.fullPost ?? "";
    const imageUrl = post.imageUrl ?? "";

    if (!caption || !imageUrl) {
      await markFailed(post.id, "Missing caption or image URL in snapshot", post.attemptCount);
      results.push({ id: post.id, platform: post.platform, success: false, error: "Missing data" });
      continue;
    }

    const result = await runPublishJob({
      userId:      post.userId,
      sanityPostId: post.sanityPostId,
      platform:    post.platform as SocialPlatform,
      caption,
      imageUrl,
    });

    if (result.success) {
      await markPublished(post.id, result.platformPostId ?? "");
      results.push({ id: post.id, platform: post.platform, success: true });
    } else {
      await markFailed(post.id, result.error ?? "Unknown error", post.attemptCount);
      results.push({ id: post.id, platform: post.platform, success: false, error: result.error });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
