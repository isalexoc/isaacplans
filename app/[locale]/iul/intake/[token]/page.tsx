import type { Metadata } from "next";
import IntakeForm from "@/components/iul-intake/intake-form";

export const metadata: Metadata = {
  title: "IUL Application Intake",
  robots: { index: false, follow: false },
};

export default async function IulIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <IntakeForm token={token} />
    </main>
  );
}
