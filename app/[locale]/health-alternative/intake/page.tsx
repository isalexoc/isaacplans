/*
 * app/[locale]/health-alternative/intake/page.tsx — agent dashboard for Health Coverage intakes:
 * operators only (an admin, or an agent on this line). The list is always the caller's own.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import IntakeDashboard from "@/components/intake/intake-dashboard";
import { getIntakeOperator } from "@/lib/tenancy/context";
import { publicOriginForOwner } from "@/lib/tenancy/urls";

export const metadata: Metadata = {
  title: "Health Coverage Client Intake",
  robots: { index: false, follow: false },
};

export default async function HealthAlternativeIntakeDashboardPage() {
  const locale = await getLocale();
  const gate = await getIntakeOperator("health-alternative");
  if (!gate.ok) {
    if (gate.status === 401) {
      redirect(`/${locale}/sign-in?redirect_url=/${locale}/health-alternative/intake`);
    }
    redirect(`/${locale}/unauthorized`);
  }
  // An agent's client links point at the product domain; Isaac's dashboard keeps using the address
  // he is on, as always.
  const shareOrigin =
    gate.operator.kind === "agent" ? await publicOriginForOwner(gate.operator.userId) : undefined;
  return <IntakeDashboard lob="health-alternative" shareOrigin={shareOrigin} />;
}
