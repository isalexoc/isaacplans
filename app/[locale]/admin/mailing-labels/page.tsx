import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MailingLabelsClient } from "@/components/admin/mailing-labels/mailing-labels-client";
import { getIsAdmin } from "@/lib/auth/admin";
import { resolveMailingLabelAgent } from "@/lib/mailing-labels/agent";
import type { LabelAgentContact } from "@/lib/mailing-labels/types";

export const metadata: Metadata = {
  title: "Mailing Labels | Isaac Plans",
  description: "Print branded name-and-address labels for folders mailed to prospects.",
  robots: { index: false, follow: false },
};

export default async function MailingLabelsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  // Resolved on the server so the on-screen preview shows the same name the PDF will print.
  let agent: LabelAgentContact | null = null;
  try {
    agent = await resolveMailingLabelAgent(userId);
  } catch (error) {
    console.warn("[mailing-labels] Could not resolve the agent identity:", error);
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Mailing Labels</h1>
        <p className="mt-1 text-muted-foreground">
          Print name-and-address labels for the folders and envelopes you mail to final expense
          prospects — plus a USPS Priority Mail FROM/TO label when you ship a package.
        </p>
      </div>
      <MailingLabelsClient agent={agent} />
    </div>
  );
}
