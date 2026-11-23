/*
 * app/[locale]/a/[slug]/page.tsx — an agent's own Impact guide, at product.com/{locale}/{slug}
 * (middleware rewrites the public address here; lib/tenancy/product-routes.ts).
 *
 * The product domain only (APP_SURFACE=product): on isaacplans.com every /{l}/a/… is a 404. Shown
 * only for an active agent the launch gates let through (lib/tenancy/pages.ts
 * `publicAgentForSlug`). The same guide as Isaac's /impact, with the agent's own name, photo,
 * WhatsApp, IBO number and licenses, inside the agent's shell. Nobody can skip the quote here (there
 * is no sign-in on this domain), the quote's pick is kept under this agent's own scope
 * (`guide:<slug>`), and "Apply now" starts an application this agent owns.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ImpactGuide from "@/components/impact-presentation/impact-guide";
import { buildGuideSteps } from "@/components/impact-presentation/guide-steps";
import { DECK_COPY, type DeckLocale } from "@/components/impact-presentation/copy";
import TenantShell from "@/components/tenant/tenant-shell";
import { IMPACT_LAST_PAYMENT_DAY } from "@/lib/intake-configs/impact-schedule";
import { businessToday, earliestMonthStart, formatLongDate } from "@/lib/intake-core/month-start";
import { guideScopeFor } from "@/lib/impact-quote/sync";
import { AGENT_PAGE_NOT_FOUND_METADATA, agentPageMetadata, publicAgentForSlug } from "@/lib/tenancy/pages";
import { agentPageAlternates, agentPagePath } from "@/lib/tenancy/product-routes";
import { agentContact, agentPublicProfile } from "@/lib/tenancy/profile";

// The agent's status and the launch gates are read on every request.
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; slug: string }>;

const localeOf = (value: string): DeckLocale => (value === "es" ? "es" : "en");

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const row = await publicAgentForSlug(slug);
  if (!row) return AGENT_PAGE_NOT_FOUND_METADATA;
  const locale = localeOf(raw);
  const agent = agentPublicProfile(row);
  const t = DECK_COPY[locale];
  return agentPageMetadata({
    title: `${t.welcome.title} · ${agent.displayName}`,
    description: t.welcome.lead,
    locale,
    path: agentPagePath(locale, row.slug),
  });
}

export default async function AgentGuidePage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const row = await publicAgentForSlug(slug);
  if (!row) notFound();
  const locale = localeOf(raw);
  const agent = agentPublicProfile(row);
  const applyHref = agentPagePath(locale, row.slug, "apply");
  const { steps, quoteStep } = buildGuideSteps({
    locale,
    // Nobody has picked a date yet, so the earliest 1st Impact allows today.
    startDate: formatLongDate(earliestMonthStart(businessToday(), IMPACT_LAST_PAYMENT_DAY), locale),
    agent,
    admin: false,
    applyHref,
    planScope: guideScopeFor(row.slug),
  });
  return (
    <TenantShell
      agent={agent}
      locale={locale}
      languageHrefs={agentPageAlternates(row.slug)}
      privacyHref={agentPagePath(locale, row.slug, "privacy")}
      reserveBottom
    >
      <ImpactGuide
        locale={locale}
        steps={steps}
        quoteStep={quoteStep}
        canSkipQuote={false}
        agent={agentContact(agent)}
        applyHref={applyHref}
        plainApplyLink
      />
    </TenantShell>
  );
}
