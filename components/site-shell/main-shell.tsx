/**
 * isaacplans.com's page frame (APP_SURFACE unset): Clerk, his header and footer, the admin button,
 * Sanity live updates, GA, Meta Pixel, the CRM chat and tracking, and his JSON-LD and site
 * metadata. Exactly what app/[locale]/layout.tsx always drew; it only moved here.
 *
 * Picked when the app is BUILT, never per request (components/site-shell/active-shell.ts): the
 * product domain's build swaps this file for product-shell.tsx, so none of its imports, which ship
 * to the browser with the layout's code even when they don't render, ever reach that domain.
 */

import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AnalyticsPrivacyGuard from "@/components/analytics-privacy-guard";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/ga-id";
import { getMessages, getTranslations } from "next-intl/server";
import { getAgencyLd, siteLd, getIsaacPersonLd } from "@/lib/seo/jsonld";
import { getLocale } from "next-intl/server";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkThemeProvider } from "@/components/clerk-theme-provider";
import { esES, enUS } from '@clerk/localizations';
import { SanityLive } from '@/sanity/lib/live';
import MetaPixelWrapper from "@/components/meta-pixel-wrapper";
import AdminFab from "@/components/admin-fab";
import AgentCrmChat from "@/components/agent-crm-chat";
import AgentCrmExternalTracking from "@/components/agent-crm-external-tracking";
import { GoogleAnalytics } from '@next/third-parties/google'
import { getLicensedStateCount } from "@/lib/licensed-states";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import { BlogModalProvider } from "@/components/blog-modal-context";
import { parseShellHeader, SHELL_ALTERNATE_HEADER, SHELL_HEADER } from "@/lib/tenancy/agent-area-routes";
import { AgentAppFrame, agentShellMetadata } from "./agent-app-shell";
import {
  STRIP_EXTENSION_ATTRS,
  type ShellMetadata,
  type ShellSurface,
  type SiteShellComponent,
} from "./shared";

export const SHELL_SURFACE: ShellSurface = "main";

export const shellMetadata: ShellMetadata = async (): Promise<Metadata> => {
  // The agent area has its own frame and none of Isaac's site metadata (middleware sets the header
  // on every page, so a browser can't choose it).
  if (parseShellHeader((await headers()).get(SHELL_HEADER)) !== "site") return agentShellMetadata();

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
      images: [{ url: cloudinaryOgImageUrl(image), width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: cloudinaryOgImageUrl(image), alt }],
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
};

const MainShell: SiteShellComponent = async ({ locale, fontClassName, children }) => {
  const requestHeaders = await headers();

  // The agent area (/agent, es /agente) draws its own frame instead of Isaac's: none of his
  // header, footer, admin button or trackers. Middleware sets this header on every page response,
  // overwriting anything a browser sent (lib/tenancy/agent-area-routes.ts).
  const shell = parseShellHeader(requestHeaders.get(SHELL_HEADER));
  if (shell !== "site") {
    return AgentAppFrame({
      locale,
      fontClassName,
      shell,
      alternateHref: requestHeaders.get(SHELL_ALTERNATE_HEADER),
      children,
    });
  }

  const isAdsLanding = requestHeaders.get("x-is-ads-landing") === "1";
  // Pages whose URL is a credential and that show a client's personal data (middleware sets this
  // for the ACA confirmation signing link). No third-party trackers there: Meta Pixel, GA and the
  // CRM's scripts all report the full page URL, token included.
  const isPrivatePage = requestHeaders.get("x-private-page") === "1";

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
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      translate="no"
      className="notranslate scroll-smooth"
      suppressHydrationWarning
    >
      <body
        className={`${fontClassName} flex min-h-screen flex-col bg-background text-foreground antialiased overflow-x-hidden`}
        suppressHydrationWarning
      >
        {/* Strip extension-injected attrs (e.g. fdprocessedid) — must run synchronously on mutation so React hydration does not see mismatched attrs */}
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: STRIP_EXTENSION_ATTRS,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="isaacplans-ui-theme"
        >
        <ClerkThemeProvider localization={clerkLocale}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <BlogModalProvider>
          <SanityLive />
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Toaster />
          <AnalyticsPrivacyGuard gaId={GA_MEASUREMENT_ID} />
          {/* Floating admin shortcut — server-gated, only renders for admins */}
          {/* @ts-ignore - AdminFab is an async server component, works correctly with React 19 */}
          <AdminFab />
          {/* <CrispChat /> */}
          {/* @ts-ignore - Footer is an async server component, works correctly with React 19 */}
          <Footer />
          {/* Facebook Pixel */}
          {facebookPixelId && !isPrivatePage && <MetaPixelWrapper pixelId={facebookPixelId} />}
          {/* LeadConnector chat — omit on paid landing routes (middleware x-is-ads-landing) for perf + funnel focus */}
          {!isAdsLanding && !isPrivatePage ? <AgentCrmChat /> : null}
          {!isAdsLanding && !isPrivatePage && agentCrmTrackingId ? (
            <AgentCrmExternalTracking
              trackingId={agentCrmTrackingId}
              src={agentCrmTrackingSrc}
              debug={agentCrmTrackingDebug}
            />
          ) : null}
          </BlogModalProvider>
        </NextIntlClientProvider>
        </ClerkThemeProvider>
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
      {!isPrivatePage && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </html>
  );
};

export default MainShell;
