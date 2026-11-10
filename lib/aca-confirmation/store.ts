/**
 * Row-level helpers shared by ./server.ts (issue, view, sign) and ./finalize.ts (after signing).
 * Their own module so the two don't import each other.
 *
 * Server-only (database).
 */

import "server-only";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { acaConfirmationEvents, acaConfirmations } from "@/lib/db/schema";
import type { RequestEvidence } from "./evidence";
import type { AcaConfirmationAgent, AcaConfirmationEventType } from "./types";

export type ConfirmationRow = typeof acaConfirmations.$inferSelect;
export type ConfirmationEventRow = typeof acaConfirmationEvents.$inferSelect;

export async function getConfirmationRow(id: string): Promise<ConfirmationRow | null> {
  const [row] = await db.select().from(acaConfirmations).where(eq(acaConfirmations.id, id)).limit(1);
  return row ?? null;
}

/** The agent exactly as snapshotted on the request (env changes never alter an issued record). */
export function agentOf(row: ConfirmationRow): AcaConfirmationAgent {
  return {
    name: row.agentName,
    npn: row.agentNpn,
    phone: row.agentPhone,
    email: row.agentEmail,
    agency: row.agency,
  };
}

/** Append one row to the trail. Never throws: a missing trail row must not undo a signature. */
export async function addEvent(
  confirmationId: string,
  type: AcaConfirmationEventType,
  evidence: RequestEvidence | null,
  actorUserId: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(acaConfirmationEvents).values({
      id: nanoid(),
      confirmationId,
      type,
      ip: evidence?.ip ?? null,
      city: evidence?.city ?? null,
      region: evidence?.region ?? null,
      country: evidence?.country ?? null,
      userAgent: evidence?.userAgent ?? null,
      actorUserId,
      detail: detail ?? null,
    });
  } catch (error) {
    console.error(`[ACA_CONFIRMATION] Event "${type}" not recorded for ${confirmationId}:`, error);
  }
}
