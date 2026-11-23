/**
 * Agent accounts: linking a Clerk sign-in to an `agents` row, Isaac's "Invite" button, and the
 * Clerk webhook's question "is this an agent?". Server-only (Clerk's API and the database). The
 * rules themselves are pure, in lib/tenancy/agent-linking.ts; this file gathers the facts and
 * applies them.
 *
 * Linking happens three ways, all ending in the same conditional write (`agents.clerk_user_id`
 * set only while it is still empty, so two requests can't both claim a row):
 *  1. Isaac's "Invite" when no Clerk account has the agent's email: a Clerk invitation carrying
 *     `publicMetadata.agentId`, which lands on /{l}/agent. The new account is linked on first use.
 *  2. Isaac's "Invite" when an account already has that email, verified: linked right away
 *     (invitations fail for existing accounts), and `publicMetadata.agentId` merged into its
 *     metadata (`role` untouched).
 *  3. First use (`linkAgentOnFirstUse`, from lib/tenancy/context.ts): a signed-in account with no
 *     row yet, pointed at one by its marker or a verified email.
 * None of them changes the agent's status (lib/tenancy/agent-linking.ts).
 */

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { clerkClient, type User } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { agentAreaPath, type AgentAreaLocale } from "./agent-area-routes";
import {
  agentIdMarker,
  decideAgentInvite,
  decideClerkCrmSync,
  decideFirstUseLink,
  hasAdminRole,
  INVITE_REFUSAL_MESSAGES,
  normalizeAgentEmail,
  type AgentRowMatch,
  type ClerkAccountFact,
  type ClerkCrmSyncDecision,
  type FirstUseCandidate,
  type InviteRefusal,
} from "./agent-linking";
import { agentRowExistsForAccount, getAgentByClerkUserId, getAgentById, getAgentsByEmails, type AgentRow } from "./agents";
import { isListedPlatformOwner } from "./crm";
import { isUniqueViolationError } from "./db-errors";
import { mainSiteUrl } from "./site-urls";

/** The account's verified email addresses, normalized. */
export function verifiedEmailsOf(user: Pick<User, "emailAddresses">): string[] {
  return (user.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => normalizeAgentEmail(e.emailAddress))
    .filter(Boolean);
}

/** Fill `clerk_user_id` only while it is empty. Null when the row was taken (or the id is in use). */
async function linkRow(agentId: string, clerkUserId: string): Promise<AgentRow | null> {
  try {
    const [row] = await db
      .update(agents)
      .set({ clerkUserId, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), isNull(agents.clerkUserId)))
      .returning();
    return row ?? null;
  } catch (error) {
    if (isUniqueViolationError(error)) return null;
    throw error;
  }
}

/** Merge `agentId` into the account's public metadata (Clerk merges; `role` stays as it is). */
export async function markClerkAccount(clerkUserId: string, agentId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, { publicMetadata: { agentId } });
    return true;
  } catch (error) {
    console.warn("[tenancy] could not mark the Clerk account as an agent:", error instanceof Error ? error.message : error);
    return false;
  }
}

/* ─── first use ───────────────────────────────────────────────────────────── */

/** The unlinked row a verified email points at, when exactly one does. */
function emailCandidate(rows: readonly AgentRow[]): FirstUseCandidate | null {
  const open = rows.filter((row) => !row.clerkUserId);
  if (open.length !== 1) {
    if (open.length > 1) console.warn("[tenancy] several agent rows match one account's emails; not linking");
    return null;
  }
  const [row] = open;
  return { id: row.id, email: row.email, clerkUserId: row.clerkUserId };
}

/**
 * A signed-in account with no agent row: link it now when it was invited (its marker) or an
 * unlinked row has one of its verified emails. Returns the linked row, or null. Never throws.
 */
export async function linkAgentOnFirstUse(user: User, opts: { impersonated: boolean }): Promise<AgentRow | null> {
  try {
    const marker = agentIdMarker(user.publicMetadata);
    const verifiedEmails = verifiedEmailsOf(user);
    const facts = {
      userId: user.id,
      isAdmin: hasAdminRole(user.publicMetadata),
      listedOwner: isListedPlatformOwner(user.id),
      impersonated: opts.impersonated,
      agentIdMarker: marker,
      verifiedEmails,
    };
    // The refusals that need no lookup go first: an admin's or Isaac's own request costs nothing.
    if (facts.isAdmin || facts.listedOwner || facts.impersonated || (!marker && verifiedEmails.length === 0)) {
      return null;
    }
    let candidate: FirstUseCandidate | null = null;
    if (marker) {
      const row = await getAgentById(marker);
      candidate = row ? { id: row.id, email: row.email, clerkUserId: row.clerkUserId } : null;
    } else {
      candidate = emailCandidate(await getAgentsByEmails(verifiedEmails));
    }
    const decision = decideFirstUseLink(facts, candidate);
    if (!decision.link) return null;
    const row = await linkRow(decision.agentId, user.id);
    if (row && marker !== row.id) await markClerkAccount(user.id, row.id);
    return row;
  } catch (error) {
    console.warn("[tenancy] first-use agent link failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/* ─── Isaac's "Invite" button ─────────────────────────────────────────────── */

export type InviteOutcome =
  | { kind: "invited"; email: string }
  | { kind: "linked"; agent: AgentRow; marked: boolean }
  | { kind: "refused"; reason: InviteRefusal; message: string }
  | { kind: "failed"; message: string };

function accountFact(user: User, email: string, linkedAgent: AgentRow | null, agentId: string): ClerkAccountFact {
  const address = (user.emailAddresses ?? []).find((e) => normalizeAgentEmail(e.emailAddress) === email);
  return {
    id: user.id,
    isAdmin: hasAdminRole(user.publicMetadata),
    listedOwner: isListedPlatformOwner(user.id),
    agentId: agentIdMarker(user.publicMetadata),
    emailVerified: address?.verification?.status === "verified",
    linkedToOtherAgent: Boolean(linkedAgent && linkedAgent.id !== agentId),
  };
}

/**
 * Invite the agent by email, or link the account that already has it. The invitation lands on
 * the agent area's dashboard on the main site, in the agent's language.
 */
export async function inviteOrLinkAgent(agent: AgentRow, locale: AgentAreaLocale): Promise<InviteOutcome> {
  const email = normalizeAgentEmail(agent.email);
  let client: Awaited<ReturnType<typeof clerkClient>>;
  let accounts: ClerkAccountFact[];
  try {
    client = await clerkClient();
    const { data: users } = await client.users.getUserList({ emailAddress: [email], limit: 10 });
    accounts = await Promise.all(
      users.map(async (user) => accountFact(user, email, await getAgentByClerkUserId(user.id), agent.id))
    );
  } catch (error) {
    console.error("[tenancy] invite lookup failed:", error instanceof Error ? error.message : error);
    return { kind: "failed", message: "Couldn't check Clerk for this email. Try again." };
  }

  const decision = decideAgentInvite(agent, accounts);
  if (decision.action === "refuse") {
    return { kind: "refused", reason: decision.reason, message: INVITE_REFUSAL_MESSAGES[decision.reason] };
  }

  if (decision.action === "invite") {
    try {
      await client.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { agentId: agent.id },
        redirectUrl: `${mainSiteUrl()}${agentAreaPath(locale)}`,
        // A second click re-sends to a pending invitation instead of failing; existing accounts
        // were ruled out above (they are linked instead).
        ignoreExisting: true,
        notify: true,
      });
      return { kind: "invited", email };
    } catch (error) {
      console.error("[tenancy] Clerk invitation failed:", error instanceof Error ? error.message : error);
      return { kind: "failed", message: "Clerk didn't accept the invitation. Check the email and the allowed redirect URLs." };
    }
  }

  try {
    const row = await linkRow(agent.id, decision.userId);
    if (!row) return { kind: "refused", reason: "already_linked", message: INVITE_REFUSAL_MESSAGES.already_linked };
    const marked = await markClerkAccount(decision.userId, agent.id);
    return { kind: "linked", agent: row, marked };
  } catch (error) {
    console.error("[tenancy] agent link failed:", error instanceof Error ? error.message : error);
    return { kind: "failed", message: "Couldn't link the account. Try again." };
  }
}

/* ─── the Clerk webhook ───────────────────────────────────────────────────── */

/**
 * May the account in this Clerk webhook payload go into Isaac's CRM? "skip" for an agent's,
 * "sync" for anyone else's, "retry" when the check failed (the webhook answers 503 and the event
 * comes back later). The marker needs no lookup. The payload is Clerk's JSON (snake_case): `id`,
 * `public_metadata`, `email_addresses[].email_address`.
 */
export async function clerkCrmSyncDecisionFor(data: Record<string, unknown>): Promise<ClerkCrmSyncDecision> {
  const marker = agentIdMarker(data.public_metadata);
  if (marker) return decideClerkCrmSync({ agentIdMarker: marker, agentRow: "no" });
  const id = typeof data.id === "string" ? data.id : "";
  const emails = Array.isArray(data.email_addresses)
    ? data.email_addresses.map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>).email_address : ""))
    : [];
  let agentRow: AgentRowMatch;
  try {
    agentRow = (await agentRowExistsForAccount(id, emails.filter((e): e is string => typeof e === "string"))) ? "yes" : "no";
  } catch (error) {
    console.warn("[tenancy] agent check for the CRM sync failed; asking Clerk to retry:", error instanceof Error ? error.message : error);
    agentRow = "unknown";
  }
  return decideClerkCrmSync({ agentIdMarker: null, agentRow });
}
