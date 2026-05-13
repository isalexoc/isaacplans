/* app/[locale]/final-expense/leave-behind/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import FinalExpenseLeaveBehindHub from "@/components/final-expense-leave-behind-hub";

import {
  ogLocaleOf,
  type SupportedLocale,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
} from "@/lib/seo/i18n";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "finalExpenseLeaveBehind.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/final-expense/leave-behind" as const;
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
export default async function FinalExpenseLeaveBehindPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "finalExpenseLeaveBehind" });

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:via-slate-900 dark:to-gray-950">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="secondary">
            <Link href="/final-expense">{t("backButton")}</Link>
          </Button>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-[#003366] dark:text-sky-300 sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">{t("subtitle")}</p>
        </div>

        <FinalExpenseLeaveBehindHub />
      </div>
    </main>
  );
}
