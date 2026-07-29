import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
import { getIsAdmin } from "@/lib/auth/admin";
import AcaIntakeDashboard from "@/components/aca-intake/intake-dashboard";

export const metadata: Metadata = {
  title: "ACA Client Intake",
  robots: { index: false, follow: false },
};

export default async function AcaIntakeDashboardPage() {
  const locale = await getLocale();
  const { userId } = await auth();
  if (!userId) {
    redirect(`/${locale}/sign-in?redirect_url=/${locale}/aca/intake`);
  }
  if (!(await getIsAdmin())) {
    redirect(`/${locale}/unauthorized`);
  }
  return <AcaIntakeDashboard />;
}
