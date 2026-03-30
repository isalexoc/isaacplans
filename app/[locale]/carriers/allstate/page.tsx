import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import AllstateHealthHub from "@/components/allstate-health-hub";
import {
  getAllstateProductBreadcrumbLd,
  getAllstateProductPageLd,
} from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

function carriersIndexHref(locale: SupportedLocale): string {
  return withLocalePrefix(locale, localizedSlug("/carriers", locale));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "allstate.productPages",
  });

  const title = t("hub.metadata.title");
  const description = t("hub.metadata.description");
  const keywords = t("hub.metadata.keywords", { default: "" });
  const routeKey = "/carriers/allstate";
  const slug = localizedSlug(routeKey as "/carriers/allstate", locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey as "/carriers/allstate");
  const xDefault = withLocalePrefix(
    "en",
    localizedSlug(routeKey as "/carriers/allstate", "en")
  );
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AllstateHubPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "allstate.productPages",
  });

  const skipLabel = locale.startsWith("es")
    ? "Saltar al contenido principal"
    : "Skip to main content";

  const homeLabel = locale.startsWith("es") ? "Inicio" : "Home";
  const pageLd = getAllstateProductPageLd(
    locale,
    "carriers/allstate",
    t("hub.metadata.title"),
    t("hub.metadata.description")
  );
  const crumbLd = getAllstateProductBreadcrumbLd(locale, [
    { name: homeLabel, path: "" },
    { name: t("labels.breadcrumbHub"), path: "carriers/allstate" },
  ]);

  return (
    <div className="relative min-h-screen">
      <a
        href="#allstate-health-hub-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0] focus:ring-offset-2"
      >
        {skipLabel}
      </a>
      <BackHome href={carriersIndexHref(locale)} label={t("hub.backNav.label")} />
      <AllstateHealthHub t={t} />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
