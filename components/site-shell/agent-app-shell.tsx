/**
 * The agent area's page frame on isaacplans.com (/{l}/agent, es /agente): drawn by Isaac's frame
 * (main-shell.tsx) INSTEAD of his own whenever middleware marks the request `x-shell: agent` or
 * `agent-present` (lib/tenancy/agent-area-routes.ts). It keeps Clerk (agents sign in and out here),
 * the theme, next-intl and toasts, and draws none of Isaac's chrome or trackers: no header, footer,
 * admin button, Sanity live updates, GA, Meta Pixel, CRM chat or tracking, and none of his JSON-LD.
 *
 *  - "agent": the platform's name, the area's nav (Applications, Profile), the language link, the
 *    signed-in agent's photo and name, and sign-out;
 *  - "agent-present": the deck the agent shares with a client, so just the platform's name, the
 *    agent and the language link.
 * The header is exactly 4rem (5rem from md) plus its 1px border: the deck sizes itself to the
 * window below it. Every link is a plain <a>: the frame is drawn once per page load, so the agent
 * area moves between its pages with full loads and never shows a frame that belongs to another.
 */

import type { ReactNode } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { esES, enUS } from "@clerk/localizations";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkThemeProvider } from "@/components/clerk-theme-provider";
import { Toaster } from "@/components/ui/toaster";
import AgentPhoto from "@/components/tenant/agent-photo";
import AgentSignOutButton from "@/components/agent/agent-sign-out-button";
import {
  agentAreaLocale,
  agentAreaPath,
  isAgentAreaPath,
  type AgentAreaLocale,
  type ShellKind,
} from "@/lib/tenancy/agent-area-routes";
import { getAgentContext } from "@/lib/tenancy/context";
import { agentPublicProfile, type AgentPublicProfile } from "@/lib/tenancy/profile";
import { platformName } from "@/lib/tenancy/site-urls";
import { STRIP_EXTENSION_ATTRS } from "./shared";

const WORDS = {
  en: { area: "Agent area", applications: "Applications", profile: "Profile", signOut: "Sign out", other: "Español", switchTo: "Ver en español" },
  es: { area: "Área de agentes", applications: "Solicitudes", profile: "Perfil", signOut: "Cerrar sesión", other: "English", switchTo: "View in English" },
} as const;

/** The agent area's metadata: the platform's name and icon, never indexed, no Referer (tokens). */
export function agentShellMetadata(): Metadata {
  return {
    title: platformName(),
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    icons: { icon: [{ url: "/platform-icon.svg", type: "image/svg+xml" }] },
    other: { google: "notranslate" },
  };
}

/** The signed-in agent, if this account is one (an admin or a stranger here gets no name). */
async function signedInAgent(): Promise<AgentPublicProfile | null> {
  try {
    const ctx = await getAgentContext();
    return ctx.agent ? agentPublicProfile(ctx.agent) : null;
  } catch {
    return null;
  }
}

function FrameHeader({
  shell,
  locale,
  agent,
  alternateHref,
}: {
  shell: Exclude<ShellKind, "site">;
  locale: AgentAreaLocale;
  agent: AgentPublicProfile | null;
  alternateHref: string;
}) {
  const w = WORDS[locale];
  const other: AgentAreaLocale = locale === "es" ? "en" : "es";
  const withNav = shell === "agent";
  const navLink =
    "hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-[#0b2a4a] hover:bg-[#fbf6f2] dark:text-gray-200 dark:hover:bg-gray-900 sm:flex";

  return (
    <header className="border-b border-[#e6e9ef] bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:px-6 md:h-20">
        <a
          href={withNav ? agentAreaPath(locale) : undefined}
          className="flex min-w-0 flex-none items-center gap-2.5"
          aria-label={platformName()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/platform-icon.svg" alt="" width={36} height={36} className="h-9 w-9 flex-none" />
          <span className="hidden min-w-0 min-[420px]:block">
            <span className="block truncate text-sm font-bold leading-tight text-[#0b2a4a] dark:text-white">
              {platformName()}
            </span>
            {withNav && (
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[.08em] text-[#56657a] dark:text-gray-400">
                {w.area}
              </span>
            )}
          </span>
        </a>

        {withNav && agent && (
          <nav className="ml-2 flex items-center gap-1" aria-label={w.area}>
            <a href={agentAreaPath(locale)} className={navLink}>
              {w.applications}
            </a>
            <a href={agentAreaPath(locale, "profile")} className={navLink}>
              {w.profile}
            </a>
          </nav>
        )}

        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          {/* Only for a signed-in agent: on an invitation landing it would drop the Clerk ticket. */}
          {agent && (
            <a
              href={alternateHref}
              hrefLang={other}
              lang={other}
              aria-label={w.switchTo}
              className="flex h-10 flex-none items-center rounded-xl px-2.5 text-sm font-semibold text-[#0b2a4a] hover:bg-[#fbf6f2] dark:text-gray-200 dark:hover:bg-gray-900"
            >
              {w.other}
            </a>
          )}
          {agent && (
            <a
              href={withNav ? agentAreaPath(locale, "profile") : undefined}
              className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1"
            >
              <span className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-[#dfe7ef] md:h-10 md:w-10">
                <AgentPhoto agent={agent} sizes="40px" initialsClassName="text-sm" />
              </span>
              <span className="hidden max-w-[11rem] truncate text-sm font-semibold text-[#0b2a4a] dark:text-white md:block">
                {agent.displayName}
              </span>
            </a>
          )}
          {withNav && agent && <AgentSignOutButton label={w.signOut} redirectUrl={agentAreaPath(locale)} />}
        </div>
      </div>
      {withNav && agent && (
        <nav className="flex gap-1 border-t border-[#e6e9ef] px-4 py-1.5 dark:border-gray-800 sm:hidden" aria-label={w.area}>
          <a href={agentAreaPath(locale)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0b2a4a] dark:text-gray-200">
            {w.applications}
          </a>
          <a href={agentAreaPath(locale, "profile")} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0b2a4a] dark:text-gray-200">
            {w.profile}
          </a>
        </nav>
      )}
    </header>
  );
}

export async function AgentAppFrame({
  locale: rawLocale,
  fontClassName,
  shell,
  alternateHref,
  children,
}: {
  locale: string;
  fontClassName: string;
  shell: Exclude<ShellKind, "site">;
  /** From middleware (`x-shell-alternate`); anything that isn't an agent-area path is ignored. */
  alternateHref: string | null;
  children: ReactNode;
}): Promise<ReactNode> {
  const locale = agentAreaLocale(rawLocale);
  const other: AgentAreaLocale = locale === "es" ? "en" : "es";
  const alternate = alternateHref && isAgentAreaPath(alternateHref) && alternateHref.startsWith(`/${other}/`)
    ? alternateHref
    : agentAreaPath(other);
  const [agent, messages] = await Promise.all([signedInAgent(), getMessages()]);

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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="isaacplans-ui-theme">
          <ClerkThemeProvider localization={locale === "es" ? esES : enUS}>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <FrameHeader shell={shell} locale={locale} agent={agent} alternateHref={alternate} />
              <main className="flex w-full flex-1 flex-col">{children}</main>
              <Toaster />
            </NextIntlClientProvider>
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
