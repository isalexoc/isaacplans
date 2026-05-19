import type { PackageQuoteData } from "@/lib/leave-behind-clients";
import { emptyPackageData, toPackageData } from "@/lib/leave-behind-package";

const DRAFT_STORAGE_KEY = "leave-behind-package-draft";

type PackageDraftPayload = {
  quoteData: PackageQuoteData;
  savedAt: string;
};

export function readLeaveBehindPackageDraft(): PackageQuoteData | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PackageDraftPayload;
    if (!parsed?.quoteData || typeof parsed.quoteData !== "object") return null;
    return toPackageData("package", parsed.quoteData);
  } catch {
    return null;
  }
}

export function writeLeaveBehindPackageDraft(quoteData: PackageQuoteData): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: PackageDraftPayload = {
      quoteData,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function clearLeaveBehindPackageDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function initialPackageDataFromProps(
  initialData: PackageQuoteData | null | undefined
): PackageQuoteData {
  return resolveInitialPackageData(initialData).data;
}

export function resolveInitialPackageData(
  initialData: PackageQuoteData | null | undefined
): { data: PackageQuoteData; fromDraft: boolean } {
  if (initialData) return { data: { ...initialData }, fromDraft: false };
  const draft = readLeaveBehindPackageDraft();
  if (draft) return { data: draft, fromDraft: true };
  return { data: emptyPackageData(), fromDraft: false };
}
