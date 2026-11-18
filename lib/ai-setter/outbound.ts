/**
 * Turning a decided reply into a stored message and routing it:
 *   shadow   — AI_SETTER_DRY_RUN: recorded, never sent (Isaac reviews what it WOULD send);
 *   approved — a compliance template (HELP / opt-out) or a template Isaac approved (same hash):
 *              a send job is queued (held until the lead's window when `notBefore` is set);
 *   draft    — model free text, an unapproved template, or anything a fallback model produced:
 *              waits for Isaac in the inbox / Telegram, and expires.
 * One live draft per lead: a new outbound supersedes the previous pending one.
 *
 * Pure apart from the injected ports.
 */

import { autoFixEnglishPunctuation } from "./guard";
import { safeCode } from "./text-utils";
import { isComplianceTemplate, templateHash, type TemplateId } from "./templates";
import { withDisclosure } from "./ui-strings";
import type {
  AiSetterPorts,
  AiSetterSettings,
  Channel,
  Lang,
  LeadRecord,
  LlmUsage,
  MessageRecord,
  ProductLine,
  Register,
} from "./types";

export const DISCLOSURE_TTL_MS = 7 * 86_400_000;

/** The AI notice goes in the first AI message on a channel, after 7 days of silence, and after a resume. */
export function needsDisclosure(lead: LeadRecord, channel: Channel, now: Date): boolean {
  const last = lead.disclosedChannels[channel];
  if (!last) return true;
  const t = Date.parse(last);
  return !Number.isFinite(t) || now.getTime() - t > DISCLOSURE_TTL_MS;
}

export function composeText(
  body: string,
  opts: {
    lang: Lang;
    register: Register;
    firstName: string | null;
    brand: string;
    includeDisclosure: boolean;
    includeStop: boolean;
  }
): string {
  const text = withDisclosure(body, {
    lang: opts.lang,
    register: opts.register,
    firstName: opts.firstName,
    brand: opts.brand,
    includeDisclosure: opts.includeDisclosure,
    includeGreeting: false,
    includeStop: opts.includeStop,
  });
  return opts.lang === "en" ? autoFixEnglishPunctuation(text) : text;
}

export type OutboundRequest = {
  contactId: string;
  channel: Channel;
  kind: "template" | "free_text";
  templateId: TemplateId | null;
  /** Final text, disclosure and STOP already included. */
  text: string;
  intent: string;
  inReplyToInboundId: string | null;
  turnRunId: string | null;
  /** Hold until the lead's window opens. */
  notBefore: Date | null;
  /** Compliance snapshot (no message text). */
  decision: Record<string, unknown>;
  guardFlags: string[];
  usage: LlmUsage | null;
  /** Route to approval even if the template is approved (e.g. a fallback model chose it). */
  forceApproval: boolean;
};

export type DispatchContext = {
  settings: AiSetterSettings;
  firstName: string | null;
  product: ProductLine | null;
  stateCode: string | null;
  /** Lead-local "now", for Isaac's card. */
  leadLocalTime: string;
  /** "now" or a lead-local time, for Isaac's card. */
  sendsAtLabel: string;
};

/** HELP, opt-out confirmations and clarifications are only worth sending promptly. */
export const COMPLIANCE_TTL_MS = 30 * 60_000;

export type DispatchResult = { message: MessageRecord; queued: boolean };

export async function dispatchOutbound(
  ports: AiSetterPorts,
  req: OutboundRequest,
  ctx: DispatchContext
): Promise<DispatchResult> {
  const { store, queue, notify, config } = ports;
  const now = ports.now();
  const compliance = req.templateId ? isComplianceTemplate(req.templateId) : false;
  const hash = req.templateId ? templateHash(req.templateId) : null;
  const approvedTemplate = Boolean(req.templateId && hash && ctx.settings.approvedTemplates[req.templateId] === hash);

  const status: MessageRecord["status"] = config.dryRun
    ? "shadow"
    : compliance
      ? "approved"
      : req.kind === "template" && approvedTemplate && !req.forceApproval
        ? "approved"
        : "draft";

  if (!compliance) await store.supersedePendingDrafts(req.contactId, "replaced_by_newer");

  const ttlMs = config.draftTtlHours * 3_600_000;
  const expiresAt = compliance
    ? new Date(now.getTime() + COMPLIANCE_TTL_MS)
    : status === "draft"
      ? new Date(Math.max(now.getTime() + ttlMs, (req.notBefore?.getTime() ?? 0) + 3_600_000))
      : null;

  const message = await store.createMessage({
    contactId: req.contactId,
    channel: req.channel,
    kind: req.kind,
    status,
    templateId: req.templateId,
    templateHash: hash,
    body: req.text,
    intent: safeCode(req.intent, "free_text"),
    inReplyToInboundId: req.inReplyToInboundId,
    turnRunId: req.turnRunId,
    decision: { ...req.decision, compliance, approvedTemplate },
    guardFlags: req.guardFlags,
    model: req.usage?.model ?? null,
    inputTokens: req.usage?.inputTokens ?? 0,
    outputTokens: req.usage?.outputTokens ?? 0,
    cacheReadTokens: req.usage?.cacheReadTokens ?? 0,
    costMicros: req.usage?.costMicros ?? 0,
    usedFallback: req.usage?.usedFallback ?? false,
    notBefore: req.notBefore,
    expiresAt,
  });

  let queued = false;
  if (status === "approved") {
    queued = await queue.publishSend(message.id, req.notBefore);
  } else if (status === "draft") {
    await notify.notify({
      kind: "draft_ready",
      messageId: message.id,
      contactId: req.contactId,
      firstName: ctx.firstName,
      product: ctx.product,
      state: ctx.stateCode,
      leadLocalTime: ctx.leadLocalTime,
      sendsAt: ctx.sendsAtLabel,
      // The AI's own words (never the lead's), so Isaac reads what [Enviar] approves.
      preview: req.kind === "free_text" ? req.text.slice(0, 500) : null,
    });
  }
  await store.recordEvent(req.contactId, `outbound_${status}`, {
    messageId: message.id,
    templateId: req.templateId,
    intent: safeCode(req.intent, "free_text"),
    kind: req.kind,
  });
  return { message, queued };
}
