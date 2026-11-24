/**
 * Staff access for server components and API routes: who the caller is, read once per request.
 *
 * Every other admin surface keeps calling `getIsAdmin()` (lib/auth/admin.ts), unchanged, so it keeps
 * rejecting a scoped role. Only the Legal Shield line's pages and the engine routes use this. The
 * decisions themselves are pure, in ./staff-roles (tested by `pnpm test:staff-access`).
 */

import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canOperateLine, roleFromMetadata, type StaffRole } from "./staff-roles";

export {
  canOperateLine,
  canOperateSession,
  roleFromMetadata,
  LEGAL_SHIELD_HOME,
  type StaffRole,
} from "./staff-roles";

export type StaffAccess = {
  userId: string | null;
  role: StaffRole | null;
  isAdmin: boolean;
};

/** The caller's staff access, read once per request. */
export const getStaffAccess = cache(async (): Promise<StaffAccess> => {
  try {
    const { userId } = await auth();
    if (!userId) return { userId: null, role: null, isAdmin: false };
    const user = await currentUser();
    const role = roleFromMetadata(user?.publicMetadata);
    return { userId, role, isAdmin: role === "admin" };
  } catch {
    return { userId: null, role: null, isAdmin: false };
  }
});

/** For an API route: the operator's access, or the 401/403 to return. */
export async function requireLineOperator(
  lob: string
): Promise<{ access: StaffAccess & { userId: string } } | { error: NextResponse }> {
  const access = await getStaffAccess();
  if (!access.userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canOperateLine(access, lob)) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { access: access as StaffAccess & { userId: string } };
}
