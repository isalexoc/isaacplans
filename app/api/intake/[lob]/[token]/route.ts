import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  alreadySubmitted,
  forbidden,
  isResponse,
  loadAuthorizedSession,
  notFound,
  resolveConfig,
  unauthorized,
} from "@/lib/intake-core/route-helpers";
import {
  clientCanEdit,
  deleteIntakeSession,
  getIntakeByToken,
  syncIntakeToCrm,
  toIntakeSession,
  updateIntakeData,
} from "@/lib/intake-core/server";
import { sanitizeIntakeData } from "@/lib/intake-core/schema";
import {
  decryptIntakeData,
  encryptIntakeData,
  maskSensitiveForClient,
  mergePreservedSensitive,
} from "@/lib/intake-core/sensitive";
import type { IntakeData } from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// GET /api/intake/[lob]/[token] — load (decrypts sensitive; claims unbound sessions to this device)
export async function GET(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const loaded = await loadAuthorizedSession(lob, token, { claim: true });
    if (isResponse(loaded)) return loaded;
    const { config, row, access } = loaded;

    const decrypted = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
    // The agent needs real values to work an application; the client's own browser only needs to
    // see that a value is on file, so a stolen link can never surface an SSN.
    const forClient =
      access.role === "owner" ? decrypted : maskSensitiveForClient(config, decrypted);

    return NextResponse.json({
      success: true,
      session: toIntakeSession(row, access.role, forClient),
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token] GET`, error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/intake/[lob]/[token] — autosave partial data (encrypts sensitive at rest)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const loaded = await loadAuthorizedSession(lob, token, { claim: true });
    if (isResponse(loaded)) return loaded;
    const { config, row, access } = loaded;

    // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
    if (access.role === "client" && !clientCanEdit(row)) return alreadySubmitted();

    const body = await request.json().catch(() => ({}));
    const clean = sanitizeIntakeData(config.sections, body?.data);
    // The client never received the real sensitive values, so a masked placeholder coming back
    // must not overwrite what's stored.
    const stored = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
    const merged = mergePreservedSensitive(config, clean, stored);
    const encrypted = encryptIntakeData(config, merged);
    const nextStatus = row.status === "completed" ? "completed" : "in_progress";

    const updated = await updateIntakeData(token, encrypted, nextStatus);
    if (!updated) return notFound();

    const decrypted = decryptIntakeData(config, (updated.data ?? {}) as IntakeData);

    // Progressive CRM sync (best-effort — never blocks the save).
    await syncIntakeToCrm(config, updated, decrypted);

    const forClient =
      access.role === "owner" ? decrypted : maskSensitiveForClient(config, decrypted);
    return NextResponse.json({
      success: true,
      session: toIntakeSession(updated, access.role, forClient),
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token] PATCH`, error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/intake/[lob]/[token] — owner-only; removes the intake record (CRM contact untouched)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();

    const config = resolveConfig(lob);
    if (!config) return notFound();

    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
    // Only the agent who created the intake may delete it.
    if (row.ownerUserId !== userId) return forbidden();

    const deleted = await deleteIntakeSession(config, token, userId);
    if (!deleted) return notFound();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[intake/${lob}/:token] DELETE`, error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
