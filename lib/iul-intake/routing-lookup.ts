/**
 * Look up a bank's ACH routing number from its name and the state the account was opened in.
 *
 * Isaac's flow on a call: ask which bank and where the account was opened, look the number up,
 * read it back, and have the client confirm it out loud. It sounds like someone who knows what
 * they are doing, and it catches the transposed digit that a client reading from memory produces.
 *
 * ─── Three facts that shape this, all verified rather than assumed ───
 *
 * 1. **State-specific numbers are real.** Bank of America registers roughly 44 different routing
 *    numbers with the Federal Reserve — the directory literally contains "BANK OF AMERICA, N.A.,
 *    NY", "…, TX", "…, CA" — a legacy of the NationsBank/FleetBoston/LaSalle mergers. So a lookup
 *    without a state is close to useless for the big banks.
 *
 * 2. **ACH is not wire, and only ACH matters here.** Bank of America uses 026009593 for wires
 *    nationwide but a state-specific number for ACH, direct deposit and checks. A premium draft is
 *    ACH. Returning a wire number would fail every draft, so results are filtered to
 *    `ach_supported` and anything else is discarded.
 *
 * 3. **It depends on where the account was OPENED, not where the client lives now.** Somebody who
 *    moved from California to Texas keeps the California number. The UI label has to say so.
 *
 * ─── Why this provider ───
 *
 * The Federal Reserve's own directory is the authoritative source and is free, but since December
 * 2018 the bulk file requires a FedLine account — financial institutions only — which is why
 * moov-io/fed still ships 2018 data and says the Fed "no longer releases this data publicly".
 * routingnumbers.info, the API most guides recommend, is now a parked domain for sale. API Ninjas'
 * `/v1/routingnumbersearch` is the one verified service that searches by bank name and state
 * rather than only by routing number, and reports `ach_supported`.
 *
 * Server-only: `API_NINJAS_KEY` must never reach the browser, which is why callers go through
 * `/api/iul-intake/routing-lookup` instead of calling this from a component.
 */

import "server-only";
import { isValidRouting } from "./validation";

export type RoutingMatch = {
  routingNumber: string;
  bankName: string;
  city: string;
  state: string;
};

const ENDPOINT = "https://api.api-ninjas.com/v1/routingnumbersearch";

/** Enough for a picker; more than this and the agent should narrow by city instead of scrolling. */
const MAX_RESULTS = 8;

export function isRoutingLookupConfigured(): boolean {
  return Boolean(process.env.API_NINJAS_KEY?.trim());
}

type RawResult = {
  routing_number?: unknown;
  bank_name?: unknown;
  city?: unknown;
  state?: unknown;
  ach_supported?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Set once the provider tells us this key is not entitled to the search endpoint.
 *
 * Distinguishing "not entitled" from "no matches" matters for what the agent sees: a search box
 * that is present but silently returns nothing every single time looks broken, whereas a hidden
 * panel is simply a feature that is not switched on. `/v1/routingnumbersearch` is premium-only,
 * and a free key gets a 400 rather than an empty list.
 */
let providerUnavailable = false;

export type RoutingSearchResult =
  /** The lookup ran. An empty array means the provider genuinely knows of no match. */
  | { available: true; results: RoutingMatch[] }
  /** The lookup could not run at all — no key, or the key is not entitled. */
  | { available: false; results: [] };

/**
 * Search by bank name plus the state the account was opened in. Optional city narrows the big
 * banks, which can register several numbers within one state.
 *
 * Never throws. A rate limit or a transient outage reports `available: true` with no results —
 * the agent types the number by hand, which is what they would have done anyway. Only a missing
 * or unentitled key reports `available: false`, which hides the panel entirely.
 */
export async function searchRoutingNumbers(params: {
  bankName: string;
  state: string;
  city?: string;
}): Promise<RoutingSearchResult> {
  const key = process.env.API_NINJAS_KEY?.trim();
  if (!key || providerUnavailable) return { available: false, results: [] };

  const bankName = params.bankName.trim();
  const state = params.state.trim().toUpperCase();
  const city = params.city?.trim() ?? "";
  if (!bankName || state.length !== 2) return { available: true, results: [] };

  const query = new URLSearchParams({ bank_name: bankName, state });
  if (city) query.set("city", city);

  try {
    const res = await fetch(`${ENDPOINT}?${query}`, {
      headers: { "X-Api-Key": key },
      // The agent is on a call; a lookup that hangs is worse than one that finds nothing.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // "This endpoint is reserved for premium subscribers only." — a plan problem, not a data
      // problem. Latch it so we stop asking and the panel stops advertising a search that cannot
      // run, until the process restarts with an upgraded key.
      if (res.status === 400 && /premium/i.test(body)) {
        providerUnavailable = true;
        console.warn("[routing-lookup] API_NINJAS_KEY is not on a premium plan — search disabled.");
        return { available: false, results: [] };
      }
      console.warn("[routing-lookup] provider returned", res.status);
      return { available: true, results: [] };
    }
    const json = (await res.json()) as unknown;
    const rows: RawResult[] = Array.isArray(json) ? (json as RawResult[]) : [];

    const seen = new Set<string>();
    const out: RoutingMatch[] = [];
    for (const row of rows) {
      // ACH only. A wire number here would fail every premium draft — see the header note.
      if (row.ach_supported !== true) continue;

      const routingNumber = str(row.routing_number).replace(/\D/g, "");
      // Checksum locally too: a bad number must never reach the picker, whatever the source says.
      if (!isValidRouting(routingNumber)) continue;
      if (seen.has(routingNumber)) continue;
      seen.add(routingNumber);

      out.push({
        routingNumber,
        bankName: str(row.bank_name) || bankName,
        city: str(row.city),
        state: str(row.state) || state,
      });
      if (out.length >= MAX_RESULTS) break;
    }
    return { available: true, results: out };
  } catch (error) {
    console.warn("[routing-lookup] failed:", error instanceof Error ? error.message : error);
    return { available: true, results: [] };
  }
}
