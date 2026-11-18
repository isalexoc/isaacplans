import { NextResponse, type NextRequest } from "next/server";

import { aiSetterLog, processQueueJob } from "@/lib/ai-setter/process";
import { verifyQStashRequest } from "@/lib/qstash/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A turn: GHL reads + up to 4 Claude calls + writes, inside a 240 s budget. */
export const maxDuration = 300;

/**
 * QStash delivery endpoint for AI Setter jobs (turn, send, verify_send, call_now_timeout),
 * authenticated by the Upstash-Signature header. Retries are scheduled by the code itself
 * (re-arm with a delay), so this answers 200 except for bad input or an unexpected throw.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!(await verifyQStashRequest(req, rawBody))) {
    aiSetterLog().warn("Queue endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { status, result } = await processQueueJob(body, req.nextUrl.origin);
  return NextResponse.json({ ok: status < 400, result }, { status });
}
