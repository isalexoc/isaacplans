import { NextIntlClientProvider, hasLocale } from "next-intl";
import { headers } from "next/headers";
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
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from '@clerk/nextjs';
import { esES, enUS } from '@clerk/localizations';
import { SanityLive } from '@/sanity/lib/live';
import MetaPixelWrapper from "@/components/meta-pixel-wrapper";
import AgentCrmChat from "@/components/agent-crm-chat";
import AgentCrmExternalTracking from "@/components/agent-crm-external-tracking";
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
      /** Meta / Facebook domain verification (Business Settings → Brand safety → Domains) */
      other: {
        "facebook-domain-verification": "u856wjwv5r8s2yjoyqhaqcpv6z5j95",
      },
    },
  };
}

const inter = Inter({ subsets: ["latin"] });

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

  const isAdsLanding =
    (await headers()).get("x-is-ads-landing") === "1";

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
        className={`${inter.className} flex min-h-screen flex-col bg-background text-foreground antialiased overflow-x-hidden`}
        suppressHydrationWarning
      >
        {/* Strip extension-injected attrs (e.g. fdprocessedid) — must run synchronously on mutation so React hydration does not see mismatched attrs */}
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){function strip(){document.querySelectorAll("[fdprocessedid]").forEach(function(el){el.removeAttribute("fdprocessedid");});}function onMut(){strip();}strip();document.addEventListener("DOMContentLoaded",strip);if(typeof MutationObserver!=="undefined"){try{new MutationObserver(onMut).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["fdprocessedid"]});}catch(e){}}})();`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="isaacplans-ui-theme"
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
          {/* LeadConnector chat — omit on paid landing routes (middleware x-is-ads-landing) for perf + funnel focus */}
          {!isAdsLanding ? <AgentCrmChat /> : null}
          {!isAdsLanding && agentCrmTrackingId ? (
            <AgentCrmExternalTracking
              trackingId={agentCrmTrackingId}
              src={agentCrmTrackingSrc}
              debug={agentCrmTrackingDebug}
            />
          ) : null}
        </NextIntlClientProvider>
        </ThemeProvider>
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
