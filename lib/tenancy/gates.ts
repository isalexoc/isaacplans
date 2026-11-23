/**
 * Launch gates for the agent platform, enforced on the server. All three are OFF unless the env var
 * is exactly one of "true", "1", "on" or "yes" (any case), so an unset or mistyped value keeps the
 * platform closed.
 *
 *  - `TENANT_PUBLIC_PAGES`: agents' public guide and "Apply" on the product domain.
 *  - `TENANT_CLIENT_DATA`: real client data in agents' applications.
 *  - `LEAD_STORE`: the paid lead store (Phase 2; nothing reads it yet).
 *
 * While a gate is off, only `is_test` agents (fake data, preview deployment) get through it. They stay
 * off in production until ACN approves in writing, and `TENANT_CLIENT_DATA` must not go on before
 * two later pieces land: the ToS/DPA click-through check in `agentMayOperate` and masked-by-default
 * sensitive values (with an audited reveal) for agent owners. Until then an agent owner sees their
 * own clients' values in full, which is acceptable only for test agents with fake data.
 *
 * Pure (env reads only, no server-only import) so the offline tests can import it.
 */

export type TenancyGates = {
  publicPages: boolean;
  clientData: boolean;
  leadStore: boolean;
};

const ON = new Set(["true", "1", "on", "yes"]);

export function parseGateFlag(value: string | null | undefined): boolean {
  return typeof value === "string" && ON.has(value.trim().toLowerCase());
}

export function readTenancyGates(env: Record<string, string | undefined> = process.env): TenancyGates {
  return {
    publicPages: parseGateFlag(env.TENANT_PUBLIC_PAGES),
    clientData: parseGateFlag(env.TENANT_CLIENT_DATA),
    leadStore: parseGateFlag(env.LEAD_STORE),
  };
}

export const AGENT_STATUSES = ["invited", "active", "paused"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** The parts of an `agents` row the gates look at. */
export type AgentGateFields = { status: string; isTest: boolean };

/**
 * Agents work the Health Coverage (Impact) line only. The engine's other lines are insurance
 * intakes, and the IBOs buying in may not be licensed.
 */
export const AGENT_LOBS: readonly string[] = ["health-alternative"];

export function isAgentLob(lob: string): boolean {
  return AGENT_LOBS.includes(lob);
}

/**
 * May this agent operate (dashboard, their own applications, deck), and may client data flow into
 * their applications? Active, and either a test agent or `TENANT_CLIENT_DATA` on.
 */
export function agentMayOperate(agent: AgentGateFields, gates: TenancyGates): boolean {
  return agent.status === "active" && (agent.isTest || gates.clientData);
}

/**
 * May this agent's public "Apply" start new applications? Both gates are involved: the page is
 * public (`TENANT_PUBLIC_PAGES`) and it creates client data (`TENANT_CLIENT_DATA`).
 */
export function agentTakesApplications(agent: AgentGateFields, gates: TenancyGates): boolean {
  return agent.status === "active" && (agent.isTest || (gates.publicPages && gates.clientData));
}
