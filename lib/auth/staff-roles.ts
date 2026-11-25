/**
 * Pure staff-role decisions, shared by middleware, routes, pages and `pnpm test:staff-access`.
 * No Clerk, no React, no Next: safe in the edge middleware and in an offline test.
 *
 * `admin` (Isaac) reaches everything. `legal_shield` (Ysmael, Isaac's dad, a LegalShield associate)
 * reaches only the Legal Shield line. The role lives in Clerk `publicMetadata.role`, which only the
 * backend or the Clerk dashboard can write; unknown values grant nothing.
 */

export type StaffRole = "admin" | "legal_shield";

/** Lines each non-admin role may operate. Admins operate every line. */
const ROLE_LINES: Record<Exclude<StaffRole, "admin">, readonly string[]> = {
  legal_shield: ["legal-shield"],
};

/** Whitelisted role from Clerk public metadata (camelCase or the webhook's snake_case object). */
export function roleFromMetadata(metadata: unknown): StaffRole | null {
  const role = (metadata as { role?: unknown } | null | undefined)?.role;
  return role === "admin" || role === "legal_shield" ? role : null;
}

/** May this role work this line's intakes (dashboard, sessions, links, deck)? */
export function canOperateLine(access: { role: StaffRole | null }, lob: string): boolean {
  if (access.role === "admin") return true;
  if (!access.role) return false;
  return ROLE_LINES[access.role].includes(lob);
}

/**
 * May this caller act on this one session? Its owner may; an admin may too on a line that asks for
 * oversight (Isaac helps with his dad's Legal Shield clients).
 */
export function canOperateSession(
  access: { userId: string | null; isAdmin: boolean },
  config: { adminOversight?: boolean },
  row: { ownerUserId: string }
): boolean {
  if (!access.userId) return false;
  if (row.ownerUserId === access.userId) return true;
  return access.isAdmin && Boolean(config.adminOversight);
}

/**
 * The one /admin path a non-admin staff role may open: the dashboard root, which then shows only
 * that role's section. Every subpath (/admin/meet, /admin/lead-holds…), /api/admin and /studio stay
 * admin-only; many admin pages and API routes have no check of their own, so this must be exact.
 */
const ADMIN_ROOT_RE = /^(?:\/(?:en|es))?\/admin\/?$/;
export function isAdminRootPath(pathname: string): boolean {
  return ADMIN_ROOT_RE.test(pathname);
}

/** May this role open this /admin path (middleware's admin gate)? */
export function canOpenAdminPath(role: StaffRole | null, pathname: string): boolean {
  if (role === "admin") return true;
  return role === "legal_shield" && isAdminRootPath(pathname);
}

/**
 * Should the Clerk → GHL contact sync run for this user? Not for a scoped staff account: Isaac's dad
 * must never become a lead (a contact, tags, workflows) in Isaac's CRM. Reads the webhook payload's
 * snake_case `public_metadata`.
 */
export function shouldSyncClerkUserToCrm(data: { public_metadata?: unknown } | null | undefined): boolean {
  return roleFromMetadata(data?.public_metadata) !== "legal_shield";
}

/** The legal_shield role's home: its dashboard. */
export const LEGAL_SHIELD_HOME = "/es/legal-shield/intake";
