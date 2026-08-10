/**
 * IUL intake device identity. Thin wrapper over lib/intake-shared/device.ts so each line of
 * business keeps its own cookie — a browser that claimed an IUL session and an ACA session holds
 * two independent bindings.
 */

import "server-only";
import { readDeviceId, ensureDeviceId } from "@/lib/intake-shared/device";

export const IUL_DEVICE_COOKIE = "iul_intake_device";

export function readIulDeviceId(): Promise<string | null> {
  return readDeviceId(IUL_DEVICE_COOKIE);
}

export function ensureIulDeviceId(): Promise<string> {
  return ensureDeviceId(IUL_DEVICE_COOKIE);
}
