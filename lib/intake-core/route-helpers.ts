/**
 * Shared plumbing for the `/api/intake/[lob]/**` handlers.
 *
 * Every route repeats the same four steps — resolve the `[lob]` segment to a config, load the row,
 * work out whether the caller may touch it, and answer with one of a small set of error shapes.
 * The three original intakes copy that dance into each of their eight routes; here it lives once.
 *
 * The error bodies are load bearing: the form distinguishes `claimed_elsewhere` from a plain
 * denial, and `expired` from either, to show the right recovery message.
 */

import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIntakeConfig } from "@/lib/intake-configs";
import { ensureIntakeDeviceId, readIntakeDeviceId } from "./device";
import { bindClientDevice, canAccessIntake, getIntakeByToken, isIntakeExpired } from "./server";
import type { IntakeSessionRow } from "./server";
import type { IntakeLobConfig } from "./types";
import type { IntakeAccess } from "@/lib/intake-shared/access";

export function notFound() {
  return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

/** Distinguishes "someone else opened this link" from a plain denial, so the form can explain. */
export function forbidden(claimedByOtherDevice = false) {
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

export function expired() {
  return NextResponse.json(
    { success: false, error: "This link has expired. Please call us for a new one.", code: "expired" },
    { status: 410 }
  );
}

export function alreadySubmitted() {
  return NextResponse.json(
    { success: false, error: "This form has already been submitted." },
    { status: 403 }
  );
}

/** Resolve the `[lob]` route segment. An unknown or legacy slug is a 404, not a 500. */
export function resolveConfig(lob: string): IntakeLobConfig | null {
  return getIntakeConfig(lob) ?? null;
}

export type AuthorizedSession = {
  config: IntakeLobConfig;
  row: IntakeSessionRow;
  access: IntakeAccess;
  deviceId: string | null;
};

/**
 * Load a token-scoped session and authorize the caller, or return the NextResponse to send back.
 *
 * `claim: true` mints a device cookie when the caller has none, which is what lets the first
 * browser to open an unclaimed link take ownership of it. Read-only endpoints that must not claim
 * (completion, for instance, where the client already holds the cookie) pass false.
 */
export async function loadAuthorizedSession(
  lob: string,
  token: string,
  opts: { claim?: boolean } = {}
): Promise<AuthorizedSession | NextResponse> {
  const config = resolveConfig(lob);
  if (!config) return notFound();

  const row = await getIntakeByToken(config, token);
  if (!row) return notFound();

  const { userId } = await auth();
  const deviceId = opts.claim
    ? await ensureIntakeDeviceId(config)
    : await readIntakeDeviceId(config);

  const access = canAccessIntake(row, { userId, deviceId });
  if (!access.allowed) return forbidden(access.claimedByOtherDevice);
  if (access.role === "client" && isIntakeExpired(row)) return expired();

  if (opts.claim && access.shouldClaim && deviceId) {
    await bindClientDevice(token, deviceId);
    row.clientDeviceId = deviceId;
  }

  return { config, row, access, deviceId };
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
