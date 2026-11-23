/*
 * app/[locale]/health-alternative/intake/page.tsx — agent dashboard for Health Coverage intakes:
 * operators only (an admin, or an agent on this line). The list is always the caller's own.
 *
 * Isaac's dashboard. An agent is sent to their own area (/agent), which has its own frame and none
 * of his CRM tools.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import IntakeDashboard from "@/components/intake/intake-dashboard";
import { agentAreaLocale, agentAreaPath } from "@/lib/tenancy/agent-area-routes";
import { getAgentContext, getIntakeOperator } from "@/lib/tenancy/context";

export const metadata: Metadata = {
  title: "Health Coverage Client Intake",
  robots: { index: false, follow: false },
};

export default async function HealthAlternativeIntakeDashboardPage() {
  const locale = await getLocale();
  // Agents (active or not, agreements or not) work in the agent area, which explains their state.
  if ((await getAgentContext()).agent) redirect(agentAreaPath(agentAreaLocale(locale)));
  const gate = await getIntakeOperator("health-alternative");
  if (!gate.ok) {
    if (gate.status === 401) {
      redirect(`/${locale}/sign-in?redirect_url=/${locale}/health-alternative/intake`);
    }
    redirect(`/${locale}/unauthorized`);
  }
  return <IntakeDashboard lob="health-alternative" />;
}
