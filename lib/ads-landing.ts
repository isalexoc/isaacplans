/**
 * Paid-ads landing routes: minimal site chrome (logo + phone; no main nav / quote CTA).
 * Pathnames are locale-agnostic (next-intl usePathname omits the locale prefix).
 */
export const ADS_LANDING_PATHNAMES = [
  "/get-health-coverage-fast",
  "/cobertura-salud-rapida",
  "/final-expense/get-covered",
  "/gastos-finales/obtener-cobertura",
  "/aca/get-covered",
  "/aca/obtener-cobertura",
  "/life-insurance/get-covered",
  "/seguro-de-vida/obtener-cobertura",
  "/health-alternative/get-covered",
  "/alternativa-de-salud/obtener-cobertura",
] as const;

export type AdsLandingPathname = (typeof ADS_LANDING_PATHNAMES)[number];

/**
 * The ACA intake CLIENT form, `/aca/intake/<token>` (es: `/aca/admision/<token>`).
 *
 * It earns the same bare chrome as the get-covered funnels for the same reason: the form is
 * the only thing the visitor is there to do, and eight steps on a phone is no place for a
 * nav menu and a footer sitemap. Matched by pattern rather than an exact list because of the
 * token segment; both slugs are accepted since the resolved pathname can be either.
 *
 * Deliberately NOT the agent surfaces — `/aca/intake` (dashboard) and
 * `/aca/intake/<token>/view` (summary) keep the full site chrome. The trailing `[^/]+$`
 * is what excludes them.
 */
const ACA_INTAKE_FORM_RE = /^(?:\/(?:en|es))?\/aca\/(?:intake|admision)\/[^/]+$/i;

export function isAcaIntakeFormPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ACA_INTAKE_FORM_RE.test(pathname);
}

/**
 * The Final Expense intake CLIENT form, `/final-expense/intake/<token>`
 * (es: `/gastos-finales/admision/<token>`) — same rule as {@link isAcaIntakeFormPath}: its
 * one-question-per-screen wizard has its own header/progress bar and expects a bare page.
 * Deliberately NOT the agent surfaces — `/final-expense/intake` (dashboard) and
 * `/final-expense/intake/<token>/view` (summary) keep the full site chrome.
 */
const FE_INTAKE_FORM_RE =
  /^(?:\/(?:en|es))?\/(?:final-expense\/intake|gastos-finales\/admision)\/[^/]+$/i;

export function isFeIntakeFormPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return FE_INTAKE_FORM_RE.test(pathname);
}

/**
 * Referral partner landing pages: `/partners/<slug>` (es: `/socios/<slug>`).
 *
 * These run their own lead capture and POST to /api/create-contact themselves. Agent CRM's
 * external-tracking script also does automatic FORM CAPTURE, so leaving it loaded here makes GHL
 * create a second contact alongside ours off the same submit — and in practice a BLANK one, since
 * it cannot read a React-controlled form reliably. Every get-covered funnel already avoids this by
 * being in ADS_LANDING_PATHNAMES; the partner pages need the same suppression.
 *
 * Deliberately a separate predicate rather than an entry in ADS_LANDING_PATHNAMES: that list also
 * drives the bare page chrome in components/header.tsx, and these pages keep the full site header.
 *
 * `/partner` and `/socio` (the portal, no slug) are excluded by the required trailing segment —
 * they have no lead form.
 */
const PARTNER_LANDING_RE = /^(?:\/(?:en|es))?\/(?:partners|socios)\/[^/]+$/i;

export function isPartnerLandingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PARTNER_LANDING_RE.test(pathname);
}

export function isAdsLandingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    (ADS_LANDING_PATHNAMES as readonly string[]).includes(pathname) ||
    isAcaIntakeFormPath(pathname) ||
    isFeIntakeFormPath(pathname)
  );
}

/** Same as {@link isAdsLandingPath}, but strips an `/{locale}` prefix (e.g. `window.location.pathname`). */
export function isAdsLandingPathResolved(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = pathname.replace(/^\/(en|es)(?=\/)/i, "");
  return isAdsLandingPath(normalized || pathname);
}

/**
 * "Bare" ads landings get an even barer chrome than the generic ads landings:
 * logo + phone only (logo NON-clickable), plus a bare footer (logo + copyright, no links).
 * The lead form is the sole interactive element / exit. Applies to the IUL, final-expense,
 * and ACA get-covered funnels, plus the ACA intake client form.
 * Pathnames are locale-agnostic (next-intl usePathname omits the locale prefix).
 */
export const IUL_BARE_LANDING_PATHNAMES = [
  "/iul/get-covered",
  "/iul/obtener-cobertura",
  "/final-expense/get-covered",
  "/gastos-finales/obtener-cobertura",
  "/aca/get-covered",
  "/aca/obtener-cobertura",
  "/life-insurance/get-covered",
  "/seguro-de-vida/obtener-cobertura",
  "/health-alternative/get-covered",
  "/alternativa-de-salud/obtener-cobertura",
] as const;

export function isIulBareLandingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    (IUL_BARE_LANDING_PATHNAMES as readonly string[]).includes(pathname) ||
    isAcaIntakeFormPath(pathname) ||
    isFeIntakeFormPath(pathname)
  );
}
