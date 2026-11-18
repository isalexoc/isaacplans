/**
 * Pure helpers for the weekly-hours editor. The server re-validates everything
 * (validateSchedule in lib/ai-setter/availability.ts); these only give instant feedback.
 */

import type { TimeWindow, Weekday, WeeklySchedule } from "@/lib/ai-setter/types";

/** Monday first, the way the week reads in Spanish. */
export const WEEKDAY_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

/** Same cap as validateSchedule. */
export const MAX_WINDOWS_PER_DAY = 6;

const DAY_MINUTES = 24 * 60;
const MIN_GAP_MINUTES = 30;
const SUGGESTED_MINUTES = 120;

type Span = { start: number; end: number };

/** "HH:MM" → minutes after midnight; "24:00" is 1440. Null when malformed. */
export function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** `<input type="time">` cannot show 24:00, so midnight as an END is shown as 00:00… */
export function endToInput(end: string): string {
  return end === "24:00" ? "00:00" : end;
}

/** …and 00:00 typed as an END means midnight (24:00). */
export function endFromInput(value: string): string {
  return value === "00:00" ? "24:00" : value;
}

function spanOf(window: TimeWindow): Span | null {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (start === null || end === null || start >= DAY_MINUTES || end <= start) return null;
  return { start, end };
}

/** One message per window (null = fine): malformed, end before start, or overlapping another. */
export function windowErrors(windows: TimeWindow[]): Array<string | null> {
  const spans = windows.map(spanOf);
  return windows.map((window, index) => {
    const span = spans[index];
    if (!span) {
      const start = toMinutes(window.start);
      const end = toMinutes(window.end);
      return start === null || end === null || start >= DAY_MINUTES ? "Hora inválida" : "El fin debe ser después del inicio";
    }
    const overlaps = spans.some((other, j) => j !== index && other !== null && span.start < other.end && other.start < span.end);
    return overlaps ? "Se cruza con otro horario de este día" : null;
  });
}

export function isScheduleValid(schedule: WeeklySchedule): boolean {
  return WEEKDAY_ORDER.every((day) => {
    const windows = schedule.days[day] ?? [];
    return windows.length <= MAX_WINDOWS_PER_DAY && windowErrors(windows).every((error) => error === null);
  });
}

/** A free 2-hour window to add: from 9:00, or right after an existing window. Null = day is full. */
export function suggestWindow(windows: TimeWindow[]): TimeWindow | null {
  const spans = windows.map(spanOf).filter((span): span is Span => span !== null);
  const candidates = [9 * 60, ...spans.map((span) => span.end).sort((a, b) => a - b), 0];
  for (const start of candidates) {
    if (start > DAY_MINUTES - MIN_GAP_MINUTES) continue;
    if (spans.some((span) => start < span.end && span.start < start + MIN_GAP_MINUTES)) continue;
    const nextStart = Math.min(DAY_MINUTES, ...spans.filter((span) => span.start > start).map((span) => span.start));
    return { start: fromMinutes(start), end: fromMinutes(Math.min(start + SUGGESTED_MINUTES, nextStart)) };
  }
  return null;
}

function mapDays(windowsFor: (day: Weekday) => TimeWindow[]): Record<Weekday, TimeWindow[]> {
  return { 0: windowsFor(0), 1: windowsFor(1), 2: windowsFor(2), 3: windowsFor(3), 4: windowsFor(4), 5: windowsFor(5), 6: windowsFor(6) };
}

export function cloneSchedule(schedule: WeeklySchedule): WeeklySchedule {
  return { timeZone: schedule.timeZone, days: mapDays((day) => (schedule.days[day] ?? []).map((w) => ({ ...w }))) };
}

/** A copy with one day's windows replaced. */
export function withDay(schedule: WeeklySchedule, day: Weekday, windows: TimeWindow[]): WeeklySchedule {
  return { timeZone: schedule.timeZone, days: mapDays((d) => (d === day ? windows : schedule.days[d] ?? [])) };
}

/** Windows in time order, as they are saved. */
export function sortedSchedule(schedule: WeeklySchedule): WeeklySchedule {
  const order = (w: TimeWindow) => toMinutes(w.start) ?? DAY_MINUTES;
  return { timeZone: schedule.timeZone, days: mapDays((day) => [...(schedule.days[day] ?? [])].sort((a, b) => order(a) - order(b))) };
}

/** Stable value key: equal schedules give equal keys. */
export function scheduleKey(schedule: WeeklySchedule): string {
  return JSON.stringify(sortedSchedule(schedule));
}
