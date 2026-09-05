import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { sanityFetch } from "@/sanity/lib/live";
import { OBJECTIONS_QUERY } from "@/lib/sanity/queries/objections";
import type { Objection } from "@/lib/objections/types";
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

  // The objection library, fetched once here rather than per call. It is what lets a detected
  // objection in the transcript open the rebuttal already written for it on /presentations —
  // the same documents, so an answer improved there improves here with no second copy.
  const objections = await sanityFetch({
    query: OBJECTIONS_QUERY,
    tags: ["objections"],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Call Study</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a recorded call and get it back as a readable dialogue, with the speakers named,
          the call broken into the parts of the script, and every objection highlighted where it
          was raised. Lines worth reusing collect in the script library across every call you add.
        </p>
      </div>
      <CallStudyClient libraryObjections={(objections.data ?? []) as Objection[]} />
    </div>
  );
}
