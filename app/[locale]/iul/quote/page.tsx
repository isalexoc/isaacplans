import type { Metadata } from "next";
import IULLeadGenForm from "@/components/iul-lead-gen-form";
import IULLeadGenTracker from "@/components/iul-lead-gen-tracker";
import { getLocale, getTranslations } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "iulQuote.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });

  const routeKey = "/iul/quote";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));
  const ogLocale = ogLocaleOf(locale);

  // Get locale-specific OG image (optimized for social sharing: 1200x630)
  const ogImageId = locale === "es" ? "quote_iul_es_bcqglt" : "quote_iul_en_cxwq4x";
  const ogImageUrl = `https://res.cloudinary.com/isaacdev/image/upload/w_1200,h_630,c_fit,f_auto,q_auto/${ogImageId}`;

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
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImageUrl, alt: title }],
    },
  };
}

export default async function IULQuotePage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "iulQuote" });
  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Hide header, footer, and chat widget using CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        header,
        body > footer {
          display: none !important;
        }
        main {
          margin-top: 0 !important;
        }
        /* Hide LeadConnector/AgentCRM chat widget */
        [id*="leadconnector"],
        [id*="agentcrm"],
        [id*="chat-widget"],
        [class*="leadconnector"],
        [class*="agentcrm"],
        [class*="chat-widget"],
        [class*="lc-chat"],
        iframe[src*="leadconnector"],
        iframe[src*="agent-crm"],
        iframe[src*="widgets.leadconnectorhq.com"],
        div[data-widget-id],
        div[data-resources-url*="leadconnector"],
        div[data-resources-url*="agent-crm"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
        }
      `}} />
      
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col">
        <IULLeadGenTracker />
        
        {/* Landing Page Content */}
        <div className="container mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col">
          <div className="max-w-4xl mx-auto w-full">
            {/* Title */}
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                {locale === "es" ? (
                  <>
                    3 Cosas que <span className="text-[#0284c7]">NECESITAS</span> Saber <span className="text-[#0284c7]">ANTES</span> de Obtener un IUL
                  </>
                ) : (
                  <>
                    3 Things You <span className="text-[#0284c7]">NEED</span> To Know <span className="text-[#0284c7]">BEFORE</span> Getting An IUL
                  </>
                )}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground">
                {t("landing.subtitle")}
              </p>
            </div>

            {/* Video Placeholder */}
            <div className="mb-6 md:mb-8">
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">▶️</div>
                  <p className="text-muted-foreground">
                    {locale === "es" 
                      ? "Marcador de posición de video - El video se agregará aquí"
                      : "Video placeholder - Video will be added here"}
                  </p>
                </div>
              </div>
            </div>

            {/* Survey CTA */}
            <div className="text-center mb-8 md:mb-12">
              <p className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t("landing.surveyCta")}
              </p>
            </div>

            {/* Form Section */}
            <div className="max-w-3xl mx-auto mb-8">
              <IULLeadGenForm />
            </div>
          </div>
        </div>

        {/* Simple Footer */}
        <footer className="py-4 text-center text-sm text-muted-foreground border-t border-gray-200 dark:border-gray-800">
          <p>Copyright {currentYear} Isaac Plans Insurance. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

