import { NextRequest, NextResponse } from "next/server";
import { processOneKixieCallJob } from "@/lib/kixie-call-processor";
import { getDuePosts, processScheduledPost } from "@/lib/social-publishing/scheduler";
import { reconcileLeadJobs } from "@/lib/leads-the-way/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Stop draining after this many Kixie jobs per run (keeps the invocation bounded). */
const MAX_KIXIE_DRAIN = 25;

/**
 * Daily safety-net reconcile (vercel.json: 0 7 * * *).
 *
 * QStash handles the live path — this only catches stragglers QStash never
 * delivered or gave up on (lost message, exhausted retries). Because it runs
 * once a day it costs ~one Neon wake/day, unlike the old every-3/5-minute crons
 * that kept the database awake 24/7.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Kixie: drain any unprocessed/failed-with-backoff call jobs ──
  let kixieProcessed = 0;
  for (let i = 0; i < MAX_KIXIE_DRAIN; i++) {
    const result = await processOneKixieCallJob();
    if (!result.processed) break; // queue empty or not configured
    kixieProcessed++;
  }

  // ── Social: publish any due posts not yet handled by QStash ──
  const duePosts = await getDuePosts(25);
  let socialPublished = 0;
  let socialFailed = 0;
  for (const post of duePosts) {
    const r = await processScheduledPost(post);
    if (r.success) socialPublished++;
    else if (!r.skipped) socialFailed++;
  }

  // ── Leads the Way: drain any lead emails QStash never delivered ──
  const leads = await reconcileLeadJobs(req.nextUrl.origin);

  return NextResponse.json({
    ok: true,
    kixieProcessed,
    socialDue: duePosts.length,
    socialPublished,
    socialFailed,
    leadsFound: leads.found,
    leadsProcessed: leads.processed,
    leadsRepublished: leads.republished,
  });
}
