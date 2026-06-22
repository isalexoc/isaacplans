/**
 * Build the absolute, locale-correct client share URL for an IUL intake session.
 * Used by the dashboard (copy link) and server-side (writing the link to the CRM field).
 *
 * Localized path mapping mirrors i18n/routing.ts: en `/iul/intake/[token]`,
 * es `/iul/admision/[token]`.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";

export function buildIntakeShareUrl(token: string, locale: string, origin?: string): string {
  const loc = locale === "es" ? "es" : "en";
  const slug = loc === "es" ? "iul/admision" : "iul/intake";
  const base = (origin ?? SITE_URL).replace(/\/+$/, "");
  return `${base}/${loc}/${slug}/${token}`;
}
