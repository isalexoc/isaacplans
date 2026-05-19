import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leaveBehindClients } from "@/lib/db/schema";
import type {
  CompareQuoteData,
  LeaveBehindQuoteData,
  LeaveBehindQuoteType,
  PackageQuoteData,
  SingleQuoteData,
} from "@/lib/leave-behind-clients";
import { migrateLeaveBehindPlanType } from "@/lib/leave-behind-clients";
import { COMPARISON_TIER_ORDER, TIER_ORDER } from "@/lib/final-expense-leave-behind-tiers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function syncCoverageDigits(natural: string, accidental: string): string {
  const n = natural.replace(/\D/g, "");
  const a = accidental.replace(/\D/g, "");
  return n || a;
}

function isPhase(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2;
}

function parseTierInputs(raw: unknown): CompareQuoteData["tierInputs"] | null {
  if (!isRecord(raw)) return null;
  const tierInputs = {} as CompareQuoteData["tierInputs"];
  for (const tier of COMPARISON_TIER_ORDER) {
    const block = raw[tier];
    if (!isRecord(block)) return null;
    const natural = typeof block.natural === "string" ? block.natural : "";
    const accidental = typeof block.accidental === "string" ? block.accidental : "";
    const coverage = syncCoverageDigits(natural, accidental);
    tierInputs[tier] = {
      natural: coverage,
      accidental: coverage,
      premium: typeof block.premium === "string" ? block.premium : "",
    };
  }
  return tierInputs;
}

function parsePackageFields(raw: Record<string, unknown>): PackageQuoteData | null {
  const phase = raw.phase ?? 1;
  if (!isPhase(phase)) return null;

  const tierInputs = parseTierInputs(raw.tierInputs);
  if (!tierInputs) return null;

  const highlightTier = raw.highlightTier;
  if (
    typeof highlightTier !== "string" ||
    !COMPARISON_TIER_ORDER.includes(highlightTier as (typeof COMPARISON_TIER_ORDER)[number])
  ) {
    return null;
  }

  return {
    prospectName: typeof raw.prospectName === "string" ? raw.prospectName : "",
    tierInputs,
    highlightTier: highlightTier as PackageQuoteData["highlightTier"],
    planType: migrateLeaveBehindPlanType(raw.planType),
    avoidNames: typeof raw.avoidNames === "string" ? raw.avoidNames : "",
    protectNames: typeof raw.protectNames === "string" ? raw.protectNames : "",
    phase,
  };
}

export function parseQuoteType(value: unknown): LeaveBehindQuoteType | null {
  return value === "package" || value === "single" || value === "compare" ? value : null;
}

export function validateQuoteData(
  quoteType: LeaveBehindQuoteType,
  raw: unknown
): LeaveBehindQuoteData | null {
  if (!isRecord(raw)) return null;

  if (quoteType === "package") {
    return parsePackageFields(raw);
  }

  const phase = raw.phase ?? 1;
  if (!isPhase(phase)) return null;

  const base = {
    prospectName: typeof raw.prospectName === "string" ? raw.prospectName : "",
    planType: migrateLeaveBehindPlanType(raw.planType),
    avoidNames: typeof raw.avoidNames === "string" ? raw.avoidNames : "",
    protectNames: typeof raw.protectNames === "string" ? raw.protectNames : "",
    phase,
  };

  if (quoteType === "single") {
    const tier = raw.presentationTier;
    if (typeof tier !== "string" || !TIER_ORDER.includes(tier as (typeof TIER_ORDER)[number])) {
      return null;
    }
    const natural = typeof raw.naturalDeath === "string" ? raw.naturalDeath : "";
    const accidental = typeof raw.accidentalDeath === "string" ? raw.accidentalDeath : "";
    const coverage = syncCoverageDigits(natural, accidental);
    const data: SingleQuoteData = {
      ...base,
      naturalDeath: coverage,
      accidentalDeath: coverage,
      monthlyPremium: typeof raw.monthlyPremium === "string" ? raw.monthlyPremium : "",
      presentationTier: tier as SingleQuoteData["presentationTier"],
    };
    return data;
  }

  const pkg = parsePackageFields(raw);
  return pkg;
}

/** New saves should use package; legacy types still validate for PATCH migration. */
export function validatePackageForSave(raw: unknown): PackageQuoteData | null {
  if (!isRecord(raw)) return null;
  const pkg = parsePackageFields(raw);
  if (!pkg?.prospectName.trim()) return null;
  return pkg;
}

export function prospectNameFromQuoteData(data: LeaveBehindQuoteData): string | null {
  const name = data.prospectName?.trim();
  return name || null;
}

export async function listLeaveBehindClientsForUser(userId: string) {
  return db
    .select({
      id: leaveBehindClients.id,
      quoteType: leaveBehindClients.quoteType,
      prospectName: leaveBehindClients.prospectName,
      quoteData: leaveBehindClients.quoteData,
      createdAt: leaveBehindClients.createdAt,
      updatedAt: leaveBehindClients.updatedAt,
    })
    .from(leaveBehindClients)
    .where(eq(leaveBehindClients.userId, userId))
    .orderBy(desc(leaveBehindClients.updatedAt));
}

export async function getLeaveBehindClientForUser(userId: string, id: string) {
  const rows = await db
    .select()
    .from(leaveBehindClients)
    .where(and(eq(leaveBehindClients.id, id), eq(leaveBehindClients.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteLeaveBehindClientForUser(userId: string, id: string) {
  const rows = await db
    .delete(leaveBehindClients)
    .where(and(eq(leaveBehindClients.id, id), eq(leaveBehindClients.userId, userId)))
    .returning({ id: leaveBehindClients.id });
  return rows[0] ?? null;
}
