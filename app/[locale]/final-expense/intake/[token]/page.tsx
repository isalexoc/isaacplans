import type { Metadata } from "next";
import FeIntakeForm from "@/components/fe-intake/intake-form";

// Token-gated, link-only page: kept out of search (noindex).
export const metadata: Metadata = {
  title: "Your Secure Final Expense Application | Isaac Plans Insurance",
  description:
    "Complete your final expense application securely from your phone in just a few minutes — encrypted, private, and reviewed personally by your agent.",
  robots: { index: false, follow: false },
};

export default async function FeIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <FeIntakeForm token={token} />
    </main>
  );
}
