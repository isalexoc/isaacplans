/* app/[locale]/dental-vision/calendar/page.tsx – server component */
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
} from "@/lib/seo/i18n"; // ⬅️ removed xDefaultHref

/* Little helper to coerce SearchParams */
const param = (p: string | string[] | undefined) =>
  Array.isArray(p) ? p[0] ?? "" : p ?? "";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "dentalVisionPage.calendar.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/dental-vision/calendar";
  const slug = localizedSlug(routeKey, locale); // "/dental-vision/calendar" or "/dental-vision/calendario"
  const canonical = withLocalePrefix(locale, slug); // "/en/..." or "/es/..."
  const languages = languageAlternatesPrefixed(routeKey); // { "en-US": "...", "es-ES": "..." }
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en")); // ✅ English page
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
    // robots omitted → defaults to index, follow
  };
}

/* ───────── Page ───────── */
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DentalVisionCalendarPage({
  searchParams,
}: PageProps) {
  const locale = (await getLocale()) as SupportedLocale; // "en" | "es"
  const t = await getTranslations({
    locale,
    namespace: "dentalVisionPage.calendar",
  });

  // Await searchParams (Next.js 15+ requires this)
  const params = await searchParams;

  /* Choose the booking URL by language */
  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/rRdoJtrmAvJ0FsgZwQqs" // 👈 replace when you get the final ES link
      : "https://link.agent-crm.com/widget/booking/62geCc4o9uF3lhsfcJ14"; // English (default)

  /* Build query string if any pre-filled fields arrive */
  const qs = new URLSearchParams({
    first_name: param(params.first_name),
    last_name: param(params.last_name),
    email: param(params.email),
    phone: param(params.phone),
  });

  const iframeSrc = qs.toString() ? `${base}?${qs}` : base;

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      {/* Header row */}
      <div className="w-full max-w-4xl flex flex-col items-center justify-center">
        <Button asChild variant="secondary">
          {/* Locale-aware back link → /en/dental-vision or /es/dental-vision */}
          <Link href="/dental-vision">{t("backButton")}</Link>
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          {t("title")}
        </h1>

        {/* spacer keeps title centred */}
        <div className="w-[110px] sm:w-[120px]" />
      </div>

      {/* Agent-CRM helper script (loads once after hydration) */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* Booking iframe */}
      <iframe
        src={iframeSrc}
        title="Dental & Vision Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
