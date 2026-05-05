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
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:via-slate-900 dark:to-gray-950">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header - stacks vertically on mobile to prevent overflow */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/final-expense">{t("backButton")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/final-expense/leave-behind">{t("leaveBehindLink")}</Link>
            </Button>
          </div>
          <h1 className="min-w-0 text-center text-xl font-bold text-[#003366] dark:text-sky-300 sm:flex-1 sm:text-2xl md:text-3xl">
            {t("title")}
          </h1>
          <div className="flex justify-center sm:justify-end shrink-0">
            <FullscreenButton
              targetId="presentation-content"
              label={t("fullscreen.enter")}
              exitLabel={t("fullscreen.exit")}
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8 rounded-lg border border-gray-200/80 bg-white p-6 shadow-md dark:border-gray-700/80 dark:bg-gray-900/95 dark:shadow-none dark:ring-1 dark:ring-gray-800">
          <FinalExpenseWorkflowStepperWrapper steps={steps} currentStep={0} />
        </div>

        {/* Presentation Content Area - overscroll-contain in fullscreen reduces accidental exit on swipe */}
        <div
          id="presentation-content"
          className="relative h-[70vh] min-h-[600px] overflow-hidden rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg dark:from-gray-950 dark:to-slate-900 dark:shadow-black/40 [&:fullscreen]:h-screen [&:fullscreen]:min-h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:overscroll-none [&:fullscreen]:bg-black/70 [&:fullscreen]:dark:bg-black/90"
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
