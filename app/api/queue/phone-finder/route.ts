import { NextResponse, type NextRequest } from "next/server";

import { getPhoneFinderConfig } from "@/lib/phone-finder/config";
import { createPhoneFinderLogger } from "@/lib/phone-finder/log";
import { processPhoneFinderRun } from "@/lib/phone-finder/process";
import { verifyQStashRequest } from "@/lib/qstash/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Up to 3 EnformionGO searches + 6 Trestle checks + 2-3 CRM calls, each with its own timeout. */
export const maxDuration = 300;

/**
 * QStash delivery endpoint for one Phone Finder run (published by the trigger webhook and the
 * daily reconcile). Authenticated by the Upstash-Signature header.
 *
 * 500 = transient, QStash backs off and redelivers; the run row is back to `pending` and its
 * saved result (if any) means the retry does not pay the vendors again. Everything else is 200.
 */
export async function POST(req: NextRequest) {
  const log = createPhoneFinderLogger(getPhoneFinderConfig().debug);
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    log.warn("Queue endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { contactId?: unknown; runId?: unknown };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const contactId = typeof payload.contactId === "string" ? payload.contactId : "";
  const runId = typeof payload.runId === "string" ? payload.runId : "";
  if (!contactId || !runId) {
    return NextResponse.json({ error: "contactId and runId required" }, { status: 400 });
  }

  const result = await processPhoneFinderRun(contactId, runId, log);
  if (result.kind === "retry") {
    return NextResponse.json({ ...result, ok: false, retry: true }, { status: 500 });
  }
  return NextResponse.json({ ...result, ok: true });
}
