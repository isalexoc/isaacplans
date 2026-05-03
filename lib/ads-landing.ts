/**
 * Paid-ads landing routes: minimal site chrome (logo + phone; no main nav / quote CTA).
 * Pathnames are locale-agnostic (next-intl usePathname omits the locale prefix).
 */
export const ADS_LANDING_PATHNAMES = [
  "/get-health-coverage-fast",
  "/cobertura-salud-rapida",
  "/final-expense/get-covered",
  "/gastos-finales/obtener-cobertura",
] as const;

export type AdsLandingPathname = (typeof ADS_LANDING_PATHNAMES)[number];

export function isAdsLandingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (ADS_LANDING_PATHNAMES as readonly string[]).includes(pathname);
}

/** Same as {@link isAdsLandingPath}, but strips an `/{locale}` prefix (e.g. `window.location.pathname`). */
export function isAdsLandingPathResolved(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = pathname.replace(/^\/(en|es)(?=\/)/i, "");
  return isAdsLandingPath(normalized || pathname);
}
