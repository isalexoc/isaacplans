/**
 * Impact Health Sharing quotes, shaped for selling. Client-safe.
 *
 * Impact prices a household by two things only: how many people (1, 2, or 3 and more) and the
 * oldest applicant's date of birth. Every household gets the same four programs, which differ only
 * in the annual Primary Responsibility Amount (PRA) — what the household covers on large bills
 * before the community shares. Benefits and provider fees are identical in all four, which is the
 * point the quote slide makes.
 *
 * Isaac's names, cheapest first (Esencial is the recommended one): see lib/impact-quote/server.ts
 * for where the prices come from.
 */

export type ImpactTierKey = "esencial" | "plus" | "premium" | "total";

/** Impact's household sizes: its quote tool's "Uno", "Dos", "Más de tres" (really 3 or more). */
export type HouseholdSize = 1 | 2 | 3;

export type ImpactPlan = {
  /** Null for a program outside the four (Impact's Senior Program, say). */
  tier: ImpactTierKey | null;
  pra: number;
  monthly: number;
};

export type ImpactQuote = {
  /** Cheapest first. */
  plans: ImpactPlan[];
  members: HouseholdSize;
  /** The oldest applicant's age, when known. */
  oldestAge: number | null;
  /** "impact" = Impact's price service; "manual" = typed by Isaac from Impact's quote page. */
  source: "impact" | "manual";
};

/** The four programs by PRA, cheapest monthly share first. */
export const TIERS: { key: ImpactTierKey; pra: number }[] = [
  { key: "esencial", pra: 10_000 },
  { key: "plus", pra: 7_500 },
  { key: "premium", pra: 5_000 },
  { key: "total", pra: 2_500 },
];

/** The tier everyone is steered to: the lowest monthly share, every benefit included. */
export const RECOMMENDED_TIER: ImpactTierKey = "esencial";

/** Impact's annual household Co-Share maximum, on top of the PRA. */
export const CO_SHARE_MAX = 5_000;

/** One-time, once per family. */
export const ENROLLMENT_FEE = 79;

/** Impact's Senior Program starts here (one person, Medicare A and B required). */
export const SENIOR_AGE = 65;

export function tierForPra(pra: number): ImpactTierKey | null {
  return TIERS.find((t) => t.pra === pra)?.key ?? null;
}

/** Impact's `{ PrimaryResponsibilityAmount, BasePrice }` programs, as plans. Junk is dropped. */
export function plansFromPrograms(programs: unknown): ImpactPlan[] {
  if (!Array.isArray(programs)) return [];
  return programs
    .map((p) => ({
      pra: Number((p as Record<string, unknown>)?.PrimaryResponsibilityAmount),
      monthly: Number((p as Record<string, unknown>)?.BasePrice),
    }))
    .filter((p) => Number.isFinite(p.pra) && Number.isFinite(p.monthly) && p.monthly > 0)
    .map((p) => ({ ...p, tier: tierForPra(p.pra) }))
    .sort((a, b) => a.monthly - b.monthly || b.pra - a.pra);
}

/** The four tiers with Isaac's typed prices; blanks are skipped. */
export function manualPlans(prices: Partial<Record<ImpactTierKey, number>>): ImpactPlan[] {
  return TIERS.filter((t) => (prices[t.key] ?? 0) > 0)
    .map((t) => ({ tier: t.key, pra: t.pra, monthly: prices[t.key] as number }))
    .sort((a, b) => a.monthly - b.monthly);
}

export function householdSize(people: number): HouseholdSize {
  if (people <= 1) return 1;
  return people === 2 ? 2 : 3;
}

/** Whole years on `today`, or null for anything that isn't a real YYYY-MM-DD. */
export function ageOn(dobIso: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() < mo - 1 || (today.getMonth() === mo - 1 && today.getDate() < d)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

/** "≈ $10.06 a day" maths. */
export function perDay(monthly: number): number {
  return Math.round(((monthly * 12) / 365) * 100) / 100;
}

export const money = (n: number, cents = false) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * The household an intake describes: the applicant plus every added person with a name or a date
 * of birth, and the oldest date of birth among them. What Impact's price needs, read straight
 * from the form so the agent never types it twice.
 */
export function householdFromIntake(data: Record<string, unknown>): { people: number; oldestDob: string | null } {
  const dobs = [str(data.dateOfBirth)];
  let people = 1;
  if (data.hasDependents === "yes" && Array.isArray(data.dependents)) {
    for (const row of data.dependents as Record<string, unknown>[]) {
      if (!str(row?.firstName) && !str(row?.dateOfBirth)) continue;
      people += 1;
      dobs.push(str(row?.dateOfBirth));
    }
  }
  const valid = dobs.filter((d) => ageOn(d) !== null).sort();
  return { people, oldestDob: valid[0] ?? null };
}
