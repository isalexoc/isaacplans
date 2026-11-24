import "server-only";

import type { LeadGuardSurface } from "./constants";
import { leadGuardKeysAvailable } from "./keys";

/**
 * LEAD_GUARD_MODE:
 *   enforce (default) — block / hold / allow as decided.
 *   shadow            — decide and log, but let every lead through as before.
 *   off               — no checks at all (the pre-guard behavior).
 * LEAD_GUARD_SHADOW_SURFACES — comma list of surfaces kept in shadow while the rest enforce,
 *   e.g. "final_expense_funnel,iul_funnel". Never put contact / agent_crm there: that lets the
 *   live bot through.
 * LEAD_GUARD_DAILY_CAP — allowed leads per surface per 24 h (distinct phones) before the next
 *   ones are held; default 25 (the busiest real day so far was 8 across all funnels).
 *
 * Without a key (no LEAD_GUARD_SECRET and no INTAKE_ENCRYPTION_KEY) the guard is off: holding
 * every lead because a variable is missing would hurt real clients far more than the bot does.
 */

export type LeadGuardMode = "enforce" | "shadow" | "off";

/** The bot's target, with essentially no real volume (1 real lead in the CRM's history). */
export const STRICT_SURFACES: ReadonlySet<LeadGuardSurface> = new Set<LeadGuardSurface>(["contact", "agent_crm"]);

/** Strict forms: after this many allowed people, the next ones are held until the window cools. */
export const STRICT_RATE = { perHour: 3, perDay: 6 } as const;

/** Allowed people per surface per 24 h on every other form, then hold. */
export function dailyCap(): number {
  const n = Number(process.env.LEAD_GUARD_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25;
}

/** Reviewed holds (released / discarded) are deleted this long after review. */
export const HOLD_TTL_DAYS = 30;
export const EVENT_TTL_DAYS = 180;

let warnedNoKey = false;

export function getLeadGuardMode(): LeadGuardMode {
  const raw = process.env.LEAD_GUARD_MODE?.trim().toLowerCase();
  const mode: LeadGuardMode = raw === "off" ? "off" : raw === "shadow" ? "shadow" : "enforce";
  if (mode === "off") return "off";
  if (!leadGuardKeysAvailable()) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.error("[lead-guard] No LEAD_GUARD_SECRET or INTAKE_ENCRYPTION_KEY: the guard is OFF.");
    }
    return "off";
  }
  return mode;
}

function isShadowSurface(surface: LeadGuardSurface): boolean {
  const list = process.env.LEAD_GUARD_SHADOW_SURFACES;
  if (!list) return false;
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(surface);
}

/** The effective mode for one surface. */
export function surfaceMode(surface: LeadGuardSurface): LeadGuardMode {
  const mode = getLeadGuardMode();
  if (mode === "enforce" && isShadowSurface(surface)) return "shadow";
  return mode;
}
