import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getIntakeByToken,
  updateIntakeData,
  deleteIntakeSession,
  bindClientUser,
  canAccessIntake,
  clientCanEdit,
  toIntakeSession,
  syncIntakeToCrm,
  type IntakeSessionRow,
} from "@/lib/iul-intake/server";
import { sanitizeIntakeData, type IntakeData } from "@/lib/iul-intake/schema";
import {
  encryptIntakeData,
  decryptIntakeData,
} from "@/lib/crypto/field-encryption";

type RouteContext = { params: Promise<{ token: string }> };

function roleOf(row: IntakeSessionRow, userId: string): "owner" | "client" {
  return row.ownerUserId === userId ? "owner" : "client";
}

// GET /api/iul-intake/[token] — load (decrypts sensitive; claims unbound sessions)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canAccessIntake(row, userId);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.shouldClaim) {
      await bindClientUser(token, userId);
      row.clientUserId = userId;
    }

    const decrypted = decryptIntakeData((row.data ?? {}) as IntakeData);
    return NextResponse.json({
      success: true,
      session: toIntakeSession(row, roleOf(row, userId), decrypted),
    });
  } catch (error) {
    console.error("[iul-intake/:token] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/iul-intake/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canAccessIntake(row, userId);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.shouldClaim) {
      await bindClientUser(token, userId);
      row.clientUserId = userId;
    }

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (roleOf(row, userId) === "client" && !clientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeIntakeData(body?.data);
    const encrypted = encryptIntakeData(clean);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateIntakeData(token, encrypted, nextStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptIntakeData((updated.data ?? {}) as IntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncIntakeToCrm(updated, decrypted);

    return NextResponse.json({
      success: true,
      session: toIntakeSession(updated, roleOf(updated, userId), decrypted),
    });
  } catch (error) {
    console.error("[iul-intake/:token] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/iul-intake/[token] — owner-only; removes the intake record (CRM contact untouched)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    // Only the agent who created the intake may delete it.
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const deleted = await deleteIntakeSession(token, userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[iul-intake/:token] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
