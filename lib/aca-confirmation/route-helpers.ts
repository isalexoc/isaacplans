/**
 * Small pieces shared by the ACA confirmation API routes. Server-only.
 */

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * The admin gate every admin route repeats (middleware also gates /api/admin/*). Returns the
 * Clerk user id, or the response to send back.
 */
export async function requireAdminUser(): Promise<string | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!(await getIsAdmin())) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  return userId;
}

/**
 * Origin for the client's signing link. Production links always use NEXT_PUBLIC_SITE_URL (the
 * default in share-url.ts); only when it's unset (local dev) does the request's own origin win,
 * so a link made on localhost opens on localhost.
 */
export function linkOriginOf(request: NextRequest): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL ? undefined : request.nextUrl.origin;
}

export function apiError(status: number, error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}
