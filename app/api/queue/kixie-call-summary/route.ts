import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { processKixieJobById } from "@/lib/kixie-call-processor";
import { createCallSummaryLogger } from "@/lib/agent-crm-call-summary-log";
import { getKixieCallSummaryConfig } from "@/lib/kixie-call-summary-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Whisper download + chunked transcription + GPT summary can take a while. */
export const maxDuration = 800;

/** Reasons that will never succeed on retry → return 2xx so QStash stops. */
const PERMANENT_REASONS = new Set(["missing_recording_url"]);

/**
 * QStash delivery endpoint for a single Kixie call-summary job.
 *
 * Published from the Kixie webhook (app/api/webhooks/kixie/calls). Authenticated
 * by the Upstash-Signature header (not CRON_SECRET). HTTP status drives retries:
 * 200 = done/no-retry, 500 = transient → QStash retries with backoff.
 */
export async function POST(req: NextRequest) {
  const log = createCallSummaryLogger(getKixieCallSummaryConfig().callSummary.debug);
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    log.warn("QStash kixie endpoint: invalid signature");
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

  const result = await processKixieJobById(messageId);

  // Nothing to do (duplicate delivery / already completed / not configured) or
  // succeeded / permanently failed → 200 so QStash does not retry.
  const isRetryable =
    result.processed === true &&
    result.ok === false &&
    !PERMANENT_REASONS.has(result.reason ?? "");

  if (isRetryable) {
    log.warn("QStash kixie endpoint: transient failure, asking QStash to retry", {
      messageId,
      reason: result.reason,
    });
    return NextResponse.json({ ok: false, retry: true, ...result }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}
