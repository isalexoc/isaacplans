/**
 * What a save writes: values for the keys it sent, and no other key.
 *
 * Every save merges into the stored answers (`data || patch`, see `patchIntakeData`), so only the
 * keys in the body change. Before that, those keys go through the rule every save has always had
 * (`lib/intake-shared/masking.ts`): a mask, or an empty value, never replaces a sensitive value
 * already on file. The client's browser is only ever sent masks, and one coming back must not wipe
 * the real number. That covers the top-level secrets (SSN, ID number, bank, card) and the sensitive
 * sub-fields of repeater rows (each person's SSN).
 *
 * Two rules on top of that, because this is the one door every shared-intake save goes through:
 *  - In a repeater, a mask goes back to the number it was made from (its last four digits), not
 *    just to whatever sits at the same position: removing a person moves everyone below up a row,
 *    and a match by position alone handed the next person the removed one's number.
 *  - A sensitive value is stored only as a real string. A mask that matches nothing on file, a
 *    non-string, or a string dressed as our encryption envelope (which `encryptString` passes
 *    through untouched, and which the next decrypt of the session would choke on) counts as empty.
 *
 * Pure, with no "server-only": the offline test (`pnpm test:intake-autosave`) imports it.
 */

import { isEncrypted } from "@/lib/crypto/field-encryption";
import { isMaskedValue, maskValue, mergePreservedSensitive } from "@/lib/intake-shared/masking";
import { stableJson } from "./diff";
import { sensitiveRowKeys, sensitiveScalarKeys } from "./fields";
import type { IntakeData, IntakeSection, RepeaterRow } from "./types";

type Row = Record<string, unknown>;

/** A sensitive value as a save may write it: a plain string. Anything else counts as empty. */
function cleanSensitive(value: unknown): string {
  return typeof value === "string" && !isEncrypted(value) ? value : "";
}

/** The stored value of `key` in a row, when there is one. */
function onFile(row: Row | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * One repeater's rows, against the stored ones. For each sensitive sub-field:
 *  - a typed value is written as typed;
 *  - a mask takes the stored number it was made from: the same row's when it matches, else the
 *    first other stored row's that gives the same mask and no earlier row took. With no match it
 *    keeps the same row's number (a mask older than the number now on file), or with nothing
 *    there, is stored empty;
 *  - an empty or missing value keeps the same row's stored number (the form clears a mask when it
 *    is focused), unless an earlier row already took that number because the rows moved up.
 *
 * Known limit: with no mask to go by, rows still match by position. Remove a person whose next
 * neighbour has no number on file, and that neighbour inherits the removed person's.
 */
function planRows(rows: RepeaterRow[], storedRows: Row[], subKeys: string[]): RepeaterRow[] {
  const taken = new Map(subKeys.map((key) => [key, new Set<number>()]));
  return rows.map((r, i) => {
    const row: Row = { ...((r ?? {}) as Row) };
    for (const key of subKeys) {
      const used = taken.get(key) as Set<number>;
      const present = row[key] !== undefined;
      const next = present ? cleanSensitive(row[key]) : "";
      if (next !== "" && !isMaskedValue(next)) {
        row[key] = next;
        continue;
      }
      const here = used.has(i) ? null : onFile(storedRows[i], key);
      let from = -1;
      if (isMaskedValue(next)) {
        if (here !== null && maskValue(here) === next) from = i;
        if (from < 0) {
          from = storedRows.findIndex((stored, j) => {
            const value = j === i || used.has(j) ? null : onFile(stored, key);
            return value !== null && maskValue(value) === next;
          });
        }
      }
      if (from < 0 && here !== null) from = i;
      if (from >= 0) {
        row[key] = onFile(storedRows[from], key);
        used.add(from);
      } else if (present) {
        row[key] = "";
      }
    }
    return row as RepeaterRow;
  });
}

/**
 * `incoming` is the sanitized body (`sanitizeIntakeData`); `stored` the session's DECRYPTED answers.
 * The result has exactly the keys of `incoming`, ready to encrypt and merge.
 */
export function planIntakePatch(
  sections: IntakeSection[],
  incoming: IntakeData,
  stored: IntakeData
): IntakeData {
  const scalarKeys = sensitiveScalarKeys(sections);
  const body: IntakeData = { ...incoming };
  for (const key of scalarKeys) if (key in body) body[key] = cleanSensitive(body[key]);

  // The shared merge also fills in stored secrets the body didn't mention, which a whole-form save
  // needed; a patch must not write those keys, so only the body's own keys are kept.
  const merged = mergePreservedSensitive(body, stored, scalarKeys);
  const patch: IntakeData = {};
  for (const key of Object.keys(incoming)) {
    // A mask with nothing on file to stand for is not a number.
    patch[key] = scalarKeys.includes(key) && isMaskedValue(merged[key]) ? "" : merged[key];
  }

  for (const [repeaterKey, subKeys] of sensitiveRowKeys(sections)) {
    const rows = patch[repeaterKey];
    if (!Array.isArray(rows)) continue;
    const storedRows = Array.isArray(stored[repeaterKey]) ? (stored[repeaterKey] as Row[]) : [];
    patch[repeaterKey] = planRows(rows as RepeaterRow[], storedRows, subKeys);
  }
  return patch;
}

/**
 * The keys of a planned patch whose value differs from what is stored (`stored` DECRYPTED). A save
 * that changes nothing, such as masks the planner turned back into the numbers on file, or the
 * untouched answers of a legacy whole-form save, then writes nothing and pushes nothing to the CRM.
 */
export function withoutUnchanged(patch: IntakeData, stored: IntakeData): IntakeData {
  const changed: IntakeData = {};
  for (const [key, value] of Object.entries(patch)) {
    if (stableJson(value) !== stableJson(stored[key])) changed[key] = value;
  }
  return changed;
}
