import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { createLeadsTheWayLogger } from "@/lib/leads-the-way/log";
import { getLeadsTheWayConfig } from "@/lib/leads-the-way/config";
import {
  LEADS_THE_WAY_PERMANENT_REASONS,
  processLeadJobById,
} from "@/lib/leads-the-way/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Parse + OpenAI fallback + a few CRM calls; comfortably under this. */
export const maxDuration = 120;

/**
 * QStash delivery endpoint for a single Leads the Way lead job.
 *
 * Published from the inbound-email webhook (app/api/webhooks/leads-the-way). Authenticated by the
 * Upstash-Signature header (not CRON_SECRET). HTTP status drives retries:
 * 200 = done/no-retry, 500 = transient → QStash retries with backoff.
 */
export async function POST(req: NextRequest) {
  const log = createLeadsTheWayLogger(getLeadsTheWayConfig().debug);
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    log.warn("QStash leads-the-way endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let messageId: string | undefined;
  try {
    messageId = (JSON.parse(rawBody) as { messageId?: string }).messageId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const result = await processLeadJobById(messageId, log);

  const isRetryable =
    result.processed === true &&
    result.ok === false &&
    !LEADS_THE_WAY_PERMANENT_REASONS.has(result.reason ?? "");

  if (isRetryable) {
    log.warn("QStash leads-the-way endpoint: transient failure, asking QStash to retry", {
      messageId,
      reason: result.reason,
    });
    return NextResponse.json({ ...result, ok: false, retry: true }, { status: 500 });
  }

  return NextResponse.json({ ...result, ok: true });
}
