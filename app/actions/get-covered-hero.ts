"use server";

import { getIsAdmin } from "@/lib/auth/admin";
import {
  setFeGetCoveredHeroOverride,
  type HeroLocale,
} from "@/lib/get-covered-fast/hero-setting";

/** Save (or clear, when `url` is empty) the get-covered hero override for one locale. */
export async function saveHeroImageAction(
  locale: HeroLocale,
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (locale !== "es" && locale !== "en") {
    return { ok: false, error: "Invalid locale" };
  }
  const result = await setFeGetCoveredHeroOverride(locale, url);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
