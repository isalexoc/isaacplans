/**
 * Build the client-facing share link for a Final Expense intake session.
 * Slugs mirror the localized pathnames declared in i18n/routing.ts.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";

export function buildFeIntakeShareUrl(token: string, locale: string, origin?: string): string {
  const loc = locale === "es" ? "es" : "en";
  const slug = loc === "es" ? "gastos-finales/admision" : "final-expense/intake";
  const base = (origin ?? SITE_URL).replace(/\/+$/, "");
  return `${base}/${loc}/${slug}/${token}`;
}
