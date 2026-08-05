import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getFeIntakeByToken,
  updateFeIntakeData,
  deleteFeIntakeSession,
  bindFeClientUser,
  canAccessFeIntake,
  feClientCanEdit,
  toFeIntakeSession,
  syncFeIntakeToCrm,
  type FeIntakeSessionRow,
} from "@/lib/fe-intake/server";
import { sanitizeFeIntakeData, type FeIntakeData } from "@/lib/fe-intake/schema";
import {
  encryptFeIntakeData,
  decryptFeIntakeData,
} from "@/lib/fe-intake/encryption";

type RouteContext = { params: Promise<{ token: string }> };

function roleOf(row: FeIntakeSessionRow, userId: string): "owner" | "client" {
  return row.ownerUserId === userId ? "owner" : "client";
}

// GET /api/fe-intake/[token] — load (decrypts sensitive; claims unbound sessions)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canAccessFeIntake(row, userId);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.shouldClaim) {
      await bindFeClientUser(token, userId);
      row.clientUserId = userId;
    }

    const decrypted = decryptFeIntakeData((row.data ?? {}) as FeIntakeData);
    return NextResponse.json({
      success: true,
      session: toFeIntakeSession(row, roleOf(row, userId), decrypted),
    });
  } catch (error) {
    console.error("[fe-intake/:token] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/fe-intake/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canAccessFeIntake(row, userId);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.shouldClaim) {
      await bindFeClientUser(token, userId);
      row.clientUserId = userId;
    }

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (roleOf(row, userId) === "client" && !feClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeFeIntakeData(body?.data);
    const encrypted = encryptFeIntakeData(clean);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateFeIntakeData(token, encrypted, nextStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptFeIntakeData((updated.data ?? {}) as FeIntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncFeIntakeToCrm(updated, decrypted);

    return NextResponse.json({
      success: true,
      session: toFeIntakeSession(updated, roleOf(updated, userId), decrypted),
    });
  } catch (error) {
    console.error("[fe-intake/:token] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/fe-intake/[token] — owner-only; removes the intake record (CRM contact untouched)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const deleted = await deleteFeIntakeSession(token, userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fe-intake/:token] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
