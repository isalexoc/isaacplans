"use server";

import { getIsAdmin } from "@/lib/auth/admin";
import {
  setAdsImageOverride,
  type AdsLob,
  type AdsImageKind,
  type AdsLocale,
} from "@/lib/ads-images/settings";

const VALID_LOBS: AdsLob[] = ["final-expense", "iul", "aca"];
const VALID_KINDS: AdsImageKind[] = ["hero", "og"];
const VALID_LOCALES: AdsLocale[] = ["en", "es"];

/** Save (or clear, when `url` is empty) an ads-page hero/OG image override. */
export async function saveAdsImageAction(
  lob: AdsLob,
  kind: AdsImageKind,
  locale: AdsLocale,
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!VALID_LOBS.includes(lob)) {
    return { ok: false, error: "Invalid line of business" };
  }
  if (!VALID_KINDS.includes(kind)) {
    return { ok: false, error: "Invalid image kind" };
  }
  if (!VALID_LOCALES.includes(locale)) {
    return { ok: false, error: "Invalid locale" };
  }
  const result = await setAdsImageOverride(lob, kind, locale, url);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
