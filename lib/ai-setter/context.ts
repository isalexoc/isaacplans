/**
 * What the model sees each turn — an ALLOWLIST, never a dump:
 *  - facts computed by code (language, register, product, zone, state + license, Isaac free now,
 *    live offered times, appointment, limits);
 *  - the lead's SMS/WhatsApp thread only (other channels' senders aren't verified), masked
 *    (links, emails, phones, long digit runs), last 15 messages / 30 days, 1,000 chars each;
 *  - from Isaac's calls, ONLY the outcome enums — the call summary's free text carries health and
 *    money details and never reaches the model.
 *
 * Pure: no IO.
 */

import { classifyOutbound, type OutboundClass } from "./classify";
import { formatSlotForText, zoneLabel } from "./availability";
import { PRODUCT_LABELS } from "./product";
import { maskForModel } from "./text-utils";
import { TURN_INSTRUCTION } from "./prompts";
import type { CallSignal, Channel, Lang, OfferedSlot, ProductLine, Register, ThreadMessage } from "./types";

export type TurnFacts = {
  now: Date;
  channel: Channel;
  lang: Lang;
  register: Register;
  firstName: string | null;
  product: ProductLine;
  topic: string;
  leadZone: string;
  zoneSource: "ghl" | "address" | "area_code" | "reported" | "none";
  stateCode: string | null;
  license: "licensed" | "not_licensed" | "unknown";
  isaacFreeNow: boolean;
  /** Lead-local label of the next time Isaac is working, when he isn't now. */
  nextIsaacWindow: string | null;
  upcomingAppointment: { id: string; label: string } | null;
  /** Times the lead has SEEN (sent offers) that are still in the future. */
  liveOffers: OfferedSlot[];
  rejections: number;
  lastCall: CallSignal | null;
  whatsappWindowOpen: boolean;
  /** Set for call-now follow-up turns. */
  callNowOutcome: "timeout" | "declined" | null;
  /** Isaac was alerted and the lead is waiting, or Isaac tapped "Estoy llamando". */
  callNowActive: "waiting" | "calling" | null;
  /** The lead already used today's "call me now". */
  callNowUsedToday: boolean;
};

const WHO: Record<OutboundClass, string> = { ours: "ai", automated: "automation", human: "isaac" };

function shortStamp(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** The thread the model reads: SMS + WhatsApp messages and call markers, oldest first. */
export function renderThread(
  messages: ThreadMessage[],
  ctx: { ourGhlIds: Set<string>; isaacUserId: string | null; leadZone: string; now: Date; maxMessages?: number; sinceDays?: number }
): string {
  const max = ctx.maxMessages ?? 15;
  const since = ctx.now.getTime() - (ctx.sinceDays ?? 30) * 86_400_000;
  const relevant = messages.filter(
    (m) => m.dateAdded.getTime() >= since && (m.channel === "SMS" || m.channel === "WhatsApp" || m.channel === "Call")
  );
  const recent = relevant.slice(-max);
  if (recent.length === 0) return "(no messages yet)";

  return recent
    .map((m) => {
      const when = shortStamp(m.dateAdded, ctx.leadZone);
      if (m.channel === "Call") {
        const who = m.direction === "inbound" ? "lead called" : "isaac called";
        return `[${when}] (${who})`;
      }
      const who = m.direction === "inbound" ? "lead" : WHO[classifyOutbound(m, ctx)];
      const media = m.attachmentKinds.length > 0 ? ` [${m.attachmentKinds.join(", ")}]` : "";
      const body = m.body.trim() ? maskForModel(m.body, 1000) : "";
      return `[${when} · ${m.channel} · ${who}] ${body}${media}`.trim();
    })
    .join("\n");
}

function yesNo(v: boolean): string {
  return v ? "yes" : "no";
}

export function renderFacts(f: TurnFacts): string {
  const lines: string[] = [];
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: f.leadZone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(f.now);
  lines.push(`lead_local_time: ${local} (${zoneLabel(f.leadZone, "en")} time; zone from ${f.zoneSource})`);
  lines.push(`channel: ${f.channel}${f.channel === "WhatsApp" ? ` (window open: ${yesNo(f.whatsappWindowOpen)})` : ""}`);
  lines.push(`language: ${f.lang}${f.lang === "es" ? ` | register: ${f.register}` : ""}`);
  lines.push(`lead_first_name: ${f.firstName ?? "unknown"}`);
  lines.push(`product: ${PRODUCT_LABELS[f.product].en} (what they asked about: "${f.topic}")`);
  lines.push(
    `lead_state: ${f.stateCode ?? "unknown"} | licensed_state: ${
      f.license === "licensed" ? "yes" : f.license === "not_licensed" ? "NO" : "unknown (ask the state before offering times)"
    }`
  );
  lines.push(
    `isaac_free_now: ${yesNo(f.isaacFreeNow)}${!f.isaacFreeNow && f.nextIsaacWindow ? ` (next: ${f.nextIsaacWindow})` : ""}${
      f.callNowUsedToday ? " | call_now already used today" : ""
    }`
  );
  lines.push(`upcoming_appointment: ${f.upcomingAppointment ? `${f.upcomingAppointment.label}` : "none"}`);
  if (f.liveOffers.length > 0) {
    lines.push(`live_offered_times (the lead has seen these): ${f.liveOffers.map((s) => `${s.id} = "${s.label}"`).join(", ")}`);
  } else {
    lines.push("live_offered_times: none");
  }
  lines.push(`rejections (times the lead turned down offered times): ${f.rejections}`);
  if (f.callNowActive === "waiting") {
    lines.push("call_now: waiting — Isaac was alerted a moment ago. Don't offer times or request_call_now again; reply briefly or end_without_reply.");
  } else if (f.callNowActive === "calling") {
    lines.push("call_now: isaac_calling — Isaac is calling the lead right now. Don't offer times; reply briefly or end_without_reply.");
  }
  if (f.lastCall) {
    const days = Math.max(0, Math.round((f.now.getTime() - f.lastCall.at.getTime()) / 86_400_000));
    lines.push(
      `last_call_with_isaac: ${days} day(s) ago, outcome ${f.lastCall.disposition ?? "unknown"}${
        f.lastCall.followUpDateIso ? `, follow-up agreed for ${f.lastCall.followUpDateIso.toISOString().slice(0, 10)}` : ""
      }`
    );
  } else {
    lines.push("last_call_with_isaac: none");
  }
  if (f.callNowOutcome === "timeout") {
    lines.push("call_now_followup: Isaac could not call within a few minutes — offer two times with call_now_unavailable.");
  } else if (f.callNowOutcome === "declined") {
    lines.push("call_now_followup: Isaac is on another call — offer two times with call_now_unavailable.");
  }
  return lines.join("\n");
}

export function buildUserContent(facts: TurnFacts, threadText: string): string {
  return `<facts>\n${renderFacts(facts)}\n</facts>\n<thread oldest_first="true">\n${threadText}\n</thread>\n${TURN_INSTRUCTION}`;
}

/** Labels of live offers re-rendered for "now" (an offer made yesterday says "today" → "yesterday"…). */
export function refreshOfferLabels(
  offers: OfferedSlot[],
  ctx: { lang: Lang; leadZone: string; now: Date; showZone: boolean }
): OfferedSlot[] {
  return offers
    .filter((s) => Date.parse(s.startIso) > ctx.now.getTime())
    .map((s) => ({ ...s, label: formatSlotForText(s.startIso, ctx) }));
}
