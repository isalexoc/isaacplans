import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { leaveBehindClients } from "@/lib/db/schema";
import {
  listLeaveBehindClientsForUser,
  parseQuoteType,
  prospectNameFromQuoteData,
} from "@/lib/leave-behind-clients-server";
import { resolvePackageDataForSave } from "@/lib/leave-behind-save";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await listLeaveBehindClientsForUser(userId);
    const clients = rows.map((row) => ({
      id: row.id,
      quoteType: row.quoteType,
      prospectName: row.prospectName,
      quoteData: row.quoteData,
      createdAt: row.createdAt?.toISOString() ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ success: true, clients });
  } catch (error) {
    console.error("[leave-behind/clients] GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load clients" },
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
    const requestedType = parseQuoteType(body?.quoteType);
    if (!requestedType) {
      return NextResponse.json(
        { success: false, error: "quoteType must be package, single, or compare" },
        { status: 400 }
      );
    }

    const quoteData = resolvePackageDataForSave(requestedType, body?.quoteData);
    if (!quoteData) {
      return NextResponse.json(
        { success: false, error: "Invalid quote data" },
        { status: 400 }
      );
    }

    const quoteType = "package" as const;
    const id = nanoid();
    const now = new Date();
    const prospectName =
      typeof body?.prospectName === "string" && body.prospectName.trim()
        ? body.prospectName.trim()
        : prospectNameFromQuoteData(quoteData);

    if (!prospectName) {
      return NextResponse.json(
        { success: false, error: "Prospect name is required" },
        { status: 400 }
      );
    }

    await db.insert(leaveBehindClients).values({
      id,
      userId,
      quoteType,
      prospectName,
      quoteData,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      client: {
        id,
        quoteType,
        prospectName,
        quoteData,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("[leave-behind/clients] POST", error);
    return NextResponse.json(
      { success: false, error: "Failed to save client" },
      { status: 500 }
    );
  }
}
