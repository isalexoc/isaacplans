/* app/[locale]/final-expense/presentation/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import FinalExpenseWorkflowStepperWrapper from "@/components/final-expense-workflow-stepper-wrapper";
import FullscreenButton from "@/components/fullscreen-button";
import IULPresentationSlides from "@/components/iul-presentation-slides";
import FinalExpenseSlideContent from "@/components/final-expense-slide-content";

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
    namespace: "finalExpensePresentation.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/final-expense/presentation" as const;
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
export default async function FinalExpensePresentationPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "finalExpensePresentation" });

  const steps = [
    { id: "presentation", label: t("stepper.presentation") },
    { id: "qualification", label: t("stepper.qualification") },
    { id: "referrals", label: t("stepper.referrals") },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button asChild variant="secondary">
            <Link href="/final-expense">{t("backButton")}</Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1 text-[#003366]">
            {t("title")}
          </h1>
          <div className="min-w-[140px] sm:min-w-[180px] flex justify-end">
            <FullscreenButton
              targetId="presentation-content"
              label={t("fullscreen.enter")}
              exitLabel={t("fullscreen.exit")}
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <FinalExpenseWorkflowStepperWrapper steps={steps} currentStep={0} />
        </div>

        {/* Presentation Content Area - overscroll-contain in fullscreen reduces accidental exit on swipe */}
        <div
          id="presentation-content"
          className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-lg min-h-[600px] h-[70vh] overflow-hidden relative [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:min-h-screen [&:fullscreen]:overscroll-none [&:fullscreen]:bg-black/70"
        >
          <IULPresentationSlides
            exitFullscreenLabel={t("fullscreen.exit")}
            slides={[
              { id: 1, content: <FinalExpenseSlideContent slideKey="slide1" /> },
              { id: 2, content: <FinalExpenseSlideContent slideKey="slide2" /> },
              { id: 3, content: <FinalExpenseSlideContent slideKey="slide3" /> },
              { id: 4, content: <FinalExpenseSlideContent slideKey="slide4" /> },
              { id: 5, content: <FinalExpenseSlideContent slideKey="slide5" /> },
              { id: 6, content: <FinalExpenseSlideContent slideKey="slide6" /> },
              { id: 7, content: <FinalExpenseSlideContent slideKey="slide7" /> },
              { id: 8, content: <FinalExpenseSlideContent slideKey="slide8" /> },
              { id: 9, content: <FinalExpenseSlideContent slideKey="slide11" /> },
              { id: 10, content: <FinalExpenseSlideContent slideKey="slide10" /> },
              { id: 11, content: <FinalExpenseSlideContent slideKey="slide12" /> },
            ]}
            className="h-full w-full"
          />
        </div>
      </div>
    </main>
  );
}
