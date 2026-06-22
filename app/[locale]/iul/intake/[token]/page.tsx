import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ogLocaleOf, type SupportedLocale } from "@/lib/seo/i18n";
import { iulIntakeOgImages } from "@/lib/iul-intake/og";
import IntakeForm from "@/components/iul-intake/intake-form";

const COPY: Record<SupportedLocale, { title: string; description: string; alt: string }> = {
  en: {
    title: "Your Secure IUL Application | Isaac Plans Insurance",
    description:
      "Complete your IUL application securely from your phone in just a few minutes — encrypted, private, and reviewed personally by your agent.",
    alt: "Isaac Plans — secure IUL application",
  },
  es: {
    title: "Tu Solicitud IUL Segura | Isaac Plans Insurance",
    description:
      "Complete su solicitud de IUL de forma segura desde su teléfono en pocos minutos — cifrada, privada y revisada personalmente por su agente.",
    alt: "Isaac Plans — solicitud IUL segura",
  },
};

// Token-gated, link-only page: kept out of search (noindex) but with rich Open Graph so the
// shared link unfurls nicely in WhatsApp / Messenger / SMS, with locale-specific images.
export async function generateMetadata(): Promise<Metadata> {
  const locale = ((await getLocale()) === "es" ? "es" : "en") as SupportedLocale;
  const { title, description, alt } = COPY[locale];
  const { square, vertical } = iulIntakeOgImages(locale);

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale),
      images: [
        { url: square, width: 1200, height: 1200, alt },
        { url: vertical, width: 1080, height: 1920, alt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: square, alt }],
    },
  };
}

export default async function IulIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <IntakeForm token={token} />
    </main>
  );
}
