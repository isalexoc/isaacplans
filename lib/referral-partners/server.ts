import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  referralPartnerClients,
  referralPartnerLeads,
  referralPartners,
} from "@/lib/db/schema";
import {
  DEFAULT_COMMISSION_BPS,
  summarize,
  type ReferralAudienceKind,
  type ReferralClientRecord,
  type ReferralClientStatus,
  type ReferralLeadRecord,
  type ReferralLeadStatus,
  type ReferralPartnerRecord,
  type ReferralPartnerStatus,
  type ReferralPartnerSummary,
} from "./types";

type PartnerRow = typeof referralPartners.$inferSelect;
type LeadRow = typeof referralPartnerLeads.$inferSelect;
type ClientRow = typeof referralPartnerClients.$inferSelect;

function normalizeLocale(value: string | null | undefined): "en" | "es" {
  return value === "es" ? "es" : "en";
}

export function rowToPartner(row: PartnerRow): ReferralPartnerRecord {
  return {
    id: row.id,
    slug: row.slug,
    companyName: row.companyName,
    contactName: row.contactName ?? "",
    contactTitle: row.contactTitle ?? "",
    email: row.email,
    phone: row.phone ?? "",
    website: row.website ?? "",
    logoUrl: row.logoUrl ?? "",
    heroImageUrl: row.heroImageUrl ?? "",
    sectionImageUrl: row.sectionImageUrl ?? "",
    ogImageUrl: row.ogImageUrl ?? "",
    accentColor: row.accentColor || "#0077B6",
    commissionBps: row.commissionBps ?? DEFAULT_COMMISSION_BPS,
    defaultLocale: normalizeLocale(row.defaultLocale),
    headlineEn: row.headlineEn ?? "",
    headlineEs: row.headlineEs ?? "",
    introEn: row.introEn ?? "",
    introEs: row.introEs ?? "",
    audienceEn: row.audienceEn ?? "",
    audienceEs: row.audienceEs ?? "",
    audienceKind: (row.audienceKind === "immigration"
      ? "immigration"
      : "general") as ReferralAudienceKind,
    status: (row.status === "paused" ? "paused" : "active") as ReferralPartnerStatus,
    notes: row.notes ?? "",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export function rowToLead(row: LeadRow): ReferralLeadRecord {
  return {
    id: row.id,
    partnerId: row.partnerId,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    locale: normalizeLocale(row.locale),
    status: row.status as ReferralLeadStatus,
    crmContactId: row.crmContactId ?? null,
    notes: row.notes ?? "",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export function rowToClient(row: ClientRow): ReferralClientRecord {
  return {
    id: row.id,
    partnerId: row.partnerId,
    leadId: row.leadId ?? null,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    memberCount: row.memberCount ?? 1,
    monthlyPremiumCents: row.monthlyPremiumCents ?? 0,
    commissionBps: row.commissionBps ?? DEFAULT_COMMISSION_BPS,
    status: row.status as ReferralClientStatus,
    effectiveDate: row.effectiveDate ?? null,
    notes: row.notes ?? "",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

// ─── Partners ────────────────────────────────────────────────────────────────

export async function listPartners(): Promise<ReferralPartnerRecord[]> {
  const rows = await db.select().from(referralPartners).orderBy(asc(referralPartners.companyName));
  return rows.map(rowToPartner);
}

export async function getPartnerById(id: string): Promise<ReferralPartnerRecord | null> {
  const rows = await db.select().from(referralPartners).where(eq(referralPartners.id, id)).limit(1);
  return rows[0] ? rowToPartner(rows[0]) : null;
}

export async function getPartnerBySlug(slug: string): Promise<ReferralPartnerRecord | null> {
  const rows = await db
    .select()
    .from(referralPartners)
    .where(eq(referralPartners.slug, slug.toLowerCase()))
    .limit(1);
  return rows[0] ? rowToPartner(rows[0]) : null;
}

/**
 * Resolve the partner who owns a dashboard from the email on the Clerk account.
 * Case-insensitive on purpose: Clerk preserves the casing the user typed at sign-up, and nobody
 * should lose access to their own dashboard over a capital letter.
 */
export async function getPartnerByEmail(email: string): Promise<ReferralPartnerRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(referralPartners)
    .where(sql`lower(${referralPartners.email}) = ${normalized}`)
    .limit(1);
  return rows[0] ? rowToPartner(rows[0]) : null;
}

export type PartnerInput = {
  slug: string;
  companyName: string;
  contactName?: string;
  contactTitle?: string;
  email: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  sectionImageUrl?: string;
  ogImageUrl?: string;
  accentColor?: string;
  commissionBps?: number;
  defaultLocale?: "en" | "es";
  headlineEn?: string;
  headlineEs?: string;
  introEn?: string;
  introEs?: string;
  audienceEn?: string;
  audienceEs?: string;
  audienceKind?: ReferralAudienceKind;
  status?: ReferralPartnerStatus;
  notes?: string;
};

export async function createPartner(input: PartnerInput): Promise<ReferralPartnerRecord> {
  const [row] = await db
    .insert(referralPartners)
    .values({
      id: nanoid(),
      slug: input.slug.toLowerCase(),
      companyName: input.companyName,
      contactName: input.contactName ?? "",
      contactTitle: input.contactTitle ?? "",
      email: input.email.trim().toLowerCase(),
      phone: input.phone || null,
      website: input.website || null,
      logoUrl: input.logoUrl || null,
      heroImageUrl: input.heroImageUrl || null,
      sectionImageUrl: input.sectionImageUrl || null,
      ogImageUrl: input.ogImageUrl || null,
      accentColor: input.accentColor || "#0077B6",
      commissionBps: input.commissionBps ?? DEFAULT_COMMISSION_BPS,
      defaultLocale: input.defaultLocale ?? "es",
      headlineEn: input.headlineEn || null,
      headlineEs: input.headlineEs || null,
      introEn: input.introEn || null,
      introEs: input.introEs || null,
      audienceEn: input.audienceEn || null,
      audienceEs: input.audienceEs || null,
      audienceKind: input.audienceKind ?? "general",
      status: input.status ?? "active",
      notes: input.notes || null,
    })
    .returning();
  return rowToPartner(row);
}

export async function updatePartner(
  id: string,
  updates: Partial<PartnerInput>
): Promise<ReferralPartnerRecord | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.slug !== undefined) values.slug = updates.slug.toLowerCase();
  if (updates.companyName !== undefined) values.companyName = updates.companyName;
  if (updates.contactName !== undefined) values.contactName = updates.contactName;
  if (updates.contactTitle !== undefined) values.contactTitle = updates.contactTitle;
  if (updates.email !== undefined) values.email = updates.email.trim().toLowerCase();
  if (updates.phone !== undefined) values.phone = updates.phone || null;
  if (updates.website !== undefined) values.website = updates.website || null;
  if (updates.logoUrl !== undefined) values.logoUrl = updates.logoUrl || null;
  if (updates.heroImageUrl !== undefined) values.heroImageUrl = updates.heroImageUrl || null;
  if (updates.sectionImageUrl !== undefined) {
    values.sectionImageUrl = updates.sectionImageUrl || null;
  }
  if (updates.ogImageUrl !== undefined) values.ogImageUrl = updates.ogImageUrl || null;
  if (updates.accentColor !== undefined) values.accentColor = updates.accentColor || "#0077B6";
  if (updates.commissionBps !== undefined) values.commissionBps = updates.commissionBps;
  if (updates.defaultLocale !== undefined) values.defaultLocale = updates.defaultLocale;
  if (updates.headlineEn !== undefined) values.headlineEn = updates.headlineEn || null;
  if (updates.headlineEs !== undefined) values.headlineEs = updates.headlineEs || null;
  if (updates.introEn !== undefined) values.introEn = updates.introEn || null;
  if (updates.introEs !== undefined) values.introEs = updates.introEs || null;
  if (updates.audienceEn !== undefined) values.audienceEn = updates.audienceEn || null;
  if (updates.audienceEs !== undefined) values.audienceEs = updates.audienceEs || null;
  if (updates.audienceKind !== undefined) values.audienceKind = updates.audienceKind;
  if (updates.status !== undefined) values.status = updates.status;
  if (updates.notes !== undefined) values.notes = updates.notes || null;

  const [row] = await db
    .update(referralPartners)
    .set(values)
    .where(eq(referralPartners.id, id))
    .returning();
  return row ? rowToPartner(row) : null;
}

export async function deletePartner(id: string): Promise<void> {
  // Leads and clients cascade — see the FK definitions in lib/db/schema.ts.
  await db.delete(referralPartners).where(eq(referralPartners.id, id));
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function listLeadsForPartner(partnerId: string): Promise<ReferralLeadRecord[]> {
  const rows = await db
    .select()
    .from(referralPartnerLeads)
    .where(eq(referralPartnerLeads.partnerId, partnerId))
    .orderBy(desc(referralPartnerLeads.createdAt))
    .limit(1000);
  return rows.map(rowToLead);
}

export async function createLead(input: {
  partnerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  locale?: "en" | "es";
  crmContactId?: string | null;
}): Promise<ReferralLeadRecord> {
  const [row] = await db
    .insert(referralPartnerLeads)
    .values({
      id: nanoid(),
      partnerId: input.partnerId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      locale: input.locale ?? "es",
      crmContactId: input.crmContactId || null,
    })
    .returning();
  return rowToLead(row);
}

export async function updateLead(
  id: string,
  partnerId: string,
  updates: { status?: ReferralLeadStatus; notes?: string; crmContactId?: string | null }
): Promise<ReferralLeadRecord | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.status !== undefined) values.status = updates.status;
  if (updates.notes !== undefined) values.notes = updates.notes || null;
  if (updates.crmContactId !== undefined) values.crmContactId = updates.crmContactId || null;

  const [row] = await db
    .update(referralPartnerLeads)
    .set(values)
    // partnerId is in the predicate so an id from one partner can never touch another's row.
    .where(and(eq(referralPartnerLeads.id, id), eq(referralPartnerLeads.partnerId, partnerId)))
    .returning();
  return row ? rowToLead(row) : null;
}

export async function deleteLead(id: string, partnerId: string): Promise<void> {
  await db
    .delete(referralPartnerLeads)
    .where(and(eq(referralPartnerLeads.id, id), eq(referralPartnerLeads.partnerId, partnerId)));
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function listClientsForPartner(partnerId: string): Promise<ReferralClientRecord[]> {
  const rows = await db
    .select()
    .from(referralPartnerClients)
    .where(eq(referralPartnerClients.partnerId, partnerId))
    .orderBy(desc(referralPartnerClients.createdAt))
    .limit(1000);
  return rows.map(rowToClient);
}

export async function createClient(input: {
  partnerId: string;
  firstName: string;
  lastName: string;
  memberCount: number;
  monthlyPremiumCents: number;
  /** Snapshot the partner's rate at insert time — see the schema comment on commissionBps. */
  commissionBps: number;
  status?: ReferralClientStatus;
  effectiveDate?: string | null;
  leadId?: string | null;
  notes?: string;
}): Promise<ReferralClientRecord> {
  const [row] = await db
    .insert(referralPartnerClients)
    .values({
      id: nanoid(),
      partnerId: input.partnerId,
      leadId: input.leadId || null,
      firstName: input.firstName,
      lastName: input.lastName,
      memberCount: input.memberCount,
      monthlyPremiumCents: input.monthlyPremiumCents,
      commissionBps: input.commissionBps,
      status: input.status ?? "active",
      effectiveDate: input.effectiveDate || null,
      notes: input.notes || null,
    })
    .returning();
  return rowToClient(row);
}

export async function updateClient(
  id: string,
  partnerId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    memberCount?: number;
    monthlyPremiumCents?: number;
    commissionBps?: number;
    status?: ReferralClientStatus;
    effectiveDate?: string | null;
    notes?: string;
  }
): Promise<ReferralClientRecord | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.firstName !== undefined) values.firstName = updates.firstName;
  if (updates.lastName !== undefined) values.lastName = updates.lastName;
  if (updates.memberCount !== undefined) values.memberCount = updates.memberCount;
  if (updates.monthlyPremiumCents !== undefined) {
    values.monthlyPremiumCents = updates.monthlyPremiumCents;
  }
  if (updates.commissionBps !== undefined) values.commissionBps = updates.commissionBps;
  if (updates.status !== undefined) values.status = updates.status;
  if (updates.effectiveDate !== undefined) values.effectiveDate = updates.effectiveDate || null;
  if (updates.notes !== undefined) values.notes = updates.notes || null;

  const [row] = await db
    .update(referralPartnerClients)
    .set(values)
    .where(and(eq(referralPartnerClients.id, id), eq(referralPartnerClients.partnerId, partnerId)))
    .returning();
  return row ? rowToClient(row) : null;
}

export async function deleteClient(id: string, partnerId: string): Promise<void> {
  await db
    .delete(referralPartnerClients)
    .where(and(eq(referralPartnerClients.id, id), eq(referralPartnerClients.partnerId, partnerId)));
}

// ─── Combined reads ──────────────────────────────────────────────────────────

export type PartnerDashboardData = {
  partner: ReferralPartnerRecord;
  leads: ReferralLeadRecord[];
  clients: ReferralClientRecord[];
  summary: ReferralPartnerSummary;
};

export async function getPartnerDashboard(partnerId: string): Promise<PartnerDashboardData | null> {
  const partner = await getPartnerById(partnerId);
  if (!partner) return null;
  const [leads, clients] = await Promise.all([
    listLeadsForPartner(partnerId),
    listClientsForPartner(partnerId),
  ]);
  return { partner, leads, clients, summary: summarize(leads, clients) };
}

/** Partner list for the admin index, each with its headline numbers already totalled. */
export async function listPartnersWithSummaries(): Promise<
  { partner: ReferralPartnerRecord; summary: ReferralPartnerSummary }[]
> {
  const partners = await listPartners();
  if (partners.length === 0) return [];
  return Promise.all(
    partners.map(async (partner) => {
      const [leads, clients] = await Promise.all([
        listLeadsForPartner(partner.id),
        listClientsForPartner(partner.id),
      ]);
      return { partner, summary: summarize(leads, clients) };
    })
  );
}
