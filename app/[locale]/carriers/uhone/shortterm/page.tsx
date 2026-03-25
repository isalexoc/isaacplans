import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import UhoneCarrierLanding from "@/components/uhone-carrier-landing";
import {
  getUhoneShortTermPageLd,
  getUhoneShortTermBreadcrumbLd,
  getUhoneShortTermFaqLd,
} from "@/lib/seo/jsonld";

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
  const t = await getTranslations({
    locale,
    namespace: "uhone.shortterm.stmMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/stm.png",
  }) as string;
  const alt = t("imageAlt", {
    default: "UnitedHealthOne plan preview",
  });

  const routeKey = "/carriers/uhone/shortterm";
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

export default async function ShortTermMedicalPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "uhone.shortterm" });

  const tMeta = await getTranslations({
    locale,
    namespace: "uhone.shortterm.stmMetadata",
  });

  const pageLd = getUhoneShortTermPageLd(
    locale,
    tMeta("title"),
    tMeta("description")
  );
  const crumbLd = getUhoneShortTermBreadcrumbLd(
    locale,
    locale.startsWith("es") ? "Inicio" : "Home",
    tMeta("title")
  );

  const faqLd = getUhoneShortTermFaqLd(
    [0, 1, 2, 3].map((i) => ({
      question: t(`faq.items.${i}.q`),
      answer: t(`faq.items.${i}.a`),
    }))
  );

  return (
    <div className="min-h-screen relative">
      <BackHome />
      <UhoneCarrierLanding locale={locale} t={t} />

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

      {/* a11y patch for 3rd-party chat close button (labels the button if present) */}
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
