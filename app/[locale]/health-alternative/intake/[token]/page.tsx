/*
 * app/[locale]/health-alternative/intake/[token]/page.tsx — the client-facing Health Coverage application.
 *
 * Public by design: there is no sign-in, so the unguessable token in this URL *is* the credential
 * (plus the device cookie that claims it on first open). That is why the metadata below is
 * noindex + `referrer: "no-referrer"` — a token must never leak through a Referer header to an
 * external site the client happens to click through to.
 */

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import IntakeForm from "@/components/intake/intake-form";
import { ogLocaleOf } from "@/lib/seo/i18n";

type SupportedLocale = "en" | "es";

const COPY: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Your Secure Health Coverage Application | Isaac Plans Insurance",
    description: "Complete your health coverage application securely from your phone. Your progress saves automatically.",
  },
  es: {
    title: "Su Solicitud Segura de Cobertura de Salud | Isaac Plans Insurance",
    description: "Complete su solicitud de cobertura de salud de forma segura desde su teléfono. Su progreso se guarda automáticamente.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = (((await getLocale()) === "es" ? "es" : "en") as SupportedLocale);
  const { title, description } = COPY[locale];
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    // The token in this URL is the credential — keep it out of the Referer header.
    referrer: "no-referrer",
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale),
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function HealthAlternativeIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <IntakeForm lob="health-alternative" token={token} />
    </main>
  );
}
