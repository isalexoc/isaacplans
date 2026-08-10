/**
 * Access control for token-scoped intake sessions, shared by Final Expense, ACA and IUL.
 *
 * The rule: the agent who owns the session always gets in. Otherwise the caller needs the
 * unguessable token *plus* proof of continuity — the device cookie that claimed the session, or
 * the Clerk id it was bound to back when signing in was required. An unclaimed session is
 * claimable by whoever opens it first, which is safe precisely because the token is unguessable.
 *
 * Claiming keys off `clientDeviceId` alone, deliberately. A session created under the old
 * sign-in flow has a `clientUserId` but no device binding, and a client mid-application must be
 * able to continue from the same link without being sent to a login screen they never needed.
 */

export type IntakeCaller = {
  /** Clerk user id, when the caller happens to be signed in (the agent always is). */
  userId?: string | null;
  /** Device id from the httpOnly cookie — how an anonymous client proves continuity. */
  deviceId?: string | null;
};

export type IntakeRole = "owner" | "client";

export type IntakeAccess = {
  allowed: boolean;
  /** The session is unclaimed: bind it to this caller's device on the way through. */
  shouldClaim: boolean;
  role: IntakeRole;
  /** Denied because a different browser already claimed the link (vs. simply not found). */
  claimedByOtherDevice: boolean;
};

/** The subset of an intake session row that access control needs. */
export type IntakeAccessRow = {
  ownerUserId: string;
  clientUserId: string | null;
  clientDeviceId: string | null;
  expiresAt?: Date | null;
};

const DENIED: IntakeAccess = {
  allowed: false,
  shouldClaim: false,
  role: "client",
  claimedByOtherDevice: false,
};

export function resolveIntakeAccess(row: IntakeAccessRow, caller: IntakeCaller): IntakeAccess {
  const userId = caller.userId ?? null;
  const deviceId = caller.deviceId ?? null;

  if (userId && row.ownerUserId === userId) {
    return { allowed: true, shouldClaim: false, role: "owner", claimedByOtherDevice: false };
  }
  // Sessions created before passwordless access stay reachable by their bound Clerk user.
  if (userId && row.clientUserId === userId) {
    return { allowed: true, shouldClaim: false, role: "client", claimedByOtherDevice: false };
  }
  if (deviceId && row.clientDeviceId === deviceId) {
    return { allowed: true, shouldClaim: false, role: "client", claimedByOtherDevice: false };
  }
  // Unclaimed by any browser — including a legacy Clerk-bound session — so this device claims it.
  if (!row.clientDeviceId && deviceId) {
    return { allowed: true, shouldClaim: true, role: "client", claimedByOtherDevice: false };
  }
  return { ...DENIED, claimedByOtherDevice: Boolean(row.clientDeviceId) };
}

/**
 * How long a passwordless intake link stays usable. Long enough that a client can finish over a
 * few days, short enough that an old link in a text thread stops being a live credential. The
 * agent can always issue a fresh one with "Reset link".
 */
export const INTAKE_LINK_TTL_DAYS = 30;
export const INTAKE_LINK_TTL_MS = INTAKE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Rows predating link expiry have a null `expiresAt` and never expire. */
export function isIntakeExpired(row: { expiresAt?: Date | null }): boolean {
  return Boolean(row.expiresAt && row.expiresAt.getTime() < Date.now());
}

export function intakeLinkExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INTAKE_LINK_TTL_MS);
}
