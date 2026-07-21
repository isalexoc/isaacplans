import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import CallMetricsView from "@/components/call-dashboard/call-metrics-view";

export const metadata: Metadata = {
  title: "Call Metrics | Isaac Plans",
  description: "Contact rate, disposition mix, and line-of-business breakdown for a date range.",
  robots: { index: false, follow: false },
};

export default async function CallMetricsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  return <CallMetricsView />;
}
