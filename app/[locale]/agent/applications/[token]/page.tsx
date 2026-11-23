/*
 * app/[locale]/agent/applications/[token]/page.tsx — the agent's own view of one Health Coverage
 * application (the shared form in owner mode), inside the agent area's frame.
 *
 * The agent who owns it only: a signed-in agent operator (active, agreements accepted) who is the
 * application's owner. "No such application" and "not yours" look the same (404); not yours is
 * audited. Its links stay in the agent area: the deck opens /agent/applications/[token]/presentation
 * in a new tab (`lang=client` picks the client's language), the breadcrumb goes back to /agent.
 * No CrankWheel panel (pilot agents share their screen with any tool) and no CRM anywhere.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AgentAreaNotice from "@/components/agent/agent-area-notice";
import IntakeForm from "@/components/intake/intake-form";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { AGENT_AREA_LOB, agentOperatorPage } from "@/lib/tenancy/agent-area";
import { agentApplicationPath, agentAreaLocale, agentAreaPath } from "@/lib/tenancy/agent-area-routes";
import { operatorOwns } from "@/lib/tenancy/context";
import { productPublicOrigin } from "@/lib/tenancy/site-urls";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = agentAreaLocale((await params).locale);
  return {
    title: locale === "es" ? "Solicitud" : "Application",
    robots: { index: false, follow: false, nocache: true },
    // The token in this URL is the client's credential.
    referrer: "no-referrer",
  };
}

export default async function AgentApplicationPage({ params }: { params: Params }) {
  const { locale: raw, token } = await params;
  const locale = agentAreaLocale(raw);
  const gate = await agentOperatorPage(locale);
  if (gate.kind === "notice") return <AgentAreaNotice kind={gate.notice} locale={locale} />;

  const row = /^[A-Za-z0-9_-]{8,128}$/.test(token)
    ? await getIntakeByToken(requireIntakeConfig(AGENT_AREA_LOB), token)
    : null;
  if (!row || !(await operatorOwns(gate.operator, row))) notFound();

  return (
    <div className="min-h-full flex-1 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <IntakeForm
        lob={AGENT_AREA_LOB}
        token={token}
        agentArea
        dashboardHref={agentAreaPath(locale)}
        deckHref={`${agentApplicationPath(locale, token, "presentation")}?lang=client`}
        // A secure link opens on the product domain; without one configured it would be a 404.
        clientLinks={productPublicOrigin() !== null}
      />
    </div>
  );
}
