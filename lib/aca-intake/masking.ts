/**
 * Mask ACA intake's sensitive values before they reach a client browser.
 *
 * Now that the form is reachable without signing in, the browser is authenticated only by the
 * unguessable link plus a device cookie — so the server stops shipping real SSNs, bank and card
 * numbers to it. The client sees a mask proving the value is on file; the agent, authenticated
 * through Clerk, still sees the real thing.
 *
 * Sensitivity is read off the field config (never a hardcoded key list) at both levels, so each
 * household member's SSN inside the `householdMembers` repeater is covered too — the same walk
 * lib/aca-intake/encryption.ts performs.
 */

import { allScalarFields, allRepeaterFields } from "./fields";
import type { AcaIntakeData } from "./schema";
import {
  maskSensitive,
  mergePreservedSensitive as mergePreserved,
  type SensitiveRowKeys,
} from "@/lib/intake-shared/masking";

let scalarCache: string[] | null = null;
function sensitiveScalarKeys(): string[] {
  if (!scalarCache) {
    scalarCache = allScalarFields()
      .filter((f) => f.sensitive)
      .map((f) => f.key);
  }
  return scalarCache;
}

let rowCache: SensitiveRowKeys | null = null;
function sensitiveRowKeys(): SensitiveRowKeys {
  if (!rowCache) {
    rowCache = allRepeaterFields()
      .map((f): [string, string[]] => [
        f.key,
        (f.rowFields ?? []).filter((sub) => sub.sensitive).map((sub) => sub.key),
      ])
      .filter(([, subKeys]) => subKeys.length > 0);
  }
  return rowCache;
}

/** Replace every sensitive value with a mask before sending data to a client browser. */
export function maskAcaSensitiveForClient(data: AcaIntakeData): AcaIntakeData {
  return maskSensitive(data, sensitiveScalarKeys(), sensitiveRowKeys());
}

/** Keep stored values whenever the client echoes back a mask, so nothing is silently wiped. */
export function mergePreservedAcaSensitive(
  incoming: AcaIntakeData,
  stored: AcaIntakeData
): AcaIntakeData {
  return mergePreserved(incoming, stored, sensitiveScalarKeys(), sensitiveRowKeys());
}
