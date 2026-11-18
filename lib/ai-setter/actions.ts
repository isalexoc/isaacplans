/**
 * What Isaac can do from the panel (/admin/ai-setter) and from the Telegram cards. Approving is a
 * conditional transition draft → approved; the send job re-checks everything before sending.
 */

import "server-only";

import { agentCrmContactUrl } from "@/lib/agent-crm-contacts";
import { localCalendarDateKey } from "@/lib/timezone";

import { slotsByZone, validateSchedule } from "./availability";
import { classifyOutbound, newestInbound } from "./classify";
import { getAiSetterConfig, type AiSetterConfig } from "./config";
import { flagCode, guardFreeText } from "./guard";
import { composeText, needsDisclosure } from "./outbound";
import { calendarIdFor } from "./product";
import { buildPorts, missingConfig } from "./process";
import { approveTemplate, revokeTemplate, saveSchedule, setBusyUntil, setPaused } from "./settings";
import { invalidateTurn, rewindWatermark } from "./store";
import { isComplianceTemplate, isTemplateId, renderTemplate, templateHash } from "./templates";
import { toE164Nanp } from "./text-utils";
import { allowedLinks, templateVars } from "./turn";
import { aiDisclosure } from "./ui-strings";
import type { AiSetterPorts, Channel, LeadRecord, MessageRecord, WeeklySchedule } from "./types";

export type AdminActionInput =
  | { action: "approve"; messageId: string }
  | { action: "edit_approve"; messageId: string; text: string }
  | { action: "reject"; messageId: string }
  | { action: "regenerate"; messageId: string }
  | { action: "take_over"; contactId: string }
  | { action: "resume"; contactId: string }
  | { action: "pause_lead"; contactId: string }
  | { action: "pause_all" }
  | { action: "resume_all" }
  | { action: "set_busy"; minutes: number }
  | { action: "save_schedule"; schedule: WeeklySchedule }
  | { action: "approve_template"; templateId: string }
  | { action: "revoke_template"; templateId: string };

export type ActionResult = { ok: boolean; error?: string; data?: unknown };

const AGENT_TZ = "America/New_York";

function portsOrError(): { ports: AiSetterPorts } | { error: string } {
  const { ports, missing } = buildPorts({ budgetMs: 60_000 });
  return ports ? { ports } : { error: `Falta configurar: ${missing.join(", ")}` };
}

async function approve(ports: AiSetterPorts, messageId: string, actor: string, editedText?: string): Promise<ActionResult> {
  const { store, queue } = ports;
  const msg = await store.getMessage(messageId);
  if (!msg) return { ok: false, error: "Mensaje no encontrado" };
  if (msg.status !== "draft") return { ok: false, error: `Este mensaje ya está ${msg.status}` };
  if (msg.expiresAt && msg.expiresAt.getTime() <= ports.now().getTime()) {
    await store.transitionMessage(msg.id, ["draft"], "stale", { error: "expired" });
    return { ok: false, error: "El borrador venció; regenéralo" };
  }
  const lead = await store.getLead(msg.contactId);
  if (lead && (lead.status === "opted_out" || lead.optOutPending)) {
    return { ok: false, error: "El cliente pidió no recibir mensajes" };
  }

  let body = msg.body ?? "";
  let originalBody: string | null = null;
  if (editedText !== undefined) {
    const text = editedText.trim();
    if (!text || text.length > 1600) return { ok: false, error: "El texto está vacío o es muy largo" };
    const blocked = editViolations(ports, text, msg, lead);
    if (blocked.length > 0) return { ok: false, error: `Revisa el texto: ${blocked.join(", ")}` };
    originalBody = msg.body;
    body = ensureNotices(text, msg, lead?.language ?? "en", lead?.register ?? "usted", lead?.firstName ?? null, ports.config);
  }
  const updated = await store.transitionMessage(msg.id, ["draft"], "approved", {
    body,
    ...(originalBody !== null ? { originalBody } : {}),
    approvedBy: actor,
    approvedAt: ports.now(),
  });
  if (!updated) return { ok: false, error: "Otro proceso ya cambió este borrador" };
  await queue.publishSend(updated.id, updated.notBefore);
  await store.recordEvent(msg.contactId, editedText !== undefined ? "draft_edited_approved" : "draft_approved", {
    messageId: msg.id,
    actor,
  });
  return { ok: true, data: { status: "approved" } };
}

/**
 * Isaac's edit goes out under the AI's name, so it is re-checked: only the rules that make a
 * text wrong whoever wrote it block it (a claim to be human, a forbidden word, a link or a phone
 * that isn't Isaac's, a leftover {placeholder}). Length, numbers and the notice are his call.
 */
const EDIT_BLOCKING = new Map<string, string>([
  ["human_claim", "da a entender que es humano"],
  ["banned_word", "palabra prohibida"],
  ["link", "link no permitido"],
  ["phone", "teléfono que no es el de Isaac"],
  ["placeholder", "quedó un {marcador}"],
]);

function editViolations(ports: AiSetterPorts, text: string, msg: MessageRecord, lead: LeadRecord | null): string[] {
  const lang = lead?.language ?? "en";
  const rawOffered = msg.decision?.offeredSlots;
  const offered = Array.isArray(rawOffered) ? (rawOffered as Array<{ label?: unknown }>) : [];
  const check = guardFreeText(text, {
    channel: msg.channel,
    lang,
    register: lead?.register ?? "usted",
    firstName: lead?.firstName ?? null,
    agentNames: [ports.config.agentFirstName, ports.config.agentFullName],
    brand: ports.config.brandName,
    agentPhone: ports.config.agentPhoneDisplay,
    site: siteHostOf(ports.config.siteUrl),
    allowedLinks: allowedLinks(ports, lead?.product ?? null, lang),
    offeredSlotLabels: [...offered, ...(lead?.offeredSlots ?? [])]
      .map((s) => (typeof s.label === "string" ? s.label : ""))
      .filter(Boolean),
    threadText: text,
    maxSmsSegments: 10,
  });
  const labels = check.violations.map((v) => EDIT_BLOCKING.get(flagCode(v))).filter((l): l is string => Boolean(l));
  return [...new Set(labels)];
}

function siteHostOf(siteUrl: string): string {
  try {
    return new URL(siteUrl).host.replace(/^www\./, "");
  } catch {
    return "isaacplans.com";
  }
}

/** An edit must keep the AI notice and the STOP line the original carried. */
function ensureNotices(
  text: string,
  msg: { decision: Record<string, unknown> | null },
  lang: "en" | "es",
  register: "usted" | "tu",
  firstName: string | null,
  config: AiSetterConfig
): string {
  const d = msg.decision ?? {};
  const disclosure = aiDisclosure(lang, register, config.brandName);
  const needDisclosure = d.includesDisclosure === true && !text.toLowerCase().includes(disclosure.toLowerCase());
  const needStop = d.includesStop === true && !/\bSTOP\b/.test(text);
  if (!needDisclosure && !needStop) return text;
  return composeText(text, {
    lang,
    register,
    firstName,
    brand: config.brandName,
    includeDisclosure: needDisclosure,
    includeStop: needStop,
  });
}

async function regenerate(ports: AiSetterPorts, messageId: string): Promise<ActionResult> {
  const { store, queue } = ports;
  const msg = await store.getMessage(messageId);
  if (!msg) return { ok: false, error: "Mensaje no encontrado" };
  // Only a message that never went out can be regenerated (an approved/sent one would double-reply).
  const regenerable: MessageRecord["status"][] = ["draft", "stale", "blocked", "shadow"];
  if (!regenerable.includes(msg.status)) return { ok: false, error: `No se puede regenerar: el mensaje ya está ${msg.status}` };
  const lead = await store.getLead(msg.contactId);
  if (lead?.status === "opted_out") return { ok: false, error: "El cliente se dio de baja" };
  if (lead?.optOutPending) return { ok: false, error: "El cliente tiene una baja sin aclarar; respóndele tú" };
  // Arm FIRST: with a turn in flight nothing is touched (the draft stays, no rewind).
  const armed = await store.armTurn(msg.contactId, ports.now());
  if (!armed.armed || !armed.runId) return { ok: false, error: "Ya hay un turno en curso para este contacto" };
  await store.transitionMessage(msg.id, regenerable, "superseded", { error: "regenerate" });
  // Re-open exactly the inbound this draft answered (and anything after it).
  const answered = typeof msg.decision?.inReplyToAt === "string" ? new Date(msg.decision.inReplyToAt) : null;
  await rewindWatermark(
    msg.contactId,
    answered && Number.isFinite(answered.getTime()) ? answered : new Date(msg.createdAt.getTime() - 15 * 60_000)
  );
  await queue.publishTurn(msg.contactId, armed.runId, 0, { reason: "inbound" });
  return { ok: true };
}

export async function runAdminAction(input: AdminActionInput, actorUserId: string): Promise<ActionResult> {
  try {
    switch (input.action) {
      case "pause_all":
        await setPaused(true);
        return { ok: true };
      case "resume_all":
        await setPaused(false);
        return { ok: true };
      case "set_busy":
        await setBusyUntil(input.minutes > 0 ? new Date(Date.now() + input.minutes * 60_000) : null);
        return { ok: true };
      case "save_schedule": {
        const schedule = validateSchedule(input.schedule);
        if (!schedule) return { ok: false, error: "Horario inválido" };
        await saveSchedule(schedule);
        return { ok: true };
      }
      case "approve_template":
      case "revoke_template": {
        if (!isTemplateId(input.templateId)) return { ok: false, error: "Plantilla desconocida" };
        if (isComplianceTemplate(input.templateId)) return { ok: true };
        if (input.action === "approve_template") await approveTemplate(input.templateId, templateHash(input.templateId));
        else await revokeTemplate(input.templateId);
        return { ok: true };
      }
      default:
        break;
    }

    const got = portsOrError();
    if ("error" in got) return { ok: false, error: got.error };
    const { ports } = got;
    const { store } = ports;

    switch (input.action) {
      case "approve":
        return approve(ports, input.messageId, actorUserId);
      case "edit_approve":
        return approve(ports, input.messageId, actorUserId, input.text);
      case "reject": {
        const r = await store.transitionMessage(input.messageId, ["draft", "shadow"], "rejected", { approvedBy: actorUserId });
        return r ? { ok: true } : { ok: false, error: "No se pudo rechazar (ya cambió)" };
      }
      case "regenerate":
        return regenerate(ports, input.messageId);
      case "take_over":
      case "pause_lead": {
        // Void a turn in flight first: its fenced finish can't overwrite Isaac's "paused".
        await invalidateTurn(input.contactId);
        await store.updateLeadUnfenced(input.contactId, {
          status: "paused",
          pausedUntil: null,
          pauseReason: input.action === "take_over" ? "isaac_took_over" : "paused_by_isaac",
          callNowState: null,
        });
        await store.supersedePendingDrafts(input.contactId, input.action);
        await store.recordEvent(input.contactId, input.action, { actor: actorUserId });
        return { ok: true };
      }
      case "resume": {
        const lead = await store.getLead(input.contactId);
        if (!lead) return { ok: false, error: "Lead no encontrado" };
        if (lead.status === "opted_out") return { ok: false, error: "El cliente se dio de baja; no se puede reanudar" };
        await store.updateLeadUnfenced(input.contactId, {
          status: lead.appointmentId ? "booked" : "active",
          pausedUntil: null,
          pauseReason: null,
          disclosedChannels: {},
          // A fresh start: the thread cap, the rejection count and stale call-now / opt-out states.
          threadTurns: 0,
          rejectionsCount: 0,
          optOutPending: false,
          callNowState: null,
        });
        await store.recordEvent(input.contactId, "resumed", { actor: actorUserId });
        return { ok: true };
      }
    }
    return { ok: false, error: "Acción desconocida" };
  } catch {
    return { ok: false, error: "Error interno" };
  }
}

// ─── Call now (Telegram buttons) ─────────────────────────────────────────────────────────

/** The call-now buttons only act on a lead the AI still manages (not opted out, paused or frozen). */
function callNowAllowed(lead: LeadRecord | null): lead is LeadRecord {
  return Boolean(
    lead && lead.callNowState === "waiting" && !lead.optOutPending && (lead.status === "active" || lead.status === "booked")
  );
}

async function callNowCalling(ports: AiSetterPorts, contactId: string): Promise<string> {
  const { store, ghl, config } = ports;
  const lead = await store.getLead(contactId);
  if (!callNowAllowed(lead)) return "Ya no está esperando";
  await store.updateLeadUnfenced(contactId, { callNowState: "calling" });

  const contact = await ghl.getContact(contactId);
  const e164 = contact.ok ? toE164Nanp(contact.value.phone) : null;
  if (!e164 || (await store.isSuppressed(e164))) {
    await store.recordEvent(contactId, "call_now_calling", { texted: false });
    return "📞 Llámalo; no le escribí (sin teléfono válido o dado de baja)";
  }
  const messages = await ghl.listMessages(contactId, { limit: 10, sinceDays: 2 });
  const newest = messages.ok ? newestInbound(messages.value, ["SMS", "WhatsApp"]) : null;
  const channel: Channel = newest?.channel === "WhatsApp" ? "WhatsApp" : "SMS";
  const lang = lead.language ?? "en";
  const register = lead.register ?? "usted";
  const rendered = renderTemplate("call_now_calling", lang, register, templateVars(ports, lead.product, lang, register, null));
  if (rendered.missing.length === 0 && !config.dryRun) {
    // A "let me check" still waiting for approval never went out: replace it, and carry the AI
    // notice when this becomes the lead's first AI text on the channel.
    await store.supersedePendingDrafts(contactId, "call_now_calling");
    const now = ports.now();
    const includeDisclosure = needsDisclosure(lead, channel, now);
    const includeStop = includeDisclosure && config.appendStopFooter;
    const body = composeText(rendered.text, {
      lang,
      register,
      firstName: lead.firstName,
      brand: config.brandName,
      includeDisclosure,
      includeStop,
    });
    // Isaac's tap IS the approval of this one message.
    const msg = await store.createMessage({
      contactId,
      channel,
      kind: "template",
      status: "approved",
      templateId: "call_now_calling",
      templateHash: templateHash("call_now_calling"),
      body,
      intent: "call_now_calling",
      inReplyToInboundId: newest?.id ?? null,
      approvedBy: "telegram",
      approvedAt: now,
      decision: {
        reason: "call_now_calling",
        channel,
        leadStatusAtCreation: lead.status,
        compliance: false,
        includesDisclosure: includeDisclosure,
        includesStop: includeStop,
        contextAt: now.toISOString(),
        inReplyToAt: newest?.dateAdded.toISOString() ?? null,
        referenceAt: now.toISOString(),
        leadZone: lead.leadTimezone ?? AGENT_TZ,
        toE164: e164,
      },
    });
    await ports.queue.publishSend(msg.id, null);
  }
  await store.recordEvent(contactId, "call_now_calling", { texted: true });
  return "📞 Le avisé al cliente que lo estás llamando";
}

async function callNowDeclined(ports: AiSetterPorts, contactId: string): Promise<string> {
  const { store, queue } = ports;
  const lead = await store.getLead(contactId);
  if (!callNowAllowed(lead)) return "Ya no está esperando";
  await store.updateLeadUnfenced(contactId, { callNowState: "declined" });
  // With a turn in flight the store flags a re-arm; that next turn reads callNowState itself.
  const armed = await store.armTurn(contactId, ports.now());
  if (armed.armed && armed.runId) await queue.publishTurn(contactId, armed.runId, 0, { reason: "call_now_declined" });
  return "⏰ La IA le ofrece dos horas";
}

/** Button presses from the Telegram cards: "ais:<a|t|c|n>:<id>". */
export async function handleAiSetterTelegramCallback(
  data: string,
  _ctx: { chatId: string | null; messageId: string | null }
): Promise<{ toast: string; editText?: string }> {
  const m = /^ais:([atcn]):([A-Za-z0-9_-]{6,60})$/.exec(data);
  if (!m) return { toast: "Acción desconocida" };
  const [, op, id] = m;
  const got = portsOrError();
  if ("error" in got) return { toast: got.error.slice(0, 180) };
  const { ports } = got;

  if (op === "a") {
    const r = await approve(ports, id, "telegram");
    return r.ok ? { toast: "✅ Aprobado; se envía en breve", editText: "✅ Aprobado desde Telegram" } : { toast: r.error ?? "No se pudo" };
  }
  if (op === "t") {
    const r = await runAdminAction({ action: "take_over", contactId: id }, "telegram");
    return r.ok ? { toast: "🙋 Es tuyo; la IA no le escribe más", editText: "🙋 Lo tomaste tú" } : { toast: r.error ?? "No se pudo" };
  }
  if (op === "c") {
    const toast = await callNowCalling(ports, id);
    return { toast, editText: "📞 Estás llamando" };
  }
  const toast = await callNowDeclined(ports, id);
  return { toast, editText: "⏰ No podías; la IA ofrece horas" };
}

// ─── Panel helpers ───────────────────────────────────────────────────────────────────────

export async function getThreadPreview(contactId: string): Promise<
  Array<{ direction: "inbound" | "outbound"; channel: string; body: string; at: string; by: "lead" | "ai" | "isaac" | "automation" }>
> {
  const got = portsOrError();
  if ("error" in got) return [];
  const { ports } = got;
  const res = await ports.ghl.listMessages(contactId, { limit: 20, sinceDays: 30 });
  if (!res.ok) return [];
  const ourIds = await ports.store.knownGhlMessageIds(contactId);
  const cls = { ourGhlIds: ourIds, isaacUserId: ports.config.isaacUserId };
  return res.value
    .filter((m) => m.channel === "SMS" || m.channel === "WhatsApp" || m.channel === "Call")
    .slice(-10)
    .map((m) => {
      const c = m.direction === "inbound" ? null : classifyOutbound(m, cls);
      const by = m.direction === "inbound" ? "lead" : c === "ours" ? "ai" : c === "human" ? "isaac" : "automation";
      const body = m.channel === "Call" ? "(llamada)" : m.body || (m.attachmentKinds.length ? `[${m.attachmentKinds.join(", ")}]` : "");
      return { direction: m.direction, channel: m.channel, body, at: m.dateAdded.toISOString(), by };
    });
}

const PREVIEW_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];

export async function getSlotPreview(): Promise<Array<{ zone: string; labelEs: string; slots: string[] }>> {
  const got = portsOrError();
  if ("error" in got) return [];
  const { ports } = got;
  const now = ports.now();
  const settings = await ports.settings.read();
  const free = await ports.ghl.getFreeSlots({
    calendarId: calendarIdFor("general", "en"),
    startMs: now.getTime(),
    endMs: now.getTime() + 7 * 86_400_000,
    timeZone: AGENT_TZ,
    userId: ports.config.isaacUserId,
  });
  if (!free.ok) return [];
  const busy = ports.config.isaacUserId
    ? await ports.ghl.listUserEvents({ userId: ports.config.isaacUserId, startMs: now.getTime(), endMs: now.getTime() + 7 * 86_400_000 })
    : null;
  return slotsByZone({
    slotsIso: free.value,
    schedule: settings.schedule,
    now,
    zones: PREVIEW_ZONES,
    durationMinutes: ports.config.appointmentMinutes,
    minNoticeMinutes: 60,
    busy: busy && busy.ok ? busy.value : [],
  });
}

export function getConfigStatus(): {
  enabled: boolean;
  dryRun: boolean;
  model: string;
  effort: string;
  dailyBudgetUsd: number;
  missing: string[];
} {
  const config = getAiSetterConfig();
  return {
    enabled: config.enabled,
    dryRun: config.dryRun,
    model: config.model,
    effort: config.effort,
    dailyBudgetUsd: config.dailyBudgetUsd,
    missing: missingConfig(config),
  };
}

/** CRM deep link for the panel. */
export function crmUrlFor(contactId: string): string | null {
  const loc = process.env.AGENT_CRM_LOCATION_ID?.trim();
  return loc ? agentCrmContactUrl(loc, contactId) : null;
}

/** Today's key in Isaac's zone (daily usage rows). */
export function todayKey(): string {
  return localCalendarDateKey(new Date(), AGENT_TZ);
}
