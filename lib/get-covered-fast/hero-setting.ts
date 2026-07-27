import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { getFinalExpenseGetCoveredHeroImageUrl } from "@/lib/get-covered-fast/constants";

/**
 * Admin-editable hero image override for the final-expense get-covered ads page.
 *
 * Stored per locale in the `app_settings` key/value table so Isaac can A/B test hero
 * art without a deploy. Public reads go through `unstable_cache` (tag + hourly backstop)
 * so the money page does NOT hit Neon on every ad click — see CLAUDE.md "Background Jobs
 * & Cron" (keep Neon idle). Admin writes revalidate the tag for an instant swap.
 *
 * Only Cloudinary `res.cloudinary.com/isaacdev/...` URLs are accepted, because that host
 * is the only one allowed by next/image `remotePatterns` — anything else would break the
 * `<Image>` on the live page.
 */

export type HeroLocale = "es" | "en";

export const FE_GET_COVERED_HERO_TAG = "fe-get-covered-hero";

const KEY_BY_LOCALE: Record<HeroLocale, string> = {
  es: "fe_get_covered_hero_url_es",
  en: "fe_get_covered_hero_url_en",
};

/** Normalize any locale (e.g. "es-US") to the two we key on. */
export function heroLocaleOf(locale: string): HeroLocale {
  return locale?.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Guard: only allow Cloudinary isaacdev URLs (the sole next/image-allowed host here). */
export function isAllowedHeroUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https:\/\/res\.cloudinary\.com\/isaacdev\/.+/i.test(trimmed);
}

/** Cached DB read of one override key. Falls back to null on any error (e.g. table not migrated yet). */
const readOverrideCached = unstable_cache(
  async (settingKey: string): Promise<string | null> => {
    try {
      const rows = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, settingKey))
        .limit(1);
      const value = rows[0]?.value?.trim();
      return value && isAllowedHeroUrl(value) ? value : null;
    } catch {
      // Settings table may not exist yet (migration not applied) — use the default.
      return null;
    }
  },
  ["fe-get-covered-hero-override"],
  { tags: [FE_GET_COVERED_HERO_TAG], revalidate: 3600 }
);

/**
 * Effective hero image URL for the public page: the admin override if set and valid,
 * otherwise the built-in locale default. Safe to call on every render (cached).
 */
export async function getEffectiveFeGetCoveredHeroUrl(locale: string): Promise<string> {
  const key = KEY_BY_LOCALE[heroLocaleOf(locale)];
  const override = await readOverrideCached(key);
  return override ?? getFinalExpenseGetCoveredHeroImageUrl(locale);
}

export type HeroSettingRow = {
  locale: HeroLocale;
  override: string | null;
  defaultUrl: string;
};

/** Uncached read of both locales' current values + defaults, for the admin UI. */
export async function getFeGetCoveredHeroSettingsForAdmin(): Promise<HeroSettingRow[]> {
  const locales: HeroLocale[] = ["es", "en"];
  const rows = await Promise.all(
    locales.map(async (locale) => {
      let override: string | null = null;
      try {
        const found = await db
          .select({ value: appSettings.value })
          .from(appSettings)
          .where(eq(appSettings.key, KEY_BY_LOCALE[locale]))
          .limit(1);
        const value = found[0]?.value?.trim();
        override = value || null;
      } catch {
        override = null;
      }
      return {
        locale,
        override,
        defaultUrl: getFinalExpenseGetCoveredHeroImageUrl(locale),
      } satisfies HeroSettingRow;
    })
  );
  return rows;
}

/**
 * Upsert (or clear, when `url` is empty) the hero override for a locale, then revalidate
 * the cache tag so the live page picks it up immediately.
 */
export async function setFeGetCoveredHeroOverride(
  locale: HeroLocale,
  url: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = KEY_BY_LOCALE[locale];
  const trimmed = url.trim();

  try {
    if (!trimmed) {
      await db.delete(appSettings).where(eq(appSettings.key, key));
    } else {
      if (!isAllowedHeroUrl(trimmed)) {
        return {
          ok: false,
          error:
            "URL must be a Cloudinary image on res.cloudinary.com/isaacdev/… (that is the only host the page can display).",
        };
      }
      await db
        .insert(appSettings)
        .values({ key, value: trimmed, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: trimmed, updatedAt: new Date() },
        });
    }
    revalidateTag(FE_GET_COVERED_HERO_TAG);
    return { ok: true };
  } catch (e) {
    console.error("[fe-get-covered-hero] save failed:", e);
    return {
      ok: false,
      error:
        "Could not save. If this is the first use, apply the database migration (pnpm db:migrate).",
    };
  }
}
