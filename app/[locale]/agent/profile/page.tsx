/*
 * app/[locale]/agent/profile/page.tsx — the agent's own profile: name, photo link (https only, by
 * the public profile's rules; no upload in the pilot), WhatsApp, contact email, languages, licenses,
 * IBO number, Impact link, language and alert email, with a preview of their guide's header exactly
 * as clients see it (components/tenant/tenant-header.tsx, drawn from the SAVED profile).
 *
 * A linked agent who accepted the agreements, whatever their status: an invited agent prepares
 * their profile before Isaac activates them.
 */

import type { Metadata } from "next";
import AgentAreaNotice from "@/components/agent/agent-area-notice";
import AgentProfileForm from "@/components/agent/agent-profile-form";
import TenantHeader from "@/components/tenant/tenant-header";
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import { agentAreaPage } from "@/lib/tenancy/agent-area";
import { agentAreaLocale } from "@/lib/tenancy/agent-area-routes";
import { agentProfileForm } from "@/lib/tenancy/agent-profile-input";
import { agentPagePath } from "@/lib/tenancy/product-routes";
import { agentPublicProfile } from "@/lib/tenancy/profile";
import { productPublicOrigin } from "@/lib/tenancy/site-urls";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = agentAreaLocale((await params).locale);
  return { title: locale === "es" ? "Perfil" : "Profile", robots: { index: false, follow: false } };
}

const WORDS = {
  en: {
    title: "Profile",
    intro: "How you appear on your guide, your presentation and your quote images.",
    preview: "Your guide's header, as clients see it",
    address: "Your guide's address",
  },
  es: {
    title: "Perfil",
    intro: "Cómo aparece usted en su guía, su presentación y sus imágenes de cotización.",
    preview: "El encabezado de su guía, como lo ven sus clientes",
    address: "La dirección de su guía",
  },
} as const;

export default async function AgentProfilePage({ params }: { params: Params }) {
  const locale = agentAreaLocale((await params).locale);
  const gate = await agentAreaPage(locale);
  if (gate.kind === "notice") return <AgentAreaNotice kind={gate.notice} locale={locale} />;
  const w = WORDS[locale];
  const profile = agentPublicProfile(gate.agent);
  const origin = productPublicOrigin();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#0b2a4a] dark:text-white sm:text-3xl">{w.title}</h1>
      <p className="mt-2 text-sm text-[#56657a] dark:text-gray-400">{w.intro}</p>

      <section className="mt-6" aria-label={w.preview}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.06em] text-[#56657a] dark:text-gray-400">{w.preview}</p>
        {/* A picture of the header, not a working one: its links do nothing here. */}
        <div className="pointer-events-none select-none overflow-hidden rounded-xl border border-[#e6e9ef] dark:border-gray-800" inert>
          <TenantHeader agent={profile} locale={locale} otherLanguageHref="#" />
        </div>
        {origin && (
          <p className="mt-2 text-xs text-[#56657a] dark:text-gray-400">
            {w.address}: <span className="font-mono">{`${origin}${agentPagePath(locale, gate.agent.slug)}`}</span>
          </p>
        )}
      </section>

      <div className="mt-6">
        <AgentProfileForm locale={locale} initial={agentProfileForm(gate.agent)} states={US_STATE_OPTIONS} />
      </div>
    </div>
  );
}
