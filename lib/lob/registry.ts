/**
 * The one place that knows what a "line of business" is.
 *
 * Until now every LOB was pure copy-paste — eight main pages, eight sets of buttons, and
 * `i18n/routing.ts` as the de facto registry. That works until you need to iterate over lines of
 * business (parameterized CTAs, the admin Page Media grid, the intake engine's `[lob]` routes),
 * at which point you need real data. This file is that data.
 *
 * Client-safe on purpose: no `server-only`, no DB, no next-intl server APIs — the admin UI and the
 * "Ready to apply now?" button both import it from the browser bundle.
 */

export type LobSlug =
  | "aca"
  | "short-term-medical"
  | "dental-vision"
  | "hospital-indemnity"
  | "iul"
  | "life-insurance"
  | "health-alternative"
  | "final-expense";

export type LobLocale = "en" | "es";

/**
 * Literal union of the eight apply routes rather than `keyof typeof routing.pathnames`, so
 * next-intl's `<Link href>` typechecks: the full pathname union includes dynamic routes like
 * `/aca/intake/[token]` that require a `params` object, which would break a bare string href.
 */
export type ApplyRoute =
  | "/aca/apply"
  | "/short-term-medical/apply"
  | "/dental-vision/apply"
  | "/hospital-indemnity/apply"
  | "/iul/apply"
  | "/life-insurance/apply"
  | "/health-alternative/apply"
  | "/final-expense/apply";

/** Same reasoning as {@link ApplyRoute}, for the agent-facing intake dashboard. */
export type IntakeRoute =
  | "/aca/intake"
  | "/short-term-medical/intake"
  | "/dental-vision/intake"
  | "/hospital-indemnity/intake"
  | "/iul/intake"
  | "/life-insurance/intake"
  | "/health-alternative/intake"
  | "/final-expense/intake";

export interface LobDefinition {
  slug: LobSlug;
  /** English display name, used in admin UI and CRM field folder names. */
  label: string;
  /** Main marketing page path per locale, without the `/en` | `/es` prefix. */
  path: Record<LobLocale, string>;
  /** Canonical (unlocalized) apply route key — pass straight to `<Link href>`. */
  applyRoute: ApplyRoute;
  /** Apply page path per locale, for plain `<a>` hrefs and admin "view live page" links. */
  applyPath: Record<LobLocale, string>;
  /** next-intl namespace for the apply page's copy, e.g. `messages/en/aca/apply.json`. */
  applyMessageNs: string;
  /**
   * Canonical (unlocalized) agent-dashboard route key. `${intakeRoute}/[token]` and
   * `${intakeRoute}/[token]/view` are the client-form and read-only-summary routes; they are
   * derived rather than stored because next-intl resolves them from the same declaration.
   */
  intakeRoute: IntakeRoute;
  /**
   * Route Handler that mints the device cookie and redirects into the intake form. The three
   * original lines of business predate the shared engine and keep their own `/api/<x>-intake`
   * trees; everything new resolves through `/api/intake/[lob]`.
   */
  intakeStartPath: string;
  /** Whether a `/get-covered` paid-ads funnel exists (drives the Page Media "Ads page" surface). */
  hasAdsFunnel: boolean;
}

export const LOBS: Record<LobSlug, LobDefinition> = {
  aca: {
    slug: "aca",
    label: "ACA",
    path: { en: "/aca", es: "/aca" },
    applyRoute: "/aca/apply",
    applyPath: { en: "/aca/apply", es: "/aca/aplicar" },
    applyMessageNs: "acaApply",
    intakeRoute: "/aca/intake",
    intakeStartPath: "/api/aca-intake/start",
    hasAdsFunnel: true,
  },
  "short-term-medical": {
    slug: "short-term-medical",
    label: "Short Term Medical",
    path: { en: "/short-term-medical", es: "/cobertura-a-corto-plazo" },
    applyRoute: "/short-term-medical/apply",
    applyPath: { en: "/short-term-medical/apply", es: "/cobertura-a-corto-plazo/aplicar" },
    applyMessageNs: "shortTermMedicalApply",
    intakeRoute: "/short-term-medical/intake",
    intakeStartPath: "/api/intake/short-term-medical/start",
    hasAdsFunnel: false,
  },
  "dental-vision": {
    slug: "dental-vision",
    label: "Dental & Vision",
    path: { en: "/dental-vision", es: "/dental-vision" },
    applyRoute: "/dental-vision/apply",
    applyPath: { en: "/dental-vision/apply", es: "/dental-vision/aplicar" },
    applyMessageNs: "dentalVisionApply",
    intakeRoute: "/dental-vision/intake",
    intakeStartPath: "/api/intake/dental-vision/start",
    hasAdsFunnel: false,
  },
  "hospital-indemnity": {
    slug: "hospital-indemnity",
    label: "Hospital Indemnity",
    path: { en: "/hospital-indemnity", es: "/indemnizacion-hospitalaria" },
    applyRoute: "/hospital-indemnity/apply",
    applyPath: { en: "/hospital-indemnity/apply", es: "/indemnizacion-hospitalaria/aplicar" },
    applyMessageNs: "hospitalIndemnityApply",
    intakeRoute: "/hospital-indemnity/intake",
    intakeStartPath: "/api/intake/hospital-indemnity/start",
    hasAdsFunnel: false,
  },
  iul: {
    slug: "iul",
    label: "IUL",
    path: { en: "/iul", es: "/iul" },
    applyRoute: "/iul/apply",
    applyPath: { en: "/iul/apply", es: "/iul/aplicar" },
    applyMessageNs: "iulApply",
    intakeRoute: "/iul/intake",
    intakeStartPath: "/api/iul-intake/start",
    hasAdsFunnel: true,
  },
  "life-insurance": {
    slug: "life-insurance",
    label: "Life Insurance",
    path: { en: "/life-insurance", es: "/seguro-de-vida" },
    applyRoute: "/life-insurance/apply",
    applyPath: { en: "/life-insurance/apply", es: "/seguro-de-vida/aplicar" },
    applyMessageNs: "lifeInsuranceApply",
    intakeRoute: "/life-insurance/intake",
    intakeStartPath: "/api/intake/life-insurance/start",
    hasAdsFunnel: true,
  },
  "health-alternative": {
    slug: "health-alternative",
    label: "Health Coverage Alternative",
    path: { en: "/health-alternative", es: "/alternativa-de-salud" },
    applyRoute: "/health-alternative/apply",
    applyPath: { en: "/health-alternative/apply", es: "/alternativa-de-salud/aplicar" },
    applyMessageNs: "healthAlternativeApply",
    intakeRoute: "/health-alternative/intake",
    intakeStartPath: "/api/intake/health-alternative/start",
    hasAdsFunnel: false,
  },
  "final-expense": {
    slug: "final-expense",
    label: "Final Expense",
    path: { en: "/final-expense", es: "/gastos-finales" },
    applyRoute: "/final-expense/apply",
    applyPath: { en: "/final-expense/apply", es: "/gastos-finales/aplicar" },
    applyMessageNs: "finalExpenseApply",
    intakeRoute: "/final-expense/intake",
    intakeStartPath: "/api/fe-intake/start",
    hasAdsFunnel: true,
  },
};

/** Display order for tabs and card grids — roughly by lead volume. */
export const LOB_SLUGS: LobSlug[] = [
  "aca",
  "short-term-medical",
  "dental-vision",
  "hospital-indemnity",
  "iul",
  "life-insurance",
  "health-alternative",
  "final-expense",
];

/** Normalize any locale string (e.g. `"es-US"`) to the two this app routes on. */
export function lobLocaleOf(locale: string): LobLocale {
  return locale?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function isLobSlug(value: string): value is LobSlug {
  return Object.prototype.hasOwnProperty.call(LOBS, value);
}
