import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import ShortTermCarriersSection, {
  stmCarrierHeroUrl,
} from "@/components/shortterm-carriers-section";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import {
  gcfCarriersDirectHref,
  isGcfCarriersHubQuery,
  type CarriersHubCardId,
} from "@/lib/carriers-gcf-direct-quote-urls";
import { isGcfHealthCoverageFastAdsCarrierPage } from "@/lib/get-covered-fast/gcf-attribution";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "carriersIndex.metadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const routeKey = "/carriers";
  const slug = localizedSlug(routeKey as any, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey as any);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey as any, "en"));
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

type CarriersPageProps = {
  searchParams: Promise<{
    from?: string;
    path?: string;
    gcf_channel?: string;
  }>;
};

function firstQueryString(
  v: string | string[] | undefined
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function CarriersIndexPage({
  searchParams,
}: CarriersPageProps) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "carriersIndex" });
  const sp = await searchParams;
  const from = firstQueryString(sp.from);
  const path = firstQueryString(sp.path);
  const gcfChannel = firstQueryString(sp.gcf_channel);

  const useGcfDirectQuotes = isGcfCarriersHubQuery(from, path);

  const gcfAdsCarrierConversionEnabled = isGcfHealthCoverageFastAdsCarrierPage(
    { from, path, gcf_channel: gcfChannel },
    "carriers"
  );

  const hub = (
    routeKey:
      | "/carriers/uhone"
      | "/carriers/pivot/shortterm"
      | "/carriers/manhattan"
      | "/carriers/manhattan/shortterm"
      | "/carriers/allstate"
  ) => withLocalePrefix(locale, localizedSlug(routeKey as any, locale));

  const carrierHref = (id: CarriersHubCardId, landing: string) =>
    useGcfDirectQuotes ? gcfCarriersDirectHref(id) : landing;

  return (
    <div className="relative min-h-screen">
      <BackHome />
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-6 text-center sm:px-6 md:pt-24 md:pb-8">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t("intro.title")}
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {t("intro.subtitle")}
        </p>
      </div>

      <ShortTermCarriersSection
        label={t("section.label")}
        title={t("section.title")}
        ctaLabel={t("section.cta")}
        ctaLabelMobile={t("section.ctaMobile")}
        gcfAdsCarrierConversionEnabled={gcfAdsCarrierConversionEnabled}
        carrierHubContext="carriers_index"
        carriers={[
          {
            id: "uhone",
            name: t("cards.uhone.name"),
            blurb: t("cards.uhone.blurb"),
            bestFor: t("cards.uhone.bestFor"),
            notIdeal: t("cards.uhone.notIdeal"),
            timeNote: t("cards.uhone.timeNote"),
            href: carrierHref("uhone", hub("/carriers/uhone")),
            heroSrc: stmCarrierHeroUrl("pexels-august-de-richelieu-4260639_qgzqnk"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
          },
          {
            id: "pivot",
            name: t("cards.pivot.name"),
            blurb: t("cards.pivot.blurb"),
            bestFor: t("cards.pivot.bestFor"),
            notIdeal: t("cards.pivot.notIdeal"),
            timeNote: t("cards.pivot.timeNote"),
            href: carrierHref("pivot", hub("/carriers/pivot/shortterm")),
            heroSrc: stmCarrierHeroUrl("pexels-pixabay-356040_kzryk7"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397411/pivothealth_logo_sabqbm.jpg",
          },
          {
            id: "manhattan",
            name: t("cards.manhattan.name"),
            blurb: t("cards.manhattan.blurb"),
            bestFor: t("cards.manhattan.bestFor"),
            notIdeal: t("cards.manhattan.notIdeal"),
            timeNote: t("cards.manhattan.timeNote"),
            href: carrierHref("manhattan", hub("/carriers/manhattan")),
            heroSrc: stmCarrierHeroUrl("pexels-gabby-k-7114420_ev9ryf"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397411/manhatan_logo_g6cswk.jpg",
          },
          {
            id: "allstate",
            name: t("cards.allstate.name"),
            blurb: t("cards.allstate.blurb"),
            bestFor: t("cards.allstate.bestFor"),
            notIdeal: t("cards.allstate.notIdeal"),
            timeNote: t("cards.allstate.timeNote"),
            href: carrierHref("allstate", hub("/carriers/allstate")),
            heroSrc: stmCarrierHeroUrl("pexels-shvetsa-4421496_ex5gi4"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397414/allstate_logo_ungrkt.png",
          },
        ]}
      />
    </div>
  );
}
