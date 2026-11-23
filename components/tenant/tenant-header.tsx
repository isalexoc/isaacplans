/**
 * The header of an agent's pages on the product domain (components/tenant/tenant-shell.tsx): the
 * agent's photo and name, "Independent representative", a WhatsApp button when the agent has a
 * number, and a link to the same page in the other language. On its own so the agent area's
 * profile page can preview exactly what clients see. Plain links only, nothing of Isaac's.
 */

import { MessageCircle } from "lucide-react";
import AgentPhoto from "@/components/tenant/agent-photo";
import { whatsappHref, type AgentPublicProfile } from "@/lib/tenancy/profile";
import type { ProductLocale } from "@/lib/tenancy/product-routes";

const WORDS = {
  en: { role: "Independent representative", switchTo: "Ver en español", other: "Español" },
  es: { role: "Representante independiente", switchTo: "View in English", other: "English" },
} as const;

export default function TenantHeader({
  agent,
  locale,
  otherLanguageHref,
}: {
  agent: AgentPublicProfile;
  locale: ProductLocale;
  /** This same page in the other language. */
  otherLanguageHref: string;
}) {
  const w = WORDS[locale];
  const other: ProductLocale = locale === "es" ? "en" : "es";
  const whatsapp = whatsappHref(agent.whatsappDigits);

  return (
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
          href={otherLanguageHref}
          hrefLang={other}
          lang={other}
          aria-label={w.switchTo}
          className="flex h-10 flex-none items-center rounded-xl px-2.5 text-sm font-semibold text-[#0b2a4a] hover:bg-[#fbf6f2] dark:text-gray-200 dark:hover:bg-gray-900"
        >
          {w.other}
        </a>
      </div>
    </header>
  );
}
