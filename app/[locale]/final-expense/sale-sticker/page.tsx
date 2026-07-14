/* app/[locale]/final-expense/sale-sticker/page.tsx – server component */

import { auth } from "@clerk/nextjs/server";
import { getTranslations, getLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { BlogUserAuth } from "@/components/blog-user-auth";
import SaleStickerHub from "@/components/sale-sticker-hub";
import { SaleStickerSignedOut } from "@/components/sale-sticker/sale-sticker-signed-out";
import enLeaveBehindMessages from "@/messages/en/final-expense/leave-behind.json";
import esLeaveBehindMessages from "@/messages/es/final-expense/leave-behind.json";
import enSaleStickerMessages from "@/messages/en/final-expense/sale-sticker.json";
import esSaleStickerMessages from "@/messages/es/final-expense/sale-sticker.json";

import {
  ogLocaleOf,
  type SupportedLocale,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
} from "@/lib/seo/i18n";

const ROUTE_KEY = "/final-expense/sale-sticker" as const;

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "saleSticker" });

  const slug = localizedSlug(ROUTE_KEY, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(ROUTE_KEY);
  const ogLocale = ogLocaleOf(locale);
  const xDefault = withLocalePrefix("en", localizedSlug(ROUTE_KEY, "en"));

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    keywords: t("meta.keywords"),
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefault },
    },
    openGraph: {
      title: t("meta.title"),
      description: t("meta.description"),
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
    },
    // Internal agent tool — keep it out of the index.
    robots: { index: false, follow: false },
  };
}

/* ───────── Page ───────── */
export default async function SaleStickerPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const { userId } = await auth();

  const messages =
    locale === "es"
      ? { ...esLeaveBehindMessages, ...esSaleStickerMessages }
      : { ...enLeaveBehindMessages, ...enSaleStickerMessages };

  if (!userId) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <NextIntlClientProvider locale={locale} messages={messages}>
            <SaleStickerSignedOut />
          </NextIntlClientProvider>
        </div>
      </main>
    );
  }

  const t = await getTranslations({ locale, namespace: "saleSticker" });

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

        <NextIntlClientProvider locale={locale} messages={messages}>
          <SaleStickerHub />
        </NextIntlClientProvider>
      </div>
    </main>
  );
}
