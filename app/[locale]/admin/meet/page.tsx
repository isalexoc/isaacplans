import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import MeetingLauncher from "@/components/admin/meeting-launcher";

export const metadata: Metadata = {
  title: "Start a Meeting | Isaac Plans",
  description: "Start a CrankWheel screen share with any CRM contact.",
  robots: { index: false, follow: false },
};

/**
 * Start a screen share with any CRM contact, without going near the CRM's own pages.
 *
 * CrankWheel's in-page button does not render on LeadConnector custom domains, so this is where
 * that button lives now.
 */
export default async function AdminMeetPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
          Start a meeting
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find a contact, create a link, and share your screen. Start sharing from the CrankWheel
          browser extension once they have the link.
        </p>
      </div>
      <MeetingLauncher />
    </div>
  );
}
