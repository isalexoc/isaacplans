import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getIsAdmin } from "@/lib/auth/admin";
import { getPartnerDashboard } from "@/lib/referral-partners/server";
import PartnerDetailClient from "@/components/admin/referral-partners/partner-detail-client";

export const metadata: Metadata = {
  title: "Referral Partner | Isaac Plans Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.isaacplans.com"
  );
}

export default async function ReferralPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getIsAdmin())) redirect("/admin");

  const { id } = await params;
  const data = await getPartnerDashboard(id);
  if (!data) notFound();

  const { partner, leads, clients } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <a
        href="/en/admin/referral-partners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All partners
      </a>

      <div className="mb-8 mt-4 flex flex-wrap items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-extrabold text-white"
          style={{ backgroundColor: partner.accentColor }}
        >
          {partner.companyName.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{partner.companyName}</h1>
          <p className="text-sm text-muted-foreground">
            {[partner.contactName, partner.contactTitle].filter(Boolean).join(" · ") ||
              "No contact set"}{" "}
            · signs in as {partner.email}
          </p>
        </div>
      </div>

      <PartnerDetailClient
        partner={partner}
        leads={leads}
        clients={clients}
        siteUrl={resolveSiteUrl()}
      />
    </div>
  );
}
