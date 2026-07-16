/* app/[locale]/iul/presentation/page.tsx – server component */

import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import IULWorkflowStepperWrapper from "@/components/iul-workflow-stepper-wrapper";
import FullscreenButton from "@/components/fullscreen-button";
import IULPresentationSlides from "@/components/iul-presentation-slides";
import IULSlideContent from "@/components/iul-slide-content";

import {
  getIulPresentation,
  mapIulPresentation,
  type IulLocale,
} from "@/lib/iul-presentation";
import { getAgentLicenseStates } from "@/lib/agent-licenses";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
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
  const doc = await getIulPresentation();
  if (!doc) return {};

  const { meta } = mapIulPresentation(doc, locale as IulLocale);

  const title = meta.title;
  const description = meta.description;
  const keywords = meta.keywords;
  const image = meta.image;
  const alt = meta.imageAlt;

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
      images: [{ url: cloudinaryOgImageUrl(image), width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: cloudinaryOgImageUrl(image), alt }],
    },
  };
}

/* ───────── Page ───────── */
export default async function IULPresentationPage() {
  const locale = (await getLocale()) as SupportedLocale;

  const doc = await getIulPresentation();
  if (!doc) notFound();

  const licenseStates = await getAgentLicenseStates();
  const pres = mapIulPresentation(doc, locale as IulLocale, { licenseStates });
  const { ui } = pres;

  // License reveal is admin-only: the flag drives the slide-1 UI, while the
  // real gate is the /api/admin/license-image middleware check.
  const { userId } = await auth();
  const isAdmin = userId
    ? (await currentUser())?.publicMetadata?.role === "admin"
    : false;

  const steps = [
    { id: "presentation", label: ui.stepperPresentation },
    { id: "application", label: ui.stepperApplication },
    { id: "referrals", label: ui.stepperReferrals },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:via-slate-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button asChild variant="secondary">
            <Link href="/iul">{ui.backButton}</Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1 text-gray-900 dark:text-gray-100">
            {ui.title}
          </h1>
          <div className="w-[110px] sm:w-[120px] flex justify-end">
            <FullscreenButton
              targetId="presentation-content"
              label={ui.fullscreenEnter}
              exitLabel={ui.fullscreenExit}
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-950 dark:ring-1 dark:ring-gray-800">
          <IULWorkflowStepperWrapper steps={steps} currentStep={0} />
        </div>

        {/* Client data intake CTA */}
        <div className="mb-8 flex flex-col items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {ui.intakeTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {ui.intakeDescription}
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/iul/intake">
              <ClipboardList className="mr-2 h-5 w-5" />
              {ui.intakeButton}
            </Link>
          </Button>
        </div>

        {/* Presentation Content Area */}
        <div
          id="presentation-content"
          className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-slate-900 dark:shadow-black/40 rounded-lg shadow-lg min-h-[600px] h-[70vh] overflow-hidden relative [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:min-h-screen"
        >
          <IULPresentationSlides
            slides={pres.slides.map((slide, index) => ({
              id: index + 1,
              content: (
                <IULSlideContent
                  slide={slide}
                  labels={pres.labels}
                  isAdmin={isAdmin}
                />
              ),
            }))}
            className="h-full w-full"
          />
        </div>
      </div>
    </main>
  );
}
