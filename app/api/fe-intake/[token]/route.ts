import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getFeIntakeByToken,
  updateFeIntakeData,
  deleteFeIntakeSession,
  bindFeClientDevice,
  canAccessFeIntake,
  feClientCanEdit,
  toFeIntakeSession,
  syncFeIntakeToCrm,
  isFeIntakeExpired,
} from "@/lib/fe-intake/server";
import { sanitizeFeIntakeData, type FeIntakeData } from "@/lib/fe-intake/schema";
import {
  encryptFeIntakeData,
  decryptFeIntakeData,
} from "@/lib/fe-intake/encryption";
import { ensureFeDeviceId } from "@/lib/fe-intake/device";
import { maskSensitiveForClient, mergePreservedSensitive } from "@/lib/fe-intake/masking";

type RouteContext = { params: Promise<{ token: string }> };

/** Shared 403 body so the form can tell "someone else opened this" from a plain denial. */
function forbidden(claimedByOtherDevice: boolean) {
  return NextResponse.json(
    {
      success: false,
      error: claimedByOtherDevice
        ? "This link was already opened on another device. Please continue there, or call us for a new link."
        : "Forbidden",
      code: claimedByOtherDevice ? "claimed_elsewhere" : "forbidden",
    },
    { status: 403 }
  );
}

function expired() {
  return NextResponse.json(
    { success: false, error: "This link has expired. Please call us for a new one.", code: "expired" },
    { status: 410 }
  );
}

// GET /api/fe-intake/[token] — load (decrypts sensitive; claims unbound sessions to this device)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    // Minting here is what claims an unclaimed link for the first browser that opens it.
    const deviceId = await ensureFeDeviceId();

    const access = canAccessFeIntake(row, { userId, deviceId });
    if (!access.allowed) return forbidden(access.claimedByOtherDevice);
    if (access.role === "client" && isFeIntakeExpired(row)) return expired();

    if (access.shouldClaim) {
      await bindFeClientDevice(token, deviceId);
      row.clientDeviceId = deviceId;
    }

    const decrypted = decryptFeIntakeData((row.data ?? {}) as FeIntakeData);
    // The agent needs the real values to work an application; the client's own browser only ever
    // needs to see that a value is on file, so a stolen link can never surface an SSN.
    const forClient = access.role === "owner" ? decrypted : maskSensitiveForClient(decrypted);

    return NextResponse.json({
      success: true,
      session: toFeIntakeSession(row, access.role, forClient),
    });
  } catch (error) {
    console.error("[fe-intake/:token] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/fe-intake/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    const deviceId = await ensureFeDeviceId();

    const access = canAccessFeIntake(row, { userId, deviceId });
    if (!access.allowed) return forbidden(access.claimedByOtherDevice);
    if (access.role === "client" && isFeIntakeExpired(row)) return expired();

    if (access.shouldClaim) {
      await bindFeClientDevice(token, deviceId);
      row.clientDeviceId = deviceId;
    }

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (access.role === "client" && !feClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeFeIntakeData(body?.data);
    // The client never received the real sensitive values, so a masked placeholder coming back
    // must not overwrite what's stored.
    const stored = decryptFeIntakeData((row.data ?? {}) as FeIntakeData);
    const merged = mergePreservedSensitive(clean, stored);
    const encrypted = encryptFeIntakeData(merged);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateFeIntakeData(token, encrypted, nextStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptFeIntakeData((updated.data ?? {}) as FeIntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncFeIntakeToCrm(updated, decrypted);

    const forClient = access.role === "owner" ? decrypted : maskSensitiveForClient(decrypted);
    return NextResponse.json({
      success: true,
      session: toFeIntakeSession(updated, access.role, forClient),
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
