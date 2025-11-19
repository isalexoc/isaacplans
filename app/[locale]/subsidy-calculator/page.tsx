import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calculator } from "lucide-react";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "subsidyCalculatorPage.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/subsidy-calculator.png",
  }) as string;
  const alt = t("imageAlt", { default: "ACA Subsidy Calculator" });

  const routeKey = "/subsidy-calculator";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));
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
  };
}

/* ───────── Page ───────── */
export default async function SubsidyCalculatorPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "subsidyCalculatorPage" });

  return (
    <main className="w-full flex flex-col overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-brand/10 p-4">
              <Calculator className="w-12 h-12 text-brand" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300">
            {t("hero.description")}
          </p>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-2xl shadow-lg p-8 md:p-12 border border-gray-200 dark:border-gray-700">
            <div className="space-y-6 mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t("content.title")}
              </h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {t("content.description")}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {t("infoBox.title")}
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-brand mr-2">•</span>
                  <span>{t("infoBox.items.0")}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-brand mr-2">•</span>
                  <span>{t("infoBox.items.1")}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-brand mr-2">•</span>
                  <span>{t("infoBox.items.2")}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-brand mr-2">•</span>
                  <span>{t("infoBox.items.3")}</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {t("howItWorks.title")}
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      {t("howItWorks.steps.0")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      {t("howItWorks.steps.1")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      {t("howItWorks.steps.2")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex flex-col items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-gray-700 dark:text-gray-300 mb-2">
                {t("cta.description")}
              </p>
              <Button
                asChild
                size="lg"
                className="bg-brand hover:bg-brand/90 text-white px-8 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <a
                  href="https://www.kff.org/interactive/calculator-aca-enhanced-premium-tax-credit/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <span>{t("cta.buttonText")}</span>
                  <ExternalLink className="w-5 h-5" />
                </a>
              </Button>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                {t("cta.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Information Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">
              {t("additionalInfo.title")}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {t("additionalInfo.cards.0.title")}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t("additionalInfo.cards.0.description")}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {t("additionalInfo.cards.1.title")}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t("additionalInfo.cards.1.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

