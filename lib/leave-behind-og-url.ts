import {
  localizedSlug,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";

const SITE_URL = "https://www.isaacplans.com";

const ROUTE_KEY = "/final-expense/leave-behind" as const;

/** Absolute URL for the dynamic Open Graph image (1200×630). */
export function leaveBehindOgImageUrl(locale: SupportedLocale): string {
  const slug = withLocalePrefix(locale, localizedSlug(ROUTE_KEY, locale));
  return `${SITE_URL}${slug}/opengraph-image`;
}
