/**
 * Encrypt/decrypt sensitive ACA intake fields at rest.
 *
 * Reuses the AES-256-GCM primitives and the `INTAKE_ENCRYPTION_KEY` env var from
 * lib/crypto/field-encryption.ts — same key, same `enc:v1:…` envelope, same idempotence.
 * What is new here is the walk: ACA stores household members as a repeater array, so
 * sensitive sub-fields (each member's SSN) live inside row objects rather than at the top
 * level. Sensitivity is read off the field config, never a hardcoded key list.
 */

import "server-only";
import {
  encryptString,
  decryptString,
  isEncrypted,
} from "@/lib/crypto/field-encryption";
import {
  allScalarFields,
  allRepeaterFields,
  type RepeaterRow,
} from "./fields";
import type { AcaIntakeData } from "./schema";

let sensitiveScalarCache: string[] | null = null;
function sensitiveScalarKeys(): string[] {
  if (!sensitiveScalarCache) {
    sensitiveScalarCache = allScalarFields()
      .filter((f) => f.sensitive)
      .map((f) => f.key);
  }
  return sensitiveScalarCache;
}

/** [repeaterKey, [sensitive sub-field keys]] pairs, e.g. ["householdMembers", ["ssn"]]. */
let sensitiveRowCache: Array<[string, string[]]> | null = null;
function sensitiveRowKeys(): Array<[string, string[]]> {
  if (!sensitiveRowCache) {
    sensitiveRowCache = allRepeaterFields()
      .map((f): [string, string[]] => [
        f.key,
        (f.rowFields ?? []).filter((sub) => sub.sensitive).map((sub) => sub.key),
      ])
      .filter(([, subKeys]) => subKeys.length > 0);
  }
  return sensitiveRowCache;
}

/** Apply `transform` to every sensitive sub-value inside a repeater array. */
function mapRows(
  list: unknown,
  subKeys: string[],
  transform: (value: string) => string
): RepeaterRow[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.map((r) => {
    const row = { ...((r ?? {}) as RepeaterRow) };
    for (const key of subKeys) {
      const v = row[key];
      if (typeof v === "string" && v !== "") row[key] = transform(v);
    }
    return row;
  });
}

/** Encrypt all sensitive values (returns a new object). */
export function encryptAcaIntakeData(data: AcaIntakeData): AcaIntakeData {
  const out: AcaIntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    const v = out[key];
    if (typeof v === "string" && v !== "") out[key] = encryptString(v);
  }
  for (const [repeaterKey, subKeys] of sensitiveRowKeys()) {
    const rows = mapRows(out[repeaterKey], subKeys, encryptString);
    if (rows) out[repeaterKey] = rows;
  }
  return out;
}

/** Decrypt all sensitive values (returns a new object). */
export function decryptAcaIntakeData(data: AcaIntakeData): AcaIntakeData {
  const out: AcaIntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    const v = out[key];
    if (isEncrypted(v)) out[key] = decryptString(v);
  }
  for (const [repeaterKey, subKeys] of sensitiveRowKeys()) {
    const rows = mapRows(out[repeaterKey], subKeys, (v) =>
      isEncrypted(v) ? decryptString(v) : v
    );
    if (rows) out[repeaterKey] = rows;
  }
  return out;
}

/** Replace sensitive values with null/empty (used by purge-after-sync). */
export function purgeAcaSensitiveData(data: AcaIntakeData): AcaIntakeData {
  const out: AcaIntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    if (out[key]) out[key] = null;
  }
  for (const [repeaterKey, subKeys] of sensitiveRowKeys()) {
    const rows = mapRows(out[repeaterKey], subKeys, () => "");
    if (rows) out[repeaterKey] = rows;
  }
  return out;
}
