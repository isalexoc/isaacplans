import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAcaIntakeByToken,
  updateAcaIntakeData,
  deleteAcaIntakeSession,
  bindAcaClientDevice,
  canAccessAcaIntake,
  acaClientCanEdit,
  toAcaIntakeSession,
  syncAcaIntakeToCrm,
  isAcaIntakeExpired,
} from "@/lib/aca-intake/server";
import { sanitizeAcaIntakeData, type AcaIntakeData } from "@/lib/aca-intake/schema";
import {
  encryptAcaIntakeData,
  decryptAcaIntakeData,
} from "@/lib/aca-intake/encryption";
import { ensureAcaDeviceId } from "@/lib/aca-intake/device";
import {
  maskAcaSensitiveForClient,
  mergePreservedAcaSensitive,
} from "@/lib/aca-intake/masking";

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

// GET /api/aca-intake/[token] — load (decrypts sensitive; claims unbound sessions to this device)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    // Minting here is what claims an unclaimed link for the first browser that opens it.
    const deviceId = await ensureAcaDeviceId();

    const access = canAccessAcaIntake(row, { userId, deviceId });
    if (!access.allowed) return forbidden(access.claimedByOtherDevice);
    if (access.role === "client" && isAcaIntakeExpired(row)) return expired();

    if (access.shouldClaim) {
      await bindAcaClientDevice(token, deviceId);
      row.clientDeviceId = deviceId;
    }

    const decrypted = decryptAcaIntakeData((row.data ?? {}) as AcaIntakeData);
    // The agent needs real values to work an application; the client's own browser only needs to
    // see that a value is on file, so a stolen link can never surface an SSN.
    const forClient = access.role === "owner" ? decrypted : maskAcaSensitiveForClient(decrypted);

    return NextResponse.json({
      success: true,
      session: toAcaIntakeSession(row, access.role, forClient),
    });
  } catch (error) {
    console.error("[aca-intake/:token] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/aca-intake/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    const deviceId = await ensureAcaDeviceId();

    const access = canAccessAcaIntake(row, { userId, deviceId });
    if (!access.allowed) return forbidden(access.claimedByOtherDevice);
    if (access.role === "client" && isAcaIntakeExpired(row)) return expired();

    if (access.shouldClaim) {
      await bindAcaClientDevice(token, deviceId);
      row.clientDeviceId = deviceId;
    }

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (access.role === "client" && !acaClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeAcaIntakeData(body?.data);
    // The client never received the real sensitive values, so a masked placeholder coming back
    // must not overwrite what's stored.
    const stored = decryptAcaIntakeData((row.data ?? {}) as AcaIntakeData);
    const merged = mergePreservedAcaSensitive(clean, stored);
    const encrypted = encryptAcaIntakeData(merged);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateAcaIntakeData(token, encrypted, nextStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptAcaIntakeData((updated.data ?? {}) as AcaIntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncAcaIntakeToCrm(updated, decrypted);

    const forClient = access.role === "owner" ? decrypted : maskAcaSensitiveForClient(decrypted);
    return NextResponse.json({
      success: true,
      session: toAcaIntakeSession(updated, access.role, forClient),
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
