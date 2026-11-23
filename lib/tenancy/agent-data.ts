/**
 * The agent platform's rules for its clients' data, as pure decisions (the routes apply them, and
 * `pnpm test:agent-data` walks them). Isaac's own applications are never touched by any of this:
 * every rule below starts from "the session's owner is an agent".
 *
 *  - Masked by default: an agent's own view of their client's application gets masks for every
 *    sensitive value (scalars and repeater sub-fields), like the client's browser. One value at a
 *    time comes back through `POST …/reveal`: the owning agent only, never while impersonated,
 *    audited (lib/tenancy/audit.ts, the field's name only). Isaac's owner view stays unmasked.
 *  - Hidden platform keys in `intake_sessions.data` (no migration): `agentAlerts` (which alerts
 *    went out), `enteredInImpactAt` (the agent's "Entered in Impact"), `sensitivePurgedAt` (when the
 *    sensitive values were erased). The server writes them; a save can't (`withoutPlatformKeys`),
 *    and the client's browser is never sent them. The config never lists them, so the CRM payload,
 *    the summary and the completion check never see them.
 *  - Alerts to the agent (no client details): the first client save once the application has an
 *    email or phone, completion, and a secure-link submit (lib/tenancy/agent-jobs.ts).
 *  - Impact isn't available in Rhode Island or Washington: an agent's application with a home
 *    address there can't be submitted (lib/impact-disclosures/availability.ts).
 *  - The sensitive values are erased when the agent marks the application "entered in Impact", or
 *    30 days after completion by a QStash job that hops in steps QStash's plan allows, with the
 *    daily reconcile as its backstop (lib/tenancy/agent-jobs.ts `reconcileAgentPurges`).
 */

import { sensitiveRowKeys, sensitiveScalarKeys, fieldByKey } from "@/lib/intake-core/fields";
import type { IntakeData, IntakeSection } from "@/lib/intake-core/types";
import { impactUnavailableIn } from "@/lib/impact-disclosures/availability";

/* ─── hidden platform keys ─────────────────────────────────────────────────── */

export const AGENT_ALERTS_KEY = "agentAlerts";
export const ENTERED_IN_IMPACT_KEY = "enteredInImpactAt";
export const SENSITIVE_PURGED_KEY = "sensitivePurgedAt";

export const PLATFORM_DATA_KEYS: readonly string[] = [AGENT_ALERTS_KEY, ENTERED_IN_IMPACT_KEY, SENSITIVE_PURGED_KEY];

/** The answers without the platform's own keys (a new object). */
export function withoutPlatformKeys(data: IntakeData): IntakeData {
  const out: IntakeData = { ...data };
  for (const key of PLATFORM_DATA_KEYS) delete out[key];
  return out;
}

/* ─── who sees what ────────────────────────────────────────────────────────── */

export type CallerRole = "owner" | "client";

/**
 * Does this caller get masks instead of the sensitive values? The client's browser always does; the
 * owner does when the owner is an agent (Isaac's owner view is unchanged: the values).
 */
export function sensitiveMasked(input: { role: CallerRole; ownerIsAgent: boolean }): boolean {
  return input.role === "client" || input.ownerIsAgent;
}

/**
 * Reveal one value, or erase them all ("Entered in Impact"): the owning agent, in person. Checked
 * after the token route's own rule (lib/tenancy/operator.ts `decideTokenAccess`) let the request
 * in, which already refuses other operators (Isaac included), a paused or gated agent, an agent who
 * hasn't accepted the current agreements, and an impersonated owner; this refuses the rest (the
 * client, Isaac on his own sessions, and impersonation again).
 */
export function agentOwnerMayActOnSensitive(input: {
  role: CallerRole;
  ownerIsAgent: boolean;
  impersonated: boolean;
}): boolean {
  return input.role === "owner" && input.ownerIsAgent && !input.impersonated;
}

/**
 * The reveal and purge routes take JSON only, compared as the exact media type: a page on another
 * site can't send `application/json` without a CORS preflight, which these routes never answer
 * (a substring check would let `text/plain;application/json` through, which needs none).
 */
export function isJsonContentType(contentType: string | null): boolean {
  return (contentType ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * The browser says the request came from this site's own pages (`Sec-Fetch-Site: same-origin`), or
 * says nothing (not a browser, or one too old to send it, neither of which carries the agent's
 * session cookie cross-site). Anything else (cross-site, same-site, a navigation) is refused.
 */
export function sameOriginFetch(secFetchSite: string | null): boolean {
  return secFetchSite === null || secFetchSite === "same-origin";
}

/* ─── reveal: which value ──────────────────────────────────────────────────── */

export type RevealTarget =
  | { kind: "scalar"; key: string }
  | { kind: "row"; repeaterKey: string; subKey: string; rowIndex: number };

const DEFAULT_MAX_ROWS = 8;

/**
 * `{ field, rowIndex? }` from a reveal request: a sensitive scalar ("ssn"), or a sensitive sub-field
 * of a repeater as "repeater.sub" with the row's index ("dependents.ssn", 1). Anything else is null.
 */
export function parseRevealTarget(sections: IntakeSection[], body: unknown): RevealTarget | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { field, rowIndex } = body as { field?: unknown; rowIndex?: unknown };
  if (typeof field !== "string" || field.length > 100) return null;
  const parts = field.split(".");
  if (parts.length === 1) {
    if (rowIndex !== undefined && rowIndex !== null) return null;
    return sensitiveScalarKeys(sections).includes(field) ? { kind: "scalar", key: field } : null;
  }
  if (parts.length !== 2) return null;
  const [repeaterKey, subKey] = parts;
  const pair = sensitiveRowKeys(sections).find(([key]) => key === repeaterKey);
  if (!pair || !pair[1].includes(subKey)) return null;
  const maxRows = fieldByKey(sections, repeaterKey)?.maxRows ?? DEFAULT_MAX_ROWS;
  if (typeof rowIndex !== "number" || !Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= maxRows) return null;
  return { kind: "row", repeaterKey, subKey, rowIndex };
}

/** The field's name as the audit log records it: "ssn", "dependents.ssn" (never a value). */
export function revealFieldName(target: RevealTarget): string {
  return target.kind === "scalar" ? target.key : `${target.repeaterKey}.${target.subKey}`;
}

/** The stored (still encrypted) value at the target, or undefined. */
export function revealStoredValue(target: RevealTarget, data: IntakeData): unknown {
  if (target.kind === "scalar") return data[target.key];
  const rows = data[target.repeaterKey];
  if (!Array.isArray(rows)) return undefined;
  const row = rows[target.rowIndex];
  return row && typeof row === "object" ? (row as Record<string, unknown>)[target.subKey] : undefined;
}

/* ─── alerts ───────────────────────────────────────────────────────────────── */

export const AGENT_ALERT_KINDS = ["started", "completed", "secure_submit"] as const;
export type AgentAlertKind = (typeof AGENT_ALERT_KINDS)[number];

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Is a save the one that tells the agent "a client started an application"? A save by the CLIENT
 * (the agent's own typing is not news), once the application holds an email or phone (an anonymous
 * start, or a link-preview bot, is not a client yet), and only the first time: the flag
 * `agentAlerts.started` is claimed in one statement before the alert is queued.
 */
export function alertStartedDue(input: { role: CallerRole; data: IntakeData }): boolean {
  if (input.role !== "client") return false;
  if (!str(input.data.email) && !str(input.data.phone)) return false;
  const alerts = input.data[AGENT_ALERTS_KEY];
  const started = alerts && typeof alerts === "object" ? (alerts as Record<string, unknown>).started : undefined;
  return !started;
}

/** One event's key: "started", "completed:<completedAt ms>", "secure_submit:<capture id>". */
export function alertEventKey(kind: AgentAlertKind, ref?: string | number | null): string {
  if (kind === "started") return "started";
  return `${kind}:${String(ref ?? "")}`;
}

/** The flag in `data.agentAlerts` that says this event's email went out. */
export function alertSentFlag(event: string): string {
  return `sent:${event}`;
}

export type AgentAlertJob = { kind: AgentAlertKind; lob: string; sessionId: string; event: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const EVENT = /^[a-z_]+(?::[A-Za-z0-9_-]{1,64})?$/;

/** A queued alert as the notify route receives it, or null when malformed. */
export function parseAgentAlertJob(body: unknown): AgentAlertJob | null {
  if (!body || typeof body !== "object") return null;
  const { kind, lob, sessionId, event } = body as Record<string, unknown>;
  if (typeof kind !== "string" || !(AGENT_ALERT_KINDS as readonly string[]).includes(kind)) return null;
  if (typeof lob !== "string" || !/^[a-z-]{2,40}$/.test(lob)) return null;
  if (typeof sessionId !== "string" || !ID.test(sessionId)) return null;
  if (typeof event !== "string" || !EVENT.test(event) || !event.startsWith(kind)) return null;
  return { kind: kind as AgentAlertKind, lob, sessionId, event };
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Where the agent's alerts go: their alert email, else their contact email, else their login email. */
export function agentAlertAddress(agent: {
  alertEmail: string | null;
  contactEmail: string | null;
  email: string | null;
}): string | null {
  for (const candidate of [agent.alertEmail, agent.contactEmail, agent.email]) {
    const value = str(candidate);
    if (value && value.length <= 254 && EMAIL.test(value)) return value;
  }
  return null;
}

/* ─── Rhode Island and Washington ──────────────────────────────────────────── */

/** An agent's application with a home address where Impact isn't available can't be submitted. */
export function agentApplicationBlocked(input: { ownerIsAgent: boolean; state: unknown }): boolean {
  return input.ownerIsAgent && impactUnavailableIn(input.state);
}

/* ─── purge after 30 days ──────────────────────────────────────────────────── */

export const AGENT_PURGE_AFTER_DAYS = 30;

/** QStash's free plan caps a delay at 7 days: a job hops in steps under that until it is due. */
export const AGENT_JOB_MAX_DELAY_SECONDS = 6 * 86_400;

/** When the sensitive values of an application completed at `completedAt` are erased (unix seconds). */
export function agentPurgeDueAt(completedAt: Date): number {
  return Math.floor(completedAt.getTime() / 1000) + AGENT_PURGE_AFTER_DAYS * 86_400;
}

/** The next hop's delay, or null once the job is due (a minute's slack for clock skew). */
export function purgeHopDelaySeconds(dueAt: number, nowSeconds: number): number | null {
  const remaining = dueAt - nowSeconds;
  if (remaining <= 60) return null;
  return Math.min(Math.ceil(remaining), AGENT_JOB_MAX_DELAY_SECONDS);
}

/**
 * Has a later completion replaced this purge job? Reopening keeps an application "completed";
 * completing it again moves `completedAt` and queues a new purge 30 days from then, so the older
 * job (still hopping) stands down rather than erase what the client just corrected, possibly while
 * they are still at it (a minute's slack, as for the hops). With no completion date on file the
 * job keeps its own date.
 */
export function agentPurgeSuperseded(jobDueAt: number, completedAt: Date | null): boolean {
  return completedAt !== null && agentPurgeDueAt(completedAt) > jobDueAt + 60;
}

export type AgentPurgeJob = { lob: string; sessionId: string; dueAt: number };

/** A queued purge as the purge route receives it, or null when malformed. */
export function parseAgentPurgeJob(body: unknown): AgentPurgeJob | null {
  if (!body || typeof body !== "object") return null;
  const { lob, sessionId, dueAt } = body as Record<string, unknown>;
  if (typeof lob !== "string" || !/^[a-z-]{2,40}$/.test(lob)) return null;
  if (typeof sessionId !== "string" || !ID.test(sessionId)) return null;
  if (typeof dueAt !== "number" || !Number.isFinite(dueAt) || dueAt <= 0) return null;
  return { lob, sessionId, dueAt: Math.floor(dueAt) };
}
