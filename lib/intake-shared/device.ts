/**
 * Device identity for passwordless intake access, shared by the Final Expense, ACA and IUL
 * intakes.
 *
 * Every intake link carries a 24-char nanoid (~144 bits) — unguessable, the same strength as a
 * password-reset link — so the URL itself is the credential and no account is required. To keep a
 * forwarded or leaked link from being usable, the first browser to open a session claims it: we
 * mint a random device id, store it in an httpOnly cookie, and bind it to the row. Later requests
 * must present that cookie (the agent, authenticated through Clerk, always has access).
 *
 * The cookie name is a parameter rather than a constant so each line of business keeps its own
 * binding — and so adding this to ACA/IUL could never invalidate the Final Expense cookies
 * already sitting in clients' browsers.
 *
 * Recovery for a genuinely lost device: the agent resets the link from the dashboard, which
 * rotates the token and clears the binding.
 */

import "server-only";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";

/** A year — the cookie only needs to outlive the link, which expires far sooner. */
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/** Read the caller's device id for one intake line, if their browser has one. */
export async function readDeviceId(cookieName: string): Promise<string | null> {
  const store = await cookies();
  const value = store.get(cookieName)?.value?.trim();
  return value ? value : null;
}

/**
 * Read the caller's device id, minting and setting one when absent.
 * Only callable from a Route Handler or Server Action — Server Components cannot set cookies.
 */
export async function ensureDeviceId(cookieName: string): Promise<string> {
  const store = await cookies();
  const existing = store.get(cookieName)?.value?.trim();
  if (existing) return existing;

  const deviceId = nanoid(32);
  store.set(cookieName, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
  return deviceId;
}
