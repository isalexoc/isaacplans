/**
 * The product domain's page frame: every page there (an agent's guide, Apply and privacy pages, and
 * the client's application and secure link) is drawn inside it, with that agent's identity and
 * nothing of Isaac's. The layout (app/[locale]/layout.tsx, product branch) adds no chrome of its own.
 *
 *  - Header: the agent's photo and name, "Independent representative", a WhatsApp button (when the
 *    agent has a number) and a link to the same page in the other language.
 *  - Footer: a slot for the state notice (empty until the notices land), the not-insurance line,
 *    the platform's name (`PLATFORM_NAME`) and the agent's privacy page.
 * Every link is a plain <a>: the language switch reloads under the other locale, and nothing here
 * may route through Isaac's site.
 */

import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DECK_COPY } from "@/components/impact-presentation/copy";
import AgentPhoto from "@/components/tenant/agent-photo";
import { whatsappHref, type AgentPublicProfile } from "@/lib/tenancy/profile";
import { platformName } from "@/lib/tenancy/site-urls";
import type { ProductLocale } from "@/lib/tenancy/product-routes";

const WORDS = {
  en: { role: "Independent representative", privacy: "Privacy", switchTo: "Ver en español", other: "Español" },
  es: { role: "Representante independiente", privacy: "Privacidad", switchTo: "View in English", other: "English" },
} as const;

export default function TenantShell({
  agent,
  locale,
  languageHrefs,
  privacyHref,
  stateNotice,
  reserveBottom = false,
  children,
}: {
  agent: AgentPublicProfile;
  locale: ProductLocale;
  /** This same page in each language. */
  languageHrefs: Record<ProductLocale, string>;
  /** The agent's privacy page. */
  privacyHref: string;
  /** The client's state notice, word for word (a later step fills it). */
  stateNotice?: ReactNode;
  /** The page keeps a bar fixed to the bottom of the screen: leave room for it under the footer. */
  reserveBottom?: boolean;
  children: ReactNode;
}) {
  const w = WORDS[locale];
  const other: ProductLocale = locale === "es" ? "en" : "es";
  const whatsapp = whatsappHref(agent.whatsappDigits);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="border-b border-[#e6e9ef] bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="relative h-11 w-11 flex-none overflow-hidden rounded-full bg-[#dfe7ef]">
            <AgentPhoto agent={agent} sizes="44px" initialsClassName="text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight text-[#0b2a4a] dark:text-white">{agent.displayName}</p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-[.08em] text-[#56657a] dark:text-gray-400">
              {w.role}
            </p>
          </div>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 flex-none items-center gap-1.5 rounded-xl border-2 border-[#25d366]/40 px-3 text-sm font-semibold text-[#128c4a] hover:bg-[#25d366]/10"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden min-[380px]:inline">WhatsApp</span>
            </a>
          )}
          <a
            href={languageHrefs[other]}
            hrefLang={other}
            lang={other}
            aria-label={w.switchTo}
            className="flex h-10 flex-none items-center rounded-xl px-2.5 text-sm font-semibold text-[#0b2a4a] hover:bg-[#fbf6f2] dark:text-gray-200 dark:hover:bg-gray-900"
          >
            {w.other}
          </a>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col">{children}</main>

      <footer
        className={cn(
          "border-t border-[#e6e9ef] bg-white px-4 pt-6 text-center text-xs leading-relaxed text-[#56657a] dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400",
          reserveBottom ? "pb-40" : "pb-8"
        )}
      >
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {stateNotice ? <div className="text-left">{stateNotice}</div> : null}
          <p>{DECK_COPY[locale].notInsurance}</p>
          <p>
            {platformName()} ·{" "}
            <a href={privacyHref} className="font-semibold underline underline-offset-2">
              {w.privacy}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
