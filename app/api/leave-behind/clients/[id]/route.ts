import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { leaveBehindClients } from "@/lib/db/schema";
import {
  getLeaveBehindClientForUser,
  deleteLeaveBehindClientForUser,
  parseQuoteType,
  prospectNameFromQuoteData,
} from "@/lib/leave-behind-clients-server";
import { resolvePackageDataForSave } from "@/lib/leave-behind-save";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const row = await getLeaveBehindClientForUser(userId, id);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      client: {
        id: row.id,
        quoteType: row.quoteType,
        prospectName: row.prospectName,
        quoteData: row.quoteData,
        createdAt: row.createdAt?.toISOString() ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[leave-behind/clients/:id] GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load client" },
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
    const existing = await getLeaveBehindClientForUser(userId, id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const requestedType =
      parseQuoteType(body?.quoteType) ??
      (existing.quoteType as "package" | "single" | "compare");
    const quoteData = resolvePackageDataForSave(requestedType, body?.quoteData);
    if (!quoteData) {
      return NextResponse.json(
        { success: false, error: "Invalid quote data" },
        { status: 400 }
      );
    }
    const quoteType = "package" as const;

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

    const now = new Date();
    const [updated] = await db
      .update(leaveBehindClients)
      .set({
        quoteType,
        prospectName,
        quoteData,
        updatedAt: now,
      })
      .where(and(eq(leaveBehindClients.id, id), eq(leaveBehindClients.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      client: {
        id: updated.id,
        quoteType: updated.quoteType,
        prospectName: updated.prospectName,
        quoteData: updated.quoteData,
        createdAt: updated.createdAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[leave-behind/clients/:id] PATCH", error);
    return NextResponse.json(
      { success: false, error: "Failed to update client" },
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
    const deleted = await deleteLeaveBehindClientForUser(userId, id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[leave-behind/clients/:id] DELETE", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
