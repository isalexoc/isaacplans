/**
 * Erasing an application's sensitive values (SSN/ITIN, ID and bank numbers, and the sensitive
 * sub-fields of repeater rows such as each added person's SSN), planned as pure functions: what to
 * write, never how. The key lists come from the config, like encryption and masking, so a
 * dependent's number is covered exactly like the applicant's.
 *
 *  - Completion's purge-after-sync (`INTAKE_PURGE_AFTER_SYNC`, Isaac's flow) blanks values through
 *    lib/intake-core/sensitive.ts `purgeIntakeSensitiveData`, which is `blankSensitiveValues`.
 *  - An agent's "Entered in Impact" (app/api/intake/[lob]/[token]/purge), the 30-day job
 *    (app/api/queue/agent-purge) and its daily backstop (lib/tenancy/agent-jobs.ts
 *    `reconcileAgentPurges`) write `planSensitivePurge`'s patch with `patchIntakeData`: one
 *    statement.
 *
 * Both work on the data as stored: an encrypted value is just a non-empty string here, so nothing
 * is decrypted to erase it. Pure (no "server-only"), for the offline tests.
 */

import { stableJson } from "./diff";
import { sensitiveRowKeys, sensitiveScalarKeys } from "./fields";
import type { IntakeData, IntakeSection, RepeaterRow } from "./types";

/** Sensitive scalars become null and sensitive row sub-fields "" (a new object). */
export function blankSensitiveValues(sections: IntakeSection[], data: IntakeData): IntakeData {
  const out: IntakeData = { ...data };
  for (const key of sensitiveScalarKeys(sections)) {
    if (out[key]) out[key] = null;
  }
  for (const [repeaterKey, subKeys] of sensitiveRowKeys(sections)) {
    const list = out[repeaterKey];
    if (!Array.isArray(list)) continue;
    out[repeaterKey] = list.map((r) => {
      const row = { ...((r ?? {}) as RepeaterRow) };
      for (const key of subKeys) {
        const value = row[key];
        if (typeof value === "string" && value !== "") row[key] = "";
      }
      return row;
    });
  }
  return out;
}

/** Every sensitive field's name, as the audit log records it: "ssn", …, "dependents.ssn". */
export function sensitiveFieldNames(sections: IntakeSection[]): string[] {
  return [
    ...sensitiveScalarKeys(sections),
    ...sensitiveRowKeys(sections).flatMap(([repeaterKey, subKeys]) => subKeys.map((sub) => `${repeaterKey}.${sub}`)),
  ];
}

export type SensitivePurgePlan = {
  /** The top-level keys to merge in; empty when nothing sensitive is left on file. */
  patch: IntakeData;
  /** The names of the fields that had a value (for the audit log: names, never values). */
  fields: string[];
};

/**
 * What erasing the sensitive values of `stored` writes. Only keys that change go in, so a session
 * with nothing left to erase gets an empty patch (the job's "already purged"). Once anything is to
 * be erased, every sensitive scalar goes in as null, so one saved between the read and the write is
 * erased too (null merges safely). A repeater goes in whole, as `data || patch` replaces a key.
 */
export function planSensitivePurge(sections: IntakeSection[], stored: IntakeData): SensitivePurgePlan {
  const scalars = sensitiveScalarKeys(sections);
  const blanked = blankSensitiveValues(sections, stored);
  const patch: IntakeData = {};
  for (const [key, value] of Object.entries(blanked)) {
    if (stableJson(value) !== stableJson(stored[key])) patch[key] = value;
  }

  const fields: string[] = scalars.filter((key) => Boolean(stored[key]));
  for (const [repeaterKey, subKeys] of sensitiveRowKeys(sections)) {
    const rows = stored[repeaterKey];
    if (!Array.isArray(rows)) continue;
    for (const sub of subKeys) {
      const held = rows.some((r) => {
        const value = ((r ?? {}) as RepeaterRow)[sub];
        return typeof value === "string" && value !== "";
      });
      if (held) fields.push(`${repeaterKey}.${sub}`);
    }
  }

  if (Object.keys(patch).length > 0) for (const key of scalars) patch[key] = null;
  return { patch, fields };
}

/**
 * Does the application hold a sensitive value: on file, just typed, or as the mask an agent's view
 * gets for one? (The agent's form brings "Entered in Impact" back when one is typed again.)
 */
export function sensitiveValuesHeld(sections: IntakeSection[], data: IntakeData): boolean {
  return planSensitivePurge(sections, data).fields.length > 0;
}
