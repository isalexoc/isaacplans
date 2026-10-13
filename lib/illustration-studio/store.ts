import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { illustrationSummaries } from "@/lib/db/schema";
import { CARRIER_KEYS } from "./types";
import type {
  CarrierKey,
  IllustrationExtraction,
  IllustrationSummaryListItem,
  IllustrationSummaryRecord,
  PresentationData,
  PresentedBy,
} from "./types";

type Row = typeof illustrationSummaries.$inferSelect;

function carrierKeyOf(value: string): CarrierKey {
  return CARRIER_KEYS.find((key) => key === value) ?? "other";
}

function toRecord(row: Row): IllustrationSummaryRecord {
  return {
    id: row.id,
    carrierKey: carrierKeyOf(row.carrierKey),
    clientName: row.clientName,
    productName: row.productName,
    sourceFileName: row.sourceFileName,
    extraction: row.extraction,
    presentation: row.presentation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toListItem(row: Row): IllustrationSummaryListItem {
  return {
    id: row.id,
    carrierKey: carrierKeyOf(row.carrierKey),
    carrierDisplayName: row.presentation.carrierDisplayName,
    clientName: row.clientName,
    productName: row.productName,
    premium: row.presentation.premium,
    deathBenefit: row.presentation.deathBenefit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The list columns mirror the presentation so the recent list never reads jsonb. */
function denormalized(presentation: PresentationData) {
  return {
    carrierKey: presentation.carrierKey,
    clientName: presentation.clientName,
    productName: presentation.productName,
  };
}

export async function createIllustrationSummary(input: {
  userId: string;
  sourceFileName: string;
  extraction: IllustrationExtraction;
  presentation: PresentationData;
}): Promise<IllustrationSummaryRecord> {
  const now = new Date();
  const [row] = await db
    .insert(illustrationSummaries)
    .values({
      id: nanoid(),
      createdByUserId: input.userId,
      sourceFileName: input.sourceFileName,
      extraction: input.extraction,
      presentation: input.presentation,
      ...denormalized(input.presentation),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return toRecord(row);
}

export async function getIllustrationSummary(id: string): Promise<IllustrationSummaryRecord | null> {
  const [row] = await db.select().from(illustrationSummaries).where(eq(illustrationSummaries.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function listIllustrationSummaries(
  userId: string,
  limit = 50
): Promise<IllustrationSummaryListItem[]> {
  const rows = await db
    .select()
    .from(illustrationSummaries)
    .where(eq(illustrationSummaries.createdByUserId, userId))
    .orderBy(desc(illustrationSummaries.updatedAt))
    .limit(limit);
  return rows.map(toListItem);
}

/** The agent block from this user's latest presentation — what they last chose to print. */
export async function getLatestPresentedBy(userId: string): Promise<PresentedBy | null> {
  const [row] = await db
    .select({ presentation: illustrationSummaries.presentation })
    .from(illustrationSummaries)
    .where(eq(illustrationSummaries.createdByUserId, userId))
    .orderBy(desc(illustrationSummaries.updatedAt))
    .limit(1);
  const presentedBy = row?.presentation.presentedBy;
  return presentedBy?.name ? presentedBy : null;
}

export async function updateIllustrationPresentation(
  id: string,
  presentation: PresentationData
): Promise<IllustrationSummaryRecord | null> {
  const [row] = await db
    .update(illustrationSummaries)
    .set({ presentation, ...denormalized(presentation), updatedAt: new Date() })
    .where(eq(illustrationSummaries.id, id))
    .returning();
  return row ? toRecord(row) : null;
}

export async function deleteIllustrationSummary(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(illustrationSummaries)
    .where(and(eq(illustrationSummaries.id, id), eq(illustrationSummaries.createdByUserId, userId)))
    .returning({ id: illustrationSummaries.id });
  return rows.length > 0;
}
