import type { Metadata } from "next";
import FeIntakeForm from "@/components/fe-intake/intake-form";

// Token-gated, link-only page. `noindex` keeps it out of search, and `no-referrer` keeps the
// token out of the Referer header on any outbound request (Google Maps, analytics, a tapped
// link) — with no sign-in, that token is the credential, so it must not leak.
export const metadata: Metadata = {
  title: "Your Secure Final Expense Application | Isaac Plans Insurance",
  description:
    "Complete your final expense application securely from your phone in just a few minutes — encrypted, private, and reviewed personally by your agent.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
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
