/* app/[locale]/final-expense/leave-behind/page.tsx – server component */

import { auth } from "@clerk/nextjs/server";
import { getTranslations, getLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { BlogUserAuth } from "@/components/blog-user-auth";
import FinalExpenseLeaveBehindHub from "@/components/final-expense-leave-behind-hub";
import FinalExpenseLeaveBehindLanding from "@/components/final-expense-leave-behind-landing";
import enLeaveBehindMessages from "@/messages/en/final-expense/leave-behind.json";
import esLeaveBehindMessages from "@/messages/es/final-expense/leave-behind.json";

import {
  ogLocaleOf,
  type SupportedLocale,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
} from "@/lib/seo/i18n";
import { leaveBehindOgImageUrl } from "@/lib/leave-behind-og-url";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const { userId } = await auth();
  const t = await getTranslations({
    locale,
    namespace: "finalExpenseLeaveBehind",
  });

  const title = userId ? t("meta.title") : t("landing.meta.title");
  const description = userId ? t("meta.description") : t("landing.meta.description");
  const keywords = userId ? t("meta.keywords") : t("landing.meta.keywords");
  const image = userId ? t("meta.image") : leaveBehindOgImageUrl(locale);
  const alt = userId ? t("meta.imageAlt") : t("landing.meta.imageAlt");

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
    robots: userId
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/* ───────── Page ───────── */
export default async function FinalExpenseLeaveBehindPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const { userId } = await auth();
  const leaveBehindMessages =
    locale === "es" ? esLeaveBehindMessages : enLeaveBehindMessages;

  if (!userId) {
    return (
      <main className="min-h-screen bg-background">
        <NextIntlClientProvider locale={locale} messages={leaveBehindMessages}>
          <FinalExpenseLeaveBehindLanding />
        </NextIntlClientProvider>
      </main>
    );
  }

  const t = await getTranslations({ locale, namespace: "finalExpenseLeaveBehind" });

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:via-slate-900 dark:to-gray-950">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Button asChild variant="secondary">
            <Link href="/final-expense">{t("backButton")}</Link>
          </Button>
          <BlogUserAuth />
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-[#003366] dark:text-sky-300 sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">{t("subtitle")}</p>
        </div>

        <NextIntlClientProvider locale={locale} messages={leaveBehindMessages}>
          <FinalExpenseLeaveBehindHub />
        </NextIntlClientProvider>
      </div>
    </main>
  );
}
