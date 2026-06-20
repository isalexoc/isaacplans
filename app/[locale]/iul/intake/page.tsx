import type { Metadata } from "next";
import IntakeDashboard from "@/components/iul-intake/intake-dashboard";

export const metadata: Metadata = {
  title: "IUL Client Intake",
  robots: { index: false, follow: false },
};

export default function IulIntakeDashboardPage() {
  return <IntakeDashboard />;
}
