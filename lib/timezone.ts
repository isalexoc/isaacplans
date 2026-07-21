/** Agent's local timezone for "same calendar day" logic (dedup keys, prompt reference dates). */
export function getAgentLocalTimezone(): string {
  return process.env.AGENT_LOCAL_TIMEZONE?.trim() || "America/New_York";
}

/** "YYYY-MM-DD" for `date` as observed in `timeZone` — the local-calendar-day bucket key. */
export function localCalendarDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Weekday + local date/time string for prompt reference lines, e.g. "Saturday, 2026-07-18 2:14 PM America/New_York". */
export function localReferenceDateLine(date: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted} (${timeZone})`;
}
