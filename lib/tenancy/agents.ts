/**
 * Reads of the `agents` table (migration 0046). Server-only.
 *
 * Every read tolerates the table not existing yet: before `pnpm db:migrate 0046` runs, the answer is
 * "no agent", which is exactly true then. The getters rethrow any other database error so a caller
 * can fail closed; `lookupAgentByClerkUserId` never throws and says "unknown" instead, for the
 * per-request access checks that must decide either way.
 */

import "server-only";
import { asc, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { normalizeAgentEmail } from "./agent-linking";
import { isMissingTableError } from "./db-errors";
import { normalizeAgentSlug } from "./slug-format";

export type AgentRow = typeof agents.$inferSelect;

async function findAgent(where: SQL): Promise<AgentRow | null> {
  try {
    const [row] = await db.select().from(agents).where(where).limit(1);
    return row ?? null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

export async function getAgentByClerkUserId(clerkUserId: string): Promise<AgentRow | null> {
  const id = clerkUserId.trim();
  return id ? findAgent(eq(agents.clerkUserId, id)) : null;
}

export async function getAgentBySlug(slug: string): Promise<AgentRow | null> {
  const value = normalizeAgentSlug(slug);
  return value ? findAgent(eq(agents.slug, value)) : null;
}

export async function getAgentById(id: string): Promise<AgentRow | null> {
  const value = id.trim();
  return value ? findAgent(eq(agents.id, value)) : null;
}

/** By login email (stored lowercased). */
export async function getAgentByEmail(email: string): Promise<AgentRow | null> {
  const value = normalizeAgentEmail(email);
  return value ? findAgent(eq(agents.email, value)) : null;
}

/** Every agent row whose login email is one of these (at most one per email). */
export async function getAgentsByEmails(emails: readonly string[]): Promise<AgentRow[]> {
  const values = Array.from(new Set(emails.map(normalizeAgentEmail).filter(Boolean)));
  if (values.length === 0) return [];
  try {
    return await db.select().from(agents).where(inArray(agents.email, values));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

/**
 * Is there an agent row for this Clerk account, by its id or any of its emails? For the Clerk
 * webhook, which must never copy an agent into Isaac's CRM. Before 0046 there is none ("no").
 */
export async function agentRowExistsForAccount(clerkUserId: string, emails: readonly string[]): Promise<boolean> {
  const id = clerkUserId.trim();
  const values = Array.from(new Set(emails.map(normalizeAgentEmail).filter(Boolean)));
  const conditions: SQL[] = [];
  if (id) conditions.push(eq(agents.clerkUserId, id));
  if (values.length) conditions.push(inArray(agents.email, values));
  if (conditions.length === 0) return false;
  try {
    const [row] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);
    return Boolean(row);
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

/** Every agent, oldest first (Isaac's admin list). */
export async function listAgents(): Promise<AgentRow[]> {
  try {
    return await db.select().from(agents).orderBy(asc(agents.createdAt));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export type AgentLookup =
  | { kind: "agent"; agent: AgentRow }
  | { kind: "none" }
  /** The query failed for another reason. Callers decide which way that fails. */
  | { kind: "unknown" };

export async function lookupAgentByClerkUserId(clerkUserId: string): Promise<AgentLookup> {
  try {
    const agent = await getAgentByClerkUserId(clerkUserId);
    return agent ? { kind: "agent", agent } : { kind: "none" };
  } catch (error) {
    console.warn("[tenancy] agent lookup failed:", error instanceof Error ? error.message : error);
    return { kind: "unknown" };
  }
}
