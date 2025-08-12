import { routing } from "@/i18n/routing";

/** Supported locales from your routing config */
export type SupportedLocale = "en" | "es";

/** Map "en" | "es" -> Open Graph locale */
export const ogLocaleOf = (locale: string) =>
  locale === "es" ? "es_ES" : "en_US";

/** Build /{locale}{localizedSlug} using routing.pathnames */
export function localizedPath(
  routeKey: keyof typeof routing.pathnames,
  locale: SupportedLocale
): string {
  const entry = routing.pathnames[routeKey];
  if (typeof entry === "string") return `/${locale}${entry}`;
  return `/${locale}${entry[locale]}`;
}

/** hreflang alternates using routing.pathnames */
export function languageAlternates(routeKey: keyof typeof routing.pathnames) {
  const entry = routing.pathnames[routeKey];
  if (typeof entry === "string") {
    return { "en-US": `/en${entry}`, "es-ES": `/es${entry}` };
  }
  return { "en-US": `/en${entry.en}`, "es-ES": `/es${entry.es}` };
}
