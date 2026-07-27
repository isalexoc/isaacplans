import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { processVideoJob } from "@/lib/social-media-studio/video-job-processor";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * QStash delivery endpoint for one video-generation tick.
 *
 * The worker advances the job by one unit and tells us whether it needs another tick;
 * if so we publish the next (delayed) delivery here — so a long presenter/render job
 * keeps progressing on the server while the browser is closed. Authenticated by the
 * Upstash-Signature header. Always 200 (the worker owns retry/backoff via self-scheduling).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jobId: string | undefined;
  try {
    jobId = (JSON.parse(rawBody) as { jobId?: string }).jobId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const result = await processVideoJob(jobId);

  if (result.kind === "continue" || result.kind === "retry") {
    await enqueueVideoJobTick(jobId, { delaySeconds: result.delaySeconds, requestOrigin: req.nextUrl.origin });
  }

  return NextResponse.json({ ok: true, kind: result.kind });
}
