/**
 * ACA intake device identity. Thin wrapper over lib/intake-shared/device.ts so each line of
 * business keeps its own cookie — a browser that claimed an ACA session and a Final Expense
 * session holds two independent bindings.
 */

import "server-only";
import { readDeviceId, ensureDeviceId } from "@/lib/intake-shared/device";

export const ACA_DEVICE_COOKIE = "aca_intake_device";

export function readAcaDeviceId(): Promise<string | null> {
  return readDeviceId(ACA_DEVICE_COOKIE);
}

export function ensureAcaDeviceId(): Promise<string> {
  return ensureDeviceId(ACA_DEVICE_COOKIE);
}
