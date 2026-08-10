import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ogLocaleOf, type SupportedLocale } from "@/lib/seo/i18n";
import { acaIntakeOgImage, ACA_OG_SIZE } from "@/lib/aca-intake/og";
import AcaIntakeForm from "@/components/aca-intake/intake-form";

const COPY: Record<SupportedLocale, { title: string; description: string; alt: string }> = {
  en: {
    title: "Your Secure Health Insurance Application | Isaac Plans Insurance",
    description:
      "Complete your health coverage application securely from your phone in just a few minutes — encrypted, private, and reviewed personally by your agent.",
    alt: "Isaac Plans — secure health insurance application",
  },
  es: {
    title: "Su Solicitud de Seguro de Salud Segura | Isaac Plans Insurance",
    description:
      "Complete su solicitud de cobertura de salud de forma segura desde su teléfono en pocos minutos — cifrada, privada y revisada personalmente por su agente.",
    alt: "Isaac Plans — solicitud de seguro de salud segura",
  },
};

// Token-gated, link-only page: kept out of search (noindex) but with Open Graph copy so the
// shared link unfurls readably in WhatsApp / Messenger / SMS.
export async function generateMetadata(): Promise<Metadata> {
  const locale = ((await getLocale()) === "es" ? "es" : "en") as SupportedLocale;
  const { title, description, alt } = COPY[locale];
  const image = acaIntakeOgImage(locale);

  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    // With no sign-in, the token in this URL is the credential — keep it out of the Referer
    // header on any outbound request (Google Maps, analytics, a tapped link).
    referrer: "no-referrer",
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale),
      images: [{ url: image, width: ACA_OG_SIZE.width, height: ACA_OG_SIZE.height, alt }],
    },
    twitter: {
      // The card is square, so "summary" renders it uncropped; summary_large_image
      // would letterbox it into a 2:1 frame.
      card: "summary",
      title,
      description,
      images: [{ url: image, alt }],
    },
  };
}

export default async function AcaIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <AcaIntakeForm token={token} />
    </main>
  );
}
