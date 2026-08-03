import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import {
  getFinalExpenseGetCoveredHeroImageUrl,
  getFinalExpenseGetCoveredOgImageUrl,
  getIulGetCoveredHeroImageUrl,
  getIulGetCoveredOgImageUrl,
  getAcaGetCoveredHeroImageUrl,
  getAcaGetCoveredOgImageUrl,
} from "@/lib/get-covered-fast/constants";
import {
  ADS_LOBS,
  ADS_IMAGE_KINDS,
  ADS_LOCALES,
  type AdsLob,
  type AdsImageKind,
  type AdsLocale,
  type AdsImageSettingRow,
} from "./shared";

export type { AdsLob, AdsImageKind, AdsLocale, AdsImageSettingRow };
export {
  ADS_LOBS,
  ADS_IMAGE_KINDS,
  ADS_LOCALES,
  ADS_LOB_LABELS,
  ADS_LOB_LIVE_PATH,
} from "./shared";

/**
 * Admin-editable hero + OG image overrides for the paid-ads "get covered" landing pages —
 * Final Expense, IUL, and ACA today (add a line of business by extending `ADS_LOBS` below).
 *
 * Stored per (line of business, image kind, locale) in the `app_settings` key/value table so
 * Isaac can swap creative or A/B test without a deploy. Public reads go through
 * `unstable_cache` (tag + hourly backstop) so the money pages do NOT hit Neon on every ad click
 * — see CLAUDE.md "Background Jobs & Cron" (keep Neon idle). Admin writes revalidate the tag
 * for an instant swap.
 *
 * Only Cloudinary `res.cloudinary.com/isaacdev/...` URLs are accepted, because that host is the
 * only one allowed by next/image `remotePatterns` — anything else would break the `<Image>` on
 * the live page (hero) or just not render correctly as a social card (OG).
 *
 * Key format is `${lobPrefix}_get_covered_${kind}_url_${locale}` — the final-expense hero keys
 * (`fe_get_covered_hero_url_en`/`_es`) are unchanged from the original single-LOB, hero-only
 * version of this file, so any override Isaac already saved keeps working with no migration.
 */

const LOB_KEY_PREFIX: Record<AdsLob, string> = {
  "final-expense": "fe",
  iul: "iul",
  aca: "aca",
};

const DEFAULT_GETTERS: Record<AdsLob, Record<AdsImageKind, (locale: string) => string>> = {
  "final-expense": {
    hero: getFinalExpenseGetCoveredHeroImageUrl,
    og: getFinalExpenseGetCoveredOgImageUrl,
  },
  iul: { hero: getIulGetCoveredHeroImageUrl, og: getIulGetCoveredOgImageUrl },
  aca: { hero: getAcaGetCoveredHeroImageUrl, og: getAcaGetCoveredOgImageUrl },
};

export const ADS_IMAGES_TAG = "ads-images";

function settingKey(lob: AdsLob, kind: AdsImageKind, locale: AdsLocale): string {
  return `${LOB_KEY_PREFIX[lob]}_get_covered_${kind}_url_${locale}`;
}

/** Normalize any locale (e.g. "es-US") to the two we key on. */
export function adsLocaleOf(locale: string): AdsLocale {
  return locale?.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Guard: only allow Cloudinary isaacdev URLs (the sole next/image-allowed host here). */
export function isAllowedAdsImageUrl(url: string): boolean {
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
      return value && isAllowedAdsImageUrl(value) ? value : null;
    } catch {
      // Settings table may not exist yet (migration not applied) — use the default.
      return null;
    }
  },
  ["ads-images-override"],
  { tags: [ADS_IMAGES_TAG], revalidate: 3600 }
);

/**
 * Effective image URL for the public page: the admin override if set and valid, otherwise the
 * built-in default. Safe to call on every render (cached).
 */
export async function getEffectiveAdsImageUrl(
  lob: AdsLob,
  kind: AdsImageKind,
  locale: string
): Promise<string> {
  const loc = adsLocaleOf(locale);
  const key = settingKey(lob, kind, loc);
  const override = await readOverrideCached(key);
  return override ?? DEFAULT_GETTERS[lob][kind](locale);
}

/** Uncached read of every (lob × kind × locale) row + defaults, for the admin UI. */
export async function getAdsImageSettingsForAdmin(): Promise<AdsImageSettingRow[]> {
  const rows = await Promise.all(
    ADS_LOBS.flatMap((lob) =>
      ADS_IMAGE_KINDS.flatMap((kind) =>
        ADS_LOCALES.map(async (locale) => {
          const key = settingKey(lob, kind, locale);
          let override: string | null = null;
          try {
            const found = await db
              .select({ value: appSettings.value })
              .from(appSettings)
              .where(eq(appSettings.key, key))
              .limit(1);
            override = found[0]?.value?.trim() || null;
          } catch {
            override = null;
          }
          return {
            lob,
            kind,
            locale,
            override,
            defaultUrl: DEFAULT_GETTERS[lob][kind](locale),
          } satisfies AdsImageSettingRow;
        })
      )
    )
  );
  return rows;
}

/**
 * Upsert (or clear, when `url` is empty) an image override, then revalidate the shared cache
 * tag so every live page picks it up immediately.
 */
export async function setAdsImageOverride(
  lob: AdsLob,
  kind: AdsImageKind,
  locale: AdsLocale,
  url: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = settingKey(lob, kind, locale);
  const trimmed = url.trim();

  try {
    if (!trimmed) {
      await db.delete(appSettings).where(eq(appSettings.key, key));
    } else {
      if (!isAllowedAdsImageUrl(trimmed)) {
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
    revalidateTag(ADS_IMAGES_TAG);
    return { ok: true };
  } catch (e) {
    console.error("[ads-images] save failed:", e);
    return {
      ok: false,
      error:
        "Could not save. If this is the first use, apply the database migration (pnpm db:migrate).",
    };
  }
}
