/**
 * Which answers a tab changed: the top-level keys whose JSON differs between the answers last known
 * to be on the server (`base`) and what the form holds now (`data`).
 *
 * Autosave sends exactly these keys, so a tab never writes back an answer it didn't change, and a
 * stale tab can't erase what another tab typed. A repeater is one key: the whole list goes.
 *
 * There is no "unset". A key missing from `data` (or `undefined` there) is not reported: the form
 * never deletes a key (a hidden field only stops rendering), and the server only merges.
 *
 * Values compare as JSON with object keys in any order. jsonb hands objects back with its own key
 * order, so a repeater row read from the server must not count as edited for that alone.
 *
 * Pure: shared by the browser hook, the server routes and the offline test.
 */

import type { IntakeData } from "./types";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = sortKeys(record[key]);
    return sorted;
  }
  return value;
}

/** JSON text with object keys sorted, so two equal values always give the same string. */
export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? "undefined";
}

/** The keys of `data` whose value differs from `base`, with their values from `data`. */
export function diffIntakeData(base: IntakeData, data: IntakeData): IntakeData {
  const patch: IntakeData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (stableJson(value) !== stableJson(base[key])) patch[key] = value;
  }
  return patch;
}
