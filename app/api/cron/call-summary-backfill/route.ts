import { NextRequest, NextResponse } from "next/server";
import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
} from "@/lib/agent-crm-call-summary-config";
import { runCallSummaryBackfill } from "@/lib/agent-crm-call-summary";
import { createCallSummaryLogger } from "@/lib/agent-crm-call-summary-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Backfill call summaries for recent calls not yet processed.
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Optional query: ?days=30&max=15
 *
 * Debug: AGENT_CRM_CALL_SUMMARY_DEBUG=true
 */
export async function GET(request: NextRequest) {
  return handleBackfill(request);
}

export async function POST(request: NextRequest) {
  return handleBackfill(request);
}

async function handleBackfill(request: NextRequest) {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);

  log.debug("Cron backfill request", {
    method: request.method,
    days: request.nextUrl.searchParams.get("days"),
    max: request.nextUrl.searchParams.get("max"),
  });

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    log.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn("Cron unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!config.enabled || !isCallSummaryConfigured(config)) {
    log.warn("Cron skipped: disabled or not configured");
    return NextResponse.json(
      { error: "Call summary disabled or not fully configured" },
      { status: 503 }
    );
  }

  const daysParam = request.nextUrl.searchParams.get("days");
  const maxParam = request.nextUrl.searchParams.get("max");
  const overrides: { backfillDays?: number; backfillMaxPerRun?: number } = {};
  if (daysParam) {
    const n = Number.parseInt(daysParam, 10);
    if (Number.isFinite(n) && n > 0) overrides.backfillDays = n;
  }
  if (maxParam) {
    const n = Number.parseInt(maxParam, 10);
    if (Number.isFinite(n) && n > 0) overrides.backfillMaxPerRun = n;
  }

  try {
    const result = await runCallSummaryBackfill(overrides);
    log.info("Cron backfill response", result);
    return NextResponse.json({ success: true, debug: config.debug, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Cron backfill error", { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
