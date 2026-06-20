import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
import { getIsAdmin } from "@/lib/auth/admin";
import ClientView from "@/components/iul-intake/client-view";

export const metadata: Metadata = {
  title: "Client Summary",
  robots: { index: false, follow: false },
};

export default async function IulIntakeViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const { userId } = await auth();
  if (!userId) {
    redirect(`/${locale}/sign-in?redirect_url=/${locale}/iul/intake/${token}/view`);
  }
  if (!(await getIsAdmin())) {
    redirect(`/${locale}/unauthorized`);
  }
  return <ClientView token={token} />;
}
