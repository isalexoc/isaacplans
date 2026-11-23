/**
 * Who is in the agent area (/agent, es /agente), for its pages and its API. Server-only.
 *
 * The agent area is for agents only: an admin (Isaac's role) is told so and pointed at
 * /admin/agents, an impersonated session is refused outright (the DPA promises Clerk impersonation
 * never reaches an agent's clients), and an account with no agent row is told it isn't linked.
 *
 * For a linked agent, in this order:
 *  1. the current terms and DPA must be accepted: every page but /agent/agreements redirects
 *     there until they are (lib/tenancy/agreements.ts);
 *  2. the applications (dashboard list, form, deck, summary) need the operator gate on the
 *     Health Coverage line (active; a test agent until TENANT_CLIENT_DATA is on). Until then the
 *     dashboard explains the agent's status and the application pages send them back to it.
 * Profile and agreements are open to a linked agent whatever their status (an invited agent
 * prepares their profile before Isaac activates them).
 */

import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { agentAreaPath, type AgentAreaLocale } from "./agent-area-routes";
import type { AgentRow } from "./agents";
import { getAgentContext, type IntakeOperator } from "./context";
import { readTenancyGates } from "./gates";
import { decideIntakeOperator, type OperatorDecision } from "./operator";

/** Agents work this line only (lib/tenancy/gates.ts). */
export const AGENT_AREA_LOB = "health-alternative";

export type AgentAreaState =
  | { kind: "signed_out" }
  | { kind: "admin" }
  | { kind: "impersonated" }
  | { kind: "not_agent" }
  | {
      kind: "agent";
      userId: string;
      agent: AgentRow;
      agreementsAccepted: boolean;
      /** The operator gate on the agent's line (applications). */
      operator: OperatorDecision;
    };

export type AgentAreaNoticeKind = Exclude<AgentAreaState["kind"], "agent">;

export async function agentAreaState(): Promise<AgentAreaState> {
  const ctx = await getAgentContext();
  if (!ctx.userId) return { kind: "signed_out" };
  if (ctx.isAdmin) return { kind: "admin" };
  if (ctx.actor) return { kind: "impersonated" };
  if (!ctx.agent) return { kind: "not_agent" };
  const operator = decideIntakeOperator(
    {
      userId: ctx.userId,
      isAdmin: false,
      agent: ctx.agent,
      impersonated: false,
      agreementsAccepted: ctx.agreementsAccepted,
    },
    AGENT_AREA_LOB,
    readTenancyGates()
  );
  return { kind: "agent", userId: ctx.userId, agent: ctx.agent, agreementsAccepted: ctx.agreementsAccepted, operator };
}

export type AgentAreaPageGate =
  | { kind: "agent"; userId: string; agent: AgentRow; operator: OperatorDecision }
  | { kind: "notice"; notice: AgentAreaNoticeKind };

/**
 * A page that needs a linked agent who accepted the agreements (profile, dashboard): a notice for
 * anyone else, a redirect to the agreements while they are missing.
 */
export async function agentAreaPage(locale: AgentAreaLocale): Promise<AgentAreaPageGate> {
  const state = await agentAreaState();
  if (state.kind !== "agent") return { kind: "notice", notice: state.kind };
  if (!state.agreementsAccepted) redirect(agentAreaPath(locale, "agreements"));
  return { kind: "agent", userId: state.userId, agent: state.agent, operator: state.operator };
}

/**
 * An application page (form, deck, summary): the agent as an operator, or a notice; an agent who
 * may not operate yet (invited, paused, gated) goes back to the dashboard, which says why.
 */
export async function agentOperatorPage(
  locale: AgentAreaLocale
): Promise<{ kind: "operator"; operator: IntakeOperator; agent: AgentRow } | { kind: "notice"; notice: AgentAreaNoticeKind }> {
  const gate = await agentAreaPage(locale);
  if (gate.kind === "notice") return gate;
  if (!gate.operator.ok) redirect(agentAreaPath(locale));
  return {
    kind: "operator",
    agent: gate.agent,
    operator: { userId: gate.userId, kind: "agent", isAdmin: false, agent: gate.agent, actor: null },
  };
}

/**
 * The agent area's API routes: the signed-in agent (linked, not impersonated, and with the
 * agreements accepted when `agreements` is asked), or the response to send back.
 */
export async function requireAgentApiCaller(opts: {
  agreements: boolean;
}): Promise<{ userId: string; agent: AgentRow } | NextResponse> {
  const state = await agentAreaState();
  if (state.kind === "signed_out") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (state.kind !== "agent") {
    return NextResponse.json({ success: false, error: "Forbidden", code: state.kind }, { status: 403 });
  }
  if (opts.agreements && !state.agreementsAccepted) {
    return NextResponse.json({ success: false, error: "Accept the agreements first.", code: "agreements" }, { status: 403 });
  }
  return { userId: state.userId, agent: state.agent };
}
