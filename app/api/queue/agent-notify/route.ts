import { NextResponse, type NextRequest } from "next/server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "@/lib/email/transactional";
import { getIntakeConfig } from "@/lib/intake-configs";
import { getIntakeSessionById } from "@/lib/intake-core/secure-capture";
import { claimSessionDataFlag, releaseSessionDataFlag } from "@/lib/intake-core/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { agentAlertEmail } from "@/lib/tenancy/agent-alert-email";
import { agentAreaLocale, agentAreaPath } from "@/lib/tenancy/agent-area-routes";
import { AGENT_ALERTS_KEY, agentAlertAddress, alertSentFlag, parseAgentAlertJob } from "@/lib/tenancy/agent-data";
import { ownerAgentOf } from "@/lib/tenancy/context";
import { mainSiteUrl } from "@/lib/tenancy/site-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QStash delivery endpoint for one alert to an agent (published by lib/tenancy/agent-jobs.ts): a
 * client started an application, completed one, or sent the secure form. Authenticated by the
 * Upstash-Signature header, not CRON_SECRET.
 *
 * The email goes to the agent's alert email (else their contact email, else their login email), in
 * the agent's language, from `PLATFORM_EMAIL_FROM` through Resend, and carries NO client details:
 * what happened and a link to the agent's dashboard (lib/tenancy/agent-alert-email.ts).
 *
 * Only an agent's application: the owner is looked up again here, and one of Isaac's is skipped.
 * Idempotent: the event's flag (`data.agentAlerts["sent:<event>"]`) is claimed in one statement
 * before sending, so a redelivery sends nothing twice; a failed send gives the flag back, and a
 * retryable failure answers 500 so QStash tries again.
 */

const done = (outcome: string) => NextResponse.json({ ok: true, outcome });

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[agent-notify] invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const job = parseAgentAlertJob(parsed);
  if (!job) return NextResponse.json({ error: "Invalid job" }, { status: 400 });
  const config = getIntakeConfig(job.lob);
  if (!config) return done("unknown_line");
  // No email on this deployment: nothing to send, so nothing to read either.
  if (!transactionalEmailConfigured()) return done("email_off");

  try {
    const session = await getIntakeSessionById(config.lob, job.sessionId);
    if (!session) return done("gone");
    const agent = await ownerAgentOf(session.ownerUserId);
    if (agent === "unknown") return NextResponse.json({ error: "Owner lookup failed" }, { status: 503 });
    if (!agent) return done("not_agent");
    const to = agentAlertAddress(agent);
    if (!to) return done("no_address");

    const flag = alertSentFlag(job.event);
    if (!(await claimSessionDataFlag(session.id, AGENT_ALERTS_KEY, flag, new Date().toISOString()))) {
      return done("already_sent");
    }

    const locale = agentAreaLocale(agent.defaultLocale);
    const email = agentAlertEmail({ kind: job.kind, locale, dashboardUrl: `${mainSiteUrl()}${agentAreaPath(locale)}` });
    const result = await sendTransactionalEmail({ to, ...email });
    if (result.status === "sent") return done("sent");

    await releaseSessionDataFlag(session.id, AGENT_ALERTS_KEY, flag);
    if (result.status === "failed" && result.retryable) {
      return NextResponse.json({ error: "Email failed, retry" }, { status: 500 });
    }
    return done(result.status === "failed" ? "email_refused" : result.status);
  } catch (error) {
    console.error("[agent-notify] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
