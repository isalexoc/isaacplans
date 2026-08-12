/* app/[locale]/health-alternative/intake/page.tsx — agent dashboard for Health Coverage intakes (admin only). */

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getIsAdmin } from "@/lib/auth/admin";
import IntakeDashboard from "@/components/intake/intake-dashboard";

export const metadata: Metadata = {
  title: "Health Coverage Client Intake",
  robots: { index: false, follow: false },
};

export default async function HealthAlternativeIntakeDashboardPage() {
  const locale = await getLocale();
  const { userId } = await auth();
  if (!userId) redirect(`/${locale}/sign-in?redirect_url=/${locale}/health-alternative/intake`);
  if (!(await getIsAdmin())) redirect(`/${locale}/unauthorized`);
  return <IntakeDashboard lob="health-alternative" />;
}
