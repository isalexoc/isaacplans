/* app/[locale]/iul/presentation/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import IULWorkflowStepper from "@/components/iul-workflow-stepper";
import FullscreenButton from "@/components/fullscreen-button";
import IULPresentationSlides from "@/components/iul-presentation-slides";
import IULSlideContent from "@/components/iul-slide-content";

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
    namespace: "iulPresentation.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/iul/presentation";
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
export default async function IULPresentationPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "iulPresentation" });

  const steps = [
    {
      id: "presentation",
      label: t("stepper.presentation"),
    },
    {
      id: "dataEntry",
      label: t("stepper.dataEntry"),
    },
    {
      id: "referrals",
      label: t("stepper.referrals"),
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button asChild variant="secondary">
            <Link href="/iul">{t("backButton")}</Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
            {t("title")}
          </h1>
          <div className="w-[110px] sm:w-[120px] flex justify-end">
            <FullscreenButton
              targetId="presentation-content"
              label={t("fullscreen.enter")}
              exitLabel={t("fullscreen.exit")}
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <IULWorkflowStepper steps={steps} currentStep={0} />
        </div>

        {/* Presentation Content Area */}
        <div
          id="presentation-content"
          className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-lg min-h-[600px] h-[70vh] overflow-hidden relative [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:min-h-screen"
        >
          <IULPresentationSlides
            slides={[
              { id: 1, content: <IULSlideContent slideKey="slide1" /> },
              { id: 2, content: <IULSlideContent slideKey="slide2" /> },
              { id: 3, content: <IULSlideContent slideKey="slide3" /> },
              { id: 4, content: <IULSlideContent slideKey="slide4" /> },
              { id: 5, content: <IULSlideContent slideKey="slide5" /> },
              { id: 6, content: <IULSlideContent slideKey="slide6" /> },
              { id: 7, content: <IULSlideContent slideKey="slide7" /> },
              { id: 8, content: <IULSlideContent slideKey="slide8" /> },
              { id: 9, content: <IULSlideContent slideKey="slide9" /> },
              { id: 10, content: <IULSlideContent slideKey="slide10" /> },
              { id: 11, content: <IULSlideContent slideKey="slide11" /> },
              { id: 12, content: <IULSlideContent slideKey="slide12" /> },
              { id: 13, content: <IULSlideContent slideKey="slide13" /> },
              { id: 14, content: <IULSlideContent slideKey="slide14" /> },
              { id: 15, content: <IULSlideContent slideKey="slide15" /> },
              { id: 16, content: <IULSlideContent slideKey="slide16" /> },
              { id: 17, content: <IULSlideContent slideKey="slide17" /> },
              { id: 18, content: <IULSlideContent slideKey="slide18" /> },
              { id: 19, content: <IULSlideContent slideKey="slide19" /> },
              { id: 20, content: <IULSlideContent slideKey="slide20" /> },
              { id: 21, content: <IULSlideContent slideKey="slide21" /> },
              { id: 22, content: <IULSlideContent slideKey="slide22" /> },
              { id: 23, content: <IULSlideContent slideKey="slide23" /> },
              { id: 24, content: <IULSlideContent slideKey="slide24" /> },
              { id: 25, content: <IULSlideContent slideKey="slide25" /> },
            ]}
            className="h-full w-full"
          />
        </div>
      </div>
    </main>
  );
}

