/**
 * Which Clerk account becomes an agent, as pure decisions (no I/O), so the offline tests can walk
 * every case. lib/tenancy/agent-accounts.ts gathers the facts (Clerk, the `agents` table) and
 * applies these.
 *
 * The rules that keep Isaac's CRM and admin role out of an agent's reach:
 *  - an admin (`publicMetadata.role === "admin"`) or one of Isaac's own ids (listed in env,
 *    lib/tenancy/crm-allowlist.ts) is NEVER linked to an agent row, by invitation, by Isaac's
 *    "Link" button or on first use. lib/tenancy/crm.ts trusts the admin role for CRM access, so an
 *    admin who were also an agent would put that agent's clients in Isaac's CRM;
 *  - an account is linked only by an email address it has VERIFIED, and only to an agent row no
 *    other account holds;
 *  - linking fills `agents.clerk_user_id` and sets `publicMetadata.agentId` (merged: `role` is
 *    never touched). It never changes the agent's status: that is Isaac's switch alone (see
 *    lib/tenancy/agent-admin.ts). An invited agent can sign in, accept the agreements and fill in
 *    their profile, and sees applications once Isaac activates them.
 *
 * And the agent marker outranks the admin role (`isPlatformAdminMetadata`, the one admin check
 * middleware, lib/auth/admin.ts `getIsAdmin` and lib/tenancy/context.ts share), and the Clerk
 * webhook never copies an agent's account into Isaac's CRM (`decideClerkCrmSync`).
 */

/** Trimmed and lowercased; the `agents.email` column stores it this way. */
export function normalizeAgentEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAgentEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/** The text of `publicMetadata.agentId`, or null. */
export function agentIdMarker(publicMetadata: unknown): string | null {
  if (!publicMetadata || typeof publicMetadata !== "object") return null;
  const value = (publicMetadata as Record<string, unknown>).agentId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function hasAdminRole(publicMetadata: unknown): boolean {
  return Boolean(publicMetadata && typeof publicMetadata === "object" && (publicMetadata as Record<string, unknown>).role === "admin");
}

/**
 * Isaac's admin role, as every admin check reads it: `role === "admin"` on an account that does NOT
 * carry the agent marker. Agents are never admins; an agent given the role by mistake gets none of
 * /admin, /api/admin, Studio, the admin-only intake routes or Isaac's CRM. Isaac's own accounts
 * never carry the marker (linking refuses admins and his listed ids), so they read exactly as before.
 */
export function isPlatformAdminMetadata(publicMetadata: unknown): boolean {
  return hasAdminRole(publicMetadata) && !agentIdMarker(publicMetadata);
}

/* ─── Isaac's "Invite" button ─────────────────────────────────────────────── */

/** A Clerk account that has the agent's email, as lib/tenancy/agent-accounts.ts reads it. */
export type ClerkAccountFact = {
  id: string;
  /** `publicMetadata.role === "admin"`. */
  isAdmin: boolean;
  /** One of Isaac's ids listed in env. */
  listedOwner: boolean;
  /** `publicMetadata.agentId`, if any. */
  agentId: string | null;
  /** The agent's email is verified on this account. */
  emailVerified: boolean;
  /** Another `agents` row is already linked to this account. */
  linkedToOtherAgent: boolean;
};

export type InviteRefusal =
  | "already_linked"
  | "not_unique"
  | "admin"
  | "platform_owner"
  | "unverified_email"
  | "other_agent";

export type InviteDecision =
  | { action: "invite" }
  | { action: "link"; userId: string }
  | { action: "refuse"; reason: InviteRefusal };

/**
 * No account has the email: send a Clerk invitation (an invitation fails for an existing account,
 * and would never give it the agent marker anyway). One account has it, verified: link it. Anything
 * else is refused, with the reason Isaac sees.
 */
export function decideAgentInvite(
  agent: { id: string; clerkUserId: string | null },
  accounts: readonly ClerkAccountFact[]
): InviteDecision {
  if (agent.clerkUserId) return { action: "refuse", reason: "already_linked" };
  if (accounts.length === 0) return { action: "invite" };
  if (accounts.length > 1) return { action: "refuse", reason: "not_unique" };
  const [account] = accounts;
  if (account.isAdmin) return { action: "refuse", reason: "admin" };
  if (account.listedOwner) return { action: "refuse", reason: "platform_owner" };
  if (!account.emailVerified) return { action: "refuse", reason: "unverified_email" };
  if ((account.agentId && account.agentId !== agent.id) || account.linkedToOtherAgent) {
    return { action: "refuse", reason: "other_agent" };
  }
  return { action: "link", userId: account.id };
}

export const INVITE_REFUSAL_MESSAGES: Readonly<Record<InviteRefusal, string>> = {
  already_linked: "This agent is already linked to a sign-in.",
  not_unique: "More than one Clerk account has this email. Fix it in Clerk first.",
  admin: "That Clerk account is an admin. Agents are never admins: use another email.",
  platform_owner: "That Clerk account is one of yours (CRM_OWNER_USER_IDS). Use another email.",
  unverified_email: "That Clerk account hasn't verified this email. Ask them to verify it, then try again.",
  other_agent: "That Clerk account already belongs to another agent.",
};

/* ─── first use: a signed-in account with no agent row yet ────────────────── */

export type FirstUseFacts = {
  userId: string;
  isAdmin: boolean;
  listedOwner: boolean;
  /** The request comes from a Clerk impersonation session. */
  impersonated: boolean;
  /** `publicMetadata.agentId` (set by the invitation). */
  agentIdMarker: string | null;
  /** The account's verified email addresses, normalized. */
  verifiedEmails: readonly string[];
};

/** The agent row the marker or a verified email points at. */
export type FirstUseCandidate = { id: string; email: string; clerkUserId: string | null };

export type FirstUseRefusal =
  | "admin"
  | "platform_owner"
  | "impersonated"
  | "no_candidate"
  | "already_linked"
  | "marker_mismatch"
  | "email_mismatch";

export type FirstUseDecision = { link: true; agentId: string } | { link: false; reason: FirstUseRefusal };

/**
 * Link on first use: an invited person who signed up (the invitation put `agentId` on their
 * account), or someone who already had an account with the agent's email. Either way the row's
 * email must be one of the account's VERIFIED addresses, the row must not be linked yet, and an
 * admin, one of Isaac's ids or an impersonated session is never linked.
 */
export function decideFirstUseLink(facts: FirstUseFacts, candidate: FirstUseCandidate | null): FirstUseDecision {
  if (facts.isAdmin) return { link: false, reason: "admin" };
  if (facts.listedOwner) return { link: false, reason: "platform_owner" };
  if (facts.impersonated) return { link: false, reason: "impersonated" };
  if (!candidate) return { link: false, reason: "no_candidate" };
  if (candidate.clerkUserId) return { link: false, reason: "already_linked" };
  if (facts.agentIdMarker && facts.agentIdMarker !== candidate.id) return { link: false, reason: "marker_mismatch" };
  const email = normalizeAgentEmail(candidate.email);
  if (!email || !facts.verifiedEmails.includes(email)) return { link: false, reason: "email_mismatch" };
  return { link: true, agentId: candidate.id };
}

/* ─── the Clerk webhook: never an agent into Isaac's CRM ──────────────────── */

/**
 * Does a Clerk account belong to an agent, as far as the CRM sync must know? "yes" when an
 * `agents` row has its id or one of its emails, "no" when none does (or the table doesn't exist
 * yet), "unknown" when the lookup failed.
 */
export type AgentRowMatch = "yes" | "no" | "unknown";

/**
 * The webhook's answer, decided BEFORE it responds: "skip" (an agent's account: the marker the
 * invitation or the link put on it, or an `agents` row with its id or email; never into Isaac's
 * CRM), "sync" (anyone else: the upsert runs as it always did), or "retry" (the lookup failed:
 * the webhook answers 503 and Clerk's sender retries the event later, so an ordinary visitor is
 * never dropped from the CRM and an agent never slips into it).
 */
export type ClerkCrmSyncDecision = "skip" | "sync" | "retry";

export function decideClerkCrmSync(input: { agentIdMarker: string | null; agentRow: AgentRowMatch }): ClerkCrmSyncDecision {
  if (input.agentIdMarker || input.agentRow === "yes") return "skip";
  return input.agentRow === "unknown" ? "retry" : "sync";
}
