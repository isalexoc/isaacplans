import { routing } from "@/i18n/routing";

/** Supported locales */
export type SupportedLocale = "en" | "es";

/** Map "en" | "es" -> Open Graph locale */
export const ogLocaleOf = (locale: string) =>
  locale === "es" ? "es_ES" : "en_US";

/** 1) Get the localized slug exactly as defined in routing.pathnames
 *    (NO locale prefix; always starts with "/")
 */
export function localizedSlug(
  routeKey: keyof typeof routing.pathnames,
  locale: SupportedLocale
): string {
  const entry = routing.pathnames[routeKey];
  return typeof entry === "string" ? entry : entry[locale];
}

/** 2) Add locale prefix safely: "/en" + "/" -> "/en"
 *    Normalizes extra slashes and avoids "/es/es" if someone
 *    accidentally puts "/es" into routing.pathnames.
 */
export function withLocalePrefix(
  locale: SupportedLocale,
  slug: string
): string {
  const clean = slug.startsWith("/") ? slug : `/${slug}`;
  // Special-case root so "/en" (not "/en/")
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}

/** hreflang alternates (prefixed) */
export function languageAlternatesPrefixed(
  routeKey: keyof typeof routing.pathnames
): Record<string, string> {
  const enSlug = localizedSlug(routeKey, "en");
  const esSlug = localizedSlug(routeKey, "es");
  return {
    "en-US": withLocalePrefix("en", enSlug),
    "es-ES": withLocalePrefix("es", esSlug),
  };
}

/** x-default: use your global default (usually English) */
export const xDefaultHref = withLocalePrefix("en", "/");
