import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { resolveConfig } from "@/lib/intake-core/route-helpers";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { decryptIntakeData, maskSensitiveForClient } from "@/lib/intake-core/sensitive";
import { buildSecureCaptureUrl } from "@/lib/intake-core/share-url";
import { captureGroups, groupReady, keysForGroups } from "@/lib/intake-core/secure-capture-groups";
import {
  cancelPendingCaptures,
  createCapture,
  getLatestCapture,
  toSecureCaptureView,
} from "@/lib/intake-core/secure-capture";
import type { IntakeData, IntakeLobConfig } from "@/lib/intake-core/types";

/**
 * The agent's side of the secure link: issue one, poll it, cancel it. Admin-only and owner-scoped;
 * the client's phone talks to `/api/intake-capture/[captureToken]`, a different credential.
 */

type RouteContext = { params: Promise<{ lob: string; token: string }> };

const fail = (status: number, error: string, code?: string) =>
  NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });

/** Clerk admin, a line with secure capture, and the caller owns this intake. */
async function requireOwner(lob: string, token: string) {
  const { userId } = await auth();
  if (!userId) return { error: fail(401, "Unauthorized") };
  if (!(await getIsAdmin())) return { error: fail(403, "Forbidden") };
  const config = resolveConfig(lob);
  if (!config?.secureCapture) return { error: fail(404, "Not found") };
  const row = await getIntakeByToken(config, token);
  if (!row) return { error: fail(404, "Not found") };
  if (row.ownerUserId !== userId) return { error: fail(403, "Forbidden") };
  return { config, row };
}

/**
 * The captured values, masked. The agent's browser gets `•••••6789`, never the number: the
 * client may be watching the screen share, and every later autosave sends the mask back, which
 * `mergePreservedSensitive` turns into a no-op, so the agent's form can't overwrite what the
 * client just sent. Scoped to the link's own keys.
 */
function maskedValues(config: IntakeLobConfig, data: IntakeData, keys: readonly string[]): Record<string, string> {
  const decrypted = decryptIntakeData(config, data);
  const subset: IntakeData = {};
  for (const key of keys) {
    const v = decrypted[key];
    if (typeof v === "string" && v) subset[key] = v;
  }
  const masked = maskSensitiveForClient(config, subset);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(masked)) if (typeof v === "string") out[k] = v;
  return out;
}

/** POST `{ groups: string[] }` — issue a link for those groups, cancelling any live one. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const guard = await requireOwner(lob, token);
    if (guard.error) return guard.error;
    const { config, row } = guard;
    if (row.status === "completed") return fail(400, "This application is already submitted.", "completed");

    const body = await request.json().catch(() => ({}));
    const asked: string[] = Array.isArray(body?.groups) ? body.groups.filter((g: unknown) => typeof g === "string") : [];
    const data = (row.data ?? {}) as IntakeData;
    const groups = captureGroups(config).filter((g) => asked.includes(g.key));
    if (!groups.length) return fail(400, "Pick at least one thing to ask for.", "empty");
    // The SSN-or-ITIN choice and the ID type are plain answers; without them the client's page
    // can't say which number it wants.
    if (groups.some((g) => !groupReady(g, data))) return fail(400, "Answer the type question first.", "not_ready");

    const capture = await createCapture({
      lob: config.lob,
      sessionId: row.id,
      ownerUserId: row.ownerUserId,
      fieldKeys: keysForGroups(config, groups.map((g) => g.key)),
    });
    return NextResponse.json({
      success: true,
      capture: toSecureCaptureView(config, capture),
      url: buildSecureCaptureUrl(capture.token, row.locale ?? "en", undefined, config.secureSlug),
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token/secure-capture] POST`, error);
    return fail(500, "Failed to create link");
  }
}

/** GET — the agent's poll: the latest link and, once the client has sent it, the masked values. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const guard = await requireOwner(lob, token);
    if (guard.error) return guard.error;
    const { config, row } = guard;

    const capture = await getLatestCapture(row.id);
    const submitted = capture?.status === "submitted";
    return NextResponse.json({
      success: true,
      capture: capture ? toSecureCaptureView(config, capture) : null,
      url: capture?.status === "pending" ? buildSecureCaptureUrl(capture.token, row.locale ?? "en", undefined, config.secureSlug) : null,
      // Only what the client actually sent; before that the agent's own typing stays on screen.
      values: submitted ? maskedValues(config, (row.data ?? {}) as IntakeData, capture.fieldKeys ?? []) : {},
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token/secure-capture] GET`, error);
    return fail(500, "Failed to load");
  }
}

/** DELETE — revoke. The link stops working immediately. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const guard = await requireOwner(lob, token);
    if (guard.error) return guard.error;
    const cancelled = await cancelPendingCaptures(guard.row.id);
    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    console.error(`[intake/${lob}/:token/secure-capture] DELETE`, error);
    return fail(500, "Failed to cancel");
  }
}
