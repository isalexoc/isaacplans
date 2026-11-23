/**
 * Reads of the `agents` table (migration 0046). Server-only.
 *
 * Every read tolerates the table not existing yet: before `pnpm db:migrate 0046` runs, the answer is
 * "no agent", which is exactly true then. The getters rethrow any other database error so a caller
 * can fail closed; `lookupAgentByClerkUserId` never throws and says "unknown" instead, for the
 * per-request access checks that must decide either way.
 */

import "server-only";
import { eq, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
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
