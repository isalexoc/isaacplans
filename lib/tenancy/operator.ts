/**
 * Who may act on the shared intake engine, as pure decisions (no I/O), so the offline tests can
 * walk the whole table: lib/tenancy/context.ts gathers the facts, these decide.
 *
 * Operators are admins (Clerk `role: "admin"`, i.e. Isaac and his team) and agents (a row in
 * `agents`). Agents work the Health Coverage line only, only while active, and only as test agents
 * until `TENANT_CLIENT_DATA` is on; an impersonated agent session is refused, so Clerk
 * impersonation can't be used to act as an agent on their clients.
 *
 * On a token route a signed-in operator who isn't the session's owner is denied, audited, and never
 * claims the session. Everyone else who isn't the owner keeps the token + device-cookie rule of
 * lib/intake-shared/access.ts.
 *
 * Whatever couldn't be established (an `agents` lookup that failed for a reason other than the
 * table not existing yet) fails closed as "retry" (503): never as "not an agent", which would open
 * a paused agent's applications or hand an impersonated session the owner's view.
 */

import { resolveIntakeAccess, type IntakeAccess, type IntakeAccessRow } from "@/lib/intake-shared/access";
import { agentMayOperate, isAgentLob, type AgentGateFields, type TenancyGates } from "./gates";
import type { AppSurface } from "./surface";

export type OperatorKind = "admin" | "agent";

export type OperatorFacts = {
  userId: string | null;
  /** Clerk `publicMetadata.role === "admin"`. Admins are never looked up as agents. */
  isAdmin: boolean;
  /** The caller's `agents` row, if they have one. */
  agent: AgentGateFields | null;
  /** The request comes from a Clerk impersonation session (`actor` claim). */
  impersonated: boolean;
};

export type OperatorDenial = "signed_out" | "not_operator" | "impersonated" | "line" | "inactive";

export type OperatorDecision =
  | { ok: true; kind: OperatorKind }
  | { ok: false; status: 401 | 403; reason: OperatorDenial };

/** May this caller use the operator routes (dashboard, create, reset, deck…) of this line? */
export function decideIntakeOperator(
  facts: OperatorFacts,
  lob: string,
  gates: TenancyGates
): OperatorDecision {
  if (!facts.userId) return { ok: false, status: 401, reason: "signed_out" };
  if (facts.isAdmin) return { ok: true, kind: "admin" };
  if (!facts.agent) return { ok: false, status: 403, reason: "not_operator" };
  if (facts.impersonated) return { ok: false, status: 403, reason: "impersonated" };
  if (!isAgentLob(lob)) return { ok: false, status: 403, reason: "line" };
  if (!agentMayOperate(facts.agent, gates)) return { ok: false, status: 403, reason: "inactive" };
  return { ok: true, kind: "agent" };
}

/**
 * The session owner as an agent: their `agents` row, null when the owner is not an agent (listed
 * in env as Isaac's, no row, or no `agents` table yet), or "unknown" when the lookup failed.
 */
export type OwnerAgentFact = AgentGateFields | null | "unknown";

/**
 * When the session's owner is an agent: "ok" (carry on with the usual rules), "deny" (403 and an
 * audit row: the agent themself, while paused, gated off, impersonated or on another line), or
 * "unavailable" (404 for anyone else: that agent's applications are closed right now).
 */
export type AgentSessionVerdict = "ok" | "deny" | "unavailable";

export function decideAgentSessionAccess(input: {
  lob: string;
  /** The owner's `agents` row; null when the owner is not an agent. */
  ownerAgent: AgentGateFields | null;
  callerIsOwner: boolean;
  impersonated: boolean;
  gates: TenancyGates;
}): AgentSessionVerdict {
  if (!input.ownerAgent) return "ok";
  const open = isAgentLob(input.lob) && agentMayOperate(input.ownerAgent, input.gates);
  if (input.callerIsOwner) return open && !input.impersonated ? "ok" : "deny";
  return open ? "ok" : "unavailable";
}

/**
 * A signed-in caller who isn't the owner, as classified by lib/tenancy/context.ts. "unknown": the
 * agent lookup failed, so they are treated as an operator (they can't claim) and, where that is
 * all that stands between them and the session, asked to retry.
 */
export type SignedInCallerKind = "admin" | "agent" | "client" | "unknown";

/** Only a plain client may claim. An impersonated session is someone else acting: never a claim. */
export function callerIsOperator(kind: SignedInCallerKind, impersonated: boolean): boolean {
  return kind !== "client" || impersonated;
}

export type TokenAccessInput = {
  lob: string;
  row: IntakeAccessRow;
  userId: string | null;
  deviceId: string | null;
  impersonated: boolean;
  /** How a signed-in non-owner was classified. Ignored for the owner and for anonymous callers. */
  callerKind: SignedInCallerKind;
  ownerAgent: OwnerAgentFact;
  /** The product domain serves agents' applications only; Isaac's are a 404 there. */
  surface: AppSurface;
  gates: TenancyGates;
};

export type TokenAccessDecision =
  | { outcome: "allow"; access: IntakeAccess }
  | { outcome: "deny"; audit: boolean; claimedByOtherDevice: boolean }
  | { outcome: "unavailable" }
  /** Something needed for the decision couldn't be read: 503, nothing claimed, nothing audited. */
  | { outcome: "retry" };

const AUDITED_DENIAL: TokenAccessDecision = { outcome: "deny", audit: true, claimedByOtherDevice: false };

/** The whole token-route rule: agent-session gate first, then the token + device rule. */
export function decideTokenAccess(input: TokenAccessInput): TokenAccessDecision {
  // Is the owner an agent whose applications are closed, or is an impersonated "owner" acting on
  // an agent's clients? Unknown, so neither can be ruled out.
  if (input.ownerAgent === "unknown") return { outcome: "retry" };
  // Client access happens only on the owner's surface: Isaac's tokens never on the product domain.
  if (input.surface === "product" && !input.ownerAgent) return { outcome: "unavailable" };

  const callerIsOwner = Boolean(input.userId) && input.userId === input.row.ownerUserId;
  const verdict = decideAgentSessionAccess({
    lob: input.lob,
    ownerAgent: input.ownerAgent,
    callerIsOwner,
    impersonated: input.impersonated,
    gates: input.gates,
  });
  if (verdict === "deny") return AUDITED_DENIAL;

  const operator =
    Boolean(input.userId) && !callerIsOwner && callerIsOperator(input.callerKind, input.impersonated);
  const access = resolveIntakeAccess(input.row, {
    userId: input.userId,
    deviceId: input.deviceId,
    operator,
  });
  // Turned away only for being a possible operator, which the failed lookup couldn't settle: retry.
  // An impersonated caller is never a claim, whatever the lookup says.
  const operatorDenial: TokenAccessDecision =
    input.callerKind === "unknown" && !input.impersonated ? { outcome: "retry" } : AUDITED_DENIAL;

  // A closed agent session is a 404 for its clients; an operator reaching it still gets the
  // audited denial every other operator gets.
  if (verdict === "unavailable") {
    return access.operatorDenied ? operatorDenial : { outcome: "unavailable" };
  }
  if (access.allowed) return { outcome: "allow", access };
  if (access.operatorDenied) return operatorDenial;
  return { outcome: "deny", audit: false, claimedByOtherDevice: access.claimedByOtherDevice };
}

/**
 * The secure link (no session token, no sign-in): may the client's data flow into this owner's
 * application here? "accept"; "closed" (404: an agent paused or gated off, or one of Isaac's
 * applications on the product domain); "retry" (503: the owner lookup failed).
 */
export type ClientDataVerdict = "accept" | "closed" | "retry";

export function decideClientDataFlow(input: {
  lob: string;
  ownerAgent: OwnerAgentFact;
  surface: AppSurface;
  gates: TenancyGates;
}): ClientDataVerdict {
  if (input.ownerAgent === "unknown") return "retry";
  if (!input.ownerAgent) return input.surface === "product" ? "closed" : "accept";
  return isAgentLob(input.lob) && agentMayOperate(input.ownerAgent, input.gates) ? "accept" : "closed";
}
