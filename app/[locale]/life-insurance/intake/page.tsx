/* app/[locale]/life-insurance/intake/page.tsx — agent dashboard for Life Insurance intakes (admin only). */

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getIsAdmin } from "@/lib/auth/admin";
import IntakeDashboard from "@/components/intake/intake-dashboard";

export const metadata: Metadata = {
  title: "Life Insurance Client Intake",
  robots: { index: false, follow: false },
};

export default async function LifeInsuranceIntakeDashboardPage() {
  const locale = await getLocale();
  const { userId } = await auth();
  if (!userId) redirect(`/${locale}/sign-in?redirect_url=/${locale}/life-insurance/intake`);
  if (!(await getIsAdmin())) redirect(`/${locale}/unauthorized`);
  return <IntakeDashboard lob="life-insurance" />;
}
