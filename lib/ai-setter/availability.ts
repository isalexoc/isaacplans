/**
 * Isaac's hours, the lead's hours, and the two times the AI offers. All of it is decided in code;
 * the model never picks a time.
 *
 *   GHL free slots -> filterSlots (notice, horizon, :00/:30, Isaac's windows, lead 9a–9p, busy)
 *   -> applyPreference (what the lead asked for) -> pickTwoSlots -> formatSlotForText
 *
 * Times are instants (epoch ms). "Local" always means wall-clock time in a named IANA zone, read
 * with Intl. A window such as 21:30–24:00 is resolved to instants on the local date it belongs
 * to, so DST changes (US: 2026-11-01, 2027-03-14) never shift or stretch it. A window ending 24:00
 * ends at that day's local midnight, and nothing crosses it. A local time skipped by spring-forward
 * moves forward by the gap; one repeated by fall-back takes the earlier instant.
 *
 * Nothing here throws on a bad zone: an invalid zone is treated as Isaac's
 * (DEFAULT_SCHEDULE_TIMEZONE) everywhere, labels included. Use `isValidTimeZone` upstream to know
 * when that happened.
 *
 * Pure: no DB, no server-only, no network.
 */

import { DEFAULT_SCHEDULE_TIMEZONE } from "./config";
import type { AppointmentRef, Lang, Register, TimeWindow, WeeklySchedule, Weekday } from "./types";

// ─── Types & constants ─────────────────────────────────────────────────────────────────────

/** Wall-clock parts of an instant in a zone. `month` 1–12, `hour` 0–23, `weekday` 0 = Sunday. */
export type ZonedParts = { year: number; month: number; day: number; weekday: Weekday; hour: number; minute: number };

/** Lead-local part of day: morning before 12:00, afternoon 12:00–16:59, evening from 17:00. */
export type PartOfDay = "morning" | "afternoon" | "evening";

/** Where the lead's zone came from (most to least reliable: GHL's own field, address, area code). */
export type ZoneSource = "ghl" | "address" | "area_code" | "none";

/**
 * What the lead asked for, all lead-local. `afterLocal` is inclusive and `beforeLocal` exclusive,
 * both "HH:MM" and compared with the slot's start. `dateLocal` is "YYYY-MM-DD". Missing or
 * malformed fields add no constraint.
 */
export type SlotPreference = {
  afterLocal?: string;
  beforeLocal?: string;
  weekdays?: Weekday[];
  dateLocal?: string;
  partOfDay?: PartOfDay;
};

/** Times offered to a lead fall inside these lead-local hours unless the lead asked otherwise. */
export const LEAD_HOURS = { start: "09:00", end: "21:00" } as const;

type MinuteWindow = { start: number; end: number };
type LocalDate = { year: number; month: number; day: number };
type Slot = { iso: string; ms: number };
type LocalSlot = Slot & { day: number; minute: number; part: PartOfDay };
type Interval = { start: number; end: number };
type ZoneRegion = "eastern" | "central" | "mountain" | "pacific" | "alaska" | "hawaii" | "atlantic";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const MAX_WINDOWS_PER_DAY = 6;
/** "Available now" (and "replies shortly") needs at least this much of the current window left. */
const MIN_MINUTES_LEFT_NOW = 15;
const DEFAULT_BUFFER_MINUTES = 30;
const DEFAULT_HORIZON_DAYS = 7;
/** Length assumed for a busy event with no usable end time. */
const ASSUMED_EVENT_MINUTES = 30;
/** The second offered time is always at least this long after the first. */
const SECOND_SLOT_GAP_MS = 2 * HOUR_MS;
const AFTERNOON_FROM_MINUTE = 12 * 60;
const EVENING_FROM_MINUTE = 17 * 60;
const LEAD_WORKS_WITHIN_MS = 3 * DAY_MS;
const PREVIEW_MAX_SLOTS = 12;
const PARTS_OF_DAY: readonly PartOfDay[] = ["morning", "afternoon", "evening"];
const INACTIVE_EVENT_STATUSES = new Set(["cancelled", "canceled", "invalid"]);

const HHMM = /^(\d{1,2}):(\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** An instant with an explicit offset. Without one, Date.parse would use the server's zone. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
/** IANA-shaped names only: Intl also accepts offsets like "+05:00", which carry no DST rules. */
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const WEEKDAY_BY_SHORT_NAME = new Map<string, Weekday>([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const EN_WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EN_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const ES_WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const ES_MONTHS_SHORT = [
  "ene.",
  "feb.",
  "mar.",
  "abr.",
  "may.",
  "jun.",
  "jul.",
  "ago.",
  "sept.",
  "oct.",
  "nov.",
  "dic.",
] as const;

/**
 * US zones by region, under both the tz names and the older CLDR names V8 canonicalizes to
 * (America/Indiana/Indianapolis reads back as America/Indianapolis). Knox and Tell_City, Indiana,
 * keep Central time.
 */
const ZONE_REGIONS: ReadonlyArray<readonly [ZoneRegion, readonly string[]]> = [
  [
    "eastern",
    [
      "America/New_York",
      "America/Detroit",
      "America/Indianapolis",
      "America/Fort_Wayne",
      "America/Louisville",
      "US/Eastern",
      "US/East-Indiana",
      "US/Michigan",
      "EST5EDT",
      "EST",
    ],
  ],
  [
    "central",
    [
      "America/Chicago",
      "America/Menominee",
      "America/Indiana/Knox",
      "America/Indiana/Tell_City",
      "America/Knox_IN",
      "US/Central",
      "US/Indiana-Starke",
      "CST6CDT",
    ],
  ],
  [
    "mountain",
    [
      "America/Denver",
      "America/Boise",
      "America/Phoenix",
      "America/Shiprock",
      "Navajo",
      "US/Mountain",
      "US/Arizona",
      "MST7MDT",
      "MST",
    ],
  ],
  ["pacific", ["America/Los_Angeles", "US/Pacific", "PST8PDT"]],
  [
    "alaska",
    [
      "America/Anchorage",
      "America/Juneau",
      "America/Sitka",
      "America/Yakutat",
      "America/Nome",
      "America/Metlakatla",
      "America/Adak",
      "America/Atka",
      "US/Alaska",
      "US/Aleutian",
    ],
  ],
  ["hawaii", ["Pacific/Honolulu", "Pacific/Johnston", "US/Hawaii", "HST"]],
  ["atlantic", ["America/Puerto_Rico", "America/St_Thomas", "America/Virgin"]],
];

const REGION_OF_ZONE = new Map<string, ZoneRegion>(
  ZONE_REGIONS.flatMap(([region, zones]) => zones.map((zone) => [zone, region] as const))
);

const REGION_OF_ZONE_PREFIX: ReadonlyArray<readonly [string, ZoneRegion]> = [
  ["America/Indiana/", "eastern"],
  ["America/Kentucky/", "eastern"],
  ["America/North_Dakota/", "central"],
];

const REGION_LABELS: Record<ZoneRegion, Record<Lang, string>> = {
  eastern: { en: "Eastern", es: "del Este" },
  central: { en: "Central", es: "del Centro" },
  mountain: { en: "Mountain", es: "de la Montaña" },
  pacific: { en: "Pacific", es: "del Pacífico" },
  alaska: { en: "Alaska", es: "de Alaska" },
  hawaii: { en: "Hawaii", es: "de Hawái" },
  atlantic: { en: "Atlantic", es: "del Atlántico" },
};

// ─── Memo caches (deterministic results only) ──────────────────────────────────────────────

const CACHE_LIMIT = 2_000;
const zoneNames = new Map<string, string | null>();
const formatters = new Map<string, Intl.DateTimeFormat>();
const localInstants = new Map<string, number>();

function memo<V>(cache: Map<string, V>, key: string, compute: () => V): V {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

// ─── Small helpers ─────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

function nonNegative(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHHMM(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/** Epoch ms of an ISO instant that carries an offset ("…-05:00", "…-0500", "…Z"); null otherwise. */
function parseIsoMs(iso: string): number | null {
  if (typeof iso !== "string") return null;
  const value = iso.trim().toUpperCase();
  if (!ISO_INSTANT.test(value)) return null;
  const ms = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isFinite(ms) ? ms : null;
}

/** Parseable slots, ascending, one per instant (the first spelling wins), original strings kept. */
function sortedUniqueSlots(slotsIso: string[]): Slot[] {
  const parsed: Slot[] = [];
  for (const iso of slotsIso) {
    const ms = parseIsoMs(iso);
    if (ms !== null) parsed.push({ iso, ms });
  }
  parsed.sort((a, b) => a.ms - b.ms);
  return parsed.filter((slot, i) => i === 0 || slot.ms !== parsed[i - 1].ms);
}

/** Busy intervals of the events that still hold time (not cancelled / invalid). */
function activeIntervals(events: AppointmentRef[]): Interval[] {
  const out: Interval[] = [];
  for (const event of events) {
    const status = typeof event.status === "string" ? event.status.trim().toLowerCase() : "";
    if (INACTIVE_EVENT_STATUSES.has(status)) continue;
    const start = new Date(event.startTime).getTime();
    if (!Number.isFinite(start)) continue;
    const end = event.endTime ? new Date(event.endTime).getTime() : Number.NaN;
    out.push({ start, end: end > start ? end : start + ASSUMED_EVENT_MINUTES * MINUTE_MS });
  }
  return out;
}

// ─── Zones & local time ────────────────────────────────────────────────────────────────────

/** Intl's canonical name for a zone, or null when it is not a valid IANA name. */
function canonicalZone(zone: string): string | null {
  const name = typeof zone === "string" ? zone.trim() : "";
  if (!IANA_NAME.test(name)) return null;
  return memo(zoneNames, name, () => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions().timeZone;
    } catch {
      return null;
    }
  });
}

/** The zone a computation uses: the given one, or Isaac's when it is not a valid IANA name. */
function resolveZone(zone: string): string {
  return canonicalZone(zone) ?? DEFAULT_SCHEDULE_TIMEZONE;
}

/** True for an IANA zone name Intl knows ("America/Chicago"); false for offsets, blanks and junk. */
export function isValidTimeZone(zone: string): boolean {
  return canonicalZone(zone) !== null;
}

function formatterFor(zone: string): Intl.DateTimeFormat {
  return memo(
    formatters,
    zone,
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        weekday: "short",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      })
  );
}

/** Wall-clock parts at `ms` in an already-resolved zone. */
function partsAt(ms: number, zone: string): ZonedParts {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatterFor(zone).formatToParts(ms)) values[part.type] = part.value;
  const hour = Number(values.hour);
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: WEEKDAY_BY_SHORT_NAME.get(values.weekday ?? "") ?? 0,
    hour: hour === 24 ? 0 : hour,
    minute: Number(values.minute),
  };
}

/**
 * Wall-clock parts of `date` in `timeZone` (Intl, hourCycle h23). An invalid zone reads as Isaac's
 * zone; an invalid Date throws RangeError, as Intl does.
 */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  return partsAt(date.getTime(), resolveZone(timeZone));
}

/** Local minus UTC at `ms`, in ms. */
function offsetAt(ms: number, zone: string): number {
  const minute = Math.floor(ms / MINUTE_MS) * MINUTE_MS;
  const p = partsAt(minute, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - minute;
}

/** The instant a local date + minute of day (0–1440) names in `zone` (see the header for DST). */
function localInstant(date: LocalDate, minuteOfDay: number, zone: string): number {
  const key = `${zone}|${date.year}-${date.month}-${date.day}|${minuteOfDay}`;
  return memo(localInstants, key, () => {
    const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
    const before = offsetAt(wall - DAY_MS, zone);
    const after = offsetAt(wall + DAY_MS, zone);
    const exact = [wall - before, wall - after].filter((ms) => offsetAt(ms, zone) === wall - ms);
    return exact.length > 0 ? Math.min(...exact) : wall - before;
  });
}

/**
 * The instant of a local date and minute of day (0–1440; 1440 = that day's midnight) in
 * `timeZone`. A skipped local time moves forward by the gap; a repeated one takes the earlier
 * instant. An invalid zone reads as Isaac's.
 */
export function zonedTimeToDate(date: { year: number; month: number; day: number }, minuteOfDay: number, timeZone: string): Date {
  return new Date(localInstant(date, minuteOfDay, resolveZone(timeZone)));
}

/** Whole days since the epoch for a local calendar date (differences = calendar-day distance). */
function dayNumber(date: LocalDate): number {
  return Math.round(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
}

function addDays(date: LocalDate, days: number): LocalDate & { weekday: Weekday } {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate(), weekday: WEEKDAYS[utc.getUTCDay()] };
}

function dateKey(date: LocalDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

// ─── Windows ───────────────────────────────────────────────────────────────────────────────

/**
 * "HH:MM" (24 h; a one-digit hour is accepted) to minutes after midnight. "24:00" is 1440.
 * NaN when malformed or out of range.
 */
export function parseHHMM(s: string): number {
  const match = typeof s === "string" ? HHMM.exec(s.trim()) : null;
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) return Number.NaN;
  return hours * 60 + minutes;
}

function minuteWindow(window: { start: string; end: string } | null | undefined): MinuteWindow | null {
  if (!window) return null;
  const start = parseHHMM(window.start);
  const end = parseHHMM(window.end);
  return start < end ? { start, end } : null;
}

/** Sorted windows merged where they touch or overlap (09:00–12:00 + 12:00–14:00 = 09:00–14:00). */
function mergeWindows(sorted: MinuteWindow[]): MinuteWindow[] {
  const out: MinuteWindow[] = [];
  for (const window of sorted) {
    const last = out[out.length - 1];
    if (last && window.start <= last.end) last.end = Math.max(last.end, window.end);
    else out.push({ ...window });
  }
  return out;
}

/** A day's usable windows, sorted and merged; malformed windows are skipped. */
function dayWindows(schedule: WeeklySchedule, weekday: Weekday): MinuteWindow[] {
  const raw: unknown = schedule.days?.[weekday];
  const items: unknown[] = Array.isArray(raw) ? raw : [];
  const windows = items
    .map((item) => (isRecord(item) ? minuteWindow({ start: String(item.start), end: String(item.end) }) : null))
    .filter((window): window is MinuteWindow => window !== null)
    .sort((a, b) => a.start - b.start);
  return mergeWindows(windows);
}

/** [startMs, endMs) inside `window` on the local date `date` (so never past that day's midnight). */
function fitsWindow(startMs: number, endMs: number, date: LocalDate, window: MinuteWindow, zone: string): boolean {
  return localInstant(date, window.start, zone) <= startMs && endMs <= localInstant(date, window.end, zone);
}

function fitsSchedule(startMs: number, endMs: number, local: ZonedParts, schedule: WeeklySchedule, zone: string): boolean {
  return dayWindows(schedule, local.weekday).some((window) => fitsWindow(startMs, endMs, local, window, zone));
}

function validateDayWindows(value: unknown): TimeWindow[] | null {
  if (!Array.isArray(value) || value.length > MAX_WINDOWS_PER_DAY) return null;
  const items: unknown[] = value;
  const windows: MinuteWindow[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const { start, end } = item;
    if (typeof start !== "string" || typeof end !== "string") return null;
    const window = minuteWindow({ start, end });
    if (!window) return null;
    windows.push(window);
  }
  windows.sort((a, b) => a.start - b.start);
  if (windows.some((window, i) => i > 0 && window.start < windows[i - 1].end)) return null;
  return mergeWindows(windows).map((window) => ({ start: formatHHMM(window.start), end: formatHHMM(window.end) }));
}

function buildDays(windowsFor: (weekday: Weekday) => TimeWindow[]): Record<Weekday, TimeWindow[]> {
  return {
    0: windowsFor(0),
    1: windowsFor(1),
    2: windowsFor(2),
    3: windowsFor(3),
    4: windowsFor(4),
    5: windowsFor(5),
    6: windowsFor(6),
  };
}

/**
 * A schedule from untrusted JSON (app_settings, the admin form), or null when it is not valid:
 * an IANA `timeZone`, and days 0–6 all present, each an array of at most 6 `{ start, end }`
 * "HH:MM" windows with start < end <= "24:00" that do not overlap. The copy is normalized:
 * zero-padded times, windows sorted, touching windows merged, unknown keys dropped.
 */
export function validateSchedule(input: unknown): WeeklySchedule | null {
  if (!isRecord(input)) return null;
  const { timeZone, days } = input;
  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone) || !isRecord(days)) return null;
  const byDay = new Map<Weekday, TimeWindow[]>();
  for (const weekday of WEEKDAYS) {
    const windows = validateDayWindows(days[String(weekday)]);
    if (!windows) return null;
    byDay.set(weekday, windows);
  }
  return { timeZone: timeZone.trim(), days: buildDays((weekday) => byDay.get(weekday) ?? []) };
}

/**
 * True when the whole [start, start + duration) fits inside ONE window of the schedule-local
 * weekday of `start` (touching windows count as one). A window ending 24:00 ends at local
 * midnight; nothing crosses it. False for an invalid date or a non-positive duration.
 */
export function isWithinSchedule(start: Date, durationMinutes: number, schedule: WeeklySchedule): boolean {
  const startMs = start.getTime();
  if (!Number.isFinite(startMs) || !(durationMinutes > 0)) return false;
  const zone = resolveZone(schedule.timeZone);
  return fitsSchedule(startMs, startMs + durationMinutes * MINUTE_MS, partsAt(startMs, zone), schedule, zone);
}

/**
 * Can Isaac take a call right now? Inside a window with at least 15 minutes left, not marked busy
 * (`busyUntil` null or past), and no live event (any status but cancelled / invalid) overlapping
 * [now - buffer, now + buffer] (buffer defaults to 30 minutes).
 */
export function isIsaacAvailableNow(input: {
  now: Date;
  schedule: WeeklySchedule;
  busyUntil: Date | null;
  events: AppointmentRef[];
  bufferMinutes?: number;
}): boolean {
  const nowMs = input.now.getTime();
  if (!isWithinSchedule(input.now, MIN_MINUTES_LEFT_NOW, input.schedule)) return false;
  if (input.busyUntil && !(input.busyUntil.getTime() <= nowMs)) return false;
  const buffer = nonNegative(input.bufferMinutes, DEFAULT_BUFFER_MINUTES) * MINUTE_MS;
  return !activeIntervals(input.events).some((event) => event.start <= nowMs + buffer && event.end > nowMs - buffer);
}

// ─── Slots ─────────────────────────────────────────────────────────────────────────────────

function isOnHalfHour(ms: number, local: ZonedParts): boolean {
  return ms % MINUTE_MS === 0 && (local.minute === 0 || local.minute === 30);
}

/**
 * The offerable slots, ascending, one per instant, as the original ISO strings. A slot is kept
 * when it parses (with an offset); starts between now + minNotice and now + horizonDays (default
 * 7); starts on :00 or :30 in the schedule zone; fits one of Isaac's windows; fits the lead-local
 * `leadHours` (default LEAD_HOURS; invalid hours fall back to it; null drops the rule for a time
 * the lead asked for); and overlaps no busy event that isn't cancelled / invalid.
 */
export function filterSlots(input: {
  slotsIso: string[];
  schedule: WeeklySchedule;
  leadZone: string;
  now: Date;
  minNoticeMinutes: number;
  durationMinutes: number;
  busy: AppointmentRef[];
  leadHours?: { start: string; end: string } | null;
  horizonDays?: number;
}): string[] {
  const nowMs = input.now.getTime();
  const durationMs = input.durationMinutes * MINUTE_MS;
  if (!Number.isFinite(nowMs) || !(durationMs > 0)) return [];
  const earliest = nowMs + nonNegative(input.minNoticeMinutes, 0) * MINUTE_MS;
  const latest = nowMs + nonNegative(input.horizonDays, DEFAULT_HORIZON_DAYS) * DAY_MS;
  const scheduleZone = resolveZone(input.schedule.timeZone);
  const leadZone = resolveZone(input.leadZone);
  const leadHours = input.leadHours === null ? null : (minuteWindow(input.leadHours) ?? minuteWindow(LEAD_HOURS));
  const busy = activeIntervals(input.busy);
  const keep = ({ ms }: Slot): boolean => {
    if (ms < earliest || ms > latest) return false;
    const endMs = ms + durationMs;
    const local = partsAt(ms, scheduleZone);
    if (!isOnHalfHour(ms, local) || !fitsSchedule(ms, endMs, local, input.schedule, scheduleZone)) return false;
    if (leadHours && !fitsWindow(ms, endMs, partsAt(ms, leadZone), leadHours, leadZone)) return false;
    return !busy.some((event) => event.start < endMs && event.end > ms);
  };
  return sortedUniqueSlots(input.slotsIso)
    .filter(keep)
    .map((slot) => slot.iso);
}

function partOfMinute(minuteOfDay: number): PartOfDay {
  if (minuteOfDay < AFTERNOON_FROM_MINUTE) return "morning";
  if (minuteOfDay < EVENING_FROM_MINUTE) return "afternoon";
  return "evening";
}

/**
 * Lead-local part of day of a slot's start: morning before 12:00, afternoon 12:00–16:59, evening
 * from 17:00. An unparseable ISO reads as "morning".
 */
export function partOfDay(iso: string, leadZone: string): PartOfDay {
  const ms = parseIsoMs(iso);
  if (ms === null) return "morning";
  const local = partsAt(ms, resolveZone(leadZone));
  return partOfMinute(local.hour * 60 + local.minute);
}

function preferenceMatcher(pref: SlotPreference | null): (local: ZonedParts) => boolean {
  const after = pref?.afterLocal === undefined ? Number.NaN : parseHHMM(pref.afterLocal);
  const before = pref?.beforeLocal === undefined ? Number.NaN : parseHHMM(pref.beforeLocal);
  const weekdays = new Set((pref?.weekdays ?? []).filter(isWeekday));
  const date = typeof pref?.dateLocal === "string" && ISO_DATE.test(pref.dateLocal.trim()) ? pref.dateLocal.trim() : null;
  const part = pref?.partOfDay && PARTS_OF_DAY.includes(pref.partOfDay) ? pref.partOfDay : null;
  return (local) => {
    const minute = local.hour * 60 + local.minute;
    if (!Number.isNaN(after) && minute < after) return false;
    if (!Number.isNaN(before) && minute >= before) return false;
    if (weekdays.size > 0 && !weekdays.has(local.weekday)) return false;
    if (date !== null && dateKey(local) !== date) return false;
    return part === null || partOfMinute(minute) === part;
  };
}

/**
 * The slots that match what the lead asked for (lead-local; see SlotPreference), in the given
 * order. A null preference keeps every parseable slot. Part of day: morning < 12:00, afternoon
 * 12:00–17:00, evening >= 17:00.
 */
export function applyPreference(slotsIso: string[], pref: SlotPreference | null, leadZone: string): string[] {
  const zone = resolveZone(leadZone);
  const matches = preferenceMatcher(pref);
  return slotsIso.filter((iso) => {
    const ms = parseIsoMs(iso);
    return ms !== null && matches(partsAt(ms, zone));
  });
}

function toLocalSlot(slot: Slot, zone: string): LocalSlot {
  const local = partsAt(slot.ms, zone);
  const minute = local.hour * 60 + local.minute;
  return { ...slot, day: dayNumber(local), minute, part: partOfMinute(minute) };
}

function pickSecond(first: LocalSlot, rest: LocalSlot[], nowMs: number, leadWorks: boolean): LocalSlot | undefined {
  const spaced = rest.filter((slot) => slot.ms >= first.ms + SECOND_SLOT_GAP_MS);
  const evening = leadWorks
    ? spaced.find((slot) => slot.minute >= EVENING_FROM_MINUTE && slot.ms <= nowMs + LEAD_WORKS_WITHIN_MS)
    : undefined;
  return (
    evening ??
    spaced.find((slot) => slot.part !== first.part || slot.day > first.day) ??
    spaced[0] ??
    rest[rest.length - 1]
  );
}

/**
 * Up to two times to offer, from an already-filtered list; never one in `exclude` (compared as
 * instants). A = the earliest. B = the first slot at least 2 h after A that is in another part of
 * the day or on a later lead-local day; when the lead works, the first slot at least 2 h after A
 * from 17:00 lead-local and within 3 days of now comes first. When nothing meets the rule, B is
 * the first slot 2 h after A, else the latest one left. Deterministic.
 */
export function pickTwoSlots(
  slotsIso: string[],
  input: { now: Date; leadZone: string; leadWorks?: boolean; exclude?: string[] }
): string[] {
  const zone = resolveZone(input.leadZone);
  const excluded = new Set(sortedUniqueSlots(input.exclude ?? []).map((slot) => slot.ms));
  const slots = sortedUniqueSlots(slotsIso)
    .filter((slot) => !excluded.has(slot.ms))
    .map((slot) => toLocalSlot(slot, zone));
  if (slots.length === 0) return [];
  const [first, ...rest] = slots;
  const second = pickSecond(first, rest, input.now.getTime(), input.leadWorks === true);
  return second ? [first.iso, second.iso] : [first.iso];
}

// ─── Zone labels ───────────────────────────────────────────────────────────────────────────

function regionOf(name: string): ZoneRegion | null {
  const exact = REGION_OF_ZONE.get(name);
  if (exact) return exact;
  return REGION_OF_ZONE_PREFIX.find(([prefix]) => name.startsWith(prefix))?.[1] ?? null;
}

/** The zone's name as given (trimmed), or Isaac's when it is not a valid IANA name. */
function displayZone(zone: string): string {
  return isValidTimeZone(zone) ? zone.trim() : DEFAULT_SCHEDULE_TIMEZONE;
}

function zoneRegion(zone: string): ZoneRegion | null {
  const name = displayZone(zone);
  return regionOf(name) ?? regionOf(resolveZone(name));
}

function cityPart(zone: string): string {
  const last = zone.split("/").pop() ?? zone;
  return last.replace(/_/g, " ");
}

/**
 * The zone as a lead reads it: "Pacific" / "del Pacífico" (for "(Pacific time)" and "(hora del
 * Pacífico)"). US regions: Eastern, Central, Mountain, Pacific, Alaska, Hawaii, Atlantic (Puerto
 * Rico, USVI). Other zones give the city ("Madrid" / "de Madrid"); an invalid zone reads as
 * Isaac's.
 */
export function zoneLabel(zone: string, lang: Lang): string {
  const region = zoneRegion(zone);
  if (region) return REGION_LABELS[region][lang];
  const city = cityPart(displayZone(zone));
  return lang === "es" ? `de ${city}` : city;
}

/**
 * Should a time in a text name its zone? Yes unless the lead is in an Eastern zone (Isaac's) that
 * came from GHL or the address: an area code is only a guess, and an unknown or invalid zone is
 * always named.
 */
export function shouldShowZone(leadZone: string, zoneSource: ZoneSource): boolean {
  if (zoneSource === "area_code" || zoneSource === "none" || !isValidTimeZone(leadZone)) return true;
  return zoneRegion(leadZone) !== "eastern";
}

// ─── Text ──────────────────────────────────────────────────────────────────────────────────

/** "4:30pm", "10am", "12pm". */
function enClock(hour: number, minute: number): string {
  const h12 = hour % 12 || 12;
  return `${h12}${minute ? `:${pad2(minute)}` : ""}${hour < 12 ? "am" : "pm"}`;
}

function esPeriod(hour: number): string {
  if (hour >= 5 && hour < 12) return "de la mañana";
  if (hour === 12) return "del mediodía";
  if (hour >= 13 && hour < 20) return "de la tarde";
  return "de la noche";
}

/** "la 1 de la tarde", "las 12 del mediodía", "las 9:30 de la noche". */
function esClock(hour: number, minute: number): string {
  const h12 = hour % 12 || 12;
  return `${h12 === 1 ? "la" : "las"} ${h12}${minute ? `:${pad2(minute)}` : ""} ${esPeriod(hour)}`;
}

/** "Thu, Nov 27" / "el jueves 27 de nov." */
function explicitDate(local: ZonedParts, lang: Lang): string {
  if (lang === "es") return `el ${ES_WEEKDAYS[local.weekday]} ${local.day} de ${ES_MONTHS_SHORT[local.month - 1]}`;
  return `${EN_WEEKDAYS_SHORT[local.weekday]}, ${EN_MONTHS_SHORT[local.month - 1]} ${local.day}`;
}

/** today / tomorrow / "Thursday" (2–6 days out) / "Thu, Nov 27"; hoy / mañana / el jueves / … */
function relativeDay(local: ZonedParts, today: ZonedParts | null, lang: Lang): string {
  const diff = today ? dayNumber(local) - dayNumber(today) : Number.NaN;
  if (diff === 0) return lang === "es" ? "hoy" : "today";
  if (diff === 1) return lang === "es" ? "mañana" : "tomorrow";
  if (diff >= 2 && diff <= 6) return lang === "es" ? `el ${ES_WEEKDAYS[local.weekday]}` : EN_WEEKDAYS[local.weekday];
  return explicitDate(local, lang);
}

function partsOrNull(date: Date, zone: string): ZonedParts | null {
  const ms = date.getTime();
  return Number.isFinite(ms) ? partsAt(ms, zone) : null;
}

/**
 * A slot for a text, in the LEAD's zone, 12-hour clock, no year. EN: "today at 4:30pm", "tomorrow
 * at 10am", "Thursday at 9:30pm" (2–6 days out), "Thu, Nov 27 at 10am" (later). ES: "hoy a las
 * 4:30 de la tarde", "mañana a las 10 de la mañana", "el jueves a la 1 de la tarde", "el jueves 27
 * de nov. a las 12 del mediodía". `showZone` appends " (Pacific time)" / " (hora del Pacífico)".
 * An unparseable ISO is returned unchanged.
 */
export function formatSlotForText(
  iso: string,
  input: { lang: Lang; leadZone: string; now: Date; showZone: boolean }
): string {
  const ms = parseIsoMs(iso);
  if (ms === null) return iso;
  const zone = resolveZone(input.leadZone);
  const local = partsAt(ms, zone);
  const day = relativeDay(local, partsOrNull(input.now, zone), input.lang);
  const text =
    input.lang === "es" ? `${day} a ${esClock(local.hour, local.minute)}` : `${day} at ${enClock(local.hour, local.minute)}`;
  if (!input.showZone) return text;
  const label = zoneLabel(input.leadZone, input.lang);
  return input.lang === "es" ? `${text} (hora ${label})` : `${text} (${label} time)`;
}

/**
 * An appointment for a confirmation, always with its date, in the lead's zone: "Tue, Nov 18 at
 * 4:30pm (your time)" / "el martes 18 de nov. a las 4:30 de la tarde (su hora)" ("(tu hora)" for
 * tú). No year. `now` is accepted for parity with formatSlotForText and not needed. An
 * unparseable ISO is returned unchanged.
 */
export function formatAppointmentForText(
  iso: string,
  input: { lang: Lang; register: Register; leadZone: string; now: Date }
): string {
  const ms = parseIsoMs(iso);
  if (ms === null) return iso;
  const local = partsAt(ms, resolveZone(input.leadZone));
  const date = explicitDate(local, input.lang);
  if (input.lang === "en") return `${date} at ${enClock(local.hour, local.minute)} (your time)`;
  return `${date} a ${esClock(local.hour, local.minute)} (${input.register === "tu" ? "tu" : "su"} hora)`;
}

/** Start of the next schedule window after `nowMs` (up to a week ahead), or null for none. */
function nextWindowStart(nowMs: number, schedule: WeeklySchedule): number | null {
  if (!Number.isFinite(nowMs)) return null;
  const zone = resolveZone(schedule.timeZone);
  const today = partsAt(nowMs, zone);
  for (let offset = 0; offset <= 7; offset++) {
    const date = addDays(today, offset);
    for (const window of dayWindows(schedule, date.weekday)) {
      const start = localInstant(date, window.start, zone);
      if (start > nowMs) return start;
    }
  }
  return null;
}

function ceilToLocalHour(ms: number, zone: string): number {
  const intoHour = partsAt(ms, zone).minute * MINUTE_MS + (ms % MINUTE_MS);
  return intoHour === 0 ? ms : ms - intoHour + HOUR_MS;
}

function promiseText(promiseMs: number, today: ZonedParts, zone: string, lang: Lang): string {
  const local = partsAt(promiseMs, zone);
  if (local.hour === 0 && local.minute === 0) {
    const day = relativeDay(partsAt(promiseMs - MINUTE_MS, zone), today, lang);
    return lang === "es" ? `${day} antes de la medianoche` : `${day} before midnight`;
  }
  const day = relativeDay(local, today, lang);
  if (lang === "es") return `${day} antes de ${esClock(local.hour, local.minute)}`;
  return `${day} before ${enClock(local.hour, local.minute)}`;
}

/**
 * When Isaac will reply in person, for "Isaac will reply {eta}". Inside a window with at least 15
 * minutes left: "shortly" / "en breve". Otherwise the next window start, rounded up to the hour
 * plus one hour, in the LEAD's zone: "today before 10pm" / "hoy antes de las 10 de la noche",
 * "tomorrow before 10am" / "mañana antes de las 10 de la mañana"; a promise at midnight reads
 * "today before midnight" / "hoy antes de la medianoche". No window at all: "as soon as possible"
 * / "lo antes posible".
 */
export function formatEta(input: { now: Date; schedule: WeeklySchedule; lang: Lang; leadZone: string }): string {
  const { lang } = input;
  if (isWithinSchedule(input.now, MIN_MINUTES_LEFT_NOW, input.schedule)) return lang === "es" ? "en breve" : "shortly";
  const nowMs = input.now.getTime();
  const next = nextWindowStart(nowMs, input.schedule);
  if (next === null) return lang === "es" ? "lo antes posible" : "as soon as possible";
  const zone = resolveZone(input.leadZone);
  return promiseText(ceilToLocalHour(next, zone) + HOUR_MS, partsAt(nowMs, zone), zone, lang);
}

/**
 * Settings preview: which times a lead in each zone would be offered this week. Per zone (in the
 * given order): filterSlots with that zone's LEAD_HOURS, then up to 12 Spanish labels in the
 * lead's zone ("mañana a las 10 de la mañana"). `labelEs` is zoneLabel(zone, "es"), e.g. "del
 * Este"; `slots` holds labels, not ISO strings.
 */
export function slotsByZone(input: {
  slotsIso: string[];
  schedule: WeeklySchedule;
  now: Date;
  zones: string[];
  durationMinutes: number;
  minNoticeMinutes: number;
  busy: AppointmentRef[];
}): Array<{ zone: string; labelEs: string; slots: string[] }> {
  return input.zones.map((zone) => {
    const slots = filterSlots({
      slotsIso: input.slotsIso,
      schedule: input.schedule,
      leadZone: zone,
      now: input.now,
      minNoticeMinutes: input.minNoticeMinutes,
      durationMinutes: input.durationMinutes,
      busy: input.busy,
    });
    return {
      zone,
      labelEs: zoneLabel(zone, "es"),
      slots: slots
        .slice(0, PREVIEW_MAX_SLOTS)
        .map((iso) => formatSlotForText(iso, { lang: "es", leadZone: zone, now: input.now, showZone: false })),
    };
  });
}
