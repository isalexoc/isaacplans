/**
 * Spanish date / money formatting for the AI Setter panel. Times show in the viewer's own zone
 * (Isaac's device), which is the zone his schedule is written in.
 */

const CLOCK = new Intl.DateTimeFormat("es-US", { hour: "numeric", minute: "2-digit" });
const DATE_TIME = new Intl.DateTimeFormat("es-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const RELATIVE = new Intl.RelativeTimeFormat("es", { numeric: "auto", style: "short" });

const MINUTE_MS = 60_000;

function toMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** "3:45 p. m." */
export function formatClock(iso: string | null): string {
  const ms = toMs(iso);
  return ms === null ? "—" : CLOCK.format(ms);
}

/** "lun, 17 nov, 3:45 p. m." */
export function formatDateTime(iso: string | null): string {
  const ms = toMs(iso);
  return ms === null ? "—" : DATE_TIME.format(ms);
}

/** "hace 5 min", "dentro de 2 h", "ayer". */
export function formatRelative(iso: string | null, nowMs: number): string {
  const ms = toMs(iso);
  if (ms === null) return "—";
  const minutes = Math.round((ms - nowMs) / MINUTE_MS);
  if (Math.abs(minutes) < 1) return "ahora";
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, "hour");
  return RELATIVE.format(Math.round(hours / 24), "day");
}

/** Time left until `iso` ("1 h 20 min", "15 min"); null once it has passed. */
export function formatTimeLeft(iso: string | null, nowMs: number): string | null {
  const ms = toMs(iso);
  if (ms === null || ms <= nowMs) return null;
  const minutes = Math.max(1, Math.round((ms - nowMs) / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** True when `iso` is a real time in the past. */
export function isPast(iso: string | null, nowMs: number): boolean {
  const ms = toMs(iso);
  return ms !== null && ms <= nowMs;
}

/** True when `iso` is a real time in the future. */
export function isFuture(iso: string | null, nowMs: number): boolean {
  const ms = toMs(iso);
  return ms !== null && ms > nowMs;
}

/** Micro-USD → "US$0.42" (three decimals under ten cents, so a few turns still show). */
export function formatUsd(micros: number): string {
  const usd = micros / 1_000_000;
  return `US$${usd.toFixed(usd > 0 && usd < 0.1 ? 3 : 2)}`;
}
