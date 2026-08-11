import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Handshake } from "lucide-react";
import { getIsAdmin } from "@/lib/auth/admin";
import { listPartnersWithSummaries } from "@/lib/referral-partners/server";
import PartnersListClient from "@/components/admin/referral-partners/partners-list-client";

export const metadata: Metadata = {
  title: "Referral Partners | Isaac Plans Admin",
  description: "Manage referral partners, their landing pages, and their commissions.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReferralPartnersAdminPage() {
  if (!(await getIsAdmin())) redirect("/admin");

  const rows = await listPartnersWithSummaries();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Handshake className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Referral Partners</h1>
          <p className="text-sm text-muted-foreground">
            Co-branded landing pages, referral tracking, and commission dashboards
          </p>
        </div>
      </div>

      <PartnersListClient initialRows={rows} />
    </div>
  );
}
