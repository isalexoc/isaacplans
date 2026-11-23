import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
// The page frame: Isaac's (main-shell.tsx) on his site, the product domain's (product-shell.tsx) on
// the product build. Swapped when the app is built, never per request: see the file.
import SiteShell, { SHELL_SURFACE, shellMetadata } from "@/components/site-shell/active-shell";
import { appSurface } from "@/lib/tenancy/surface";

/**
 * A deployment whose APP_SURFACE changed after it was built must never draw one site's frame on the
 * other's pages (Isaac's header, analytics and CRM scripts on the product domain): it fails instead,
 * until it is rebuilt. Never true when build and runtime agree, as they do on Vercel.
 */
function assertFrameMatchesSurface(): void {
  if (SHELL_SURFACE !== appSurface()) {
    throw new Error(
      `This build's page frame is "${SHELL_SURFACE}" but APP_SURFACE says "${appSurface()}": rebuild the app with the same APP_SURFACE it runs with.`
    );
  }
}

export async function generateMetadata(): Promise<Metadata> {
  assertFrameMatchesSurface();
  return shellMetadata();
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
  assertFrameMatchesSurface();

  // The frame is an async Server Component, called directly: this TypeScript (5.0) rejects an async
  // component written as JSX, and a server component is just an async function of its props.
  return SiteShell({ locale, fontClassName: inter.className, children });
}
