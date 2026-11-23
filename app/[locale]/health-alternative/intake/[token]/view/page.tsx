/*
 * app/[locale]/health-alternative/intake/[token]/view/page.tsx — agent read-only summary: the
 * intake's owner only (an admin, or an agent on Health Coverage).
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import IntakeClientView from "@/components/intake/client-view";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { getIntakeOperator, operatorOwns } from "@/lib/tenancy/context";

export const metadata: Metadata = {
  title: "Client Summary",
  robots: { index: false, follow: false },
};

export default async function HealthAlternativeIntakeViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const gate = await getIntakeOperator("health-alternative");
  if (!gate.ok) {
    if (gate.status === 401) {
      redirect(`/${locale}/sign-in?redirect_url=/${locale}/health-alternative/intake`);
    }
    redirect(`/${locale}/unauthorized`);
  }
  const row = await getIntakeByToken(requireIntakeConfig("health-alternative"), token);
  // "No such intake" and "not yours" look the same; not yours is audited.
  if (!row || !(await operatorOwns(gate.operator, row))) notFound();
  return <IntakeClientView lob="health-alternative" token={token} />;
}
