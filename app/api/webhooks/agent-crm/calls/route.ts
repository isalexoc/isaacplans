import { NextResponse, after, type NextRequest } from "next/server";
import { verifyCallSummaryWebhookAuthDetailed } from "@/lib/agent-crm-webhook-verify";
import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
} from "@/lib/agent-crm-call-summary-config";
import {
  isCallSummaryWebhookPayload,
  payloadFromWebhookBody,
  processCallSummary,
  resolveCallProcessingId,
} from "@/lib/agent-crm-call-summary";
import { createCallSummaryLogger, sanitizeCallPayload } from "@/lib/agent-crm-call-summary-log";
import { isCallEndedPing, queueEndedCrmCalls } from "@/lib/ghl-call-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Agent CRM (GoHighLevel) call webhooks → OpenAI summary → contact note.
 *
 * Current workflow (Call Status = completed + Custom Webhook), sends only:
 * - contactId: {{contact.id}}
 * The app finds the call that just ended and transcribes its recording (lib/ghl-call-jobs.ts).
 *
 * Older workflow (Transcript Generated + Custom Webhook), still accepted. GHL stopped
 * transcribing these calls on 2026-09-21:
 * - transcript: {{transcript_generated.call_transcript}}
 * - contactId: {{contact.id}}
 * - direction / duration / status from transcript_generated.* or phoneCall.*
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

  if (isCallEndedPing(payload)) {
    if (!isCallSummaryConfigured(config)) {
      log.error("Webhook not configured: missing API keys or CRM credentials");
      return NextResponse.json({ received: true, error: "not_configured" });
    }
    const contactId = payload.contactId!.trim();
    const origin = req.nextUrl.origin;
    log.info("Webhook accepted; looking up the contact's ended CRM call", { contactId });
    after(async () => {
      try {
        await queueEndedCrmCalls(contactId, origin);
      } catch (err) {
        log.error("CRM call lookup failed", {
          contactId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
    return NextResponse.json({ received: true, lookup: "crm_call" });
  }

  if (!isCallSummaryWebhookPayload(payload, eventType)) {
    log.debug("Webhook ignored: not a call event", { eventType, messageType: payload.messageType });
    return NextResponse.json({ received: true, skipped: "not_call_event" });
  }

  if (!isCallSummaryConfigured(config)) {
    log.error("Webhook not configured: missing API keys or CRM credentials");
    return NextResponse.json({ received: true, error: "not_configured" });
  }

  const processingId = resolveCallProcessingId(payload);

  log.info("Webhook accepted; queueing call summary", {
    processingId,
    contactId: payload.contactId,
    direction: payload.direction,
    callDuration: payload.callDuration,
    hasWorkflowTranscript: Boolean(payload.transcript),
  });

  after(async () => {
    log.debug("Background processing started", { processingId });
    const result = await processCallSummary(payload);
    if (result.ok) {
      log.info("Background processing succeeded", {
        processingId,
        noteId: result.noteId,
      });
    } else {
      log.info("Background processing finished without note", {
        processingId,
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
    acceptsWorkflowTranscript: true,
  });
}
