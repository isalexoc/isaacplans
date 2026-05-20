import { NextResponse, after, type NextRequest } from "next/server";
import { verifyCallSummaryWebhookAuthDetailed } from "@/lib/agent-crm-webhook-verify";
import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
} from "@/lib/agent-crm-call-summary-config";
import {
  payloadFromWebhookBody,
  processCallSummary,
  type GhlCallWebhookPayload,
} from "@/lib/agent-crm-call-summary";
import { createCallSummaryLogger, sanitizeCallPayload } from "@/lib/agent-crm-call-summary-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CALL_EVENT_TYPES = new Set([
  "InboundMessage",
  "OutboundMessage",
]);

function isCallWebhookEvent(payload: GhlCallWebhookPayload, eventType: string | undefined): boolean {
  const mt = (payload.messageType ?? "").toUpperCase();
  const mts = (payload.messageTypeString ?? "").toUpperCase();
  if (mt === "CALL" || mts.includes("CALL") || mts.includes("VOICEMAIL")) return true;
  if (eventType && CALL_EVENT_TYPES.has(eventType) && (mt || mts)) return true;
  return false;
}

/**
 * Agent CRM (GoHighLevel) call webhooks → OpenAI summary → contact note.
 *
 * Configure in GHL:
 * - Native: subscribe InboundMessage + OutboundMessage; verify via X-GHL-Signature / X-WH-Signature
 * - Workflow custom webhook: POST here with Authorization: Bearer <AGENT_CRM_CALL_SUMMARY_WEBHOOK_SECRET>
 *
 * Debug: set AGENT_CRM_CALL_SUMMARY_DEBUG=true — logs appear in Vercel/server console.
 *
 * URL: https://www.isaacplans.com/api/webhooks/agent-crm/calls
 */
export async function POST(req: NextRequest) {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);

  log.debug("Webhook POST received", {
    path: req.nextUrl.pathname,
    hasGhlSig: Boolean(req.headers.get("x-ghl-signature")),
    hasLegacySig: Boolean(req.headers.get("x-wh-signature")),
    hasAuthHeader: Boolean(req.headers.get("authorization")),
  });

  if (!config.enabled) {
    log.info("Webhook skipped: feature disabled");
    return NextResponse.json({ received: true, skipped: "disabled" });
  }

  const rawBody = await req.text();
  log.debug("Webhook body size", { bytes: rawBody.length });

  const auth = verifyCallSummaryWebhookAuthDetailed(req, rawBody, config.webhookSecret);
  if (!auth.ok) {
    log.warn("Webhook unauthorized", { reason: auth.reason });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  log.debug("Webhook authorized", { method: auth.method });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    log.warn("Webhook invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = typeof body.type === "string" ? body.type : undefined;
  const payload = payloadFromWebhookBody(body);

  log.debug("Webhook parsed", {
    eventType,
    payload: sanitizeCallPayload(payload),
  });

  if (!isCallWebhookEvent(payload, eventType)) {
    log.debug("Webhook ignored: not a call event", { eventType, messageType: payload.messageType });
    return NextResponse.json({ received: true, skipped: "not_call_event" });
  }

  if (!isCallSummaryConfigured(config)) {
    log.error("Webhook not configured: missing API keys or CRM credentials");
    return NextResponse.json({ received: true, error: "not_configured" });
  }

  log.info("Webhook accepted; queueing call summary", {
    messageId: payload.messageId,
    contactId: payload.contactId,
    direction: payload.direction,
    callDuration: payload.callDuration,
  });

  after(async () => {
    log.debug("Background processing started", { messageId: payload.messageId });
    const result = await processCallSummary(payload);
    if (result.ok) {
      log.info("Background processing succeeded", {
        messageId: payload.messageId,
        noteId: result.noteId,
      });
    } else {
      log.info("Background processing finished without note", {
        messageId: payload.messageId,
        reason: result.reason,
      });
    }
  });

  return NextResponse.json({ received: true });
}

export async function GET() {
  const config = getCallSummaryConfig();
  return NextResponse.json({
    ok: true,
    route: "agent-crm-call-summary-webhook",
    enabled: config.enabled,
    debug: config.debug,
    configured: isCallSummaryConfigured(config),
  });
}
