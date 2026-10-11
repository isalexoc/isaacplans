/*
 * app/[locale]/iul/guia/page.tsx
 *
 * The IUL lead-magnet opt-in — Spanish only, Meta Ads traffic only.
 *
 * A SECOND funnel beside `/iul/get-covered`, deliberately not a replacement for it. The two
 * differ in exactly one structural way — this page asks for the email in step 1 because it has a
 * guide to deliver, while get-covered asks for it last — so running both at once is the only way
 * to find out whether that field order costs conversion. Pointing the new creative here and
 * leaving the existing video on get-covered keeps both experiments alive inside one ad set and
 * one budget, and gives a clean rollback if this page loses.
 *
 * Deliberately `noindex`: paid traffic only, and an opt-in page competing in search with the
 * actual IUL content is a net loss.
 */

import type { Metadata } from "next";

import ServicePageTracker from "@/components/service-page-tracker";
import IulGuiaFunnel from "@/components/iul/guia/iul-guia-funnel";
import IulGuiaSections, { IulGuiaHero } from "@/components/iul/guia/iul-guia-sections";

const TITLE = "Reporte gratis: 7 errores fatales que mantienen a los latinos sin ahorros";
const DESCRIPTION =
  "Reporte gratis en español sobre el IUL: la razón #1 por la que los latinos jóvenes se mantienen atrasados en sus finanzas, y cómo usar un seguro de vida para crecer tus ahorros.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = "https://www.isaacplans.com/es/iul/guia";
  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    alternates: {
      canonical,
      // Spanish-only page: emitting an en-US alternate would advertise a translation that does
      // not exist. Same shape as the LegalShield opt-in and the single-language state pages.
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

export default function IulGuiaOptinPage() {
  return (
    <>
      <ServicePageTracker serviceName="IUL guía" serviceCategory="iul-guia-ads" />
      <IulGuiaFunnel hero={<IulGuiaHero />}>
        <IulGuiaSections />
      </IulGuiaFunnel>
    </>
  );
}
