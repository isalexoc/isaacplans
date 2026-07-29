import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAcaIntakeByToken,
  updateAcaIntakeData,
  deleteAcaIntakeSession,
  bindAcaClientUser,
  canAccessAcaIntake,
  acaClientCanEdit,
  toAcaIntakeSession,
  syncAcaIntakeToCrm,
  type AcaIntakeSessionRow,
} from "@/lib/aca-intake/server";
import { sanitizeAcaIntakeData, type AcaIntakeData } from "@/lib/aca-intake/schema";
import {
  encryptAcaIntakeData,
  decryptAcaIntakeData,
} from "@/lib/aca-intake/encryption";

type RouteContext = { params: Promise<{ token: string }> };

function roleOf(row: AcaIntakeSessionRow, userId: string): "owner" | "client" {
  return row.ownerUserId === userId ? "owner" : "client";
}

// GET /api/aca-intake/[token] — load (decrypts sensitive; claims unbound sessions)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canAccessAcaIntake(row, userId);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.shouldClaim) {
      await bindAcaClientUser(token, userId);
      row.clientUserId = userId;
    }

    const decrypted = decryptAcaIntakeData((row.data ?? {}) as AcaIntakeData);
    return NextResponse.json({
      success: true,
      session: toAcaIntakeSession(row, roleOf(row, userId), decrypted),
    });
  } catch (error) {
    console.error("[aca-intake/:token] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/aca-intake/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canAccessAcaIntake(row, userId);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.shouldClaim) {
      await bindAcaClientUser(token, userId);
      row.clientUserId = userId;
    }

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (roleOf(row, userId) === "client" && !acaClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeAcaIntakeData(body?.data);
    const encrypted = encryptAcaIntakeData(clean);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateAcaIntakeData(token, encrypted, nextStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptAcaIntakeData((updated.data ?? {}) as AcaIntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncAcaIntakeToCrm(updated, decrypted);

    return NextResponse.json({
      success: true,
      session: toAcaIntakeSession(updated, roleOf(updated, userId), decrypted),
    });
  } catch (error) {
    console.error("[aca-intake/:token] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/aca-intake/[token] — owner-only; removes the intake record (CRM contact untouched)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    // Only the agent who created the intake may delete it.
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const deleted = await deleteAcaIntakeSession(token, userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[aca-intake/:token] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
