/**
 * The product domain's page frame (APP_SURFACE=product): the page itself (each one draws the
 * agent's own header and footer through components/tenant/tenant-shell.tsx), the theme, next-intl
 * and toasts, and nothing of Isaac's: no Clerk, header, footer, admin button, Sanity live updates,
 * analytics, Pixel, CRM chat or tracking, JSON-LD, keywords or verification tags. next-intl gets no
 * message catalog: the client components there only read the locale, and the catalog is Isaac's
 * site copy.
 *
 * Only the product build contains this file (components/site-shell/active-shell.ts): it replaces
 * main-shell.tsx there, so that frame's imports never reach the product's browser bundles. Import
 * only what this frame renders.
 */

import { NextIntlClientProvider } from "next-intl";
import type { Metadata } from "next";
import Script from "next/script";
import { connection } from "next/server";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { platformName, productPublicOrigin } from "@/lib/tenancy/site-urls";
import {
  STRIP_EXTENSION_ATTRS,
  type ShellMetadata,
  type ShellSurface,
  type SiteShellComponent,
} from "./shared";

export const SHELL_SURFACE: ShellSurface = "product";

/**
 * The product domain's defaults: its own address, a neutral icon and nothing of Isaac's (no
 * keywords, verification tags, site name or share image). Never indexed; each page sets its own
 * title and share image.
 */
export const shellMetadata: ShellMetadata = async (): Promise<Metadata> => {
  const origin = productPublicOrigin();
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: platformName(),
    robots: { index: false, follow: false },
    icons: { icon: [{ url: "/platform-icon.svg", type: "image/svg+xml" }] },
    other: { google: "notranslate" },
  };
};

const ProductShell: SiteShellComponent = async ({ locale, fontClassName, children }) => {
  // Every page renders per request, as on Isaac's site (his frame reads the request headers): the
  // product build never prerenders a page, his included, inside this frame.
  await connection();
  return (
    <html lang={locale} translate="no" className="notranslate scroll-smooth" suppressHydrationWarning>
      <body
        className={`${fontClassName} flex min-h-screen flex-col bg-background text-foreground antialiased overflow-x-hidden`}
        suppressHydrationWarning
      >
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="ui-theme">
          <NextIntlClientProvider locale={locale} messages={{}}>
            <div className="flex w-full flex-1 flex-col">{children}</div>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ProductShell;
