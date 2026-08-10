/**
 * Mask IUL intake's sensitive values before they reach a client browser.
 *
 * Now that the form is reachable without signing in, the browser is authenticated only by the
 * unguessable link plus a device cookie — so the server stops shipping real SSNs, driver's licence
 * and bank numbers to it. The client sees a mask proving the value is on file; the agent,
 * authenticated through Clerk, still sees the real thing.
 *
 * Beneficiaries need explicit handling: `allScalarFields()` filters out the composite
 * `beneficiaries` field, so its per-beneficiary SSN is invisible to the scalar walk — exactly the
 * reason lib/crypto/field-encryption.ts carries a dedicated beneficiary walker. Miss it and
 * beneficiary SSNs would leak while every other sensitive value was masked.
 */

import { allScalarFields } from "./fields";
import type { IntakeData } from "./schema";
import {
  maskSensitive,
  mergePreservedSensitive as mergePreserved,
  type SensitiveRowKeys,
} from "@/lib/intake-shared/masking";

/** The composite beneficiary list, walked like a repeater row. */
const BENEFICIARY_ROW_KEYS: SensitiveRowKeys = [["beneficiaries", ["ssn"]]];

let scalarCache: string[] | null = null;
function sensitiveScalarKeys(): string[] {
  if (!scalarCache) {
    scalarCache = allScalarFields()
      .filter((f) => f.sensitive)
      .map((f) => f.key);
  }
  return scalarCache;
}

/** Replace every sensitive value with a mask before sending data to a client browser. */
export function maskIulSensitiveForClient(data: IntakeData): IntakeData {
  return maskSensitive(data, sensitiveScalarKeys(), BENEFICIARY_ROW_KEYS);
}

/** Keep stored values whenever the client echoes back a mask, so nothing is silently wiped. */
export function mergePreservedIulSensitive(incoming: IntakeData, stored: IntakeData): IntakeData {
  return mergePreserved(incoming, stored, sensitiveScalarKeys(), BENEFICIARY_ROW_KEYS);
}
