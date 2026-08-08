/**
 * Sensitive-value masking for passwordless intake sessions.
 *
 * With no sign-in, the client's browser is authenticated only by an unguessable link plus a
 * device cookie. That's strong, but it means the browser is the weakest link — so the server
 * never sends real sensitive values (SSN, mother's maiden name) back to it. The client sees a
 * mask proving the value is on file; only the agent, authenticated through Clerk, sees the
 * real thing.
 *
 * The round trip: `maskSensitiveForClient` on the way out, `mergePreservedSensitive` on the way
 * back in, so a returning mask never overwrites the stored value.
 */

import { allScalarFields } from "./fields";
import type { FeIntakeData } from "./schema";

/** Bullet used to build masks — also the marker that identifies one coming back. */
const MASK_CHAR = "•";

let sensitiveKeysCache: string[] | null = null;
function sensitiveKeys(): string[] {
  if (!sensitiveKeysCache) {
    sensitiveKeysCache = allScalarFields()
      .filter((f) => f.sensitive)
      .map((f) => f.key);
  }
  return sensitiveKeysCache;
}

/** True when a value is one of our masks rather than something the client actually typed. */
export function isMaskedValue(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(MASK_CHAR);
}

/** "123456789" → "•••••6789"; short values are fully masked. */
export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return MASK_CHAR.repeat(trimmed.length);
  return MASK_CHAR.repeat(trimmed.length - 4) + trimmed.slice(-4);
}

/** Replace every sensitive value with a mask before sending data to a client browser. */
export function maskSensitiveForClient(data: FeIntakeData): FeIntakeData {
  const out: FeIntakeData = { ...data };
  for (const key of sensitiveKeys()) {
    const value = out[key];
    if (typeof value === "string" && value !== "") out[key] = maskValue(value);
  }
  return out;
}

/**
 * Keep the stored value whenever the client sends back a mask (or clears a field it was never
 * given). A real edit — the client types a new number — still comes through as plain digits and
 * overwrites normally.
 */
export function mergePreservedSensitive(incoming: FeIntakeData, stored: FeIntakeData): FeIntakeData {
  const out: FeIntakeData = { ...incoming };
  for (const key of sensitiveKeys()) {
    const next = out[key];
    const previous = stored[key];
    if (typeof previous !== "string" || previous === "") continue;
    if (isMaskedValue(next) || next === undefined || next === "") out[key] = previous;
  }
  return out;
}
