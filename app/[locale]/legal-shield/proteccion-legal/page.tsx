/*
 * app/[locale]/legal-shield/proteccion-legal/page.tsx
 *
 * The LegalShield opt-in funnel — Spanish only, Meta Ads traffic only.
 *
 * Deliberately carries NO JSON-LD. Structured data naming LegalShield would strengthen exactly the
 * reading the associate advertising guidelines forbid — that this is an official LegalShield
 * property — and the page is noindex anyway, so there is nothing to gain by it.
 */

import type { Metadata } from "next";

import ServicePageTracker from "@/components/service-page-tracker";
import LegalShieldOptinFunnel from "@/components/legal-shield/legal-shield-optin-funnel";
import LegalShieldSections, {
  LegalShieldHero,
} from "@/components/legal-shield/legal-shield-sections";

const TITLE = "Guía gratis: cómo tener un abogado a tu alcance";
const DESCRIPTION =
  "Descarga gratis la guía Escudo Legal: orientación clara en español sobre documentos, vivienda y contratos, tránsito, protección familiar, estafas e inmigración.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = "https://www.isaacplans.com/es/legal-shield/proteccion-legal";
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Paid traffic only. Keeping it out of the index also keeps it from competing with the
    // insurance content that is the rest of this site.
    robots: { index: false, follow: false },
    alternates: {
      canonical,
      // Spanish-only page: emitting an en-US alternate would advertise a translation that does
      // not exist. Same shape as the single-language state pages.
      languages: { "es-US": canonical, "x-default": canonical },
    },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      type: "website",
      locale: "es_US",
    },
  };
}

export default function LegalShieldOptinPage() {
  return (
    <>
      <ServicePageTracker
        serviceName="LegalShield opt-in"
        serviceCategory="legal-shield-optin-ads"
      />
      <LegalShieldOptinFunnel hero={<LegalShieldHero />}>
        <LegalShieldSections />
      </LegalShieldOptinFunnel>
    </>
  );
}
