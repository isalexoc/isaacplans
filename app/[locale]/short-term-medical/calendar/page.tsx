/* app/[locale]/short-term-medical/calendar/page.tsx – server component */
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
    namespace: "shortTermMedicalPage.calendar.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/short-term-medical/calendar";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));
  const ogLocale = ogLocaleOf(locale);

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
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt }],
    },
  };
}

/* ───────── Page ───────── */
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShortTermMedicalCalendarPage({
  searchParams,
}: PageProps) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "shortTermMedicalPage.calendar",
  });

  const params = await searchParams;

  /* Booking URLs - replace with your Agent CRM short-term medical booking links */
  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/oWauKhvdkWNdNscrp8az"
      : "https://link.agent-crm.com/widget/booking/W4HpeJCBnxmO8XOuXWgn";

  const qs = new URLSearchParams({
    first_name: param(params.first_name),
    last_name: param(params.last_name),
    email: param(params.email),
    phone: param(params.phone),
  });

  const iframeSrc = qs.toString() ? `${base}?${qs}` : base;

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      <div className="w-full max-w-4xl flex flex-col items-center justify-center">
        <Button asChild variant="secondary">
          <Link href="/short-term-medical">{t("backButton")}</Link>
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          {t("title")}
        </h1>

        <div className="w-[110px] sm:w-[120px]" />
      </div>

      <Script
        id="agent-crm-embed-stm"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      <iframe
        src={iframeSrc}
        title={t("meta.imageAlt")}
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
