/**
 * Which quote modal the header "Free quote" CTA should open based on the current route.
 * Uses logical and localized pathnames (next-intl `usePathname()` is locale-stripped in many setups;
 * we match both EN and ES URL segments where they differ).
 */
export type HeaderQuoteModalKind =
  | "aca"
  | "iul"
  | "stm"
  | "dental"
  | "hi"
  | "fe"
  | "general";

export function getHeaderQuoteModalKind(pathname: string): HeaderQuoteModalKind {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (p === "/" || p === "") return "general";

  if (p.startsWith("/aca")) return "aca";
  if (p.startsWith("/iul")) return "iul";

  if (
    p.startsWith("/short-term-medical") ||
    p.startsWith("/cobertura-a-corto-plazo") ||
    p.startsWith("/carriers/uhone/shortterm")
  ) {
    return "stm";
  }

  if (p.startsWith("/dental-vision")) return "dental";

  if (
    p.startsWith("/hospital-indemnity") ||
    p.startsWith("/indemnizacion-hospitalaria")
  ) {
    return "hi";
  }

  if (p.startsWith("/final-expense") || p.startsWith("/gastos-finales")) {
    return "fe";
  }

  return "general";
}
