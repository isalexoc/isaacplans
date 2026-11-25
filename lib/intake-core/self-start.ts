/**
 * Pure rules of the public self-start (`/api/intake/<lob>/start`): who owns the new session, and
 * which answers its URL may preset. No database, no Clerk: `pnpm test:staff-access` runs them.
 */

import type { IntakeData, IntakeLobConfig } from "./types";

type Env = Record<string, string | undefined>;

/**
 * Owner Clerk id for self-started sessions: the line's own env var, else the shared default,
 * unless the line requires its own (Legal Shield: Ysmael's clients are never Isaac's by accident).
 */
export function resolveIntakeOwner(
  config: Pick<IntakeLobConfig, "ownerEnvVar" | "ownerEnvRequired">,
  env: Env = process.env
): string {
  const own = env[config.ownerEnvVar]?.trim();
  if (own) return own;
  if (config.ownerEnvRequired) throw new Error(`${config.ownerEnvVar} is not configured.`);
  const fallback = env.INTAKE_DEFAULT_OWNER_USER_ID?.trim();
  if (!fallback) throw new Error(`Neither ${config.ownerEnvVar} nor INTAKE_DEFAULT_OWNER_USER_ID is configured.`);
  return fallback;
}

/** The whitelisted presets in a start URL (`?lsBilling=anual`); unknown keys and values are dropped. */
export function selfStartPresetsFrom(
  config: Pick<IntakeLobConfig, "selfStartPresets">,
  params: URLSearchParams
): IntakeData {
  const out: IntakeData = {};
  for (const [key, allowed] of Object.entries(config.selfStartPresets ?? {})) {
    const value = params.get(key);
    if (value !== null && allowed.includes(value)) out[key] = value;
  }
  return out;
}
