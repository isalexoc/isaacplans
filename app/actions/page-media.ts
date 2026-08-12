"use server";

import { getIsAdmin } from "@/lib/auth/admin";
import { setPageMedia } from "@/lib/page-media/settings";
import { LOB_SLUGS, MEDIA_KINDS, MEDIA_LOCALES, MEDIA_SURFACES } from "@/lib/page-media/shared";
import type { LobSlug, MediaKind, MediaLocale, MediaSurface } from "@/lib/page-media/shared";

/**
 * Clear a page's media override so it falls back to the built-in default ("Use default").
 *
 * Note the allowlists come straight from the shared constants rather than being retyped. The
 * module this replaces hardcoded `["final-expense", "iul", "aca"]` in the equivalent action and
 * was never updated when Life Insurance and Health Alternative were added — so resetting either of
 * those to default silently failed with "Invalid line of business" while uploads kept working.
 */
export async function resetPageMediaAction(
  lob: LobSlug,
  surface: MediaSurface,
  kind: MediaKind,
  locale: MediaLocale
): Promise<{ ok: boolean; error?: string }> {
  if (!(await getIsAdmin())) return { ok: false, error: "Not authorized." };

  if (!(LOB_SLUGS as string[]).includes(lob)) return { ok: false, error: "Invalid line of business" };
  if (!(MEDIA_SURFACES as string[]).includes(surface)) return { ok: false, error: "Invalid page" };
  if (!(MEDIA_KINDS as string[]).includes(kind)) return { ok: false, error: "Invalid media kind" };
  if (!(MEDIA_LOCALES as string[]).includes(locale)) return { ok: false, error: "Invalid locale" };

  const result = await setPageMedia(lob, surface, kind, locale, null);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
