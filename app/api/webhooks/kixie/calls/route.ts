import { NextResponse, after, type NextRequest } from "next/server";
import { verifyCallSummaryWebhookAuthDetailed } from "@/lib/agent-crm-webhook-verify";
import { resolveCallProcessingId, type GhlCallWebhookPayload } from "@/lib/agent-crm-call-summary";

function firstAttachmentUrl(attachments: GhlCallWebhookPayload["attachments"]): string {
  if (!attachments) return "";
  if (typeof attachments === "string" && attachments.startsWith("http")) return attachments;
  if (Array.isArray(attachments)) {
    for (const item of attachments) {
      if (typeof item === "string" && item.startsWith("http")) return item;
    }
  }
  return "";
}
import { enqueueKixieCallJob } from "@/lib/agent-crm-call-summary-store";
import { createCallSummaryLogger, sanitizeCallPayload } from "@/lib/agent-crm-call-summary-log";
import { triggerKixieProcessorKick } from "@/lib/kixie-call-processor";
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
/** Webhook only enqueues; processing runs on cron (800s). */
export const maxDuration = 60;

/**
 * Kixie End Call webhook → queue job → cron processor (Whisper + OpenAI + GHL note).
 *
 * URL: https://www.isaacplans.com/api/webhooks/kixie/calls
 * Header: x-call-summary-secret: <KIXIE_CALL_SUMMARY_WEBHOOK_SECRET>
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
  const recordingUrl = firstAttachmentUrl(payload.attachments);

  if (!recordingUrl) {
    log.warn("Kixie webhook: no recording URL", { processingId });
    return NextResponse.json({ received: true, skipped: "missing_recording_url" });
  }

  const queued = await enqueueKixieCallJob(
    {
      messageId: processingId,
      contactId: payload.contactId!,
      locationId: payload.locationId!,
      recordingUrl,
      direction: payload.direction ?? null,
      callDurationSeconds:
        typeof payload.callDuration === "number"
          ? payload.callDuration
          : Number.parseInt(String(payload.callDuration ?? 0), 10) || null,
    },
    log
  );

  log.info("Kixie webhook accepted", {
    processingId,
    contactId: payload.contactId,
    queued: queued.queued,
    queueReason: queued.reason,
    hasRecording: true,
  });

  log.debug("Kixie mapped payload", { payload: sanitizeCallPayload(payload) });

  if (queued.queued) {
    const origin = req.nextUrl.origin;
    after(async () => {
      await triggerKixieProcessorKick(origin);
    });
  }

  return NextResponse.json({
    received: true,
    queued: queued.queued,
    processingId,
    skipped: queued.reason,
  });
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
    asyncQueue: true,
    crmConfigured: Boolean(config.callSummary.piToken && config.callSummary.locationId),
  });
}
