/**
 * Shared types + money math for the referral partner program.
 *
 * Money is handled in integer cents and rates in integer basis points everywhere. Commission is
 * rounded once, at the last possible moment, with `Math.round` — so a partner statement always
 * sums to the same number no matter whether you total the rows or the premium first.
 */

export type ReferralPartnerStatus = "active" | "paused";
/**
 * Which extra landing-page sections a partner gets. `immigration` turns on the "when this
 * matters" and "what being uninsured costs" blocks, written for someone with a pending case.
 */
export type ReferralAudienceKind = "general" | "immigration";
export type ReferralLeadStatus = "new" | "contacted" | "closed" | "lost";
export type ReferralClientStatus = "active" | "pending" | "cancelled";

export const REFERRAL_LEAD_STATUSES: ReferralLeadStatus[] = [
  "new",
  "contacted",
  "closed",
  "lost",
];

export const REFERRAL_CLIENT_STATUSES: ReferralClientStatus[] = [
  "active",
  "pending",
  "cancelled",
];

/** 5% — the standard deal. Overridable per partner in the admin tool. */
export const DEFAULT_COMMISSION_BPS = 500;

export type ReferralPartnerRecord = {
  id: string;
  slug: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  accentColor: string;
  commissionBps: number;
  defaultLocale: "en" | "es";
  headlineEn: string;
  headlineEs: string;
  introEn: string;
  introEs: string;
  audienceEn: string;
  audienceEs: string;
  audienceKind: ReferralAudienceKind;
  status: ReferralPartnerStatus;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ReferralLeadRecord = {
  id: string;
  partnerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  locale: "en" | "es";
  status: ReferralLeadStatus;
  crmContactId: string | null;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ReferralClientRecord = {
  id: string;
  partnerId: string;
  leadId: string | null;
  firstName: string;
  lastName: string;
  memberCount: number;
  monthlyPremiumCents: number;
  commissionBps: number;
  status: ReferralClientStatus;
  effectiveDate: string | null;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Everything a dashboard needs in one shot, already totalled. */
export type ReferralPartnerSummary = {
  totalLeads: number;
  openLeads: number;
  closedLeads: number;
  lostLeads: number;
  /** closed / total, 0-100, rounded. 0 when there are no leads yet. */
  conversionRate: number;
  activeClients: number;
  totalMembers: number;
  /** Active clients only — pending and cancelled do not earn. */
  monthlyPremiumCents: number;
  monthlyCommissionCents: number;
  annualCommissionCents: number;
};

/** Commission for a single client, rounded to the cent. */
export function commissionCents(monthlyPremiumCents: number, bps: number): number {
  return Math.round((monthlyPremiumCents * bps) / 10_000);
}

/** Only `active` clients earn — pending isn't issued yet, cancelled stopped paying. */
export function isEarningClient(client: Pick<ReferralClientRecord, "status">): boolean {
  return client.status === "active";
}

export function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

export function formatCents(cents: number, locale: "en" | "es" = "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Parse a hand-typed premium ("485", "$485.50", "1,200") into cents.
 * Returns null for anything that isn't a non-negative number, so the caller can 400 instead of
 * silently storing a 0.
 */
export function parsePremiumToCents(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  const cleaned = String(input).replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function summarize(
  leads: ReferralLeadRecord[],
  clients: ReferralClientRecord[]
): ReferralPartnerSummary {
  const closedLeads = leads.filter((l) => l.status === "closed").length;
  const lostLeads = leads.filter((l) => l.status === "lost").length;
  const earning = clients.filter(isEarningClient);

  const monthlyPremiumCents = earning.reduce((sum, c) => sum + c.monthlyPremiumCents, 0);
  const monthlyCommissionCents = earning.reduce(
    (sum, c) => sum + commissionCents(c.monthlyPremiumCents, c.commissionBps),
    0
  );

  return {
    totalLeads: leads.length,
    openLeads: leads.length - closedLeads - lostLeads,
    closedLeads,
    lostLeads,
    conversionRate: leads.length ? Math.round((closedLeads / leads.length) * 100) : 0,
    activeClients: earning.length,
    totalMembers: earning.reduce((sum, c) => sum + c.memberCount, 0),
    monthlyPremiumCents,
    monthlyCommissionCents,
    annualCommissionCents: monthlyCommissionCents * 12,
  };
}

/** URL-safe slug from a company name. Used to prefill the admin form. */
export function slugifyPartnerName(name: string): string {
  return name
    .normalize("NFD") // decompose so the accent becomes its own combining char, then drop it
    .replace(/\p{Diacritic}/gu, "") // strip accents so "Latinos Si" stays clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * The CRM tag that identifies a partner's referrals. Lowercase + underscored so it reads the same
 * as the other funnel tags already in Agent CRM (`fe_get_covered_funnel`, `aca_get_covered_funnel`).
 */
export function partnerCrmTag(slug: string): string {
  return `referral_${slug.replace(/-/g, "_")}`;
}
