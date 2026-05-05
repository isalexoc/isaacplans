/* app/[locale]/final-expense/referrals/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import FinalExpenseWorkflowStepperWrapper from "@/components/final-expense-workflow-stepper-wrapper";
import FinalExpenseReferralsContent from "@/components/final-expense-referrals-content";

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
    namespace: "finalExpenseReferrals.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/final-expense/referrals";
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
export default async function FinalExpenseReferralsPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "finalExpenseReferrals",
  });

  const steps = [
    { id: "presentation", label: t("stepper.presentation") },
    { id: "qualification", label: t("stepper.qualification") },
    { id: "referrals", label: t("stepper.referrals") },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <Button asChild variant="secondary">
            <Link href="/final-expense">{t("backButton")}</Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1 text-[#003366]">
            {t("title")}
          </h1>
          <div className="w-[110px] sm:w-[120px]" />
        </div>

        <div className="mb-8 rounded-lg bg-white p-6 shadow-md dark:bg-gray-950 dark:ring-1 dark:ring-gray-800">
          <FinalExpenseWorkflowStepperWrapper
            steps={steps}
            currentStep={2}
          />
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-lg min-h-[600px] p-8 md:p-12">
          <FinalExpenseReferralsContent />
        </div>
      </div>
    </main>
  );
}
