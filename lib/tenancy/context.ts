/**
 * Who is calling, as the agent platform sees it, and the operator gate for the intake engine.
 * Server-only (Clerk + database).
 *
 * Isaac's own requests cost nothing new here: an admin listed in env (lib/tenancy/crm-allowlist.ts)
 * is never looked up in `agents` (an admin who isn't listed is, once per request, so an agent given
 * the role by mistake stays an agent), and a session owner listed in env is never looked up either.
 * Every read of the new tables tolerates 0046 not being applied yet ("no agent"); any other failed
 * read is "unknown", which the decisions in lib/tenancy/operator.ts fail closed.
 */

import "server-only";
import { cache } from "react";
import { NextResponse } from "next/server";
import { auth, currentUser, type User } from "@clerk/nextjs/server";
import { linkAgentOnFirstUse, markClerkAccount } from "./agent-accounts";
import { agentIdMarker, isPlatformAdminMetadata } from "./agent-linking";
import { getAgentByClerkUserId, lookupAgentByClerkUserId, type AgentRow } from "./agents";
import { agentAgreementsAccepted } from "./agreements-store";
import { logSensitiveAccess, type SensitiveAccessActorRole } from "./audit";
import { clerkAdminStatus } from "./clerk-admin";
import { isListedPlatformOwner, type CrmOwnerOptions } from "./crm";
import { readTenancyGates } from "./gates";
import {
  decideClientDataFlow,
  decideIntakeOperator,
  type ClientDataVerdict,
  type OperatorDenial,
  type OperatorKind,
  type SignedInCallerKind,
} from "./operator";
import { appSurface, isProductSurface } from "./surface";

/** The Clerk impersonation actor: who is really driving an impersonated session. */
export type ImpersonationActor = { sub: string };

export type RequestIdentity = { userId: string | null; actor: ImpersonationActor | null };

/**
 * The signed-in Clerk user and impersonation actor. The product surface has no sign-in (agents
 * work on the main site), so there every caller is anonymous and Clerk is never called.
 */
export async function requestIdentity(): Promise<RequestIdentity> {
  if (isProductSurface()) return { userId: null, actor: null };
  const { userId, actor } = await auth();
  const sub = typeof actor?.sub === "string" && actor.sub ? actor.sub : null;
  return { userId: userId ?? null, actor: sub ? { sub } : null };
}

export type AgentContext = {
  userId: string | null;
  isAdmin: boolean;
  agent: AgentRow | null;
  actor: ImpersonationActor | null;
  /**
   * The agent has accepted the current terms and DPA (lib/tenancy/agreements.ts). Admins are not
   * asked (true); false for anyone without an agent row, and when the read failed.
   */
  agreementsAccepted: boolean;
};

/** The signed-in account, from Clerk's API (one call), or null if it can't be read. */
async function signedInAccount(): Promise<User | null> {
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

/**
 * The caller: Clerk id, admin role (`publicMetadata.role === "admin"`, the live check every admin
 * route already used), their `agents` row if they have one, the impersonation actor, and whether
 * they accepted the agreements. A failed agent lookup counts as no agent, so it can only take access
 * away.
 *
 * The agent link outranks the admin role, both ways it can show: an account carrying the agent
 * marker is never an admin (`isPlatformAdminMetadata`, as middleware and `getIsAdmin` read it), and
 * an admin-role account that isn't one of Isaac's listed ids is looked up in `agents` first: linked
 * to a row (a marker that never stuck, then the role given by mistake), it is that agent, never an
 * admin, so it never gets an admin's operator rights or vouches for Isaac's CRM. If that lookup
 * fails, the account is neither for this request. Isaac's listed ids are never looked up (linking
 * refuses them), so his requests cost nothing new.
 *
 * A signed-in account with no agent row is linked here on first use when it was invited, or has
 * the verified email of an agent row nobody holds yet (lib/tenancy/agent-accounts.ts). Never for an
 * admin, one of Isaac's listed ids, or an impersonated session.
 *
 * One answer per request (React's per-render cache): the agent area's frame and its page share it.
 */
export const getAgentContext = cache(async (): Promise<AgentContext> => {
  const { userId, actor } = await requestIdentity();
  if (!userId) return { userId: null, isAdmin: false, agent: null, actor: null, agreementsAccepted: false };
  const account = await signedInAccount();
  const adminRole = isPlatformAdminMetadata(account?.publicMetadata);
  if (adminRole && isListedPlatformOwner(userId)) {
    return { userId, isAdmin: true, agent: null, actor, agreementsAccepted: true };
  }
  let agent: AgentRow | null = null;
  let lookupFailed = false;
  try {
    agent = await getAgentByClerkUserId(userId);
    if (!agent && !adminRole && account && account.id === userId) {
      agent = await linkAgentOnFirstUse(account, { impersonated: Boolean(actor) });
    } else if (agent && account && account.id === userId && !actor && agentIdMarker(account.publicMetadata) !== agent.id) {
      // Linked, but the account lost (or never got) its marker, e.g. Clerk refused the write when
      // Isaac linked it: add it back (merged, never touching `role`). Best effort, once it sticks.
      await markClerkAccount(userId, agent.id);
    }
  } catch (error) {
    lookupFailed = true;
    console.warn("[tenancy] agent lookup failed:", error instanceof Error ? error.message : error);
  }
  if (adminRole && !agent) {
    // An admin who is no agent; or, when the lookup failed, nothing this request (fails closed).
    return lookupFailed
      ? { userId, isAdmin: false, agent: null, actor, agreementsAccepted: false }
      : { userId, isAdmin: true, agent: null, actor, agreementsAccepted: true };
  }
  if (adminRole && agent) {
    console.error(`[tenancy] the Clerk account linked to agent ${agent.id} has the admin role: it is treated as that agent. Remove the role in Clerk.`);
  }
  const agreementsAccepted = agent ? await agentAgreementsAccepted(agent.id) : false;
  return { userId, isAdmin: false, agent, actor, agreementsAccepted };
});

export type IntakeOperator = {
  userId: string;
  kind: OperatorKind;
  isAdmin: boolean;
  agent: AgentRow | null;
  actor: ImpersonationActor | null;
};

export type IntakeOperatorResult =
  | { ok: true; operator: IntakeOperator }
  | { ok: false; status: 401 | 403; reason: OperatorDenial };

/**
 * The operator gate for pages (which redirect rather than answer JSON): an admin, or an active agent
 * (a test agent while `TENANT_CLIENT_DATA` is off) on the Health Coverage line, not impersonated,
 * who has accepted the current terms and DPA.
 */
export async function getIntakeOperator(lob: string): Promise<IntakeOperatorResult> {
  const ctx = await getAgentContext();
  const decision = decideIntakeOperator(
    {
      userId: ctx.userId,
      isAdmin: ctx.isAdmin,
      agent: ctx.agent,
      impersonated: Boolean(ctx.actor),
      agreementsAccepted: ctx.agreementsAccepted,
    },
    lob,
    readTenancyGates()
  );
  if (!decision.ok) return { ok: false, status: decision.status, reason: decision.reason };
  if (!ctx.userId) return { ok: false, status: 401, reason: "signed_out" };
  return {
    ok: true,
    operator: {
      userId: ctx.userId,
      kind: decision.kind,
      isAdmin: ctx.isAdmin,
      agent: ctx.agent,
      actor: ctx.actor,
    },
  };
}

/** The operator gate for API routes: the operator, or the 401/403 response to send back. */
export async function requireIntakeOperator(lob: string): Promise<IntakeOperator | NextResponse> {
  const result = await getIntakeOperator(lob);
  if (result.ok) return result.operator;
  return result.status === 401
    ? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    : NextResponse.json({ success: false, error: "Forbidden", code: "forbidden" }, { status: 403 });
}

/**
 * CRM options for a route where the operator acts on their own session: an admin vouches for
 * themself (lib/tenancy/crm.ts step 3). That is safe only because agents are never Clerk admins:
 * the agent-linking flow refuses to link an admin or a listed id (lib/tenancy/agent-linking.ts).
 */
export function operatorCrmOptions(op: IntakeOperator): CrmOwnerOptions {
  return { adminCaller: op.kind === "admin" ? op.userId : null };
}

/** Write a "denied" row: a signed-in caller reached a session they don't own. */
export async function logDeniedAccess(input: {
  actorUserId: string;
  actorRole: SensitiveAccessActorRole;
  actor: ImpersonationActor | null;
  row: { id: string; ownerUserId: string };
}): Promise<void> {
  await logSensitiveAccess({
    action: "denied",
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    impersonatorUserId: input.actor?.sub ?? null,
    ownerUserId: input.row.ownerUserId,
    sessionId: input.row.id,
  });
}

/**
 * Does this operator own the session? If not, the denial is audited; the caller then answers 403
 * (an API route) or 404 (a page). One rule for every operator route, admins included: with several
 * operators, nobody acts on another's session.
 */
export async function operatorOwns(
  op: IntakeOperator,
  row: { id: string; ownerUserId: string }
): Promise<boolean> {
  if (row.ownerUserId === op.userId) return true;
  await logDeniedAccess({ actorUserId: op.userId, actorRole: op.kind, actor: op.actor, row });
  return false;
}

/**
 * The owner's `agents` row when the session belongs to an agent; null when it doesn't (an owner
 * listed in env, i.e. Isaac, with no lookup at all; no row; no `agents` table before 0046); and
 * "unknown" when the lookup failed. "unknown" is never read as "not an agent": the callers fail
 * it closed (503), and it can't happen to a listed owner.
 */
export async function ownerAgentOf(ownerUserId: string): Promise<AgentRow | null | "unknown"> {
  if (isListedPlatformOwner(ownerUserId)) return null;
  const found = await lookupAgentByClerkUserId(ownerUserId);
  if (found.kind === "unknown") return "unknown";
  return found.kind === "agent" ? found.agent : null;
}

/**
 * A signed-in caller who is NOT the session's owner (and not already its bound client): an
 * operator (admin, agent, or "unknown" when a lookup failed) never claims; a plain client keeps
 * today's rule. Agents are caught by the database lookup. If Clerk can't be asked about the admin
 * role, the caller stays a client on Isaac's applications (today's behavior), but is "unknown" on
 * an agent's (`ownerIsAgent`), so an admin can't claim an agent's client's link during an outage.
 */
export async function classifySignedInCaller(
  userId: string,
  opts: { ownerIsAgent?: boolean } = {}
): Promise<SignedInCallerKind> {
  if (isListedPlatformOwner(userId)) return "admin";
  const found = await lookupAgentByClerkUserId(userId);
  if (found.kind === "agent") return "agent";
  if (found.kind === "unknown") return "unknown";
  const status = await clerkAdminStatus(userId);
  if (status === null) return opts.ownerIsAgent ? "unknown" : "client";
  return status.admin ? "admin" : "client";
}

/**
 * For the endpoints a client reaches with no session token (the secure link): may client data
 * flow into this owner's application on this deployment? On isaacplans.com always for a session
 * that isn't an agent's; on the product domain only for an agent's. See `decideClientDataFlow`.
 */
export async function ownerAcceptsClientData(lob: string, ownerUserId: string): Promise<ClientDataVerdict> {
  return decideClientDataFlow({
    lob,
    ownerAgent: await ownerAgentOf(ownerUserId),
    surface: appSurface(),
    gates: readTenancyGates(),
  });
}
