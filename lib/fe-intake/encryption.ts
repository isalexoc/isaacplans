/**
 * Encrypt/decrypt sensitive Final Expense intake fields at rest.
 *
 * Reuses the AES-256-GCM primitives and the `INTAKE_ENCRYPTION_KEY` env var from
 * lib/crypto/field-encryption.ts — same key, same `enc:v1:…` envelope, same idempotence.
 * Sensitivity is read off the field config, never a hardcoded key list (mirrors
 * lib/aca-intake/encryption.ts).
 */

import "server-only";
import {
  encryptString,
  decryptString,
  isEncrypted,
} from "@/lib/crypto/field-encryption";
import { allScalarFields } from "./fields";
import type { FeIntakeData } from "./schema";

let sensitiveScalarCache: string[] | null = null;
function sensitiveScalarKeys(): string[] {
  if (!sensitiveScalarCache) {
    sensitiveScalarCache = allScalarFields()
      .filter((f) => f.sensitive)
      .map((f) => f.key);
  }
  return sensitiveScalarCache;
}

/** Encrypt all sensitive values (returns a new object). */
export function encryptFeIntakeData(data: FeIntakeData): FeIntakeData {
  const out: FeIntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    const v = out[key];
    if (typeof v === "string" && v !== "") out[key] = encryptString(v);
  }
  return out;
}

/** Decrypt all sensitive values (returns a new object). */
export function decryptFeIntakeData(data: FeIntakeData): FeIntakeData {
  const out: FeIntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    const v = out[key];
    if (isEncrypted(v)) out[key] = decryptString(v);
  }
  return out;
}

/** Replace sensitive values with null (used by purge-after-sync). */
export function purgeFeSensitiveData(data: FeIntakeData): FeIntakeData {
  const out: FeIntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    if (out[key]) out[key] = null;
  }
  return out;
}
