/**
 * Device identity for the shared intake engine. Thin wrapper over lib/intake-shared/device.ts,
 * reading the cookie name off the line of business's config so each line keeps an independent
 * binding — a browser that claimed a Dental session and a Life session holds two cookies, and
 * losing one never invalidates the other.
 */

import "server-only";
import { readDeviceId, ensureDeviceId } from "@/lib/intake-shared/device";
import type { IntakeLobConfig } from "./types";

export function readIntakeDeviceId(config: IntakeLobConfig): Promise<string | null> {
  return readDeviceId(config.cookieName);
}

/** Mints and sets a cookie when absent — only callable from a Route Handler or Server Action. */
export function ensureIntakeDeviceId(config: IntakeLobConfig): Promise<string> {
  return ensureDeviceId(config.cookieName);
}
