import { NextRequest, NextResponse } from "next/server";
import { getDuePosts, processScheduledPost } from "@/lib/social-publishing/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publish any due scheduled posts. No longer on a frequent schedule — QStash
 * now delivers each post at its exact time (see /api/queue/social-publish), and
 * the daily /api/cron/queue-reconcile is the backstop. Kept as a manual trigger.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duePosts = await getDuePosts(10);
  const results = [];
  for (const post of duePosts) {
    const r = await processScheduledPost(post);
    results.push({ id: post.id, platform: post.platform, success: r.success, error: r.error ?? r.skipped });
  }

  return NextResponse.json({ processed: results.length, results });
}
