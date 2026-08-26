import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getIntakeByToken } from "@/lib/iul-intake/server";
import { buildSecureCaptureUrl } from "@/lib/iul-intake/share-url";
import { decryptIntakeData } from "@/lib/crypto/field-encryption";
import { maskIulSensitiveForClient } from "@/lib/iul-intake/masking";
import { SECURE_CAPTURE_FIELD_KEYS, isCaptureScope } from "@/lib/iul-intake/fields";
import {
  createCapture,
  cancelPendingCaptures,
  getLatestCapture,
  toSecureCaptureView,
} from "@/lib/iul-intake/secure-capture";
import type { IntakeData } from "@/lib/iul-intake/schema";

/**
 * The agent's side of the secure capture link: create one, poll it, cancel it.
 *
 * All three are admin-only AND owner-scoped. Nothing here is reachable from the client's phone —
 * the client talks to `/api/iul-intake/secure-capture/[captureToken]`, which is a different tree
 * with a different credential.
 */

type RouteContext = { params: Promise<{ token: string }> };

/** Clerk admin + owns this session. Returns the row, or a response to send back. */
async function requireOwner(token: string) {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await getIsAdmin())) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  const row = await getIntakeByToken(token);
  if (!row) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  if (row.ownerUserId !== userId) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { row };
}

/**
 * The four captured values, masked.
 *
 * This is the heart of the feature and the reason it is safe: the agent's browser is handed
 * `•••••6789`, never the real number. Two things follow. The client watching the screen share
 * sees nothing readable, which is the point. And because every later autosave then sends a mask
 * back, `mergePreservedIulSensitive` turns those writes into no-ops — so the agent's form
 * physically cannot overwrite what the client just submitted.
 *
 * Masking runs through `maskIulSensitiveForClient`, whose key list is derived from the field
 * config, so marking a new field `sensitive` cannot leave it unmasked here by omission.
 */
function maskedCaptureValues(
  row: { data: IntakeData | null },
  /**
   * The live link's frozen keys, when there is a link.
   *
   * Scoped on purpose. Masking exists to protect what the CLIENT submitted, so it must cover
   * exactly what the client was asked for and nothing else. On a bank-only link the agent is
   * often typing the SSN themselves at the same moment — masking that field would blank it under
   * them and raise "the client replaced what you typed", which never happened.
   *
   * Undefined means no link was ever issued for this session, which keeps the original behaviour
   * of masking all four rather than quietly changing how an untouched session reloads.
   */
  scopeKeys?: readonly string[]
): Record<string, string> {
  const decrypted = decryptIntakeData((row.data ?? {}) as IntakeData);
  const keys = scopeKeys?.length ? scopeKeys : SECURE_CAPTURE_FIELD_KEYS;
  const subset: IntakeData = {};
  for (const key of keys) {
    const v = decrypted[key];
    if (typeof v === "string" && v) subset[key] = v;
  }
  const masked = maskIulSensitiveForClient(subset);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(masked)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * POST — issue a link. Cancels any previous pending one so only one is ever live.
 *
 * Body: `{ scope?: "both" | "ssn" | "bank" }`. An absent or unrecognised scope means "both",
 * which is what every link meant before scopes existed — so an older client that posts an empty
 * body keeps working rather than issuing a link that asks for nothing.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const guard = await requireOwner(token);
    if (guard.error) return guard.error;
    const row = guard.row!;

    if (row.status === "completed") {
      return NextResponse.json(
        { success: false, error: "This application is already submitted." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const scope = isCaptureScope(body?.scope) ? body.scope : "both";

    const capture = await createCapture({
      sessionId: row.id,
      ownerUserId: row.ownerUserId,
      scope,
    });

    return NextResponse.json({
      success: true,
      capture: toSecureCaptureView(capture),
      url: buildSecureCaptureUrl(capture.token, row.locale ?? "en"),
    });
  } catch (error) {
    console.error("[iul-intake/:token/secure-capture] POST", error);
    return NextResponse.json({ success: false, error: "Failed to create link" }, { status: 500 });
  }
}

/** GET — the agent's poll: capture status plus the masked values. */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const guard = await requireOwner(token);
    if (guard.error) return guard.error;
    const row = guard.row!;

    const capture = await getLatestCapture(row.id);

    return NextResponse.json({
      success: true,
      capture: capture ? toSecureCaptureView(capture) : null,
      url: capture ? buildSecureCaptureUrl(capture.token, row.locale ?? "en") : null,
      values: maskedCaptureValues(row, capture?.fieldKeys ?? undefined),
    });
  } catch (error) {
    console.error("[iul-intake/:token/secure-capture] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/** DELETE — revoke. The link stops working immediately. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const guard = await requireOwner(token);
    if (guard.error) return guard.error;

    const cancelled = await cancelPendingCaptures(guard.row!.id);
    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    console.error("[iul-intake/:token/secure-capture] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to cancel" }, { status: 500 });
  }
}
