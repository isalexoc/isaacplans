import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import StmRequestInfoLanding, {
  stmRequestInfoMainId,
  stmRequestInfoSkipLinkRingClass,
} from "@/components/stm-request-info-landing";
import {
  getStmPartnerCarrierPageLd,
  getStmPartnerCarrierBreadcrumbLd,
  getStmPartnerCarrierFaqLd,
} from "@/lib/seo/jsonld";
import { MANHATTAN_DIRECT_QUOTE_URL } from "@/lib/manhattan-direct-quote";

import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

const CARRIER = "manhattan" as const;

function shortTermMedicalHref(locale: SupportedLocale): string {
  return withLocalePrefix(
    locale,
    localizedSlug("/short-term-medical", locale)
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "manhattan.shortterm.stmMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/stm.png",
  }) as string;
  const alt = t("imageAlt", {
    default: "Manhattan Life short term medical preview",
  });

  const routeKey = "/carriers/manhattan/shortterm";
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

export default async function ManhattanShortTermPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "manhattan.shortterm" });

  const tMeta = await getTranslations({
    locale,
    namespace: "manhattan.shortterm.stmMetadata",
  });

  const pageLd = getStmPartnerCarrierPageLd(
    locale,
    CARRIER,
    tMeta("title"),
    tMeta("description")
  );
  const crumbLd = getStmPartnerCarrierBreadcrumbLd(
    locale,
    CARRIER,
    locale.startsWith("es") ? "Inicio" : "Home",
    tMeta("title")
  );

  const faqLd = getStmPartnerCarrierFaqLd(
    [0, 1, 2, 3].map((i) => ({
      question: t(`faq.items.${i}.q`),
      answer: t(`faq.items.${i}.a`),
    }))
  );

  const skipLabel = locale.startsWith("es")
    ? "Saltar al contenido principal"
    : "Skip to main content";

  const mainId = stmRequestInfoMainId(CARRIER);
  const skipRing = stmRequestInfoSkipLinkRingClass(CARRIER);

  return (
    <div className="relative min-h-screen">
      <a
        href={`#${mainId}`}
        className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${skipRing}`}
      >
        {skipLabel}
      </a>
      <BackHome href={shortTermMedicalHref(locale)} label={t("backNav.label")} />
      <StmRequestInfoLanding
        t={t}
        variant={CARRIER}
        directQuoteUrl={MANHATTAN_DIRECT_QUOTE_URL}
        locale={locale}
      />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd, faqLd]).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />

      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              function labelChatClose(){
                var el = document.querySelector('button.lc_text-widget_prompt--prompt-close');
                if (el && !el.getAttribute('aria-label')) {
                  var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
                  var label = lang.startsWith('es') ? 'Cerrar' : 'Close';
                  el.setAttribute('aria-label', label);
                  el.setAttribute('title', label);
                }
              }
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', labelChatClose);
              } else {
                labelChatClose();
              }
            })();
          `,
        }}
      />
    </div>
  );
}
