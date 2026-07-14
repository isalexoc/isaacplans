import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import LeadBackupClient from "@/components/admin/lead-backup-client";

export const metadata: Metadata = {
  title: "Lead Backup | Isaac Plans",
  description: "Manually process a Senior Life lead from a screenshot.",
  robots: { index: false, follow: false },
};

export default async function LeadBackupPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  return <LeadBackupClient />;
}
