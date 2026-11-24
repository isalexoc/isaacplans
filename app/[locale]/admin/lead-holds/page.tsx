import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import LeadHoldsClient, { type LeadHoldView, type LeadGuardStatRow } from "@/components/admin/lead-holds-client";
import { agentCrmContactUrl } from "@/lib/agent-crm-contacts";
import { getIsAdmin } from "@/lib/auth/admin";
import { REASON_LABELS, SURFACE_LABELS } from "@/lib/lead-guard/labels";
import { getLeadHoldDetail, leadGuardStatsSince, listLeadHolds, type LeadHoldRow } from "@/lib/lead-guard/store";
import type { LeadGuardReason } from "@/lib/lead-guard/assess";
import type { LeadGuardSurface } from "@/lib/lead-guard/constants";

export const metadata: Metadata = {
  title: "Leads retenidos | Isaac Plans",
  description: "Website leads Lead Guard kept out of the CRM until reviewed.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BLOB_KEYS = [
  "contactPageData",
  "agentCrmData",
  "acaData",
  "dentalVisionData",
  "finalExpenseData",
  "healthAlternativeData",
  "hospitalIndemnityData",
  "iulLeadGenData",
  "lifeInsuranceData",
  "shortTermMedicalData",
  "legalShieldData",
  "getCoveredFastData",
] as const;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Name / email / phone / consents from whichever body shape the held route received. */
function detailsFrom(body: Record<string, unknown>) {
  const blobKey = BLOB_KEYS.find((k) => body[k] && typeof body[k] === "object");
  const blob = (blobKey ? body[blobKey] : body) as Record<string, unknown>;
  return {
    firstName: str(body.firstName) ?? str(body.name),
    lastName: str(body.lastName),
    email: str(body.email),
    phone: str(body.phone),
    language: str(blob.language) ?? str(body.locale),
    source: str(blob.source) ?? str(body.slug),
    smsConsent: blob.smsConsent === true || blob.smsConsent === "on",
    marketingConsent: blob.marketingConsent === true || blob.marketingConsent === "on",
  };
}

async function toView(row: LeadHoldRow, locationId: string | null): Promise<LeadHoldView> {
  const reasons = (row.reasons ?? []) as LeadGuardReason[];
  const base: LeadHoldView = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    surface: SURFACE_LABELS[row.surface as LeadGuardSurface] ?? row.surface,
    reasons: reasons.map((r) => REASON_LABELS[r] ?? r),
    status: row.status,
    releaseError: row.releaseError,
    releasedAt: row.releasedAt?.toISOString() ?? null,
    crmUrl: row.releasedContactId && locationId ? agentCrmContactUrl(locationId, row.releasedContactId) : null,
    preview: row.preview ?? null,
    details: null,
    stepTwoCount: 0,
  };
  if (row.status !== "held") return base;
  const detail = await getLeadHoldDetail(row.id);
  if (!detail?.payload) return base;
  return { ...base, details: detailsFrom(detail.payload.body), stepTwoCount: detail.appends.length };
}

export default async function LeadHoldsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const locationId = process.env.AGENT_CRM_LOCATION_ID ?? null;
  let holds: LeadHoldView[] = [];
  let recent: LeadHoldView[] = [];
  let stats: LeadGuardStatRow[] = [];
  let loadError: string | null = null;
  try {
    const [held, all, day, week] = await Promise.all([
      listLeadHolds("held", 200),
      listLeadHolds("all", 60),
      leadGuardStatsSince(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      leadGuardStatsSince(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    ]);
    holds = await Promise.all(held.map((r) => toView(r, locationId)));
    recent = await Promise.all(all.filter((r) => r.status !== "held").slice(0, 30).map((r) => toView(r, locationId)));
    const surfaces = [...new Set([...day, ...week].map((r) => r.surface))];
    stats = surfaces.map((surface) => {
      const n = (rows: typeof day, verdict: string) =>
        rows.filter((r) => r.surface === surface && r.verdict === verdict).reduce((sum, r) => sum + r.n, 0);
      return {
        surface: SURFACE_LABELS[surface as LeadGuardSurface] ?? surface,
        allowedDay: n(day, "allow"),
        heldDay: n(day, "hold"),
        allowedWeek: n(week, "allow"),
        heldWeek: n(week, "hold"),
      };
    });
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return <LeadHoldsClient holds={holds} recent={recent} stats={stats} loadError={loadError} />;
}
