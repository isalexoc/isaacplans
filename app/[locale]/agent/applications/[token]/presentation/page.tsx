/*
 * app/[locale]/agent/applications/[token]/presentation/page.tsx — the Impact deck for one of the
 * agent's clients, with the agent's own name, photo, WhatsApp, IBO number and licenses (ACN P&P
 * §I.6: each IBO shows only their own Business ID). The same deck as Isaac's, opened from the
 * agent's form in a new tab, which the agent shares with any screen-sharing tool; the frame shows
 * no nav here (`x-shell: agent-present`), since the client is watching.
 *
 * The owner only (an agent operator who owns the application), like the form. `?lang=client`
 * opens it in the application's language (agents have no CRM to ask). The L key and the frame's
 * language link go to this same deck in the other language, inside the agent area.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AgentAreaNotice from "@/components/agent/agent-area-notice";
import ImpactPresentation from "@/components/impact-presentation/impact-presentation";
import { buildImpactSlides } from "@/components/impact-presentation/slides";
import type { DeckLocale } from "@/components/impact-presentation/copy";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { deckCoverageStart, deckFirstName, deckInitialQuote } from "@/lib/impact-quote/deck-data";
import { AGENT_AREA_LOB, agentOperatorPage } from "@/lib/tenancy/agent-area";
import { agentApplicationPath, agentAreaLocale } from "@/lib/tenancy/agent-area-routes";
import { operatorOwns } from "@/lib/tenancy/context";
import { agentPublicProfile } from "@/lib/tenancy/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Impact Health Sharing",
  robots: { index: false, follow: false, nocache: true },
  // The token in this URL is the client's credential.
  referrer: "no-referrer",
};

type Params = Promise<{ locale: string; token: string }>;
type SearchParams = Promise<{ lang?: string | string[] }>;

export default async function AgentPresentationPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale: raw, token } = await params;
  const { lang } = await searchParams;
  const locale: DeckLocale = agentAreaLocale(raw);
  const gate = await agentOperatorPage(locale);
  if (gate.kind === "notice") return <AgentAreaNotice kind={gate.notice} locale={locale} />;

  const row = /^[A-Za-z0-9_-]{8,128}$/.test(token)
    ? await getIntakeByToken(requireIntakeConfig(AGENT_AREA_LOB), token)
    : null;
  if (!row || !(await operatorOwns(gate.operator, row))) notFound();

  // The form's button asks for the client's language: the application's own (no CRM tag here).
  if (lang === "client") {
    const wanted: DeckLocale = row.locale === "es" ? "es" : "en";
    if (wanted !== locale) redirect(agentApplicationPath(wanted, token, "presentation"));
  }

  const slides = buildImpactSlides({
    locale,
    firstName: deckFirstName(row),
    startDate: deckCoverageStart(row, locale),
    agent: agentPublicProfile(gate.agent),
    token,
    ...(await deckInitialQuote(row)),
  });

  return (
    <ImpactPresentation
      token={token}
      locale={locale}
      slides={slides}
      otherLocaleHref={agentApplicationPath(locale === "es" ? "en" : "es", token, "presentation")}
      agentArea
    />
  );
}
