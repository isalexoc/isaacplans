/**
 * The client's signing link. Slugs mirror the localized pathnames in i18n/routing.ts:
 * en `/aca/confirmation/[token]`, es `/aca/confirmacion/[token]`.
 */

import type { AcaConfirmationLanguage } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";

export function acaConfirmationPath(token: string, language: AcaConfirmationLanguage): string {
  return language === "es" ? `/es/aca/confirmacion/${token}` : `/en/aca/confirmation/${token}`;
}

export function buildAcaConfirmationUrl(
  token: string,
  language: AcaConfirmationLanguage,
  origin?: string
): string {
  const base = (origin ?? SITE_URL).replace(/\/+$/, "");
  return `${base}${acaConfirmationPath(token, language)}`;
}
