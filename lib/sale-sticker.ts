/** Types + helpers for the sale-celebration WhatsApp sticker tool. */

export type SaleType = "in_person" | "telesales";
export type StickerLanguage = "en" | "es";
export type ClientTitle = "mr" | "mrs";

/** Canonical lead-source keys. Rendered labels are localized in sale-sticker-strings.ts. */
export type LeadSourceKey =
  | "live_transfer" // e.g. a live-transfer vendor call
  | "facebook"
  | "organic"
  | "cold"
  | "referral"
  | "returning"
  | "other";

export const SALE_TYPES: readonly SaleType[] = ["in_person", "telesales"] as const;
export const STICKER_LANGUAGES: readonly StickerLanguage[] = ["en", "es"] as const;
export const CLIENT_TITLES: readonly ClientTitle[] = ["mr", "mrs"] as const;
export const LEAD_SOURCE_KEYS: readonly LeadSourceKey[] = [
  "live_transfer",
  "facebook",
  "organic",
  "cold",
  "referral",
  "returning",
  "other",
] as const;

/** Optional phrase length cap (keeps the sticker uncluttered). */
export const MAX_PHRASE_CHARS = 15;
export const MAX_CLIENT_NAME_CHARS = 60;
export const MAX_LEAD_SOURCE_CUSTOM_CHARS = 24;

/** Editable sticker fields (persisted as columns, not a JSON blob). */
export type SaleStickerData = {
  clientName: string;
  clientTitle: ClientTitle; // Mr./Mrs. ↔ El Señor/La Señora
  leadSource: LeadSourceKey;
  leadSourceCustom: string; // used when leadSource === "other"
  saleType: SaleType;
  language: StickerLanguage;
  customPhrase: string; // optional
  extraImageUrl: string; // optional Cloudinary delivery URL
  extraImagePublicId: string; // optional
};

/** A saved sticker as returned by the API. */
export type SaleStickerRecord = SaleStickerData & {
  id: string;
  saleDate: string; // YYYY-MM-DD
  dailySequence: number; // 1..n for that day
  createdAt: string | null;
  updatedAt: string | null;
};

export function emptyStickerData(): SaleStickerData {
  return {
    clientName: "",
    clientTitle: "mr",
    leadSource: "live_transfer",
    leadSourceCustom: "",
    saleType: "in_person",
    language: "en",
    customPhrase: "",
    extraImageUrl: "",
    extraImagePublicId: "",
  };
}

export function parseSaleType(value: unknown): SaleType | null {
  return value === "in_person" || value === "telesales" ? value : null;
}

export function parseStickerLanguage(value: unknown): StickerLanguage | null {
  return value === "en" || value === "es" ? value : null;
}

export function parseClientTitle(value: unknown): ClientTitle | null {
  return value === "mr" || value === "mrs" ? value : null;
}

export function parseLeadSourceKey(value: unknown): LeadSourceKey | null {
  return typeof value === "string" && (LEAD_SOURCE_KEYS as readonly string[]).includes(value)
    ? (value as LeadSourceKey)
    : null;
}

/** Whether the form has enough to generate/save a sticker. */
export function isStickerComplete(data: Pick<SaleStickerData, "clientName" | "leadSource" | "leadSourceCustom">): boolean {
  if (!data.clientName.trim()) return false;
  if (data.leadSource === "other" && !data.leadSourceCustom.trim()) return false;
  return true;
}

/** Server-side validation → a clean SaleStickerData, or null if invalid. */
export function normalizeStickerData(raw: unknown): SaleStickerData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const clientName = typeof r.clientName === "string" ? r.clientName.trim() : "";
  if (!clientName) return null;

  const leadSource = parseLeadSourceKey(r.leadSource) ?? "live_transfer";
  const saleType = parseSaleType(r.saleType) ?? "in_person";
  const language = parseStickerLanguage(r.language) ?? "en";
  const clientTitle = parseClientTitle(r.clientTitle) ?? "mr";

  const leadSourceCustom =
    typeof r.leadSourceCustom === "string"
      ? r.leadSourceCustom.trim().slice(0, MAX_LEAD_SOURCE_CUSTOM_CHARS)
      : "";
  if (leadSource === "other" && !leadSourceCustom) return null;

  const customPhrase =
    typeof r.customPhrase === "string" ? r.customPhrase.trim().slice(0, MAX_PHRASE_CHARS) : "";

  const extraImageUrl = typeof r.extraImageUrl === "string" ? r.extraImageUrl.trim() : "";
  const extraImagePublicId =
    typeof r.extraImagePublicId === "string" ? r.extraImagePublicId.trim() : "";

  return {
    clientName: clientName.slice(0, MAX_CLIENT_NAME_CHARS),
    clientTitle,
    leadSource,
    leadSourceCustom,
    saleType,
    language,
    customPhrase,
    extraImageUrl,
    extraImagePublicId,
  };
}

/** Local (agent timezone) date as YYYY-MM-DD — used for the daily counter. */
export function todayLocalDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Basic YYYY-MM-DD guard for values coming from the client. */
export function isValidSaleDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Matches combining diacritical marks (U+0300–U+036F) so accents are stripped.
const COMBINING_MARKS = /[̀-ͯ]/g;

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "sale";
}

/** Download filename, e.g. sale-sticker-maria-garcia-3-2026-07-13.png */
export function saleStickerFilenameSlug(
  clientName: string,
  dailySequence: number,
  saleDate: string,
  extension: "png" | "webp"
): string {
  return `sale-sticker-${slugify(clientName)}-${dailySequence}-${saleDate}.${extension}`;
}
