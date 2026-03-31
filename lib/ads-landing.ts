/**
 * Paid-ads landing routes: minimal site chrome (logo + phone; no main nav / quote CTA).
 * Pathnames are locale-agnostic (next-intl usePathname omits the locale prefix).
 */
export const ADS_LANDING_PATHNAMES = [
  "/get-health-coverage-fast",
  "/cobertura-salud-rapida",
] as const;

export type AdsLandingPathname = (typeof ADS_LANDING_PATHNAMES)[number];

export function isAdsLandingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (ADS_LANDING_PATHNAMES as readonly string[]).includes(pathname);
}
