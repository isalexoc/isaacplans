/**
 * Build the client-facing share link for an intake session.
 * Slugs come from the config and mirror the localized pathnames in i18n/routing.ts.
 */

import type { IntakeLobConfig } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";

export function buildIntakeShareUrl(
  config: IntakeLobConfig,
  token: string,
  locale: string,
  origin?: string
): string {
  const loc = locale === "es" ? "es" : "en";
  const base = (origin ?? SITE_URL).replace(/\/+$/, "");
  return `${base}/${loc}/${config.intakeSlug[loc]}/${token}`;
}
