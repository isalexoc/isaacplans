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
import { captureFieldKeys } from "@/lib/intake-core/secure-capture-groups";
import { CAPTURE_GRACE_MS, recentlyCapturedKeys } from "@/lib/intake-core/secure-capture";
import type { IntakeData, IntakeLobConfig } from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

/**
 * Grace window after a client sends numbers through a secure link.
 *
 * Once the agent's next poll lands, their form holds masks and `mergePreservedSensitive` turns
 * those saves into no-ops. The exposure is the few seconds before: a value the agent was half-way
 * through typing is neither a mask nor empty, so it would quietly replace the client's. For a
 * short window the stored values win. The lookup only runs when this save would actually change a
 * value a link can capture, so ordinary autosaves cost nothing extra; and a failure (the table not
 * migrated yet, say) just skips the window rather than failing the save.
 */
async function keepFreshCapture(
  config: IntakeLobConfig,
  sessionId: string,
  merged: IntakeData,
  stored: IntakeData
): Promise<void> {
  const changing = captureFieldKeys(config).filter((key) => {
    const previous = stored[key];
    return typeof previous === "string" && previous !== "" && merged[key] !== previous;
  });
  if (!changing.length) return;
  try {
    const fresh = new Set(await recentlyCapturedKeys(sessionId, CAPTURE_GRACE_MS));
    for (const key of changing) if (fresh.has(key)) merged[key] = stored[key];
  } catch (error) {
    console.warn("[intake] secure-capture grace check skipped:", error);
  }
}

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
    if (access.role === "owner") await keepFreshCapture(config, row.id, merged, stored);
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
