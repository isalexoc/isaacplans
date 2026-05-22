import { NextResponse, after, type NextRequest } from "next/server";
import { verifyCallSummaryWebhookAuthDetailed } from "@/lib/agent-crm-webhook-verify";
import { processCallSummary, resolveCallProcessingId } from "@/lib/agent-crm-call-summary";
import { createCallSummaryLogger, sanitizeCallPayload } from "@/lib/agent-crm-call-summary-log";
import {
  getKixieCallSummaryConfig,
  isKixieCallSummaryConfigured,
} from "@/lib/kixie-call-summary-config";
import {
  isKixieEndCallEvent,
  kixieToCallSummaryPayload,
  parseKixieEndCallBody,
} from "@/lib/kixie-call-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Whisper + OpenAI on long calls can exceed 60s. */
export const maxDuration = 300;

/**
 * Kixie End Call webhook → Whisper transcript → OpenAI summary → GHL contact note.
 *
 * Configure in Kixie: Manage → Event Webhooks → End Call
 * URL: https://www.isaacplans.com/api/webhooks/kixie/calls
 * Header: Authorization: Bearer <KIXIE_CALL_SUMMARY_WEBHOOK_SECRET>
 */
export async function POST(req: NextRequest) {
  const config = getKixieCallSummaryConfig();
  const log = createCallSummaryLogger(config.callSummary.debug);

  log.debug("Kixie webhook POST received", {
    path: req.nextUrl.pathname,
    hasAuthHeader: Boolean(req.headers.get("authorization")),
  });

  if (!config.enabled) {
    log.info("Kixie webhook skipped: feature disabled");
    return NextResponse.json({ received: true, skipped: "disabled" });
  }

  const rawBody = await req.text();
  log.debug("Kixie webhook body size", { bytes: rawBody.length });

  const auth = verifyCallSummaryWebhookAuthDetailed(req, rawBody, config.webhookSecret);
  if (!auth.ok) {
    log.warn("Kixie webhook unauthorized", { reason: auth.reason });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  log.debug("Kixie webhook authorized", { method: auth.method });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    log.warn("Kixie webhook invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kixie = parseKixieEndCallBody(body);
  const hookEvent = kixie.data?.hookevent;

  if (!isKixieEndCallEvent(kixie)) {
    log.debug("Kixie webhook ignored: not endcall", { hookEvent });
    return NextResponse.json({ received: true, skipped: "not_endcall" });
  }

  if (!isKixieCallSummaryConfigured(config)) {
    log.error("Kixie webhook not configured: missing secret, CRM, or OpenAI");
    return NextResponse.json({ received: true, error: "not_configured" });
  }

  const mapped = await kixieToCallSummaryPayload(kixie, config);
  if (!mapped.ok) {
    log.info("Kixie webhook skipped", { reason: mapped.reason });
    return NextResponse.json({ received: true, skipped: mapped.reason });
  }

  const payload = mapped.payload;
  const processingId = resolveCallProcessingId(payload);

  log.info("Kixie webhook accepted; queueing call summary", {
    processingId,
    contactId: payload.contactId,
    direction: payload.direction,
    callDuration: payload.callDuration,
    hasRecording: Boolean(payload.attachments),
  });

  log.debug("Kixie mapped payload", { payload: sanitizeCallPayload(payload) });

  after(async () => {
    log.debug("Kixie background processing started", { processingId });
    const result = await processCallSummary(payload);
    if (result.ok) {
      log.info("Kixie background processing succeeded", {
        processingId,
        noteId: result.noteId,
      });
    } else {
      log.info("Kixie background processing finished without note", {
        processingId,
        reason: result.reason,
      });
    }
  });

  return NextResponse.json({ received: true });
}

export async function GET() {
  const config = getKixieCallSummaryConfig();
  return NextResponse.json({
    ok: true,
    route: "kixie-call-summary-webhook",
    enabled: config.enabled,
    configured: isKixieCallSummaryConfigured(config),
    minDurationSeconds: config.minDurationSeconds,
    debug: config.callSummary.debug,
    crmConfigured: Boolean(config.callSummary.piToken && config.callSummary.locationId),
  });
}
