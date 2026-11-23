/**
 * Who is calling, as the agent platform sees it, and the operator gate for the intake engine.
 * Server-only (Clerk + database).
 *
 * Isaac's own requests cost nothing new here: an admin is never looked up in `agents`, and a
 * session owner listed in env (lib/tenancy/crm-allowlist.ts) is never looked up either. Every read
 * of the new tables tolerates 0046 not being applied yet ("no agent"); any other failed read is
 * "unknown", which the decisions in lib/tenancy/operator.ts fail closed.
 */

import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getAgentByClerkUserId, lookupAgentByClerkUserId, type AgentRow } from "./agents";
import { logSensitiveAccess, type SensitiveAccessActorRole } from "./audit";
import { clerkAdminStatus } from "./clerk-admin";
import { isListedPlatformOwner, type CrmOwnerOptions } from "./crm";
import { readTenancyGates } from "./gates";
import {
  decideClientDataFlow,
  decideIntakeOperator,
  type ClientDataVerdict,
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
};

/**
 * The caller: Clerk id, admin role (the live check every admin route already used), their `agents`
 * row if they have one, and the impersonation actor. A failed agent lookup counts as no agent, so
 * it can only take access away.
 */
export async function getAgentContext(): Promise<AgentContext> {
  const { userId, actor } = await requestIdentity();
  if (!userId) return { userId: null, isAdmin: false, agent: null, actor: null };
  const isAdmin = await getIsAdmin();
  let agent: AgentRow | null = null;
  if (!isAdmin) {
    try {
      agent = await getAgentByClerkUserId(userId);
    } catch (error) {
      console.warn("[tenancy] agent lookup failed:", error instanceof Error ? error.message : error);
    }
  }
  return { userId, isAdmin, agent, actor };
}

export type IntakeOperator = {
  userId: string;
  kind: OperatorKind;
  isAdmin: boolean;
  agent: AgentRow | null;
  actor: ImpersonationActor | null;
};

export type IntakeOperatorResult =
  | { ok: true; operator: IntakeOperator }
  | { ok: false; status: 401 | 403 };

/**
 * The operator gate for pages (which redirect rather than answer JSON): an admin, or an active agent
 * (a test agent while `TENANT_CLIENT_DATA` is off) on the Health Coverage line, not impersonated.
 */
export async function getIntakeOperator(lob: string): Promise<IntakeOperatorResult> {
  const ctx = await getAgentContext();
  const decision = decideIntakeOperator(
    { userId: ctx.userId, isAdmin: ctx.isAdmin, agent: ctx.agent, impersonated: Boolean(ctx.actor) },
    lob,
    readTenancyGates()
  );
  if (!decision.ok || !ctx.userId) return { ok: false, status: decision.ok ? 401 : decision.status };
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
 * themself (lib/tenancy/crm.ts step 3). That is safe only because agents are never Clerk admins;
 * the agent-linking flow must refuse to link an admin or a listed id (a later chunk).
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
