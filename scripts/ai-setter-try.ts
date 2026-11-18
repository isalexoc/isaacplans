/**
 * AI Setter — Phase 0 checks and dry runs against the REAL CRM (read-only unless --yes).
 *
 *   pnpm ai-setter:try --calendars
 *       Every calendar id in lib/ai-setter/product.ts vs GET /calendars/: name, type, Isaac on the
 *       team, slot duration, and how many free slots the next 3 days have.
 *   pnpm ai-setter:try --sources <contactId>
 *       The last 25 messages' raw direction / messageType / source / userId / status (NO bodies),
 *       the sender number GHL reports on inbound rows, masked (from=305•••••42, or from=null when
 *       it names none; only SMS / WhatsApp carry one), and how the human-vs-automation classifier
 *       labels each one. A type the setter maps to no channel is flagged UNKNOWN TYPE. Send one
 *       message of every kind to your own contact first (manual web, mobile app, workflow SMS,
 *       calendar confirmation, API, WhatsApp from the phone, a Kixie call) and check every label.
 *   pnpm ai-setter:try <contactId> [--yes]
 *       One real turn in SHADOW mode: reads GHL, calls Claude, stores what it WOULD send, sends
 *       nothing. Its CRM writes (tags, notes, DND, bookings) are listed instead of made; only with
 *       --yes on a contact in AI_SETTER_TEST_CONTACT_IDS do they go through (still listed).
 *       Alerts print here instead of going to Telegram; queue jobs are listed, never published.
 *       Uses the database in .env.
 *   pnpm ai-setter:try --book <contactId> --yes
 *       Books a REAL appointment at the next free general-calendar slot (Phase 0 reminders test).
 *       Only for ids listed in AI_SETTER_TEST_CONTACT_IDS.
 *   pnpm ai-setter:try --cancel-appointment <appointmentId> --yes
 *       Cancels it, only when GHL says the appointment's contact is in AI_SETTER_TEST_CONTACT_IDS.
 *
 * Run with `tsx --conditions=react-server` (the package.json script does) so server-only modules load.
 */

import "dotenv/config";

import { AGENT_CRM_API_BASE } from "@/lib/agent-crm-contacts";
import { classifyOutbound } from "@/lib/ai-setter/classify";
import { getAiSetterConfig } from "@/lib/ai-setter/config";
import { createAiSetterGhlPort } from "@/lib/ai-setter/ghl";
import { CALENDAR_IDS } from "@/lib/ai-setter/product";
import type { AiSetterPorts, AppointmentRef, GhlPort, NotifyEvent, NotifyPort } from "@/lib/ai-setter/types";
import { httpJson, type HttpResult } from "@/lib/phone-finder/http";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueAfter = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? null : null;
};
const ID_RE = /^[A-Za-z0-9]{10,40}$/;
/** GHL event ids (recurring instances too): letters, digits, `_`, `-` (the rule lib/ai-setter/ghl.ts applies). */
const APPOINTMENT_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const config = getAiSetterConfig();
if (!config.ghlToken || !config.locationId) fail("Set AI_SETTER_GHL_PI and AGENT_CRM_LOCATION_ID in .env");
const ghlToken: string = config.ghlToken;
const locationId: string = config.locationId;
const ghl = createAiSetterGhlPort({ token: ghlToken, locationId });

/** GET on the calendars API (Version 2021-04-15) with the setter's own token (AI_SETTER_GHL_PI). */
function calendarsGet(path: string): Promise<HttpResult> {
  return httpJson(
    `${AGENT_CRM_API_BASE}${path}`,
    { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${ghlToken}`, Version: "2021-04-15" } },
    { timeoutMs: 20_000 }
  );
}

async function checkCalendars(): Promise<void> {
  const res = await calendarsGet(`/calendars/?locationId=${encodeURIComponent(locationId)}`);
  if (res.status !== 200) fail(`GET /calendars/ → ${res.status} (scope calendars.readonly?)`);
  const list = ((res.json as { calendars?: unknown[] })?.calendars ?? []) as Array<Record<string, unknown>>;
  const byId = new Map(list.map((c) => [String(c.id), c]));
  const now = Date.now();
  for (const [product, ids] of Object.entries(CALENDAR_IDS)) {
    for (const [lang, id] of Object.entries(ids)) {
      const cal = byId.get(id);
      if (!cal) {
        console.log(`✗ ${product}/${lang} ${id}: NOT a calendar id in this location (widget slug? resolve it in GHL)`);
        continue;
      }
      const team = Array.isArray(cal.teamMembers) ? (cal.teamMembers as Array<Record<string, unknown>>) : [];
      const isaacOnTeam = config.isaacUserId ? team.some((m) => m.userId === config.isaacUserId) : null;
      const slots = await ghl.getFreeSlots({
        calendarId: id,
        startMs: now,
        endMs: now + 3 * 86_400_000,
        timeZone: "America/New_York",
        userId: config.isaacUserId,
      });
      console.log(
        `${isaacOnTeam === false ? "✗" : "✓"} ${product}/${lang} ${id}: "${String(cal.name ?? "")}" type=${String(
          cal.calendarType ?? "?"
        )} slot=${String(cal.slotDuration ?? "?")}${String(cal.slotDurationUnit ?? "")} isaacOnTeam=${
          isaacOnTeam === null ? "set AI_SETTER_GHL_USER_ID" : isaacOnTeam
        } freeSlots(3d)=${slots.ok ? slots.value.length : `error ${slots.status}`}`
      );
    }
  }
  console.log(`\nAppointment length used by the setter: ${config.appointmentMinutes} min (AI_SETTER_APPOINTMENT_MINUTES).`);
}

/** "+13055551242" → "305•••••42": the area code and the last two digits. */
function maskNumber(e164: string): string {
  const national = e164.replace(/^\+1/, "");
  return /^\d{10}$/.test(national) ? `${national.slice(0, 3)}•••••${national.slice(-2)}` : "•••";
}

async function showSources(contactId: string): Promise<void> {
  const res = await ghl.listMessages(contactId, { limit: 25, sinceDays: 30 });
  if (!res.ok) fail(`listMessages → ${res.status}`);
  let unknownTypes = 0;
  for (const m of res.value) {
    const label =
      m.direction === "inbound" ? "lead" : classifyOutbound(m, { ourGhlIds: new Set(), isaacUserId: config.isaacUserId });
    const from = m.direction === "inbound" ? `from=${m.fromNumber ? maskNumber(m.fromNumber) : "null"}` : "";
    const unknownType = m.channel === "Other";
    if (unknownType) unknownTypes++;
    console.log(
      [
        m.dateAdded.toISOString(),
        m.direction.padEnd(8),
        m.messageType.padEnd(24),
        `source=${m.source ?? "null"}`.padEnd(20),
        `userId=${m.userId ? `${m.userId.slice(0, 4)}…` : "null"}`.padEnd(14),
        `status=${m.status ?? "null"}`.padEnd(18),
        from.padEnd(16),
        `→ ${label}`,
        ...(unknownType ? ["✗ UNKNOWN TYPE — tell Claude"] : []),
      ].join(" ")
    );
  }
  if (unknownTypes > 0) {
    console.log(`\n${unknownTypes} message(s) of a type the setter maps to no channel: send this output to Claude.`);
  }
}

async function requireWritable(contactId: string): Promise<void> {
  if (!flag("--yes")) fail("This writes to the CRM. Re-run with --yes.");
  if (!config.testContactIds.includes(contactId)) fail("Contact not in AI_SETTER_TEST_CONTACT_IDS.");
}

async function bookTest(contactId: string): Promise<void> {
  await requireWritable(contactId);
  const now = Date.now();
  const calendarId = CALENDAR_IDS.general.en;
  const slots = await ghl.getFreeSlots({ calendarId, startMs: now + 3_600_000, endMs: now + 3 * 86_400_000, timeZone: "America/New_York", userId: config.isaacUserId });
  if (!slots.ok || slots.value.length === 0) fail("No free slot in the next 3 days on the general calendar.");
  const start = slots.value[0];
  const end = new Date(Date.parse(start) + config.appointmentMinutes * 60_000).toISOString();
  const res = await ghl.createAppointment({
    calendarId,
    contactId,
    startIso: start,
    endIso: end,
    title: `Llamada con ${config.agentFirstName}`,
    description: "PRUEBA del asistente de IA (Fase 0). Cancélala después de revisar los recordatorios.",
    assignedUserId: config.isaacUserId,
  });
  if (!res.ok) fail(`createAppointment → ${res.status}${res.slotTaken ? " (slot taken)" : ""}`);
  console.log(`✓ Booked ${start} (appointment ${res.value.id}). Check: GHL calendar, Google Calendar, confirmation + reminders.`);
  console.log(`  Clean up: pnpm ai-setter:try --cancel-appointment ${res.value.id} --yes`);
}

/**
 * GET /calendars/events/appointments/{id} → `{ event }`: the contact GHL says the appointment
 * belongs to, or null when it names none. Exits on an error answer or a deleted appointment.
 */
async function appointmentContactId(appointmentId: string): Promise<string | null> {
  const res = await calendarsGet(`/calendars/events/appointments/${encodeURIComponent(appointmentId)}`);
  if (res.status < 200 || res.status >= 300) fail(`GET /calendars/events/appointments/{id} → ${res.status}`);
  const json = isRecord(res.json) ? res.json : null;
  const event = json && isRecord(json.event) ? json.event : json;
  if (event?.deleted === true) fail("That appointment is already deleted in GHL.");
  return event && typeof event.contactId === "string" ? event.contactId : null;
}

async function cancelTest(appointmentId: string): Promise<void> {
  if (!flag("--yes")) fail("This writes to the CRM. Re-run with --yes.");
  const owner = await appointmentContactId(appointmentId);
  if (!owner || !config.testContactIds.includes(owner)) {
    fail("The appointment's contact is not in AI_SETTER_TEST_CONTACT_IDS. Nothing was changed.");
  }
  const res = await ghl.updateAppointment({ appointmentId, status: "cancelled" });
  console.log(res.ok ? `✓ Cancelled ${appointmentId}` : `✗ Cancel failed: ${res.status}`);
}

// ─── Shadow turn: CRM writes and alerts stay on this screen ────────────────────────────────

/** Collapsed to one line and cut to `max` characters. */
function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** The parsed time, or `fallback` when `iso` is missing or unreadable. */
function parsedDate<T extends Date | null>(iso: string | undefined, fallback: T): Date | T {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? new Date(ms) : fallback;
}

/**
 * The real port with every CRM write recorded in `writes`; reads always go to GHL. With `live`
 * false no write is made and each returns what a success would (ids "dry_<n>"), so the turn goes
 * on exactly as it would have. With `live` true the writes go through and their outcome is
 * recorded. Every method is listed on purpose: a new GhlPort method fails to compile here
 * instead of slipping through unrecorded.
 */
function recordingGhl(real: GhlPort, live: boolean, writes: string[]): GhlPort {
  let fakeIds = 0;
  const fakeId = () => `dry_${++fakeIds}`;
  const record = (line: string, outcome: string) => {
    writes.push(`${line}  → ${outcome}`);
  };
  /** setDnd / tags / notes: a boolean outcome. */
  const flagWrite = async (line: string, run: () => Promise<boolean>): Promise<boolean> => {
    if (!live) {
      record(line, "not made");
      return true;
    }
    const ok = await run();
    record(line, ok ? "ok" : "FAILED");
    return ok;
  };

  return {
    getContact: (contactId) => real.getContact(contactId),
    listMessages: (contactId, opts) => real.listMessages(contactId, opts),
    getFreeSlots: (input) => real.getFreeSlots(input),
    listUserEvents: (input) => real.listUserEvents(input),
    listContactAppointments: (contactId) => real.listContactAppointments(contactId),

    async sendMessage(input) {
      const line = `sendMessage ${input.channel} contact=${input.contactId}: "${oneLine(input.text, 160)}"`;
      if (!live) {
        const messageId = fakeId();
        record(line, `not sent (${messageId})`);
        return { kind: "sent", messageId, conversationId: null };
      }
      const outcome = await real.sendMessage(input);
      record(line, outcome.kind === "sent" ? `sent ${outcome.messageId}` : `${outcome.kind} ${outcome.status}`);
      return outcome;
    },
    async createAppointment(input) {
      const line = `createAppointment calendar=${input.calendarId} contact=${input.contactId} start=${input.startIso}`;
      if (!live) {
        const startTime = parsedDate(input.startIso, null);
        if (!startTime) {
          // What the real port answers for an unreadable time.
          record(line, "refused (invalid_time)");
          return { ok: false, status: 0, retryable: false, error: "invalid_time", slotTaken: false };
        }
        const value: AppointmentRef = {
          id: fakeId(),
          calendarId: input.calendarId,
          contactId: input.contactId,
          startTime,
          endTime: parsedDate(input.endIso, null),
          status: "confirmed",
          title: input.title,
        };
        record(line, `not booked (${value.id})`);
        return { ok: true, value };
      }
      const res = await real.createAppointment(input);
      record(line, res.ok ? `booked ${res.value.id}` : `failed ${res.status}${res.slotTaken ? " (slot taken)" : ""}`);
      return res;
    },
    async updateAppointment(input) {
      const line = `updateAppointment ${input.appointmentId} status=${input.status}${input.startIso ? ` start=${input.startIso}` : ""}`;
      if (!live) {
        record(line, "not changed");
        // A status-only change has no time to echo back: "now" stands in for GHL's answer.
        const value: AppointmentRef = {
          id: input.appointmentId,
          calendarId: "",
          contactId: null,
          startTime: parsedDate(input.startIso, new Date()),
          endTime: parsedDate(input.endIso, null),
          status: input.status,
          title: null,
        };
        return { ok: true, value };
      }
      const res = await real.updateAppointment(input);
      record(line, res.ok ? "ok" : `failed ${res.status}`);
      return res;
    },
    setDnd: (contactId, channels) =>
      flagWrite(`setDnd contact=${contactId} ${channels.join(",")}`, () => real.setDnd(contactId, channels)),
    addTags: (contactId, tags) =>
      flagWrite(`addTags contact=${contactId} ${tags.join(",")}`, () => real.addTags(contactId, tags)),
    removeTags: (contactId, tags) =>
      flagWrite(`removeTags contact=${contactId} ${tags.join(",")}`, () => real.removeTags(contactId, tags)),
    addNote: (contactId, body) =>
      flagWrite(`addNote contact=${contactId}: "${oneLine(body, 200)}"`, () => real.addNote(contactId, body)),
  };
}

/** Alert fields printed as they are. Any other field shows only its name (first name, future fields). */
const PRINTABLE_EVENT_FIELDS = new Set([
  "messageId",
  "contactId",
  "product",
  "state",
  "leadLocalTime",
  "sendsAt",
  "reason",
  "urgent",
  "whenLabel",
  "aiManaged",
  "percent",
  "detail",
]);

/** Prints each alert here instead of sending it to Telegram: its kind and PII-free fields. */
function consoleNotifier(): NotifyPort {
  return {
    async notify(event: NotifyEvent) {
      const fields = Object.entries(event).flatMap(([key, value]: [string, unknown]): string[] => {
        if (key === "kind") return [];
        // The draft preview is our own text, but it is shown as a length: the inbox has it.
        if (key === "preview") return [`preview=${typeof value === "string" ? `${value.length} chars` : "none"}`];
        return [PRINTABLE_EVENT_FIELDS.has(key) ? `${key}=${String(value)}` : `${key}=…`];
      });
      console.log(`[notify] ${event.kind}${fields.length > 0 ? ` ${fields.join(" ")}` : ""}`);
    },
  };
}

function printWrites(writes: string[], live: boolean): void {
  if (writes.length === 0) {
    console.log("\nCRM writes: none.");
    return;
  }
  console.log(live ? "\nCRM writes MADE (test contact, --yes):" : "\nCRM writes that WOULD have been made (none reached the CRM):");
  for (const write of writes) console.log(`  ${write}`);
}

async function shadowTurn(contactId: string): Promise<void> {
  process.env.AI_SETTER_DRY_RUN = "true";
  const { buildPorts } = await import("@/lib/ai-setter/process");
  const { runTurn } = await import("@/lib/ai-setter/turn");
  const { aiSetterStore } = await import("@/lib/ai-setter/store");
  const built = buildPorts({ budgetMs: 240_000, requireQueue: false });
  if (!built.ports) fail(`Not configured: ${built.missing.join(", ")}`);

  const testContact = config.testContactIds.includes(contactId);
  const liveWrites = flag("--yes") && testContact;
  if (flag("--yes") && !testContact) console.log("--yes ignored: the contact is not in AI_SETTER_TEST_CONTACT_IDS.");
  console.log(liveWrites ? "CRM writes: LIVE (test contact, --yes)." : "CRM writes: recorded only, none reach the CRM.");

  const writes: string[] = [];
  const published: string[] = [];
  const ports: AiSetterPorts = {
    ...built.ports,
    config: { ...built.ports.config, dryRun: true },
    ghl: recordingGhl(built.ports.ghl, liveWrites, writes),
    notify: consoleNotifier(),
    queue: {
      publishTurn: async (_c, runId) => (published.push(`turn ${runId}`), true),
      publishSend: async (id) => (published.push(`send ${id}`), true),
      publishVerifySend: async (id) => (published.push(`verify ${id}`), true),
      publishCallNowTimeout: async (c) => (published.push(`call_now_timeout ${c}`), true),
    },
  };
  const armed = await aiSetterStore.armTurn(contactId, new Date());
  if (!armed.armed || !armed.runId) fail("A turn is already in flight for this contact.");
  try {
    const result = await runTurn(contactId, armed.runId, ports, { reason: "inbound", retry: 0 });
    console.log("Turn result:", result);
    if (result.messageId) {
      const msg = await aiSetterStore.getMessage(result.messageId);
      console.log(`\n[${msg?.status}] ${msg?.templateId ?? "free text"} · ${msg?.channel}\n${msg?.body ?? "(no body)"}\n`);
      console.log(`Cost: US$${((msg?.costMicros ?? 0) / 1_000_000).toFixed(4)} · model ${msg?.model ?? "-"}`);
    }
  } finally {
    if (published.length) console.log("Jobs that WOULD have been queued:", published);
    printWrites(writes, liveWrites);
  }
}

async function main(): Promise<void> {
  if (flag("--calendars")) return checkCalendars();
  const sources = valueAfter("--sources");
  if (sources) {
    if (!ID_RE.test(sources)) fail("Bad contact id");
    return showSources(sources);
  }
  const book = valueAfter("--book");
  if (book) {
    if (!ID_RE.test(book)) fail("Bad contact id");
    return bookTest(book);
  }
  const cancel = valueAfter("--cancel-appointment");
  if (cancel) {
    if (!APPOINTMENT_ID_RE.test(cancel)) fail("Bad appointment id");
    return cancelTest(cancel);
  }
  const contactId = args.find((a) => ID_RE.test(a));
  if (contactId) return shadowTurn(contactId);
  console.log(
    "Usage: pnpm ai-setter:try --calendars | --sources <contactId> | <contactId> [--yes] | --book <contactId> --yes | --cancel-appointment <id> --yes"
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
