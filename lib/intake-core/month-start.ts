/**
 * Calendar helpers for `monthStart` fields: coverage that can only begin on the 1st of a month.
 *
 * "Today" is read in US Eastern time on both the browser and the server. Using the client's own
 * clock would let the form offer a date the server then rejects: a client in Los Angeles at 10 PM
 * on the 28th is already on the 29th in Virginia. One calendar on both sides avoids that.
 *
 * Dates are plain `{ y, m, d }` triples (m is 1–12) and never `Date` objects, so no time zone can
 * shift a day. Client-safe: pure functions, no DOM.
 */

export const BUSINESS_TIME_ZONE = "America/New_York";

export type Ymd = { y: number; m: number; d: number };
export type Ym = { y: number; m: number };

/** Today's date in the business time zone. */
export function businessToday(now: Date = new Date()): Ymd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** `{ y, m }` moved by `n` months (negative goes back). */
export function addMonths(y: number, m: number, n: number): Ym {
  const index = y * 12 + (m - 1) + n;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

export function toIso({ y, m, d }: Ymd): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseIso(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Negative when `a` is before `b`, 0 when equal. */
export function compareYmd(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

/** Earliest 1st allowed today: next month's, or the one after once today is past `cutoffDay`. */
export function earliestMonthStart(today: Ymd, cutoffDay?: number): Ymd {
  const skip = cutoffDay && today.d > cutoffDay ? 2 : 1;
  return { ...addMonths(today.y, today.m, skip), d: 1 };
}

/** The ISO dates a `monthStart` field offers, earliest first. */
export function monthStartOptions(today: Ymd, count = 6, cutoffDay?: number): string[] {
  const first = earliestMonthStart(today, cutoffDay);
  return Array.from({ length: count }, (_, i) => toIso({ ...addMonths(first.y, first.m, i), d: 1 }));
}

/** A real 1st of a month, no earlier than today allows. No upper limit. */
export function isValidMonthStart(value: string, cutoffDay?: number, today: Ymd = businessToday()): boolean {
  const date = parseIso(value);
  if (!date || date.d !== 1 || date.m < 1 || date.m > 12) return false;
  return compareYmd(date, earliestMonthStart(today, cutoffDay)) >= 0;
}

function format(date: Ymd, locale: "en" | "es", options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(date.y, date.m - 1, date.d))
  );
}

/** "December 1, 2026" / "1 de diciembre de 2026". */
export function formatLongDate(date: Ymd, locale: "en" | "es"): string {
  return format(date, locale, { month: "long", day: "numeric", year: "numeric" });
}

/** "November 28" / "28 de noviembre". */
export function formatMonthDay(date: Ymd, locale: "en" | "es"): string {
  return format(date, locale, { month: "long", day: "numeric" });
}

/** "November" / "noviembre". */
export function formatMonthName(date: Ym, locale: "en" | "es"): string {
  return format({ ...date, d: 1 }, locale, { month: "long" });
}

/** "December 2026" / "diciembre de 2026". */
export function formatMonthYear(date: Ym, locale: "en" | "es"): string {
  return format({ ...date, d: 1 }, locale, { month: "long", year: "numeric" });
}

/** A stored ISO date as a long date, or the raw value when it isn't one. */
export function formatIsoLong(value: string, locale: "en" | "es"): string {
  const date = parseIso(value);
  return date ? formatLongDate(date, locale) : value;
}
