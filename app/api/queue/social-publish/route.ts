import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { getScheduledPostById, processScheduledPost } from "@/lib/social-publishing/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * QStash delivery endpoint for one scheduled social post.
 *
 * Published (with `notBefore = scheduledFor`) when a post is scheduled, so it
 * fires at the exact time without any polling cron. Authenticated by the
 * Upstash-Signature header. 200 = handled/no-retry, 500 = transient → QStash
 * retries with backoff.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let scheduledPostId: string | undefined;
  try {
    scheduledPostId = (JSON.parse(rawBody) as { scheduledPostId?: string }).scheduledPostId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!scheduledPostId) {
    return NextResponse.json({ error: "scheduledPostId required" }, { status: 400 });
  }

  const post = await getScheduledPostById(scheduledPostId);
  if (!post) {
    // Deleted before delivery — nothing to do, stop retrying.
    return NextResponse.json({ ok: true, skipped: "not_found" });
  }

  const result = await processScheduledPost(post);

  // Only a real publish failure is retryable (skipped = already-done/bad-data).
  if (!result.success && !result.skipped) {
    return NextResponse.json({ ok: false, retry: true, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: result.success, skipped: result.skipped });
}
