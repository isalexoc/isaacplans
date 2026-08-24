import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getIntakeByToken,
  updateIntakeData,
  deleteIntakeSession,
  bindClientDevice,
  canAccessIntake,
  clientCanEdit,
  toIntakeSession,
  syncIntakeToCrm,
  isIulIntakeExpired,
  type IntakeSessionRow,
} from "@/lib/iul-intake/server";
import { sanitizeIntakeData, type IntakeData } from "@/lib/iul-intake/schema";
import { ensureIulDeviceId } from "@/lib/iul-intake/device";
import { maskIulSensitiveForClient, mergePreservedIulSensitive } from "@/lib/iul-intake/masking";
import { SECURE_CAPTURE_FIELD_KEYS } from "@/lib/iul-intake/fields";
import { CAPTURE_GRACE_MS } from "@/lib/iul-intake/secure-capture";
import {
  encryptIntakeData,
  decryptIntakeData,
} from "@/lib/crypto/field-encryption";

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

// GET /api/iul-intake/[token] — load (decrypts sensitive; claims unbound sessions)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    // Minting here is what claims an unclaimed link for the first browser that opens it.
    const deviceId = await ensureIulDeviceId();

    const access = canAccessIntake(row, { userId, deviceId });
    if (!access.allowed) return forbidden(access.claimedByOtherDevice);
    if (access.role === "client" && isIulIntakeExpired(row)) return expired();

    if (access.shouldClaim) {
      await bindClientDevice(token, deviceId);
      row.clientDeviceId = deviceId;
    }

    const decrypted = decryptIntakeData((row.data ?? {}) as IntakeData);
    // The agent needs real values to work an application; the client's own browser only needs to
    // see that a value is on file, so a stolen link can never surface an SSN.
    const forClient = access.role === "owner" ? decrypted : maskIulSensitiveForClient(decrypted);
    return NextResponse.json({
      success: true,
      session: toIntakeSession(row, access.role, forClient),
    });
  } catch (error) {
    console.error("[iul-intake/:token] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/iul-intake/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    const deviceId = await ensureIulDeviceId();

    const access = canAccessIntake(row, { userId, deviceId });
    if (!access.allowed) return forbidden(access.claimedByOtherDevice);
    if (access.role === "client" && isIulIntakeExpired(row)) return expired();

    if (access.shouldClaim) {
      await bindClientDevice(token, deviceId);
      row.clientDeviceId = deviceId;
    }

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (access.role === "client" && !clientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeIntakeData(body?.data);
    // The client never received the real sensitive values, so a masked placeholder coming back
    // must not overwrite what's stored.
    const stored = decryptIntakeData((row.data ?? {}) as IntakeData);
    const merged = mergePreservedIulSensitive(clean, stored);

    /**
     * Grace window after a secure capture lands.
     *
     * Once the agent's next poll arrives their form holds masks, and `mergePreservedIulSensitive`
     * above already makes those writes no-ops. The exposure is the few seconds before that poll:
     * if the agent was mid-way through typing an SSN when the client submitted theirs, that
     * half-typed value is neither masked nor empty, so it would win and quietly replace the real
     * one. For a short window after a capture, the stored values are forced back.
     *
     * `sensitiveCapturedAt` lives on this row precisely so this costs no extra query on a path
     * that runs about once a second per open form.
     */
    const capturedAt = row.sensitiveCapturedAt?.getTime() ?? 0;
    if (access.role === "owner" && capturedAt && Date.now() - capturedAt < CAPTURE_GRACE_MS) {
      for (const key of SECURE_CAPTURE_FIELD_KEYS) {
        const previous = stored[key];
        if (typeof previous === "string" && previous !== "") merged[key] = previous;
      }
    }

    const encrypted = encryptIntakeData(merged);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateIntakeData(token, encrypted, nextStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptIntakeData((updated.data ?? {}) as IntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncIntakeToCrm(updated, decrypted);

    const forClient = access.role === "owner" ? decrypted : maskIulSensitiveForClient(decrypted);
    return NextResponse.json({
      success: true,
      session: toIntakeSession(updated, access.role, forClient),
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
