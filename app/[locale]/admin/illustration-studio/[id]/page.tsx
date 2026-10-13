import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { getIllustrationSummary } from "@/lib/illustration-studio/store";
import SummaryEditor from "@/components/admin/illustration-studio/summary-editor";

export const metadata: Metadata = {
  title: "Edit Summary | Illustration Studio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function IllustrationSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const { id } = await params;
  const summary = await getIllustrationSummary(id);
  if (!summary) notFound();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <SummaryEditor summary={summary} />
    </div>
  );
}
