import { emptyStickerData, type SaleStickerData } from "@/lib/sale-sticker";

const DRAFT_STORAGE_KEY = "sale-sticker-draft";

type StickerDraftPayload = {
  data: SaleStickerData;
  savedAt: string;
};

export function readSaleStickerDraft(): SaleStickerData | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StickerDraftPayload;
    if (!parsed?.data || typeof parsed.data !== "object") return null;
    // Merge over defaults so older/partial drafts stay valid.
    return { ...emptyStickerData(), ...parsed.data };
  } catch {
    return null;
  }
}

export function writeSaleStickerDraft(data: SaleStickerData): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: StickerDraftPayload = { data, savedAt: new Date().toISOString() };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function clearSaleStickerDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
