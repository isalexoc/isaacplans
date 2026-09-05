import { NextRequest, NextResponse } from "next/server";
import { processOneKixieCallJob } from "@/lib/kixie-call-processor";
import { getDuePosts, processScheduledPost } from "@/lib/social-publishing/scheduler";
import { reconcileLeadJobs } from "@/lib/leads-the-way/process";
import { getStaleJobs } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { listMeetingsAwaitingNote } from "@/lib/crankwheel/meetings";
import { postMeetingNote } from "@/lib/crankwheel/note-job";
import {
  listStuckTranscriptions,
  listUnanalysedTranscripts,
  setStatus,
} from "@/lib/call-study/store";
import { runAnalysis } from "@/lib/call-study/run-analysis";
import { fetchTranscript } from "@/lib/call-study/scribe";
import { ingestTranscript } from "@/lib/call-study/ingest";

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
 * How long a transcription may sit in flight before it is treated as lost.
 *
 * Generous, because Scribe genuinely takes a while on a long recording and giving up early would
 * mean paying for the same transcription twice.
 */
const TRANSCRIPTION_STUCK_MINUTES = 90;

/** How long a finished transcript may sit unanalysed before this picks it up. */
const UNANALYSED_MINUTES = 60;

/** Each is several model calls, so the daily run works through a few rather than a backlog. */
const MAX_ANALYSES_PER_RUN = 3;

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

  // -- Call Study: recover transcriptions whose webhook never arrived --
  const stuck = await listStuckTranscriptions(
    new Date(Date.now() - TRANSCRIPTION_STUCK_MINUTES * 60 * 1000)
  );
  let transcriptsRecovered = 0;
  for (const row of stuck) {
    // The TRANSCRIPTION id, not the request id. Fetching by the request id answers 404 for every
    // call ever made, which is what silently stopped this backstop from recovering anything.
    if (!row.elevenTranscriptionId) {
      await setStatus(
        row.id,
        "failed",
        "This call was started before transcripts could be collected by id, and its delivery never arrived. Please upload it again."
      );
      continue;
    }
    const fetched = await fetchTranscript(row.elevenTranscriptionId);
    if (!fetched.ok) {
      // Say what happened on the row itself. An agent seeing "still transcribing" three days later
      // has no way to tell a slow call from a lost one.
      await setStatus(row.id, "failed", `Transcription did not arrive. ${fetched.error}`);
      continue;
    }
    const result = await ingestTranscript({
      recordingId: row.id,
      transcript: fetched.data,
      fallbackDurationSeconds: row.durationSeconds,
      requestOrigin: req.nextUrl.origin,
    });
    if (!result.landed && result.reason === "empty transcript") {
      await setStatus(row.id, "failed", "The transcription came back empty.");
      continue;
    }
    if (result.landed) transcriptsRecovered++;
  }

  // -- Call Study: analyse transcripts the queue never got to --
  // Normally the transcript webhook queues this immediately. This is the backstop for QStash
  // being off or a publish that failed, so a call cannot sit fully transcribed and permanently
  // unstaged with nothing to say so.
  const unanalysed = await listUnanalysedTranscripts(
    new Date(Date.now() - UNANALYSED_MINUTES * 60 * 1000),
    MAX_ANALYSES_PER_RUN
  );
  let callsAnalysed = 0;
  for (const row of unanalysed) {
    const analysis = await runAnalysis(row.id);
    if (analysis.ok) callsAnalysed++;
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
    transcriptionsStuck: stuck.length,
    transcriptsRecovered,
    callsAwaitingAnalysis: unanalysed.length,
    callsAnalysed,
  });
}
