/**
 * Encryption at rest and masking in transit for sensitive intake values.
 *
 * Two protections over the same set of fields, so they live together and derive their key lists
 * from one place:
 *
 *  - **Encryption** reuses the AES-256-GCM primitives and `INTAKE_ENCRYPTION_KEY` from
 *    `lib/crypto/field-encryption.ts` — same key, same `enc:v1:…` envelope, same idempotence as
 *    the three original intakes, so nothing about the secret changes.
 *  - **Masking** exists because the form is reachable without signing in: the browser is
 *    authenticated only by an unguessable link plus a device cookie, so the server never sends
 *    real SSNs, bank or card numbers back to it. The client sees a mask proving the value is on
 *    file; the agent, authenticated through Clerk, sees the real thing.
 *
 * Which fields count is read off the config (never a hardcoded key list) at both levels — top-level
 * scalars and sub-fields inside repeater rows — so a dependent's SSN is covered exactly like the
 * applicant's.
 *
 * Both key lists are memoized per config object; configs are module singletons so this is stable.
 */

import "server-only";
import { encryptString, decryptString, isEncrypted } from "@/lib/crypto/field-encryption";
import {
  maskSensitive,
  mergePreservedSensitive as mergePreserved,
  type SensitiveRowKeys,
} from "@/lib/intake-shared/masking";
import { sensitiveScalarKeys, sensitiveRowKeys } from "./fields";
import type { IntakeData, IntakeLobConfig, RepeaterRow } from "./types";

type Keys = { scalars: string[]; rows: SensitiveRowKeys };

const keyCache = new WeakMap<IntakeLobConfig, Keys>();

function keysFor(config: IntakeLobConfig): Keys {
  let keys = keyCache.get(config);
  if (!keys) {
    keys = {
      scalars: sensitiveScalarKeys(config.sections),
      rows: sensitiveRowKeys(config.sections),
    };
    keyCache.set(config, keys);
  }
  return keys;
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
export function encryptIntakeData(config: IntakeLobConfig, data: IntakeData): IntakeData {
  const { scalars, rows: rowKeys } = keysFor(config);
  const out: IntakeData = { ...data };
  for (const key of scalars) {
    const v = out[key];
    if (typeof v === "string" && v !== "") out[key] = encryptString(v);
  }
  for (const [repeaterKey, subKeys] of rowKeys) {
    const rows = mapRows(out[repeaterKey], subKeys, encryptString);
    if (rows) out[repeaterKey] = rows;
  }
  return out;
}

/** Decrypt all sensitive values (returns a new object). */
export function decryptIntakeData(config: IntakeLobConfig, data: IntakeData): IntakeData {
  const { scalars, rows: rowKeys } = keysFor(config);
  const out: IntakeData = { ...data };
  for (const key of scalars) {
    const v = out[key];
    if (isEncrypted(v)) out[key] = decryptString(v);
  }
  for (const [repeaterKey, subKeys] of rowKeys) {
    const rows = mapRows(out[repeaterKey], subKeys, (v) => (isEncrypted(v) ? decryptString(v) : v));
    if (rows) out[repeaterKey] = rows;
  }
  return out;
}

/** Replace sensitive values with null/empty (used by purge-after-sync). */
export function purgeIntakeSensitiveData(config: IntakeLobConfig, data: IntakeData): IntakeData {
  const { scalars, rows: rowKeys } = keysFor(config);
  const out: IntakeData = { ...data };
  for (const key of scalars) {
    if (out[key]) out[key] = null;
  }
  for (const [repeaterKey, subKeys] of rowKeys) {
    const rows = mapRows(out[repeaterKey], subKeys, () => "");
    if (rows) out[repeaterKey] = rows;
  }
  return out;
}

/** Replace every sensitive value with a mask before sending data to a client browser. */
export function maskSensitiveForClient(config: IntakeLobConfig, data: IntakeData): IntakeData {
  const { scalars, rows } = keysFor(config);
  return maskSensitive(data, scalars, rows);
}

/** Keep stored values whenever the client echoes back a mask, so nothing is silently wiped. */
export function mergePreservedSensitive(
  config: IntakeLobConfig,
  incoming: IntakeData,
  stored: IntakeData
): IntakeData {
  const { scalars, rows } = keysFor(config);
  return mergePreserved(incoming, stored, scalars, rows);
}
