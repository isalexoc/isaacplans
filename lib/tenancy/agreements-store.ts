/**
 * The agreements an agent has accepted (`agent_agreements`, migration 0046). Server-only.
 *
 * `agentAgreementsAccepted` answers the operator gate's question (lib/tenancy/context.ts and the
 * owner's token routes) and fails closed: a failed read is "not accepted", which sends the agent to
 * /agent/agreements and refuses their operator actions until the read works again. It never
 * concerns their clients, whose links keep working. `agentAgreementsOnRecord` answers the public
 * pages' question (an agent who never accepted gets no guide and no new applications).
 *
 * Acceptance is evidence: one row per document version with the hash of the exact text, the time,
 * the IP and the browser. A version already accepted is never overwritten.
 */

import "server-only";
import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { agentAgreements } from "@/lib/db/schema";
import { agreementsOnRecord, agreementsSatisfied, type AcceptedAgreement, type AgreementRef } from "./agreements";
import { isMissingTableError } from "./db-errors";

export async function acceptedAgreementsOf(agentId: string): Promise<AcceptedAgreement[]> {
  return db
    .select({ doc: agentAgreements.doc, version: agentAgreements.version, sha256: agentAgreements.sha256 })
    .from(agentAgreements)
    .where(eq(agentAgreements.agentId, agentId));
}

/** Whether each of these agents has accepted the current documents (Isaac's list). Throws on failure. */
export async function agreementsAcceptedByAgent(agentIds: readonly string[]): Promise<Map<string, boolean>> {
  const ids = Array.from(new Set(agentIds.filter(Boolean)));
  const out = new Map<string, boolean>(ids.map((id) => [id, false]));
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      agentId: agentAgreements.agentId,
      doc: agentAgreements.doc,
      version: agentAgreements.version,
      sha256: agentAgreements.sha256,
    })
    .from(agentAgreements)
    .where(inArray(agentAgreements.agentId, ids));
  for (const id of ids) out.set(id, agreementsSatisfied(rows.filter((row) => row.agentId === id)));
  return out;
}

/**
 * Has this agent accepted every document at some version (their public pages and new applications
 * need it, lib/tenancy/agreements.ts `agreementsOnRecord`)? Throws on a failed read, so the page or
 * the start route answers its retryable error instead of "no such agent".
 */
export async function agentAgreementsOnRecord(agentId: string): Promise<boolean> {
  return agreementsOnRecord(await acceptedAgreementsOf(agentId));
}

/** Has this agent accepted the current version of every document? False on any failure. */
export async function agentAgreementsAccepted(agentId: string): Promise<boolean> {
  try {
    return agreementsSatisfied(await acceptedAgreementsOf(agentId));
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[tenancy] agreements read failed:", error instanceof Error ? error.message : error);
    }
    return false;
  }
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
    return { ip: ip ? ip.slice(0, 100) : null, userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Record the agent's acceptance of these document versions (already checked as current). */
export async function recordAgreementAcceptance(agentId: string, refs: readonly AgreementRef[]): Promise<void> {
  if (refs.length === 0) return;
  const { ip, userAgent } = await requestMeta();
  await db
    .insert(agentAgreements)
    .values(
      refs.map((ref) => ({
        id: nanoid(),
        agentId,
        doc: ref.doc,
        version: ref.version,
        sha256: ref.sha256,
        ip,
        userAgent,
      }))
    )
    .onConflictDoNothing({ target: [agentAgreements.agentId, agentAgreements.doc, agentAgreements.version] });
}
