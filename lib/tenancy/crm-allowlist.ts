/**
 * Which session owners may use Isaac's CRM (GHL) credentials: the pure half of lib/tenancy/crm.ts,
 * kept free of server-only imports so the offline tests can run it.
 *
 * The rule is an allowlist and it fails closed. An owner gets Isaac's credentials only when one of
 * these is true:
 *  1. the owner's Clerk id is listed in env: `CRM_OWNER_USER_IDS` (new; comma- or space-separated:
 *     Isaac's admin Clerk ids) or any of the single-tenant default-owner vars below, which already
 *     hold Isaac's id because every self-started application is owned by it;
 *  2. the route has just verified that the signed-in caller IS the owner and is a Clerk admin
 *     (`adminCaller` equal to the owner);
 *  3. otherwise lib/tenancy/crm.ts asks Clerk whether the owner has `publicMetadata.role = "admin"`
 *     (cached; an error or any other answer means no credentials).
 * The product surface never gets credentials at all. Nothing here reads the database: a missing
 * table, a paused agent or a lookup error can never turn into "use Isaac's CRM".
 *
 * Why step 3 exists: if `CRM_OWNER_USER_IDS` is unset and the default-owner vars hold a different id
 * than the one Isaac signs in with, his dashboard-created applications are still synced when the
 * CLIENT saves them (that request has no admin caller to vouch for the owner). Steps 2 and 3 trust
 * the Clerk admin role, which is safe because agents are never Clerk admins; the agent-linking flow
 * (lib/tenancy/agent-linking.ts) enforces that: it never links an admin or a listed id.
 */

import type { AppSurface } from "./surface";

/**
 * Env vars whose values are Isaac's own Clerk ids. The first is the new explicit list; the rest
 * are the existing self-start owners: the engine lines (`config.ownerEnvVar` in
 * lib/intake-configs/, plus the shared fallback) and the IUL, ACA and Final Expense intakes.
 * scripts/test-tenancy.ts fails if an engine line's owner var is missing here.
 */
export const PLATFORM_OWNER_ENV_VARS = [
  "CRM_OWNER_USER_IDS",
  "INTAKE_DEFAULT_OWNER_USER_ID",
  "HEALTH_ALTERNATIVE_DEFAULT_OWNER_USER_ID",
  "STM_DEFAULT_OWNER_USER_ID",
  "DENTAL_VISION_DEFAULT_OWNER_USER_ID",
  "HOSPITAL_INDEMNITY_DEFAULT_OWNER_USER_ID",
  "LIFE_INSURANCE_DEFAULT_OWNER_USER_ID",
  "IUL_DEFAULT_OWNER_USER_ID",
  "ACA_DEFAULT_OWNER_USER_ID",
  "FE_INTAKE_DEFAULT_OWNER_USER_ID",
] as const;

/** A Clerk-id-shaped token. Anything else ("*", "all", a stray quote) is ignored, never a wildcard. */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function parseOwnerIds(value: string | null | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && ID_PATTERN.test(v));
}

export function buildCrmOwnerAllowlist(
  env: Record<string, string | undefined> = process.env
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const name of PLATFORM_OWNER_ENV_VARS) {
    for (const id of parseOwnerIds(env[name])) ids.add(id);
  }
  return ids;
}

/** "ask_clerk": not listed and not vouched for; only a Clerk admin role can still allow it. */
export type CrmOwnerDecision = "allow" | "deny" | "ask_clerk";

export function crmOwnerDecision(
  ownerUserId: string | null | undefined,
  ctx: { allowlist: ReadonlySet<string>; surface: AppSurface; adminCaller?: string | null }
): CrmOwnerDecision {
  if (ctx.surface === "product") return "deny";
  const owner = typeof ownerUserId === "string" ? ownerUserId.trim() : "";
  if (!owner) return "deny";
  if (ctx.allowlist.has(owner)) return "allow";
  if (ctx.adminCaller && ctx.adminCaller === owner) return "allow";
  return "ask_clerk";
}
