/**
 * Admin authorization helper.
 *
 * Mirrors the existing convention used by /presentations: a Clerk user is an admin when
 * `publicMetadata.role === "admin"`. Set this once per agent in the Clerk dashboard.
 *
 * Use `getIsAdmin()` in server components and API routes to gate admin-only surfaces.
 * Client-facing pages (e.g. the IUL intake form a client fills via their link) must NOT
 * use this — they are token-scoped and access-controlled per session instead.
 */

import { currentUser } from "@clerk/nextjs/server";

export async function getIsAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    return user?.publicMetadata?.role === "admin";
  } catch {
    return false;
  }
}
