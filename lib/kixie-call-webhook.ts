import { agentCrmFindContactByPhone } from "@/lib/agent-crm-contacts";
import type { GhlCallWebhookPayload } from "@/lib/agent-crm-call-summary";
import { normalizeMergeField, parseCallDuration } from "@/lib/agent-crm-call-summary";
import type { KixieCallSummaryConfig } from "@/lib/kixie-call-summary-config";

export type KixieCallDetails = {
  callid?: string;
  externalid?: string;
  contactid?: string | number;
  externalcrmid?: string | number;
  crmlink?: string;
  recordingurl?: string;
  duration?: number;
  callstatus?: string;
  calltype?: string;
  calldate?: string;
  callEndDate?: string;
  fromnumber?: string;
  tonumber?: string;
  disposition?: string;
};

export type KixieEndCallWebhook = {
  data?: {
    callDetails?: KixieCallDetails;
    hookevent?: string;
    customernumber?: string;
    businessnumber?: string;
    number?: string;
  };
};

const ANSWERED_STATUSES = new Set(["answered", "completed"]);

export function parseKixieEndCallBody(body: Record<string, unknown>): KixieEndCallWebhook {
  const data = body.data;
  if (!data || typeof data !== "object") return {};
  return { data: data as KixieEndCallWebhook["data"] };
}

export function isKixieEndCallEvent(webhook: KixieEndCallWebhook): boolean {
  const event = (webhook.data?.hookevent ?? "").toLowerCase();
  if (event && event !== "endcall") return false;
  return Boolean(webhook.data?.callDetails);
}

export function kixieCallId(details: KixieCallDetails): string | null {
  const id = normalizeMergeField(details.callid ?? details.externalid);
  return id || null;
}

export function kixieProcessingId(callid: string): string {
  return `kx_${callid}`;
}

/** Parse GHL location + contact from app.gohighlevel.com contact detail URL. */
export function parseGhlIdsFromCrmlink(crmlink: string): {
  locationId?: string;
  contactId?: string;
} {
  const loc = crmlink.match(/\/location\/([^/]+)\//i);
  const contact = crmlink.match(/\/contacts\/detail\/([^/?#]+)/i);
  return {
    locationId: loc?.[1],
    contactId: contact?.[1],
  };
}

export function resolveKixieContactId(details: KixieCallDetails): string | null {
  for (const raw of [details.contactid, details.externalcrmid]) {
    const id = normalizeMergeField(raw);
    if (id) return id;
  }
  const link = normalizeMergeField(details.crmlink);
  if (link) {
    const parsed = parseGhlIdsFromCrmlink(link);
    if (parsed.contactId) return parsed.contactId;
  }
  return null;
}

export function resolveKixieLocationId(
  details: KixieCallDetails,
  fallbackLocationId: string | null
): string | null {
  const link = normalizeMergeField(details.crmlink);
  if (link) {
    const parsed = parseGhlIdsFromCrmlink(link);
    if (parsed.locationId) return parsed.locationId;
  }
  return fallbackLocationId;
}

export function kixieDirection(calltype: string | undefined): string {
  const t = (calltype ?? "").toLowerCase();
  if (t === "incoming" || t === "inbound") return "inbound";
  if (t === "outgoing" || t === "outbound") return "outbound";
  return "unknown";
}

export function shouldProcessKixieCall(
  details: KixieCallDetails,
  config: KixieCallSummaryConfig
): { ok: boolean; reason?: string } {
  const callid = kixieCallId(details);
  if (!callid) return { ok: false, reason: "missing_callid" };

  const status = normalizeMergeField(details.callstatus).toLowerCase();
  if (status && !ANSWERED_STATUSES.has(status) && !status.includes("answered")) {
    if (
      status.includes("no-answer") ||
      status.includes("busy") ||
      status.includes("failed") ||
      status.includes("missed")
    ) {
      return { ok: false, reason: `call_status_${status}` };
    }
  }

  const duration = typeof details.duration === "number" ? details.duration : parseCallDuration(details.duration);
  if (duration < config.minDurationSeconds) {
    return { ok: false, reason: "duration_below_minimum" };
  }

  const recording = normalizeMergeField(details.recordingurl);
  if (!recording || !recording.startsWith("http")) {
    return { ok: false, reason: "missing_recording_url" };
  }

  return { ok: true };
}

export type KixieToCallSummaryResult =
  | { ok: true; payload: GhlCallWebhookPayload }
  | { ok: false; reason: string };

/** Map Kixie End Call payload → shared GHL call summary payload. */
export async function kixieToCallSummaryPayload(
  webhook: KixieEndCallWebhook,
  config: KixieCallSummaryConfig
): Promise<KixieToCallSummaryResult> {
  const details = webhook.data?.callDetails;
  if (!details) return { ok: false, reason: "missing_call_details" };

  const gate = shouldProcessKixieCall(details, config);
  if (!gate.ok) return { ok: false, reason: gate.reason ?? "skipped" };

  const callid = kixieCallId(details)!;
  let contactId = resolveKixieContactId(details);
  const locationId = resolveKixieLocationId(details, config.callSummary.locationId);
  const customerPhone =
    normalizeMergeField(webhook.data?.customernumber) ||
    normalizeMergeField(details.tonumber) ||
    normalizeMergeField(details.fromnumber);

  if (!contactId && customerPhone && locationId && config.callSummary.piToken) {
    const found = await agentCrmFindContactByPhone(
      customerPhone,
      locationId,
      config.callSummary.piToken,
      "[KIXIE_CALL_SUMMARY]"
    );
    contactId = found?.id ?? null;
  }

  if (!contactId) return { ok: false, reason: "missing_contact_id" };
  if (!locationId) return { ok: false, reason: "missing_location_id" };

  const recordingurl = normalizeMergeField(details.recordingurl);
  const payload: GhlCallWebhookPayload = {
    contactId,
    locationId,
    messageId: kixieProcessingId(callid),
    messageType: "CALL",
    direction: kixieDirection(details.calltype),
    callDuration: details.duration,
    callStatus: normalizeMergeField(details.callstatus) || "answered",
    dateAdded: normalizeMergeField(details.callEndDate) || normalizeMergeField(details.calldate),
    attachments: [recordingurl],
    from: normalizeMergeField(details.fromnumber) || undefined,
    to: normalizeMergeField(details.tonumber) || undefined,
  };

  return { ok: true, payload };
}
