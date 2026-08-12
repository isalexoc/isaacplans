/* app/[locale]/hospital-indemnity/intake/[token]/view/page.tsx — agent read-only summary (admin only). */

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getIsAdmin } from "@/lib/auth/admin";
import IntakeClientView from "@/components/intake/client-view";

export const metadata: Metadata = {
  title: "Client Summary",
  robots: { index: false, follow: false },
};

export default async function HospitalIndemnityIntakeViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const { userId } = await auth();
  if (!userId) redirect(`/${locale}/sign-in?redirect_url=/${locale}/hospital-indemnity/intake`);
  if (!(await getIsAdmin())) redirect(`/${locale}/unauthorized`);
  return <IntakeClientView lob="hospital-indemnity" token={token} />;
}
