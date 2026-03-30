/**
 * Manhattan Life direct enrollment (agent link).
 *
 * - `manhattanDirectQuoteUrl()` — “all plans” base URL (no product suffix).
 * - `manhattanDirectQuoteUrl(productCode)` — appends `/${productCode}` (e.g. `ACC`, `24H`).
 *
 * Overrides:
 * - `NEXT_PUBLIC_MANHATTAN_DIRECT_QUOTE_URL` — full base URL (must not include a trailing
 *   product segment). When set, used as the base for both `MANHATTAN_DIRECT_QUOTE_URL` and
 *   `manhattanDirectQuoteUrl`.
 */

const DEFAULT_BASE = "https://direct.manhattanlife.com/#/link/6981/isaacplans";

function resolvedBase(): string {
  return process.env.NEXT_PUBLIC_MANHATTAN_DIRECT_QUOTE_URL ?? DEFAULT_BASE;
}

/** Build Manhattan Life direct link. Omit `productCode` for the all-plans entry point. */
export function manhattanDirectQuoteUrl(productCode?: string): string {
  const base = resolvedBase().replace(/\/+$/, "");
  if (!productCode) return base;
  return `${base}/${productCode}`;
}

export const MANHATTAN_DIRECT_QUOTE_URL = manhattanDirectQuoteUrl();
