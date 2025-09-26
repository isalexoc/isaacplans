/* app/[locale]/final-expense/calendar/page.tsx – server component */
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

/* helper to coerce SearchParams */
const param = (p: string | string[] | undefined) =>
  Array.isArray(p) ? p[0] ?? "" : p ?? "";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "FEpage.calendar.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/final-expense/calendar";
  const slug = localizedSlug(routeKey, locale); // "/final-expense/calendar" or "/gastos-finales/calendario"
  const canonical = withLocalePrefix(locale, slug); // "/en/..." or "/es/..."
  const languages = languageAlternatesPrefixed(routeKey); // {"en-US": "...", "es-ES": "..."}
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
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinalExpenseCalendarPage({
  searchParams,
}: PageProps) {
  const locale = (await getLocale()) as SupportedLocale; // "en" | "es"
  const t = await getTranslations({
    locale,
    namespace: "FEpage.calendar.meta",
  });

  /* Choose the booking URL by language */
  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/cp075CJgwaZppyW7EVmV" // Spanish
      : "https://link.agent-crm.com/widget/booking/ndTlLivbrRxtySFg7jgQ"; // English (default)

  /* Build query string if any pre-filled fields arrive */
  const qs = new URLSearchParams({
    first_name: param(searchParams.first_name),
    last_name: param(searchParams.last_name),
    email: param(searchParams.email),
    phone: param(searchParams.phone),
  });

  const iframeSrc = qs.toString() ? `${base}?${qs}` : base;

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      {/* Header row */}
      <div className="w-full max-w-4xl flex flex-col items-center justify-center">
        <Button asChild variant="secondary">
          {/* Locale-aware back link → /en/final-expense or /es/gastos-finales */}
          <Link href="/final-expense">{t("backButton")}</Link>
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          {t("title")}
        </h1>

        {/* spacer keeps title centred */}
        <div className="w-[110px] sm:w-[120px]" />
      </div>

      {/* Agent-CRM helper script */}
      <Script
        id="agent-crm-embed-fe"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* Booking iframe */}
      <iframe
        src={iframeSrc}
        title="Final Expense Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
