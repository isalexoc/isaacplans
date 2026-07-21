import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import OpenLoopDashboard from "@/components/call-dashboard/open-loop-dashboard";

export const metadata: Metadata = {
  title: "Callback Priority | Isaac Plans",
  description: "Contacts with an open follow-up loop, sorted by soonest promised callback.",
  robots: { index: false, follow: false },
};

export default async function CallDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  return <OpenLoopDashboard />;
}
