import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import CrispChat from "@/components/crisp-chat";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { getTranslations } from "next-intl/server";
import {
  agencyLd,
  siteLd,
  rootBreadcrumbLd,
  isaacPersonLd,
} from "@/lib/seo/jsonld";
import { getLocale } from "next-intl/server";

export const metadata = {
  metadataBase: new URL("https://www.isaacplans.com"), // keep this host everywhere
} satisfies Metadata;

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
  };
}

const inter = Inter({ subsets: ["latin"] });

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Ensure that the incoming `locale` is valid
  const { locale } = params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className="scroll-smooth">
      <body
        className={`${inter.className} flex min-h-screen flex-col bg-white text-gray-900 overflow-x-hidden`}
      >
        <NextIntlClientProvider locale={locale}>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Toaster />
          <CrispChat />
          <Footer />
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              agencyLd,
              siteLd,
              rootBreadcrumbLd,
              isaacPersonLd, // ← moved here
            ]).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
