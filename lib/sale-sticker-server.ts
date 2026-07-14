import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { saleStickers } from "@/lib/db/schema";
import type { SaleStickerRecord } from "@/lib/sale-sticker";

type SaleStickerRow = typeof saleStickers.$inferSelect;

/** Map a DB row to the API record shape. */
export function rowToStickerRecord(row: SaleStickerRow): SaleStickerRecord {
  return {
    id: row.id,
    clientName: row.clientName,
    clientTitle: row.clientTitle as SaleStickerRecord["clientTitle"],
    leadSource: row.leadSource as SaleStickerRecord["leadSource"],
    leadSourceCustom: row.leadSourceCustom ?? "",
    saleType: row.saleType as SaleStickerRecord["saleType"],
    language: row.language as SaleStickerRecord["language"],
    saleDate: row.saleDate,
    dailySequence: row.dailySequence,
    customPhrase: row.customPhrase ?? "",
    extraImageUrl: row.extraImageUrl ?? "",
    extraImagePublicId: row.extraImagePublicId ?? "",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function listStickersForUser(userId: string): Promise<SaleStickerRow[]> {
  return db
    .select()
    .from(saleStickers)
    .where(eq(saleStickers.userId, userId))
    .orderBy(desc(saleStickers.createdAt));
}

export async function getStickerForUser(
  userId: string,
  id: string
): Promise<SaleStickerRow | null> {
  const rows = await db
    .select()
    .from(saleStickers)
    .where(and(eq(saleStickers.id, id), eq(saleStickers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteStickerForUser(userId: string, id: string) {
  const rows = await db
    .delete(saleStickers)
    .where(and(eq(saleStickers.id, id), eq(saleStickers.userId, userId)))
    .returning({ id: saleStickers.id });
  return rows[0] ?? null;
}

/**
 * Next "sale #N of the day" for this agent on this local date.
 * max(dailySequence)+1 — single low-volume agent, so the tiny race is acceptable.
 */
export async function computeNextDailySequence(
  userId: string,
  saleDate: string
): Promise<number> {
  const rows = await db
    .select({ max: sql<number | null>`max(${saleStickers.dailySequence})` })
    .from(saleStickers)
    .where(and(eq(saleStickers.userId, userId), eq(saleStickers.saleDate, saleDate)));
  const current = rows[0]?.max ?? 0;
  return Number(current) + 1;
}
