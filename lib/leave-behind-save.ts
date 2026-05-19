import type { LeaveBehindQuoteType } from "@/lib/leave-behind-clients";
import type { PackageQuoteData } from "@/lib/leave-behind-clients";
import { toPackageData } from "@/lib/leave-behind-package";
import {
  validatePackageForSave,
  validateQuoteData,
} from "@/lib/leave-behind-clients-server";

/** Resolve POST/PATCH body to package data (new saves always stored as package). */
export function resolvePackageDataForSave(
  requestedType: LeaveBehindQuoteType,
  raw: unknown
): PackageQuoteData | null {
  const direct = validatePackageForSave(raw);
  if (direct) return direct;

  const legacy = validateQuoteData(requestedType, raw);
  if (!legacy) return null;

  return toPackageData(requestedType, legacy);
}
