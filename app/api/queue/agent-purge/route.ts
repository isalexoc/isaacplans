import { NextResponse, type NextRequest } from "next/server";
import { getIntakeConfig } from "@/lib/intake-configs";
import { getIntakeSessionById } from "@/lib/intake-core/secure-capture";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { agentPurgeSuperseded, parseAgentPurgeJob, purgeHopDelaySeconds } from "@/lib/tenancy/agent-data";
import { eraseAgentApplicationSensitive, scheduleAgentPurge } from "@/lib/tenancy/agent-jobs";
import { ownerAgentOf } from "@/lib/tenancy/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QStash delivery endpoint for the 30-day purge of an agent's application (published at completion
 * by lib/tenancy/agent-jobs.ts). Authenticated by the Upstash-Signature header, not CRON_SECRET.
 *
 * QStash's free plan caps a delay at 7 days, so the job hops: until it is due it only queues itself
 * again (no database read at all), and once due it erases every sensitive value still on file
 * (lib/tenancy/agent-jobs.ts `eraseAgentApplicationSensitive`: one statement, the
 * `sensitivePurgedAt` stamp, a "purge" row with field names only). Idempotent: an application with
 * nothing left to erase (the agent already marked it "entered in Impact", or an earlier delivery
 * ran) is left alone. A job a later completion replaced (reopened, then completed again) stands
 * down: that completion queued its own. If this chain dies, the daily reconcile erases what is left
 * (`reconcileAgentPurges`).
 *
 * Only an agent's completed application: the owner is looked up again, and Isaac's are never
 * touched.
 */

const done = (outcome: string) => NextResponse.json({ ok: true, outcome });

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[agent-purge] invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const job = parseAgentPurgeJob(parsed);
  if (!job) return NextResponse.json({ error: "Invalid job" }, { status: 400 });

  try {
    const now = Date.now() / 1000;
    if (purgeHopDelaySeconds(job.dueAt, now) !== null) {
      // Not due yet: the next hop. A failure answers 500, so QStash delivers this one again.
      return (await scheduleAgentPurge(job, now))
        ? done("rescheduled")
        : NextResponse.json({ error: "Could not reschedule" }, { status: 500 });
    }

    const config = getIntakeConfig(job.lob);
    if (!config) return done("unknown_line");
    const session = await getIntakeSessionById(config.lob, job.sessionId);
    if (!session) return done("gone");
    const agent = await ownerAgentOf(session.ownerUserId);
    if (agent === "unknown") return NextResponse.json({ error: "Owner lookup failed" }, { status: 503 });
    if (!agent) return done("not_agent");
    if (session.status !== "completed") return done("not_completed");
    if (agentPurgeSuperseded(job.dueAt, session.completedAt)) return done("superseded");

    const outcome = await eraseAgentApplicationSensitive(config, session);
    // The link was reset between the read and the write: deliver again, and read it afresh.
    if (outcome === "moved") return NextResponse.json({ error: "Session moved, retry" }, { status: 500 });
    return done(outcome);
  } catch (error) {
    console.error("[agent-purge] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
