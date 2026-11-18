/**
 * States Isaac is licensed in (`LicensePort`), read from Sanity: the same active `state` documents
 * the site's About page and map show.
 *
 * Plain `client.fetch` with `LICENSED_STATES_LIST_QUERY`, NOT the React `cache()` helpers in
 * lib/licensed-states.ts: this runs in QStash jobs, outside a React request. The list is memoized
 * in module scope for 10 minutes, so a burst of turns costs one Sanity request per warm instance.
 *
 * Never throws, and bounded by a timeout. A failed or empty read returns null ("unknown": the
 * caller skips the license gate and logs it), unless a list fetched in the last 24 hours is at
 * hand, which is served instead: an empty list would wrongly close every lead as out of state.
 */

import "server-only";

import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import { LICENSED_STATES_LIST_QUERY } from "@/lib/licensed-states";
import { client } from "@/sanity/lib/client";

import { getAiSetterConfig } from "./config";
import { createAiSetterLogger } from "./log";
import type { LicensePort } from "./types";

const MEMO_TTL_MS = 10 * 60_000;
const STALE_IF_ERROR_MS = 24 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

/** "FLORIDA" → "FL", for state documents saved without the optional `code`. */
const CODE_BY_NAME = new Map(US_STATE_OPTIONS.map((s) => [s.name.toUpperCase(), s.code]));

type StateRow = { name?: unknown; code?: unknown };

let memo: { codes: string[]; fetchedAt: number } | null = null;

function logger() {
  return createAiSetterLogger(getAiSetterConfig().debug);
}

/** Error class and a short message only: never a payload. */
function errorSummary(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : "unknown error";
}

/** " fl " → "FL"; no code but name "Florida" → "FL". Null when neither names a state. */
function toStateCode(row: StateRow): string | null {
  const code = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
  if (/^[A-Z]{2}$/.test(code)) return code;
  const name = typeof row.name === "string" ? row.name.trim().toUpperCase() : "";
  return CODE_BY_NAME.get(name) ?? null;
}

async function fetchCodes(): Promise<string[]> {
  const rows = await client.fetch<StateRow[] | null>(
    LICENSED_STATES_LIST_QUERY,
    {},
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );
  const codes = new Set<string>();
  for (const row of rows ?? []) {
    const code = toStateCode(row);
    if (code) codes.add(code);
  }
  return Array.from(codes).sort();
}

function staleOrNull(now: number): string[] | null {
  return memo && now - memo.fetchedAt < STALE_IF_ERROR_MS ? [...memo.codes] : null;
}

async function licensedStateCodes(): Promise<string[] | null> {
  const now = Date.now();
  if (memo && now - memo.fetchedAt < MEMO_TTL_MS) return [...memo.codes];
  let codes: string[];
  try {
    codes = await fetchCodes();
  } catch (error) {
    const stale = staleOrNull(now);
    logger().warn("Licensed states read failed", { error: errorSummary(error), servedStale: stale !== null });
    return stale;
  }
  if (codes.length === 0) {
    const stale = staleOrNull(now);
    logger().warn("Sanity returned no licensed states", { servedStale: stale !== null });
    return stale;
  }
  memo = { codes, fetchedAt: now };
  return [...codes];
}

/** `LicensePort` over Sanity's active `state` documents: uppercase 2-letter codes, or null = unknown. */
export const aiSetterLicense: LicensePort = { licensedStateCodes };
