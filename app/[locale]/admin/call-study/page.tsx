import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import CallStudyClient from "@/components/admin/call-study/call-study-client";

export const metadata: Metadata = {
  title: "Call Study | Isaac Plans",
  description: "Transcribe recorded sales calls as readable dialogue and mine them for script material.",
  robots: { index: false, follow: false },
};

/**
 * Upload a recorded call, read it back as a conversation, and collect the lines worth reusing.
 */
export default async function CallStudyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Call Study</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a recorded call and get it back as a readable dialogue, with the speakers named.
          Analyse it to pull out objections, discovery questions and closing lines — they collect in
          the script library across every call you add.
        </p>
      </div>
      <CallStudyClient />
    </div>
  );
}
