/* app/[locale]/aca/calendar/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation"; // ✅ locale-aware Link
import Script from "next/script";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

import {
  ogLocaleOf,
  type SupportedLocale,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
} from "@/lib/seo/i18n";

/* helper */
const param = (p: string | string[] | undefined) =>
  Array.isArray(p) ? p[0] ?? "" : p ?? "";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "acaPage.calendar.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/aca/calendar";
  const slug = localizedSlug(routeKey, locale); // "/aca/calendar" or "/aca/calendario"
  const canonical = withLocalePrefix(locale, slug); // "/en/aca/calendar" or "/es/aca/calendario"
  const languages = languageAlternatesPrefixed(routeKey); // { "en-US": "...", "es-ES": "..." }
  const ogLocale = ogLocaleOf(locale);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en")); // ✅ English page

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefault }, // x-default => "/en/..."
    },
    openGraph: {
      title,
      description,
      url: canonical, // resolved absolute via metadataBase in your layout
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt }],
    },
    // robots omitted → defaults to index, follow
  };
}

/* ───────── Page ───────── */
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ACACalendarPage({ searchParams }: PageProps) {
  const locale = (await getLocale()) as SupportedLocale; // "en" | "es"
  const t = await getTranslations({ locale, namespace: "acaPage.calendar" });

  // Await searchParams (Next.js 15+ requires this)
  const params = await searchParams;

  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/MGgUxlHXgfQGa9UoZcv6" // Spanish
      : "https://link.agent-crm.com/widget/booking/HR7iDiMN8k01DUkGl8z0"; // English

  const qs = new URLSearchParams({
    first_name: param(params.first_name),
    last_name: param(params.last_name),
    email: param(params.email),
    phone: param(params.phone),
  });

  const iframeSrc = qs.toString().length > 0 ? `${base}?${qs}` : base;

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      {/* header row */}
      <div className="w-full max-w-4xl flex flex-col items-center justify-center">
        <Button asChild variant="secondary">
          {/* ✅ locale-aware back link → /en/aca or /es/aca */}
          <Link href="/aca">{t("backButton")}</Link>
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          {t("title")}
        </h1>

        <div className="w-[110px] sm:w-[120px]" />
      </div>

      {/* agent-CRM script */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* booking iframe */}
      <iframe
        src={iframeSrc}
        title="ACA Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
