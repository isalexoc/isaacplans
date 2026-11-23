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
import { getIntakeConfig } from "@/lib/intake-configs";
import {
  classifySignedInCaller,
  logDeniedAccess,
  ownerAgentOf,
  requestIdentity,
} from "@/lib/tenancy/context";
import { readTenancyGates } from "@/lib/tenancy/gates";
import { callerIsOperator, decideTokenAccess, type SignedInCallerKind } from "@/lib/tenancy/operator";
import { appSurface } from "@/lib/tenancy/surface";
import { ensureIntakeDeviceId, readIntakeDeviceId } from "./device";
import { bindClientDevice, getIntakeByToken, isIntakeExpired } from "./server";
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

/** A fact the access decision needs couldn't be read (a failed lookup): nothing was decided. */
export function retryLater() {
  return NextResponse.json(
    { success: false, error: "Please try again in a moment.", code: "retry" },
    { status: 503, headers: { "Retry-After": "5" } }
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
 *
 * The rule (lib/tenancy/operator.ts `decideTokenAccess`): the owner gets in, as before; an agent
 * owner only while that agent may operate. A signed-in operator (admin or agent) who is NOT the
 * owner is denied with 403, audited, and never claims or binds this browser; the only exception is
 * an application they started themselves as a visitor, which is already bound to them. Everyone
 * else keeps the token + device-cookie rule. An agent's application is a 404 to its client while
 * that agent is paused or the launch gates are closed, and Isaac's are a 404 on the product domain.
 * A failed `agents` lookup is a 503, never "not an agent". For Isaac's sessions (owner listed in
 * env), his anonymous clients and any caller already bound to the session this costs no lookup.
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

  const { userId, actor } = await requestIdentity();
  const impersonated = Boolean(actor);
  const callerIsOwner = Boolean(userId) && userId === row.ownerUserId;
  const ownerAgent = await ownerAgentOf(row.ownerUserId);
  // Can't tell whether this is an agent's application (`decideTokenAccess` says the same): stop
  // before classifying anyone or minting a cookie.
  if (ownerAgent === "unknown") return retryLater();
  const existingDeviceId = await readIntakeDeviceId(config);
  // The session's bound client gets in whatever else they are (lib/intake-shared/access.ts), so
  // their saves never pay for, or fail on, the classification below.
  const boundCaller =
    Boolean(existingDeviceId && row.clientDeviceId === existingDeviceId) ||
    Boolean(userId && row.clientUserId === userId);
  const callerKind: SignedInCallerKind =
    userId && !callerIsOwner && !boundCaller
      ? await classifySignedInCaller(userId, { ownerIsAgent: ownerAgent !== null })
      : "client";
  // An operator who isn't the owner gets no cookie minted: they can't claim, so there is nothing
  // to bind it to.
  const mayMint = !userId || callerIsOwner || !callerIsOperator(callerKind, impersonated);
  const deviceId = opts.claim && mayMint ? await ensureIntakeDeviceId(config) : existingDeviceId;

  const decision = decideTokenAccess({
    lob: config.lob,
    row,
    userId,
    deviceId,
    impersonated,
    callerKind,
    ownerAgent,
    surface: appSurface(),
    gates: readTenancyGates(),
  });
  if (decision.outcome === "retry") return retryLater();
  if (decision.outcome === "unavailable") return notFound();
  if (decision.outcome === "deny") {
    if (decision.audit && userId) {
      await logDeniedAccess({
        actorUserId: userId,
        actorRole: callerIsOwner ? "agent" : callerKind,
        actor,
        row,
      });
    }
    return forbidden(decision.claimedByOtherDevice);
  }
  const { access } = decision;
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
