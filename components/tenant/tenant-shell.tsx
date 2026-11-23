/**
 * The product domain's page frame: every page there (an agent's guide, Apply and privacy pages, and
 * the client's application and secure link) is drawn inside it, with that agent's identity and
 * nothing of Isaac's. The layout (app/[locale]/layout.tsx, product branch) adds no chrome of its own.
 *
 *  - Header (components/tenant/tenant-header.tsx): the agent's photo and name, "Independent
 *    representative", a WhatsApp button (when the agent has a number) and a link to the same page
 *    in the other language.
 *  - Footer: a slot for the state notice (empty until the notices land), the not-insurance line,
 *    the platform's name (`PLATFORM_NAME`) and the agent's privacy page.
 * Every link is a plain <a>: the language switch reloads under the other locale, and nothing here
 * may route through Isaac's site.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DECK_COPY } from "@/components/impact-presentation/copy";
import TenantHeader from "@/components/tenant/tenant-header";
import type { AgentPublicProfile } from "@/lib/tenancy/profile";
import { platformName } from "@/lib/tenancy/site-urls";
import type { ProductLocale } from "@/lib/tenancy/product-routes";

const WORDS = {
  en: { privacy: "Privacy" },
  es: { privacy: "Privacidad" },
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

  return (
    <div className="flex min-h-screen w-full flex-col">
      <TenantHeader agent={agent} locale={locale} otherLanguageHref={languageHrefs[other]} />

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
