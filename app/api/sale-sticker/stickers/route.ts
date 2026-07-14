import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { saleStickers } from "@/lib/db/schema";
import {
  isValidSaleDate,
  normalizeStickerData,
  todayLocalDateString,
} from "@/lib/sale-sticker";
import {
  computeNextDailySequence,
  listStickersForUser,
  rowToStickerRecord,
} from "@/lib/sale-sticker-server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await listStickersForUser(userId);
    return NextResponse.json({ success: true, stickers: rows.map(rowToStickerRecord) });
  } catch (error) {
    console.error("[sale-sticker/stickers] GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load stickers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = normalizeStickerData(body?.data);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Client name and lead source are required" },
        { status: 400 }
      );
    }

    // Agent's local date drives the daily counter; fall back to the server date.
    const saleDate = isValidSaleDate(body?.saleDate) ? body.saleDate : todayLocalDateString();
    const dailySequence = await computeNextDailySequence(userId, saleDate);

    const id = nanoid();
    const now = new Date();

    const [row] = await db
      .insert(saleStickers)
      .values({
        id,
        userId,
        clientName: data.clientName,
        clientTitle: data.clientTitle,
        leadSource: data.leadSource,
        leadSourceCustom: data.leadSourceCustom || null,
        saleType: data.saleType,
        language: data.language,
        saleDate,
        dailySequence,
        customPhrase: data.customPhrase || null,
        extraImageUrl: data.extraImageUrl || null,
        extraImagePublicId: data.extraImagePublicId || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ success: true, sticker: rowToStickerRecord(row) });
  } catch (error) {
    console.error("[sale-sticker/stickers] POST", error);
    return NextResponse.json(
      { success: false, error: "Failed to save sticker" },
      { status: 500 }
    );
  }
}
