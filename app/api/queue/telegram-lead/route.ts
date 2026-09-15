import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { getTelegramLeadsConfig } from "@/lib/telegram/config";
import { createTelegramLogger } from "@/lib/telegram/log";
import {
  TELEGRAM_PERMANENT_REASONS,
  processTelegramLeadJobById,
} from "@/lib/telegram/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Parse + optional OpenAI fallback + a handful of CRM calls. */
export const maxDuration = 120;

/**
 * QStash delivery endpoint for a single Telegram lead job.
 *
 * Published from the inbound webhook. Authenticated by the Upstash-Signature header (not
 * CRON_SECRET). HTTP status drives retries: 200 = done, 500 = transient so QStash backs off and
 * tries again.
 */
export async function POST(req: NextRequest) {
  const log = createTelegramLogger(getTelegramLeadsConfig().debug);
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    log.warn("QStash telegram-lead endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let leadKey: string | undefined;
  try {
    leadKey = (JSON.parse(rawBody) as { leadKey?: string }).leadKey;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!leadKey) {
    return NextResponse.json({ error: "leadKey required" }, { status: 400 });
  }

  const result = await processTelegramLeadJobById(leadKey, log);

  const isRetryable =
    result.processed === true &&
    result.ok === false &&
    !TELEGRAM_PERMANENT_REASONS.has(result.reason ?? "");

  if (isRetryable) {
    log.warn("Transient failure; asking QStash to retry", { leadKey, reason: result.reason });
    return NextResponse.json({ ...result, ok: false, retry: true }, { status: 500 });
  }

  return NextResponse.json({ ...result, ok: true });
}
