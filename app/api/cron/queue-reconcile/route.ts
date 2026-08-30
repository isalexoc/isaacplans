import { NextRequest, NextResponse } from "next/server";
import { processOneKixieCallJob } from "@/lib/kixie-call-processor";
import { getDuePosts, processScheduledPost } from "@/lib/social-publishing/scheduler";
import { reconcileLeadJobs } from "@/lib/leads-the-way/process";
import { getStaleJobs } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { listMeetingsAwaitingNote } from "@/lib/crankwheel/meetings";
import { postMeetingNote } from "@/lib/crankwheel/note-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Stop draining after this many Kixie jobs per run (keeps the invocation bounded). */
const MAX_KIXIE_DRAIN = 25;

/**
 * How far back to look for meetings still owed a CRM note.
 *
 * Bounded because the CrankWheel usage API is queried over the same span: a meeting older than
 * this can no longer be matched to a session, so retrying it would be a query that never succeeds.
 */
const MEETING_NOTE_LOOKBACK_DAYS = 3;

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

  // ── Video generation: nudge any stale video jobs back onto QStash (dropped tick) ──
  const staleVideoJobs = await getStaleJobs(25);
  let videoJobsRequeued = 0;
  for (const job of staleVideoJobs) {
    const messageId = await enqueueVideoJobTick(job.id, { delaySeconds: 1, requestOrigin: req.nextUrl.origin });
    if (messageId) videoJobsRequeued++;
  }

  // ── CrankWheel: post notes for meetings whose create_hook never fired, and for scheduled
  //    links, which have no hook to fire in the first place ──
  const meetingsAwaiting = await listMeetingsAwaitingNote(
    new Date(Date.now() - MEETING_NOTE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  );
  let meetingNotesPosted = 0;
  for (const meeting of meetingsAwaiting) {
    const r = await postMeetingNote(meeting);
    if (r.posted) meetingNotesPosted++;
  }

  return NextResponse.json({
    ok: true,
    kixieProcessed,
    socialDue: duePosts.length,
    socialPublished,
    socialFailed,
    leadsFound: leads.found,
    leadsProcessed: leads.processed,
    leadsRepublished: leads.republished,
    videoJobsStale: staleVideoJobs.length,
    videoJobsRequeued,
    meetingsAwaitingNote: meetingsAwaiting.length,
    meetingNotesPosted,
  });
}
