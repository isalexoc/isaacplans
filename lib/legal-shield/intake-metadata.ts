/**
 * Metadata for the Legal Shield intake pages.
 *
 * Every page sets its own Open Graph and Twitter tags. Left to inherit, they would take the root
 * layout's "Isaac Plans Insurance" site name and logo, and Ysmael sends these links by WhatsApp,
 * which shows that preview card: an insurance agency's brand over a LegalShield offer, the mix the
 * associate rules forbid. So: no site name, no image, a plain Spanish title.
 *
 * The token in these URLs is a credential: never indexed, never sent on as a Referer.
 */

import type { Metadata } from "next";

export function legalShieldIntakeMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: { title, description, type: "website", locale: "es_US" },
    twitter: { card: "summary", title, description },
  };
}
