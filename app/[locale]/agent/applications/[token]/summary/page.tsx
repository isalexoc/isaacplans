/*
 * app/[locale]/agent/applications/[token]/summary/page.tsx — the read-only summary of one of the
 * agent's applications, inside the agent area's frame. The owner only, like the form; its links
 * (Edit, the breadcrumb) stay in the agent area.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AgentAreaNotice from "@/components/agent/agent-area-notice";
import IntakeClientView from "@/components/intake/client-view";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { AGENT_AREA_LOB, agentOperatorPage } from "@/lib/tenancy/agent-area";
import { agentApplicationPath, agentAreaLocale, agentAreaPath } from "@/lib/tenancy/agent-area-routes";
import { operatorOwns } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = agentAreaLocale((await params).locale);
  return {
    title: locale === "es" ? "Resumen" : "Summary",
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

export default async function AgentApplicationSummaryPage({ params }: { params: Params }) {
  const { locale: raw, token } = await params;
  const locale = agentAreaLocale(raw);
  const gate = await agentOperatorPage(locale);
  if (gate.kind === "notice") return <AgentAreaNotice kind={gate.notice} locale={locale} />;

  const row = /^[A-Za-z0-9_-]{8,128}$/.test(token)
    ? await getIntakeByToken(requireIntakeConfig(AGENT_AREA_LOB), token)
    : null;
  if (!row || !(await operatorOwns(gate.operator, row))) notFound();

  return (
    <IntakeClientView
      lob={AGENT_AREA_LOB}
      token={token}
      agentArea
      dashboardHref={agentAreaPath(locale)}
      formHref={agentApplicationPath(locale, token)}
    />
  );
}
