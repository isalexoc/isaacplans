import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { listIllustrationSummaries } from "@/lib/illustration-studio/store";
import IllustrationUploader from "@/components/admin/illustration-studio/illustration-uploader";
import SummaryList from "@/components/admin/illustration-studio/summary-list";

export const metadata: Metadata = {
  title: "Illustration Studio | Isaac Plans",
  description: "Turn any carrier's IUL illustration into a National Life–style two-page summary.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function IllustrationStudioPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const summaries = await listIllustrationSummaries(userId);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Illustration Studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop in any carrier&apos;s IUL illustration and get back the two pages that sell National
          Life&apos;s: a photo cover and &ldquo;My Planned Life Insurance Offers&rdquo;, in that
          carrier&apos;s logo and colors. Every number is checked against the illustration, and
          you can change anything before you present it.
        </p>
      </div>
      <div className="space-y-6">
        <IllustrationUploader />
        <SummaryList summaries={summaries} />
      </div>
    </div>
  );
}
