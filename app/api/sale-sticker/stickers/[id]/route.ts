import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { saleStickers } from "@/lib/db/schema";
import { normalizeStickerData } from "@/lib/sale-sticker";
import {
  deleteStickerForUser,
  getStickerForUser,
  rowToStickerRecord,
} from "@/lib/sale-sticker-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const row = await getStickerForUser(userId, id);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, sticker: rowToStickerRecord(row) });
  } catch (error) {
    console.error("[sale-sticker/stickers/:id] GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load sticker" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await getStickerForUser(userId, id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = normalizeStickerData(body?.data);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Client name and lead source are required" },
        { status: 400 }
      );
    }

    // saleDate + dailySequence are assigned once at creation and stay immutable.
    const now = new Date();
    const [updated] = await db
      .update(saleStickers)
      .set({
        clientName: data.clientName,
        clientTitle: data.clientTitle,
        leadSource: data.leadSource,
        leadSourceCustom: data.leadSourceCustom || null,
        saleType: data.saleType,
        language: data.language,
        customPhrase: data.customPhrase || null,
        extraImageUrl: data.extraImageUrl || null,
        extraImagePublicId: data.extraImagePublicId || null,
        updatedAt: now,
      })
      .where(and(eq(saleStickers.id, id), eq(saleStickers.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, sticker: rowToStickerRecord(updated) });
  } catch (error) {
    console.error("[sale-sticker/stickers/:id] PATCH", error);
    return NextResponse.json(
      { success: false, error: "Failed to update sticker" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await deleteStickerForUser(userId, id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sale-sticker/stickers/:id] DELETE", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete sticker" },
      { status: 500 }
    );
  }
}
