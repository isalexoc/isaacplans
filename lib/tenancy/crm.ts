/**
 * The CRM adapter: whose GHL credentials an intake session may use. Server-only.
 *
 * Every intake, secure-link and CrankWheel path asks `crmCredsForOwner(session owner)` instead of
 * reading Isaac's credentials directly (`pnpm test:tenancy` fails if any of those paths, or a
 * module they import, reads them another way). The answer is Isaac's credentials or null, and it
 * fails closed. In order:
 *  1. The product surface (`APP_SURFACE=product`), or no CRM env on this deployment: null.
 *  2. The owner is listed in env: credentials. The list is `CRM_OWNER_USER_IDS` plus the
 *     single-tenant default-owner vars (lib/tenancy/crm-allowlist.ts).
 *  3. The route verified that the signed-in caller is this owner and a Clerk admin
 *     (`{ adminCaller }` equal to the owner): credentials.
 *  4. Clerk says the owner has `role: "admin"` (cached a minute): credentials. A Clerk error, or
 *     any other answer: null. Logged both ways, so an unlisted admin shows up in the logs.
 * No database read can open it: a missing table, a paused agent or a failed query never does. The
 * one read, in step 4 for an admin-role owner (lib/tenancy/clerk-admin.ts: is that account linked
 * to an agent row?), can only take the credentials away.
 *
 * Steps 3 and 4 trust the Clerk admin role, so they are safe only while agents are never Clerk
 * admins (the plan's rule). The agent-linking flow (lib/tenancy/agent-linking.ts) enforces it: it
 * refuses an admin or a listed id, and sets `publicMetadata.agentId`, which step 4 honors
 * (lib/tenancy/clerk-admin.ts), as it honors an `agents` row linked to the account. Step 3's
 * vouching comes from lib/tenancy/context.ts, where an agent's account is never an admin.
 *
 * Env, for the setup docs:
 *  - `CRM_OWNER_USER_IDS` (new; set it before deploying): every admin Clerk id that owns intakes
 *    or CrankWheel meetings, comma- or space-separated. With it set, steps 3 and 4 never run for
 *    them, so a Clerk outage can't hold back a sync (step 4's error answer is null; a submission
 *    synced then is not retried). Without it, self-started applications are still covered by the
 *    default-owner vars and dashboard-created ones by steps 3 and 4.
 */

import "server-only";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { buildCrmOwnerAllowlist, crmOwnerDecision } from "./crm-allowlist";
import { clerkAdminStatus } from "./clerk-admin";
import { appSurface } from "./surface";

export type CrmCredentials = { token: string; locationId: string };

export type CrmOwnerOptions = {
  /**
   * The signed-in caller, when the route has verified they are a Clerk admin. Counts only when it
   * equals the owner (an admin vouches for themself, never for someone else's session).
   */
  adminCaller?: string | null;
};

/** Listed in env as one of Isaac's own ids (step 2 alone: no network, any surface). */
export function isListedPlatformOwner(ownerUserId: string | null | undefined): boolean {
  const owner = typeof ownerUserId === "string" ? ownerUserId.trim() : "";
  return owner !== "" && buildCrmOwnerAllowlist().has(owner);
}

/** Every id listed in env as Isaac's (step 2's list), for queries that must exempt them. */
export function listedPlatformOwnerIds(): string[] {
  return Array.from(buildCrmOwnerAllowlist());
}

/** Owners already reported as reaching the CRM through step 4, so the log says it once per process. */
const grantedByClerk = new Set<string>();

/** Steps 2 to 4: is this owner Isaac's side (listed, or a Clerk admin)? Never true on the product surface. */
export async function isPlatformOwner(
  ownerUserId: string | null | undefined,
  opts: CrmOwnerOptions = {}
): Promise<boolean> {
  const decision = crmOwnerDecision(ownerUserId, {
    allowlist: buildCrmOwnerAllowlist(),
    surface: appSurface(),
    adminCaller: opts.adminCaller ?? null,
  });
  if (decision === "allow") return true;
  if (decision === "deny") return false;
  const owner = String(ownerUserId).trim();
  const status = await clerkAdminStatus(owner);
  if (status === null) {
    console.error(
      `[tenancy] CRM withheld for owner ${owner}: Clerk could not confirm the admin role. ` +
        "If this is an admin, add the id to CRM_OWNER_USER_IDS."
    );
    return false;
  }
  if (status.platformAdmin && !grantedByClerk.has(owner)) {
    grantedByClerk.add(owner);
    console.warn(
      `[tenancy] CRM granted to owner ${owner} through the Clerk admin role; add the id to CRM_OWNER_USER_IDS.`
    );
  }
  return status.platformAdmin;
}

/** Isaac's GHL credentials for a session owned by `ownerUserId`, or null. See the rule above. */
export async function crmCredsForOwner(
  ownerUserId: string | null | undefined,
  opts: CrmOwnerOptions = {}
): Promise<CrmCredentials | null> {
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return null;
  return (await isPlatformOwner(ownerUserId, opts)) ? creds : null;
}
