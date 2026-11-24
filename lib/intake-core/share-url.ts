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
  // A one-language line (Legal Shield is Spanish only) always links to its own language.
  const loc = config.fixedLocale ?? (locale === "es" ? "es" : "en");
  const base = (origin ?? SITE_URL).replace(/\/+$/, "");
  return `${base}/${loc}/${config.intakeSlug[loc]}/${token}`;
}

/**
 * The client's secure-capture link (`/en/secure/<token>`, `/es/seguro/<token>`, mirroring
 * i18n/routing.ts). Deliberately free of any product name: it sits in a text message.
 *
 * A line with its own branded page passes its `secureSlug` (Legal Shield's sits under its intake
 * path, so it is private by the same rule as the form).
 */
export function buildSecureCaptureUrl(
  token: string,
  locale: string,
  origin?: string,
  secureSlug?: Record<"en" | "es", string>
): string {
  const loc = locale === "es" ? "es" : "en";
  const base = (origin ?? SITE_URL).replace(/\/+$/, "");
  const slug = secureSlug?.[loc] ?? (loc === "es" ? "seguro" : "secure");
  return `${base}/${loc}/${slug}/${token}`;
}
