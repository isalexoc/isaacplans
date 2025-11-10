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
import { agencyLd, siteLd, isaacPersonLd } from "@/lib/seo/jsonld";
import { getLocale } from "next-intl/server";
import Script from "next/script";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  const t = await getTranslations({ locale, namespace: "layoutMetadata" });
  const title = t("title");
  const description = t("description");
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
    widgetId: "68b65604b832ccbc42830f29",
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

  return (
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
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Toaster />
          {/* <CrispChat /> */}
          {/* @ts-expect-error - Next.js async server components are valid JSX */}
          <Footer />
          {/* Agent CRM (LeadConnector) chat – loads after page is interactive */}
          <Script
            id={`agentcrm-chat-${locale}`} // unique per-locale to avoid dedupe
            src={chat.src}
            strategy="afterInteractive"
            data-resources-url={chat.resourcesUrl}
            data-widget-id={chat.widgetId}
          />
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              agencyLd,
              siteLd,
              isaacPersonLd, // ← moved here
            ]).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
