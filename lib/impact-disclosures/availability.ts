/**
 * Where Impact Health Sharing is available, apart from the notices' texts (lib/impact-disclosures/
 * notices.ts, ~55 KB): the shared intake form (Isaac's lines included) and the server's rules ask
 * this, and only an agent's application loads the notices themselves. Pure (one import, the static
 * state list).
 */

import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";

/** "Not available in RI and WA." (Impact's footer, https://www.impacthealthsharing.com/disclosures). */
export const IMPACT_UNAVAILABLE_STATES: readonly string[] = ["RI", "WA"];

const STATE_CODES = new Set(US_STATE_OPTIONS.map((s) => s.code));
const STATE_BY_NAME = new Map(US_STATE_OPTIONS.map((s) => [s.name.toLowerCase(), s.code]));

/**
 * A home state as its two-letter code: "va", " VA ", "R.I." and "Rhode Island" all count (the form
 * stores the code, but the server never trusts what a request sends). Anything else is null.
 */
export function normalizeStateCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!compact) return null;
  const upper = compact.toUpperCase();
  if (upper.length === 2) return STATE_CODES.has(upper) ? upper : null;
  return STATE_BY_NAME.get(compact.toLowerCase()) ?? null;
}

/** Impact doesn't serve this home state (Rhode Island, Washington). */
export function impactUnavailableIn(state: unknown): boolean {
  const code = normalizeStateCode(state);
  return code !== null && IMPACT_UNAVAILABLE_STATES.includes(code);
}

/** "WA" → "Washington" (the state's own name in either language). */
export function impactStateName(state: unknown): string {
  const code = normalizeStateCode(state);
  return US_STATE_OPTIONS.find((s) => s.code === code)?.name ?? (code ?? "");
}
