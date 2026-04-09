import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { getTranslations } from "next-intl/server";
import { getAgencyLd, siteLd, getIsaacPersonLd } from "@/lib/seo/jsonld";
import { getLocale } from "next-intl/server";
import Script from "next/script";
import { ClerkProvider } from '@clerk/nextjs';
import { esES, enUS } from '@clerk/localizations';
import { SanityLive } from '@/sanity/lib/live';
import MetaPixelWrapper from "@/components/meta-pixel-wrapper";
import { GoogleAnalytics } from '@next/third-parties/google'
import { getLicensedStateCount } from "@/lib/licensed-states";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  const states = String(await getLicensedStateCount());
  const t = await getTranslations({ locale, namespace: "layoutMetadata" });
  const title = t("title");
  const description = t("description", { states });
  const image = t("image");
  const alt = t("imageAlt", {
    default: "Isaac Plans Insurance logo on a blue gradient background",
  });

  // Map to OG-friendly locale
  const ogLocale = locale === "es" ? "es_ES" : "en_US";

  return {
    metadataBase: new URL("https://www.isaacplans.com"),
    title,
    description,
    keywords: t("keywords"),
    openGraph: {
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt }],
    },
    other: {
      google: "notranslate",
    },
    verification: {
      google:
        "google-site-verification=bHyg2vwWXgsYAG8Ue4uwYs8QPDDiu56H0BrecWVNGaQ",
    },
  };
}

const inter = Inter({ subsets: ["latin"] });

const CHAT_CONFIG: Record<
  string,
  { src: string; resourcesUrl: string; widgetId: string }
> = {
  en: {
    src: "https://widgets.leadconnectorhq.com/loader.js",
    resourcesUrl: "https://widgets.leadconnectorhq.com/chat-widget/loader.js",
    widgetId: "687794d4afd5323330f86826",
  },
  es: {
    src: "https://beta.leadconnectorhq.com/loader.js",
    resourcesUrl: "https://beta.leadconnectorhq.com/chat-widget/loader.js",
    widgetId: "69d4000b6ddd01f306170b54",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const chat = CHAT_CONFIG[locale] ?? CHAT_CONFIG.en;

  // Get Facebook Pixel ID from environment variable
  const facebookPixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

  // Agent CRM external page view + form tracking (Settings → External Tracking).
  // Set NEXT_PUBLIC_AGENT_CRM_TRACKING_ID="" to disable; omit env to use the default id below.
  const envAgentCrmTrackingId = process.env.NEXT_PUBLIC_AGENT_CRM_TRACKING_ID;
  const agentCrmTrackingId =
    envAgentCrmTrackingId !== undefined
      ? envAgentCrmTrackingId.trim() || null
      : "tk_4df021e9555846009a2051074c72000d";
  const agentCrmTrackingSrc =
    process.env.NEXT_PUBLIC_AGENT_CRM_EXTERNAL_TRACKING_URL ??
    "https://link.agent-crm.com/js/external-tracking.js";
  const agentCrmTrackingDebug =
    process.env.NEXT_PUBLIC_AGENT_CRM_TRACKING_DEBUG === "true";

  // Map your locale to Clerk's localization
  const clerkLocale = locale === "es" ? esES : enUS;

  return (
    // @ts-ignore - ClerkProvider works correctly with React 19, TypeScript types need update
    <ClerkProvider localization={clerkLocale}>
    <html
      lang={locale}
      translate="no"
      className="notranslate scroll-smooth"
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} flex min-h-screen flex-col bg-white text-gray-900 overflow-x-hidden`}
      >
        <NextIntlClientProvider locale={locale}>
          <SanityLive />
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Toaster />
          {/* <CrispChat /> */}
          {/* @ts-ignore - Footer is an async server component, works correctly with React 19 */}
          <Footer />
          {/* Facebook Pixel */}
          {facebookPixelId && <MetaPixelWrapper pixelId={facebookPixelId} />}
          {/* Agent CRM (LeadConnector) chat – loads after page is interactive */}
          <Script
            id={`agentcrm-chat-${locale}`} // unique per-locale to avoid dedupe
            src={chat.src}
            strategy="afterInteractive"
            data-resources-url={chat.resourcesUrl}
            data-widget-id={chat.widgetId}
          />
          {agentCrmTrackingId ? (
            <Script
              id="agentcrm-external-tracking"
              src={agentCrmTrackingSrc}
              strategy="afterInteractive"
              data-tracking-id={agentCrmTrackingId}
              {...(agentCrmTrackingDebug ? { "data-debug": "true" } : {})}
            />
          ) : null}
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              getAgencyLd(locale),
              siteLd,
              getIsaacPersonLd(locale),
            ]).replace(/</g, "\\u003c"),
          }}
        />
      </body>
      <GoogleAnalytics gaId="G-5SDTGH29ER" />
    </html>
    </ClerkProvider>
  );
}
