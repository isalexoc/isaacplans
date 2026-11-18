import { NextResponse, after, type NextRequest } from "next/server";

import { getAiSetterConfig } from "@/lib/ai-setter/config";
import { handleWebhookPoke } from "@/lib/ai-setter/process";
import { isAuthorizedBearer, parseWebhookContactId } from "@/lib/phone-finder/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** ACK only: arming + publishing is a couple of DB writes; the turn runs from QStash. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 2048;

/**
 * AI Setter poke, called by two GHL workflows:
 *   "AI Setter – Mensaje entrante": Customer Replied (SMS, WhatsApp) → Custom Webhook
 *   "AI Setter – Isaac respondió":  User Replied → Custom Webhook
 * Auth: Authorization: Bearer <AI_SETTER_WEBHOOK_SECRET> (header only).
 * Body: {"event":"inbound"|"user_replied","contactId":"{{contact.id}}"}.
 *
 * The body is only a hint ("look at this contact"): the turn re-reads the contact and the thread
 * from GHL and decides everything itself. Disabled → 200 and nothing stored (no stale backlog).
 */
export async function POST(req: NextRequest) {
  const config = getAiSetterConfig();
  if (!config.webhookSecret) {
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 500 });
  }
  if (!isAuthorizedBearer(req.headers.get("authorization"), config.webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!config.enabled) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const contactId = parseWebhookContactId(body);
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }
  const eventRaw = body && typeof body === "object" ? (body as Record<string, unknown>).event : undefined;
  const event = eventRaw === "user_replied" ? "user_replied" : "inbound";

  const origin = req.nextUrl.origin;
  after(async () => {
    await handleWebhookPoke(contactId, event, origin);
  });
  return NextResponse.json({ ok: true, accepted: true });
}

/** Health marker only — no configuration details for unauthenticated callers. */
export async function GET() {
  return NextResponse.json({ ok: true, route: "ai-setter" });
}
