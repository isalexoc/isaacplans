/**
 * AI Setter switches Isaac changes from /admin/ai-setter without a deploy, kept in the shared
 * `app_settings` key/value table (same mechanism as lib/mailing-labels/settings.ts).
 *
 * Env (./config.ts) is the ceiling. These values can only tighten it: pause, "busy until", the
 * weekly hours, and which template versions may go out without review.
 *
 * Read UNCACHED in one query, and fail closed: when the read fails the setter behaves as paused
 * (`failedClosed: true`) and the caller alerts Isaac. Reads happen inside QStash jobs or behind
 * admin auth, never on public traffic, so they never wake Neon on their own.
 */

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

import { getAiSetterConfig } from "./config";
import { createAiSetterLogger } from "./log";
import { DEFAULT_SCHEDULE } from "./product";
import type { AiSetterSettings, SettingsPort, TimeWindow, Weekday, WeeklySchedule } from "./types";

const KEYS = {
  paused: "ai_setter_paused",
  busyUntil: "ai_setter_busy_until",
  schedule: "ai_setter_schedule",
  templates: "ai_setter_templates",
} as const;

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const MINUTES_PER_DAY = 24 * 60;
const MAX_WINDOWS_PER_DAY = 8;
/** Two approve / revoke taps at once: retry the compare-and-swap this many times. */
const CAS_ATTEMPTS = 3;
const TEMPLATE_ID_MAX_CHARS = 120;
const TEMPLATE_HASH_MAX_CHARS = 128;

function logger() {
  return createAiSetterLogger(getAiSetterConfig().debug);
}

/** Error class and a short message only: never a payload. */
function errorSummary(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : "unknown error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function defaultSchedule(): WeeklySchedule {
  return structuredClone(DEFAULT_SCHEDULE);
}

// ─── Parsing (every stored value is untrusted until it has a valid shape) ───────────────────

/** Missing = not paused. "false" = not paused. Anything else, including garbage, = paused. */
function parsePaused(value: string | undefined): boolean {
  if (value === undefined) return false;
  return value.trim().toLowerCase() !== "false";
}

function parseBusyUntil(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTemplates(value: string | undefined): Record<string, string> {
  const parsed = parseJson(value);
  if (!isRecord(parsed)) return {};
  const map: Record<string, string> = {};
  for (const [id, hash] of Object.entries(parsed)) {
    if (typeof hash === "string" && hash) map[id] = hash;
  }
  return map;
}

/** "HH:MM" → minutes since midnight; "24:00" is the only valid 24 hour. */
function toMinutes(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

function isTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** One day's windows: well-formed, start < end, sorted, and not overlapping. Null = invalid. */
function parseWindows(value: unknown): TimeWindow[] | null {
  if (!Array.isArray(value) || value.length > MAX_WINDOWS_PER_DAY) return null;
  const windows: Array<TimeWindow & { from: number; to: number }> = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.start !== "string" || typeof item.end !== "string") return null;
    const from = toMinutes(item.start);
    const to = toMinutes(item.end);
    if (from === null || to === null || from >= MINUTES_PER_DAY || to <= from) return null;
    windows.push({ start: item.start, end: item.end, from, to });
  }
  windows.sort((a, b) => a.from - b.from);
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].from < windows[i - 1].to) return null;
  }
  return windows.map(({ start, end }) => ({ start, end }));
}

/**
 * Validates a `WeeklySchedule` (a real IANA zone, all seven days present, each window "HH:MM" with
 * start < end ≤ "24:00", no overlaps). Returns a normalized copy, or null when anything is off.
 * Exported so the admin route can reject a bad schedule with the same rules `saveSchedule` uses.
 */
export function parseWeeklySchedule(value: unknown): WeeklySchedule | null {
  if (!isRecord(value) || typeof value.timeZone !== "string" || !isTimeZone(value.timeZone)) return null;
  const days = value.days;
  if (!isRecord(days)) return null;
  const result: Record<Weekday, TimeWindow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const day of WEEKDAYS) {
    const windows = parseWindows(days[String(day)]);
    if (!windows) return null;
    result[day] = windows;
  }
  return { timeZone: value.timeZone, days: result };
}

function parseStoredSchedule(value: string | undefined): WeeklySchedule {
  if (value === undefined) return defaultSchedule();
  const schedule = parseWeeklySchedule(parseJson(value));
  if (schedule) return schedule;
  logger().warn("Stored schedule is invalid; using the default hours");
  return defaultSchedule();
}

// ─── Read ──────────────────────────────────────────────────────────────────────────────────

function failedClosed(): AiSetterSettings {
  return { paused: true, failedClosed: true, busyUntil: null, schedule: defaultSchedule(), approvedTemplates: {} };
}

async function readSettings(): Promise<AiSetterSettings> {
  try {
    const rows = await db
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(inArray(appSettings.key, Object.values(KEYS)));
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      paused: parsePaused(byKey.get(KEYS.paused)),
      busyUntil: parseBusyUntil(byKey.get(KEYS.busyUntil)),
      schedule: parseStoredSchedule(byKey.get(KEYS.schedule)),
      approvedTemplates: parseTemplates(byKey.get(KEYS.templates)),
      failedClosed: false,
    };
  } catch (error) {
    logger().error("Settings read failed; the setter is treated as paused", { error: errorSummary(error) });
    return failedClosed();
  }
}

/** `SettingsPort` for the turn engine and the send job: one uncached query; any error → paused. */
export const aiSetterSettings: SettingsPort = { read: readSettings };

// ─── Writers (admin only; they throw, so the panel can show a failed save) ──────────────────

async function writeSetting(key: string, value: string): Promise<void> {
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } });
}

/** The panel's master pause. Env (`AI_SETTER_ENABLED`) can still switch the whole setter off. */
export async function setPaused(paused: boolean): Promise<void> {
  await writeSetting(KEYS.paused, paused ? "true" : "false");
}

/** "Estoy ocupado hasta": no call-now offers until then. Null clears it. */
export async function setBusyUntil(until: Date | null): Promise<void> {
  if (until === null) {
    await db.delete(appSettings).where(eq(appSettings.key, KEYS.busyUntil));
    return;
  }
  if (Number.isNaN(until.getTime())) throw new Error("setBusyUntil: invalid date");
  await writeSetting(KEYS.busyUntil, until.toISOString());
}

/** Saves Isaac's weekly hours. Throws on an invalid schedule, so one is never stored. */
export async function saveSchedule(s: WeeklySchedule): Promise<void> {
  const schedule = parseWeeklySchedule(s);
  if (!schedule) throw new Error("saveSchedule: invalid schedule");
  await writeSetting(KEYS.schedule, JSON.stringify(schedule));
}

function requireToken(value: string, maxChars: number, label: string): string {
  const token = value.trim();
  if (!token || token.length > maxChars) throw new Error(`Invalid ${label}`);
  return token;
}

/** Writes `next` only if the stored map is still `current`: a compare-and-swap in one statement. */
async function swapTemplates(current: string | undefined, next: string): Promise<boolean> {
  const now = new Date();
  const rows =
    current === undefined
      ? await db
          .insert(appSettings)
          .values({ key: KEYS.templates, value: next, updatedAt: now })
          .onConflictDoNothing({ target: appSettings.key })
          .returning({ key: appSettings.key })
      : await db
          .update(appSettings)
          .set({ value: next, updatedAt: now })
          .where(and(eq(appSettings.key, KEYS.templates), eq(appSettings.value, current)))
          .returning({ key: appSettings.key });
  return rows.length > 0;
}

/**
 * Read-modify-write of the approved-templates map. Guarded by compare-and-swap, so an approve and
 * a revoke tapped at the same moment can never resurrect a revoked template.
 */
async function updateTemplates(change: (map: Record<string, string>) => Record<string, string>): Promise<void> {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, KEYS.templates))
      .limit(1);
    const current = rows[0]?.value;
    const next = JSON.stringify(change(parseTemplates(current)));
    if (next === current) return;
    if (await swapTemplates(current, next)) return;
  }
  throw new Error("Approved templates changed at the same time; try again");
}

/** Approves this exact version (content hash) of a template; a changed text needs a new approval. */
export async function approveTemplate(id: string, hash: string): Promise<void> {
  const templateId = requireToken(id, TEMPLATE_ID_MAX_CHARS, "template id");
  const contentHash = requireToken(hash, TEMPLATE_HASH_MAX_CHARS, "template hash");
  await updateTemplates((map) => ({ ...map, [templateId]: contentHash }));
}

/** Revokes a template: from now on it goes to the inbox like free text. */
export async function revokeTemplate(id: string): Promise<void> {
  const templateId = requireToken(id, TEMPLATE_ID_MAX_CHARS, "template id");
  await updateTemplates((map) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== templateId)));
}
