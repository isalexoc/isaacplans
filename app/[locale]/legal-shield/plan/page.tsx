/*
 * app/[locale]/legal-shield/plan/page.tsx — the self-serve Legal Shield presentation.
 *
 * One general link Ysmael sends anyone by WhatsApp: they walk his Plan Preferencial + IDShield
 * presentation alone, one screen at a time, pick monthly or yearly, and "Llenar mi solicitud"
 * starts their own application (owned by Ysmael). Public and Spanish only (/en 308s to /es).
 * Middleware gives it Ysmael's "Red de Apoyo Latino USA" header and footer and keeps the CRM chat
 * bubble off it (it would sit on the Next button).
 */

import type { Metadata } from "next";
import LegalShieldGuide from "@/components/legal-shield-presentation/guide";
import { buildLegalShieldGuideSteps } from "@/components/legal-shield-presentation/guide-steps";
import { LS_BRAND_NAME } from "@/lib/legal-shield/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";
const TITLE = "Plan Preferencial + IDShield: protegemos a tu familia";
const DESCRIPTION =
  "Abogado para tu familia y protección de identidad en una sola membresía. Mira la presentación en 2 minutos y llena tu solicitud desde tu teléfono.";

export function generateMetadata(): Metadata {
  const url = `${SITE_URL}/es/legal-shield/plan`;
  // Explicit, so the WhatsApp preview never inherits the root layout's "Isaac Plans Insurance"
  // name and logo (an insurance brand over a LegalShield offer, which the associate rules forbid).
  const images = [{ url: `${SITE_URL}/images/legal-shield/presentation/og-plan.jpg`, width: 1200, height: 630, alt: LS_BRAND_NAME }];
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Shared by link, not found by search.
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESCRIPTION, url, type: "website", siteName: LS_BRAND_NAME, locale: "es_US", images },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images },
  };
}

export default async function LegalShieldPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LegalShieldGuide steps={buildLegalShieldGuideSteps()} startError={error === "start"} />;
}
