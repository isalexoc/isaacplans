/**
 * The model's tools: strict JSON Schemas + hand-written validators + executors over the ports.
 *
 * Security contract (prompt injection): no tool takes a contactId, calendarId, userId, phone or
 * channel — the executor derives them from the turn. Bookings use ONLY slot ids the lead has
 * already seen (live offers), one future appointment per contact, fixed title/description text.
 * Terminal tools only RECORD the decision; turn.ts renders, checks and dispatches it.
 *
 * Pure apart from the injected ports.
 */

import { resolveTimezone } from "@/lib/leads-the-way/timezone";

import {
  LEAD_HOURS,
  applyPreference,
  filterSlots,
  formatSlotForText,
  parseHHMM,
  pickTwoSlots,
  shouldShowZone,
  type SlotPreference,
} from "./availability";
import { licenseDecision, toStateCode } from "./compliance";
import { PRODUCT_LABELS } from "./product";
import { safeCode } from "./text-utils";
import { TEMPLATE_META, type TemplateId } from "./templates";
import type { TurnFacts } from "./context";
import type {
  AiSetterPorts,
  AppointmentRef,
  ContactSnapshot,
  HandoffReason,
  LeadRecord,
  OfferedSlot,
  ToolDef,
  ToolExecResult,
  TurnFence,
  WeeklySchedule,
  Weekday,
} from "./types";

/** Templates the MODEL may choose. Compliance and code-driven ones (help, opt-out, call-now acks, holds) are not here. */
export const MODEL_TEMPLATE_IDS = [
  "offer_times",
  "offer_one_time",
  "offer_times_now",
  "price_redirect",
  "info_redirect",
  "who_is_this",
  "confirm_booking",
  "confirm_reschedule",
  "confirm_cancel",
  "existing_appointment",
  "call_now_unavailable",
  "ask_state",
  "out_of_license",
  "self_booking_link",
  "ask_time_preference",
] as const satisfies readonly TemplateId[];

export type ModelTemplateId = (typeof MODEL_TEMPLATE_IDS)[number];

const HANDOFF_REASONS = [
  "asked_for_person",
  "pricing_detail",
  "health",
  "medicare",
  "existing_client",
  "complaint",
  "legal",
  "confused",
  "other",
] as const satisfies readonly HandoffReason[];

export type TerminalDecision =
  | { kind: "template"; templateId: ModelTemplateId; slotIds: string[] }
  | { kind: "draft"; text: string; intent: string }
  | { kind: "call_now"; reason: string }
  | { kind: "handoff"; reason: HandoffReason; urgent: boolean; note: string }
  | { kind: "not_interested"; reason: string }
  | { kind: "opt_out"; reason: string }
  | { kind: "end"; reason: string };

export type BookingOutcome = {
  action: "booked" | "rescheduled" | "canceled";
  /** ISO of the (new) start time; null when canceled. */
  whenIso: string | null;
  appointment: AppointmentRef | null;
  calendarId: string;
  simulated: boolean;
};

export type ToolState = {
  /** Times found this turn (by find_open_slots); a reply may offer them. */
  offeredThisTurn: OfferedSlot[];
  /** The model asked for new times while live offers existed → the lead turned those down. */
  rejectedPrevious: boolean;
  booking: BookingOutcome | null;
  reportedState: string | null;
  terminal: TerminalDecision | null;
};

export type ToolContext = {
  ports: AiSetterPorts;
  fence: TurnFence;
  lead: LeadRecord;
  contact: ContactSnapshot;
  /** Mutable: set_lead_state updates the zone, state and license. */
  facts: TurnFacts;
  schedule: WeeklySchedule;
  calendarId: string;
  licensed: string[] | null;
  upcoming: AppointmentRef | null;
  /** False when the contact's appointments couldn't be read: no booking this turn. */
  appointmentsKnown: boolean;
  /**
   * The moment the reply will actually go out (`notBefore` when the lead's window is closed,
   * else now). Times are filtered and worded relative to it, so a held reply never says
   * "tomorrow" about a day that has become today.
   */
  referenceNow: Date;
  /** Isaac's appointments across calendars (loaded once per turn); null when unreadable. */
  loadIsaacEvents: () => Promise<AppointmentRef[] | null>;
  dryRun: boolean;
};

export function newToolState(): ToolState {
  return { offeredThisTurn: [], rejectedPrevious: false, booking: null, reportedState: null, terminal: null };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────────────────

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const reasonOnly = (description: string) => ({
  type: "object",
  properties: { reason: { type: "string", description } },
  required: ["reason"],
  additionalProperties: false,
});

/** Stable order and text: part of the cached prefix. */
export const TOOL_DEFS: ToolDef[] = [
  {
    name: "find_open_slots",
    description:
      "Find up to two times Isaac can call the lead, chosen by code from his calendar and the lead's local hours. Returns slot ids with exact labels to offer. Pass the lead's stated preference, or nulls.",
    inputSchema: {
      type: "object",
      properties: {
        after_local: { ...nullableString, description: "Earliest lead-local time 'HH:MM' (24h) the lead wants, e.g. '17:00' for 'after 5'." },
        before_local: { ...nullableString, description: "Latest lead-local start time 'HH:MM' (24h)." },
        part_of_day: { anyOf: [{ type: "string", enum: ["morning", "afternoon", "evening"] }, { type: "null" }] },
        weekday: {
          anyOf: [{ type: "string", enum: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] }, { type: "null" }],
          description: "A specific day of the week the lead asked for.",
        },
        date_local: { ...nullableString, description: "A specific lead-local date 'YYYY-MM-DD' the lead asked for." },
        lead_works: { type: "boolean", description: "True when the lead said they work / are busy during the day." },
        lead_declined_offered_times: {
          type: "boolean",
          description:
            "True ONLY when the lead's latest message turns down the live offered times (e.g. 'neither works', 'not then'). False for price/info questions, first offers, or after slot_taken.",
        },
      },
      required: ["after_local", "before_local", "part_of_day", "weekday", "date_local", "lead_works", "lead_declined_offered_times"],
      additionalProperties: false,
    },
  },
  {
    name: "set_lead_state",
    description: "Record the US state the lead just said they live in (2-letter code or name). Updates their time zone and license check.",
    inputSchema: {
      type: "object",
      properties: { state: { type: "string", description: "e.g. 'CA' or 'California'." } },
      required: ["state"],
      additionalProperties: false,
    },
  },
  {
    name: "book_appointment",
    description: "Book Isaac's call at one of the LIVE offered times (a slot id the lead has already seen in facts). Only when the lead clearly picked it.",
    inputSchema: {
      type: "object",
      properties: { slot_id: { type: "string", description: "Id from live_offered_times, e.g. 'A'." } },
      required: ["slot_id"],
      additionalProperties: false,
    },
  },
  {
    name: "reschedule_appointment",
    description: "Move the lead's upcoming appointment to one of the LIVE offered times the lead picked.",
    inputSchema: {
      type: "object",
      properties: { slot_id: { type: "string" } },
      required: ["slot_id"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel the lead's upcoming appointment because the lead asked to cancel it.",
    inputSchema: reasonOnly("Short reason in English."),
  },
  {
    name: "reply_with_template",
    description:
      "TERMINAL. Reply with a pre-approved template. Offer templates need the slot ids returned by find_open_slots THIS turn (offer_times and price_redirect / info_redirect / who_is_this / call_now_unavailable need 2; offer_one_time and offer_times_now need 1). confirm_* need the booking tool to have succeeded this turn.",
    inputSchema: {
      type: "object",
      properties: {
        template_id: { type: "string", enum: [...MODEL_TEMPLATE_IDS] },
        slot_ids: { type: "array", items: { type: "string" }, description: "Slot ids in the order to offer them; [] when none." },
      },
      required: ["template_id", "slot_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_reply",
    description:
      "TERMINAL. Your own short reply (1-2 sentences, the facts' language and register) for when no template fits. It is checked by code and held for Isaac's approval.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The message body only: no greeting with an AI notice, no signature, no STOP line." },
        intent: { type: "string", description: "Short label of what this reply does, e.g. 'clarify_time'." },
      },
      required: ["text", "intent"],
      additionalProperties: false,
    },
  },
  {
    name: "request_call_now",
    description: "TERMINAL. The lead can talk right now. Code checks if Isaac is free and alerts him, or offers times.",
    inputSchema: reasonOnly("What the lead said, summarized in English."),
  },
  {
    name: "handoff_to_isaac",
    description: "TERMINAL. Pass the lead to Isaac personally (see the playbook for when). The lead gets a short hold message.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", enum: [...HANDOFF_REASONS] },
        urgent: { type: "boolean", description: "True for complaints, legal threats or a time-sensitive request." },
        note: { type: "string", description: "One line for Isaac, in Spanish, about what the lead needs." },
      },
      required: ["reason", "urgent", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_not_interested",
    description: "TERMINAL. The lead is not interested / already covered. Sends one polite close and stops.",
    inputSchema: reasonOnly("Short reason in English."),
  },
  {
    name: "mark_opt_out",
    description: "TERMINAL. The lead wants no more messages (stop, remove me, wrong number, don't text me).",
    inputSchema: reasonOnly("Short reason in English."),
  },
  {
    name: "end_without_reply",
    description: "TERMINAL. Nothing needs to be said (thanks after a booking, a closing ok).",
    inputSchema: reasonOnly("Short reason in English."),
  },
];

const TERMINAL_TOOLS = new Set([
  "reply_with_template",
  "draft_reply",
  "request_call_now",
  "handoff_to_isaac",
  "mark_not_interested",
  "mark_opt_out",
  "end_without_reply",
]);

// ─── Validation helpers ───────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
}

function str(v: unknown, max = 600): string | null {
  return typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
}

function nullableHHMM(v: unknown): string | null | "invalid" {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return "invalid";
  const minutes = parseHHMM(v);
  return Number.isFinite(minutes) ? v : "invalid";
}

const WEEKDAYS: Record<string, Weekday> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function result(payload: Record<string, unknown>, isError = false): ToolExecResult {
  return { content: JSON.stringify(payload), isError };
}

function error(code: string, hint: string): ToolExecResult {
  return result({ ok: false, error: code, hint }, true);
}

/** Times are only offered or booked for a lead in one of Isaac's licensed states. */
function licenseBlock(ctx: ToolContext): ToolExecResult | null {
  if (ctx.facts.license === "licensed") return null;
  if (ctx.facts.license === "not_licensed") return error("not_licensed", "Use reply_with_template out_of_license.");
  if (!ctx.licensed) return error("license_unverified", "The licensed states couldn't be checked; use handoff_to_isaac with reason other.");
  return error("state_unknown", "Ask the lead which state they live in (reply_with_template ask_state), then set_lead_state.");
}

// ─── Executor ─────────────────────────────────────────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function createToolExecutor(ctx: ToolContext, state: ToolState) {
  let freeSlotsCache: string[] | null = null;

  const deadlineHit = () => Date.now() > ctx.ports.deadlineAt;

  async function findOpenSlots(input: Obj): Promise<ToolExecResult> {
    const after = nullableHHMM(input.after_local);
    const before = nullableHHMM(input.before_local);
    if (after === "invalid" || before === "invalid") return error("invalid_time", "Use 'HH:MM' 24h or null.");
    const partOfDay =
      input.part_of_day === "morning" || input.part_of_day === "afternoon" || input.part_of_day === "evening"
        ? input.part_of_day
        : null;
    const weekday = typeof input.weekday === "string" && input.weekday in WEEKDAYS ? WEEKDAYS[input.weekday] : null;
    const dateLocal = typeof input.date_local === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date_local) ? input.date_local : null;
    const leadWorks = input.lead_works === true;
    const blocked = licenseBlock(ctx);
    if (blocked) return blocked;

    // Filter and word the times for when the reply goes OUT (held replies), not for now.
    const now = ctx.referenceNow;
    const { ghl, config } = ctx.ports;
    if (!freeSlotsCache) {
      if (deadlineHit()) return error("deadline", "No time left this turn; hand off to Isaac.");
      const res = await ghl.getFreeSlots({
        calendarId: ctx.calendarId,
        startMs: now.getTime(),
        endMs: now.getTime() + 8 * 86_400_000,
        timeZone: ctx.facts.leadZone,
        userId: config.isaacUserId,
      });
      if (!res.ok) return error("calendar_unavailable", "The calendar could not be read; hand off to Isaac (reason other).");
      freeSlotsCache = res.value;
    }
    const busy = await ctx.loadIsaacEvents();
    if (!busy) return error("calendar_unavailable", "Isaac's appointments could not be read; hand off to Isaac (reason other).");

    // An explicit request outside 9am-9pm (e.g. "after 9:30pm") is the lead's own choice.
    const explicitOutside =
      (after !== null && parseHHMM(after) >= parseHHMM(LEAD_HOURS.end)) ||
      (before !== null && parseHHMM(before) < parseHHMM(LEAD_HOURS.start));
    const filtered = filterSlots({
      slotsIso: freeSlotsCache,
      schedule: ctx.schedule,
      leadZone: ctx.facts.leadZone,
      now,
      minNoticeMinutes: 60,
      durationMinutes: config.appointmentMinutes,
      busy,
      leadHours: explicitOutside ? null : LEAD_HOURS,
      horizonDays: 7,
    });

    const pref: SlotPreference = {
      ...(after ? { afterLocal: after } : {}),
      ...(before ? { beforeLocal: before } : {}),
      ...(partOfDay ? { partOfDay } : {}),
      ...(weekday !== null ? { weekdays: [weekday] } : {}),
      ...(dateLocal ? { dateLocal } : {}),
    };
    const hasPref = Object.keys(pref).length > 0;
    const candidates = hasPref ? applyPreference(filtered, pref, ctx.facts.leadZone) : filtered;

    const exclude = ctx.facts.liveOffers.map((s) => s.startIso);
    if (exclude.length > 0 && input.lead_declined_offered_times === true) state.rejectedPrevious = true;
    const picks = pickTwoSlots(candidates, { now, leadZone: ctx.facts.leadZone, leadWorks, exclude });

    const used = new Set(ctx.facts.liveOffers.map((s) => s.id));
    const ids = LETTERS.filter((l) => !used.has(l));
    const showZone = shouldShowZone(ctx.facts.leadZone, ctx.facts.zoneSource === "reported" ? "address" : ctx.facts.zoneSource);
    state.offeredThisTurn = picks.map((iso, i) => ({
      id: ids[i] ?? `S${i}`,
      startIso: iso,
      label: formatSlotForText(iso, { lang: ctx.facts.lang, leadZone: ctx.facts.leadZone, now, showZone }),
    }));

    if (state.offeredThisTurn.length === 0) {
      return result({
        ok: true,
        slots: [],
        note: hasPref
          ? "No free time matches that preference in the next 7 days. Ask for another preference (ask_time_preference) or send self_booking_link."
          : "No free time in the next 7 days. Use handoff_to_isaac with reason other.",
      });
    }
    return result({ ok: true, slots: state.offeredThisTurn.map((s) => ({ id: s.id, label: s.label })) });
  }

  function setLeadState(input: Obj): ToolExecResult {
    const code = toStateCode(str(input.state, 40));
    if (!code) return error("unknown_state", "Ask the lead which US state they live in.");
    const zone = resolveTimezone(code, null);
    state.reportedState = code;
    ctx.facts.stateCode = code;
    if (zone) {
      ctx.facts.leadZone = zone;
      ctx.facts.zoneSource = "reported";
    }
    ctx.facts.license = licenseDecision(code, ctx.licensed);
    return result({
      ok: true,
      state: code,
      licensed: ctx.facts.license === "licensed" ? "yes" : ctx.facts.license === "not_licensed" ? "no" : "unknown",
    });
  }

  function liveOffer(slotId: string): OfferedSlot | null {
    return ctx.facts.liveOffers.find((s) => s.id === slotId) ?? null;
  }

  function endIsoOf(startIso: string): string {
    return new Date(Date.parse(startIso) + ctx.ports.config.appointmentMinutes * 60_000).toISOString();
  }

  async function bookAppointment(input: Obj): Promise<ToolExecResult> {
    if (state.booking) return error("already_done", "A booking action already ran this turn; reply now.");
    const slotId = str(input.slot_id, 4);
    const slot = slotId ? liveOffer(slotId) : null;
    if (!slot) return error("not_a_live_offer", "Only a time the lead has already seen can be booked. Offer times first.");

    // Idempotency FIRST: a retry of this turn (crash after the POST) finds the appointment the
    // first attempt created — it shows up as `upcoming` at the very time we tried to book.
    if (!ctx.dryRun && ctx.lead.bookingIntent?.slotIso === slot.startIso && ctx.upcoming) {
      if (Math.abs(ctx.upcoming.startTime.getTime() - Date.parse(slot.startIso)) < 60_000) {
        state.booking = {
          action: "booked",
          whenIso: slot.startIso,
          appointment: ctx.upcoming,
          calendarId: ctx.upcoming.calendarId,
          simulated: false,
        };
        return result({ ok: true, booked: slot.label });
      }
    }
    if (!ctx.appointmentsKnown) return error("appointments_unknown", "The lead's appointments couldn't be read; hand off to Isaac (reason other).");
    if (ctx.upcoming) return error("already_booked", "The lead already has an upcoming appointment; use reschedule_appointment.");
    const blocked = licenseBlock(ctx);
    if (blocked) return blocked;

    if (ctx.dryRun) {
      // Shadow mode: nothing is saved and nothing is booked.
      state.booking = { action: "booked", whenIso: slot.startIso, appointment: null, calendarId: ctx.calendarId, simulated: true };
      return result({ ok: true, booked: slot.label, simulated: true });
    }

    const { ghl, store, config } = ctx.ports;
    const saved = await store.updateLead(ctx.fence, {
      bookingIntent: { slotIso: slot.startIso, calendarId: ctx.calendarId, runId: ctx.fence.runId },
    });
    if (!saved) return error("lost_claim", "Stop here with end_without_reply.");
    if (deadlineHit()) return error("deadline", "No time left this turn; hand off to Isaac.");
    const product = PRODUCT_LABELS[ctx.facts.product].es;
    const res = await ghl.createAppointment({
      calendarId: ctx.calendarId,
      contactId: ctx.fence.contactId,
      startIso: slot.startIso,
      endIso: endIsoOf(slot.startIso),
      title: `Llamada con ${config.agentFirstName}`,
      description: `Agendada por el asistente de IA. Producto: ${product}. Idioma: ${ctx.facts.lang}. Canal: ${ctx.facts.channel}.`,
      assignedUserId: config.isaacUserId,
    });
    if (res.ok) {
      state.booking = { action: "booked", whenIso: slot.startIso, appointment: res.value, calendarId: ctx.calendarId, simulated: false };
      return result({ ok: true, booked: slot.label });
    }
    if (res.slotTaken) return error("slot_taken", "That time was just taken. Call find_open_slots and offer new times.");
    return error("booking_failed", "Booking failed; hand off to Isaac with reason other.");
  }

  async function rescheduleAppointment(input: Obj): Promise<ToolExecResult> {
    if (state.booking) return error("already_done", "A booking action already ran this turn; reply now.");
    if (!ctx.upcoming) return error("no_appointment", "There is no upcoming appointment; use book_appointment.");
    const blocked = licenseBlock(ctx);
    if (blocked) return blocked;
    const slotId = str(input.slot_id, 4);
    const slot = slotId ? liveOffer(slotId) : null;
    if (!slot) return error("not_a_live_offer", "Offer new times first; the lead must pick one they have seen.");
    if (ctx.dryRun) {
      state.booking = { action: "rescheduled", whenIso: slot.startIso, appointment: ctx.upcoming, calendarId: ctx.upcoming.calendarId, simulated: true };
      return result({ ok: true, rescheduled: slot.label, simulated: true });
    }
    if (deadlineHit()) return error("deadline", "No time left this turn; hand off to Isaac.");
    const res = await ctx.ports.ghl.updateAppointment({
      appointmentId: ctx.upcoming.id,
      startIso: slot.startIso,
      endIso: endIsoOf(slot.startIso),
      status: "confirmed",
    });
    if (!res.ok) return error("reschedule_failed", "Could not move it; hand off to Isaac with reason other.");
    state.booking = { action: "rescheduled", whenIso: slot.startIso, appointment: res.value, calendarId: ctx.upcoming.calendarId, simulated: false };
    return result({ ok: true, rescheduled: slot.label });
  }

  async function cancelAppointment(): Promise<ToolExecResult> {
    if (state.booking) return error("already_done", "A booking action already ran this turn; reply now.");
    if (!ctx.upcoming) return error("no_appointment", "There is no upcoming appointment to cancel.");
    if (ctx.dryRun) {
      state.booking = { action: "canceled", whenIso: null, appointment: ctx.upcoming, calendarId: ctx.upcoming.calendarId, simulated: true };
      return result({ ok: true, canceled: true, simulated: true });
    }
    if (deadlineHit()) return error("deadline", "No time left this turn; hand off to Isaac.");
    const res = await ctx.ports.ghl.updateAppointment({ appointmentId: ctx.upcoming.id, status: "cancelled" });
    if (!res.ok) return error("cancel_failed", "Could not cancel; hand off to Isaac with reason other.");
    state.booking = { action: "canceled", whenIso: null, appointment: res.value, calendarId: ctx.upcoming.calendarId, simulated: false };
    return result({ ok: true, canceled: true });
  }

  function replyWithTemplate(input: Obj): ToolExecResult {
    const id = input.template_id;
    if (typeof id !== "string" || !(MODEL_TEMPLATE_IDS as readonly string[]).includes(id)) {
      return error("unknown_template", "Pick a template_id from the list.");
    }
    const templateId = id as ModelTemplateId;
    const slotIds = Array.isArray(input.slot_ids) ? input.slot_ids.filter((s): s is string => typeof s === "string") : [];
    const need = TEMPLATE_META[templateId].slots;
    if (need > 0) {
      if (slotIds.length !== need) return error("wrong_slot_count", `This template needs exactly ${need} slot id(s) from find_open_slots this turn.`);
      const known = new Set(state.offeredThisTurn.map((s) => s.id));
      if (!slotIds.every((s) => known.has(s))) return error("unknown_slot", "Use slot ids returned by find_open_slots in THIS turn.");
    }
    if (templateId === "confirm_booking" && state.booking?.action !== "booked") return error("not_booked", "Call book_appointment first.");
    if (templateId === "confirm_reschedule" && state.booking?.action !== "rescheduled") return error("not_rescheduled", "Call reschedule_appointment first.");
    if (templateId === "confirm_cancel" && state.booking?.action !== "canceled") return error("not_canceled", "Call cancel_appointment first.");
    if (templateId === "existing_appointment" && !ctx.upcoming) return error("no_appointment", "There is no upcoming appointment.");
    if (templateId === "out_of_license" && ctx.facts.license !== "not_licensed") return error("licensed", "The state is not marked unlicensed.");
    state.terminal = { kind: "template", templateId, slotIds: need > 0 ? slotIds : [] };
    return { content: "ok", terminal: true };
  }

  function terminal(name: string, input: Obj): ToolExecResult {
    switch (name) {
      case "reply_with_template":
        return replyWithTemplate(input);
      case "draft_reply": {
        const text = str(input.text, 1200);
        if (!text) return error("empty_text", "Write the reply text.");
        state.terminal = { kind: "draft", text, intent: safeCode(str(input.intent, 60)?.toLowerCase() ?? null, "free_text") };
        return { content: "ok", terminal: true };
      }
      case "request_call_now":
        state.terminal = { kind: "call_now", reason: str(input.reason) ?? "" };
        return { content: "ok", terminal: true };
      case "handoff_to_isaac": {
        const reason = (HANDOFF_REASONS as readonly string[]).includes(String(input.reason)) ? (input.reason as HandoffReason) : "other";
        state.terminal = { kind: "handoff", reason, urgent: input.urgent === true, note: str(input.note, 300) ?? "" };
        return { content: "ok", terminal: true };
      }
      case "mark_not_interested":
        state.terminal = { kind: "not_interested", reason: str(input.reason) ?? "" };
        return { content: "ok", terminal: true };
      case "mark_opt_out":
        state.terminal = { kind: "opt_out", reason: str(input.reason) ?? "" };
        return { content: "ok", terminal: true };
      default:
        state.terminal = { kind: "end", reason: str(input.reason) ?? "" };
        return { content: "ok", terminal: true };
    }
  }

  return async function executeTool(name: string, rawInput: unknown): Promise<ToolExecResult> {
    const input = asObj(rawInput);
    if (!input) return error("invalid_input", "Arguments must be an object matching the schema.");
    if (TERMINAL_TOOLS.has(name)) return terminal(name, input);
    switch (name) {
      case "find_open_slots":
        return findOpenSlots(input);
      case "set_lead_state":
        return setLeadState(input);
      case "book_appointment":
        return bookAppointment(input);
      case "reschedule_appointment":
        return rescheduleAppointment(input);
      case "cancel_appointment":
        return cancelAppointment();
      default:
        return error("unknown_tool", "Use one of the listed tools.");
    }
  };
}
