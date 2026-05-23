import { NextRequest, NextResponse } from "next/server";
import { createCallSummaryLogger } from "@/lib/agent-crm-call-summary-log";
import { processOneKixieCallJob } from "@/lib/kixie-call-processor";
import {
  getKixieCallSummaryConfig,
  isKixieCallSummaryConfigured,
} from "@/lib/kixie-call-summary-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel Pro: long downloads + chunked Whisper + GPT. */
export const maxDuration = 800;

/**
 * Process queued Kixie End Call jobs (one per invocation).
 *
 * Authorization: Bearer <CRON_SECRET>
 * Schedule: every 3 minutes (vercel.json)
 */
export async function GET(request: NextRequest) {
  return handleProcessor(request);
}

export async function POST(request: NextRequest) {
  return handleProcessor(request);
}

async function handleProcessor(request: NextRequest) {
  const config = getKixieCallSummaryConfig();
  const log = createCallSummaryLogger(config.callSummary.debug);

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      log.warn("Kixie cron unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!config.enabled || !isKixieCallSummaryConfigured(config)) {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  log.info("Kixie cron processor started");
  const result = await processOneKixieCallJob();
  log.info("Kixie cron processor finished", result);

  return NextResponse.json({ ok: true, ...result });
}
