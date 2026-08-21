import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { LOBS, LOB_SLUGS, mediaLocaleOf, surfacesFor, type HeroMedia, type LobSlug, type MediaKind, type MediaLocale, type MediaSurface, type PageMediaRow, type VideoPlayback } from "./shared";
import { defaultMedia } from "./defaults";
import { isAllowedCloudinaryUrl, isVideoUrl, withPinnedVideoTransform } from "./cloudinary-urls";

/**
 * Admin-editable hero + social-share media for every line-of-business page.
 *
 * Generalizes the former `lib/ads-images/settings.ts` (now retired) from the five get-covered ads funnels to three surfaces
 * (main / apply / ads) on all eight lines, and adds video. Still stored in the generic
 * `app_settings` key/value table — no migration, and none needed to add a surface later.
 *
 * **Two compatibility rules keep Isaac's existing overrides working untouched:**
 *  1. The `ads` surface still emits the exact key the old module used
 *     (`${prefix}_get_covered_${kind}_url_${locale}`), so every override already saved is read
 *     back by this code with no data migration.
 *  2. A stored value that is a bare `https://…` string is read as `{ type: "image", url }`. Only
 *     video (and its playback setting) needs the richer JSON form, so old rows parse as-is.
 *
 * Public reads go through `unstable_cache` (tag + hourly backstop) so the money pages do NOT hit
 * Neon on every ad click — see CLAUDE.md "Background Jobs & Cron" (keep Neon idle). Admin writes
 * revalidate the tag for an instant swap.
 */

export const PAGE_MEDIA_TAG = "page-media";

/** Short per-line key prefix. Unchanged from the ads-images module so old keys still resolve. */
const LOB_KEY_PREFIX: Record<LobSlug, string> = {
  aca: "aca",
  "short-term-medical": "stm",
  "dental-vision": "dv",
  "hospital-indemnity": "hi",
  iul: "iul",
  "life-insurance": "life",
  "health-alternative": "ha",
  "final-expense": "fe",
};

export function settingKey(
  lob: LobSlug,
  surface: MediaSurface,
  kind: MediaKind,
  locale: MediaLocale
): string {
  const prefix = LOB_KEY_PREFIX[lob];
  // Legacy shape for the ads funnels — this is what makes existing overrides survive.
  if (surface === "ads") return `${prefix}_get_covered_${kind}_url_${locale}`;
  return `pagemedia_${prefix}_${surface}_${kind}_${locale}`;
}

/** Serialize an override for storage. A plain image stays a bare URL, for backward compatibility. */
export function serializeMedia(media: HeroMedia): string {
  if (media.type === "image") return media.url;
  return JSON.stringify({
    t: "video",
    url: media.url,
    poster: media.posterUrl,
    posterCustom: media.posterCustom ? true : undefined,
    play: media.playback,
  });
}

/** Parse a stored value. Anything unrecognized returns null so the page falls back to its default. */
export function parseMedia(raw: string | null | undefined): HeroMedia | null {
  const value = raw?.trim();
  if (!value) return null;

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as {
        t?: string;
        url?: string;
        poster?: string;
        posterCustom?: boolean;
        play?: string;
      };
      if (parsed.t === "video" && parsed.url && isAllowedCloudinaryUrl(parsed.url)) {
        return {
          type: "video",
          // Normalised on read: the stored URL carries whatever transform was current when it was
          // uploaded, and a video must be on the one pinned format so only a single derived asset
          // ever exists. See `withPinnedVideoTransform`.
          url: withPinnedVideoTransform(parsed.url),
          posterUrl: parsed.poster && isAllowedCloudinaryUrl(parsed.poster) ? parsed.poster : "",
          posterCustom: parsed.posterCustom === true,
          playback: parsed.play === "click" ? "click" : "loop",
        };
      }
      if (parsed.url && isAllowedCloudinaryUrl(parsed.url)) {
        return { type: "image", url: parsed.url };
      }
      return null;
    } catch {
      return null;
    }
  }

  if (!isAllowedCloudinaryUrl(value)) return null;
  // A video URL saved in the legacy bare-string form would break `next/image`; treat it as video.
  if (isVideoUrl(value)) return { type: "video", url: value, posterUrl: "", playback: "loop" };
  return { type: "image", url: value };
}

/** Cached DB read of one key. Falls back to null on any error (e.g. table not migrated yet). */
const readOverrideCached = unstable_cache(
  async (key: string): Promise<string | null> => {
    try {
      const rows = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);
      return rows[0]?.value?.trim() || null;
    } catch {
      // Settings table may not exist yet (migration not applied) — use the default.
      return null;
    }
  },
  ["page-media-override"],
  { tags: [PAGE_MEDIA_TAG], revalidate: 3600 }
);

/**
 * What a page should actually render: the admin override if one is set and valid, otherwise the
 * built-in default. Safe to call on every render (cached).
 *
 * `fallbackUrl` covers the cells with no registered default — the main and apply social cards,
 * whose built-in value lives in a next-intl message the caller already has in hand.
 */
export async function getEffectivePageMedia(
  lob: LobSlug,
  surface: MediaSurface,
  kind: MediaKind,
  locale: string,
  opts: { fallbackUrl?: string } = {}
): Promise<HeroMedia> {
  const loc = mediaLocaleOf(locale);
  const override = parseMedia(await readOverrideCached(settingKey(lob, surface, kind, loc)));

  // A social card must be a still — a video override on `og` is ignored rather than shipped to
  // Facebook as a link preview it cannot play.
  if (override && !(kind === "og" && override.type === "video")) return override;

  const fallback = defaultMedia(lob, surface, kind, locale);
  // The cells with no registered default (main/apply social cards) come back with an empty URL —
  // those are the ones the caller supplies from its message key.
  return fallback.url ? fallback : { type: "image", url: opts.fallbackUrl || "" };
}

/** Convenience for `generateMetadata`, which only ever wants a URL string. */
export async function getEffectiveOgImageUrl(
  lob: LobSlug,
  surface: MediaSurface,
  locale: string,
  fallbackUrl?: string
): Promise<string> {
  const media = await getEffectivePageMedia(lob, surface, "og", locale, { fallbackUrl });
  return media.url;
}

/**
 * Every editable cell plus its current override, for the admin UI.
 *
 * One `inArray` query rather than the per-row lookup the ads module did — that was 20 round trips
 * then and would be ~84 now, all of them waking Neon on a page the agent opens regularly.
 */
export async function getPageMediaForAdmin(): Promise<PageMediaRow[]> {
  const cells: Array<Omit<PageMediaRow, "override">> = [];
  const keys: string[] = [];

  for (const lob of LOB_SLUGS) {
    for (const surface of surfacesFor(lob)) {
      for (const kind of ["hero", "og"] as MediaKind[]) {
        for (const locale of ["en", "es"] as MediaLocale[]) {
          cells.push({
            lob,
            surface,
            kind,
            locale,
            defaultMedia: defaultMedia(lob, surface, kind, locale),
          });
          keys.push(settingKey(lob, surface, kind, locale));
        }
      }
    }
  }

  let stored = new Map<string, string>();
  try {
    const rows = await db
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(inArray(appSettings.key, keys));
    stored = new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    // Table not migrated yet — every cell reads as "on the default".
  }

  return cells.map((cell, i) => ({
    ...cell,
    override: parseMedia(stored.get(keys[i])),
  }));
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Upsert (or clear, when `media` is null) an override, then revalidate the shared tag so every
 * live page picks it up immediately — no rebuild, no deploy.
 */
export async function setPageMedia(
  lob: LobSlug,
  surface: MediaSurface,
  kind: MediaKind,
  locale: MediaLocale,
  media: HeroMedia | null
): Promise<SaveResult> {
  const key = settingKey(lob, surface, kind, locale);

  if (media) {
    if (!isAllowedCloudinaryUrl(media.url)) {
      return {
        ok: false,
        error:
          "URL must be a Cloudinary file on res.cloudinary.com/isaacdev/… (that is the only host the page can display).",
      };
    }
    if (kind === "og" && media.type === "video") {
      return { ok: false, error: "A social share image has to be an image — link previews can't play video." };
    }
  }

  try {
    if (!media) {
      await db.delete(appSettings).where(eq(appSettings.key, key));
    } else {
      const value = serializeMedia(media);
      await db
        .insert(appSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: new Date() },
        });
    }
    revalidateTag(PAGE_MEDIA_TAG);
    return { ok: true };
  } catch (e) {
    console.error("[page-media] save failed:", e);
    return {
      ok: false,
      error: "Could not save. If this is the first use, apply the database migration (pnpm db:migrate).",
    };
  }
}

export { LOBS, LOB_SLUGS, mediaLocaleOf, surfacesFor };
export type { HeroMedia, LobSlug, MediaKind, MediaLocale, MediaSurface, PageMediaRow, VideoPlayback };
