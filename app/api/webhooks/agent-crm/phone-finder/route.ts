import { NextResponse, after, type NextRequest } from "next/server";

import { getPhoneFinderConfig } from "@/lib/phone-finder/config";
import { createPhoneFinderLogger } from "@/lib/phone-finder/log";
import { queuePhoneFinderRun } from "@/lib/phone-finder/process";
import { armPhoneFinderRun } from "@/lib/phone-finder/store";
import { isAuthorizedBearer, parseWebhookContactId } from "@/lib/phone-finder/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** The ACK is instant; the budget is for the inline fallback when QStash is off. */
export const maxDuration = 300;

/**
 * Phone Finder trigger, called by the GHL workflow "Phone Finder":
 *   Contact Changed (Find More Phones = Search) -> Custom Webhook (here) -> Clear field data.
 *
 * Auth: Authorization: Bearer <PHONE_FINDER_WEBHOOK_SECRET>. Body: {"contactId":"{{contact.id}}"}.
 * Nothing in the body besides the id is trusted; the job re-reads the contact from GHL.
 *
 * Makes no GHL call itself, so it answers immediately: arm one run per contact (a repeat
 * delivery while a run is in flight is a no-op), then queue it.
 */
export async function POST(req: NextRequest) {
  const config = getPhoneFinderConfig();
  const log = createPhoneFinderLogger(config.debug);

  if (!config.webhookSecret) {
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 500 });
  }
  if (!isAuthorizedBearer(req.headers.get("authorization"), config.webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!config.enabled) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const contactId = parseWebhookContactId(body);
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }

  const { armed, runId } = await armPhoneFinderRun(contactId);
  log.info("Trigger received", { contactId, armed, runId });

  if (armed && runId) {
    const origin = req.nextUrl.origin;
    after(async () => {
      await queuePhoneFinderRun(contactId, runId, origin, log);
    });
  }

  return NextResponse.json({ ok: true, queued: armed, runId, ...(armed ? {} : { reason: "in_flight" }) });
}

/** Health marker only — no configuration details for unauthenticated callers. */
export async function GET() {
  return NextResponse.json({ ok: true, route: "phone-finder" });
}
