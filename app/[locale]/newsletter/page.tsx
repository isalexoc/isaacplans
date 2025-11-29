import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { BackHome } from "@/components/back-home";
import { NewsletterSubscriptionForm } from "@/components/newsletter-subscription-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "newsletterPage.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/newsletter.png",
  }) as string;
  const alt = t("imageAlt", { default: "Isaac Plans Insurance Newsletter" });

  const routeKey = "/newsletter";
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

export default async function NewsletterPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "newsletterPage" });

  return (
    <main className="container mx-auto min-h-screen max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <BackHome variant="inline" />
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            {t("hero.title")}
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {t("hero.description")}
          </p>
        </div>

        {/* Subscription Form */}
        <NewsletterSubscriptionForm locale={locale} />

        {/* Benefits Section */}
        <div className="mt-16 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("benefits.title")}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {t(`benefits.item${i}.title`)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(`benefits.item${i}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="mt-12 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t("privacy")}
          </p>
        </div>
      </div>
    </main>
  );
}

