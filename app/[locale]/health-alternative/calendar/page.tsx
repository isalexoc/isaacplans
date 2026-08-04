/* app/[locale]/health-alternative/calendar/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation"; // ✅ locale-aware Link
import Script from "next/script";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
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
    namespace: "healthAlternativePage.calendar.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/health-alternative/calendar";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const ogLocale = ogLocaleOf(locale);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefault },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [{ url: cloudinaryOgImageUrl(image), width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: cloudinaryOgImageUrl(image), alt }],
    },
    // robots omitted → defaults to index, follow
  };
}

/* ───────── Page ───────── */
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HealthAlternativeCalendarPage({ searchParams }: PageProps) {
  const locale = (await getLocale()) as SupportedLocale; // "en" | "es"
  const t = await getTranslations({ locale, namespace: "healthAlternativePage.calendar" });

  // Await searchParams (Next.js 15+ requires this)
  const params = await searchParams;

  // Placeholder: reuses the generic /contact/calendar GHL widget until Isaac creates a dedicated
  // "Health Coverage Alternative" calendar in GHL and hands over the EN/ES widget URLs.
  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/tPPqNMldYmNWIVCyPkHd" // Spanish
      : "https://link.agent-crm.com/widget/booking/NSjUB0yiEwvZarpmvMcx"; // English

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
          {/* ✅ locale-aware back link → /en/health-alternative or /es/alternativa-de-salud */}
          <Link href="/health-alternative">{t("backButton")}</Link>
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
        title="Health Coverage Alternative Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
