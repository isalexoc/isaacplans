import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash/verify";
import { finalizeAcaConfirmation } from "@/lib/aca-confirmation/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * QStash delivery endpoint: finish one signed ACA confirmation (PDF archive, the copy in the
 * contact's Documents, the note, the tag). Published by the signing route the moment the client
 * signs. Authenticated by the Upstash-Signature header, not CRON_SECRET.
 *
 * A step that failed answers 500, so QStash retries with its own backoff; the steps already done
 * are skipped on the retry. The daily queue-reconcile is the backstop after QStash gives up.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    console.warn("[ACA_CONFIRMATION] finalize endpoint: invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let confirmationId: unknown;
  try {
    confirmationId = (JSON.parse(rawBody) as { confirmationId?: unknown }).confirmationId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof confirmationId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(confirmationId)) {
    return NextResponse.json({ error: "confirmationId required" }, { status: 400 });
  }

  const result = await finalizeAcaConfirmation(confirmationId);
  return NextResponse.json({ ok: result.done, steps: result.steps }, { status: result.done ? 200 : 500 });
}
