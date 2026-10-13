/**
 * Builds the first draft of the two pages from a grounded extraction. Pure and deterministic:
 * every number on the page is either copied from the extraction or derived here by a rule the
 * agent can read — never by the model. The route supplies `today` and the "Presented By" seed.
 */

import { getCarrier } from "./carriers";
import { DEFAULT_COVER_PHOTO } from "./cover-photos";
import type {
  BenefitFrequency,
  CarrierKey,
  CashValueBar,
  ExtractedLivingBenefit,
  IllustrationExtraction,
  LedgerRow,
  LivingBenefitExample,
  LivingBenefitRow,
  LivingBenefitType,
  PresentationData,
  PresentedBy,
} from "./types";

export interface DefaultsContext {
  carrierKey: CarrierKey;
  /** YYYY-MM-DD in the agent's timezone. */
  today: string;
  presentedBy: PresentedBy;
}

export const BENEFIT_LABELS: Record<LivingBenefitType, string> = {
  terminal: "Terminal Illness Benefit",
  chronic: "Chronic Illness Benefit",
  critical_illness: "Critical Illness Benefit",
  critical_injury: "Critical Injury Benefit",
  alzheimers: "Alzheimer's Disease Benefit",
  confined_care: "Confined Care Benefit",
  other: "Living Benefit",
};

const BENEFIT_ORDER: LivingBenefitType[] = [
  "terminal",
  "chronic",
  "critical_illness",
  "critical_injury",
  "alzheimers",
  "confined_care",
];

const SUFFIX: Record<BenefitFrequency, string> = {
  lump_sum: "Lump Sum",
  monthly: "Per Month",
  annual: "Per Year",
};

/** "MARIO SILVA" → "Mario Silva"; anything already mixed-case is left alone. */
export function tidyName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// ─── Cash value chart ─────────────────────────────────────────────────────────

/** Four retirement ages, five years apart, starting at 65 (or ten years after issue if later). */
export function defaultCashValueBars(ledger: LedgerRow[], issueAge: number | null): CashValueBar[] {
  const rows = ledger.filter((row) => row.verified && row.cashSurrenderValue !== null);
  if (rows.length === 0) return [];
  const start = Math.max(65, Math.ceil(((issueAge ?? rows[0].age) + 10) / 5) * 5);
  const bars: CashValueBar[] = [];
  for (const target of [start, start + 5, start + 10, start + 15]) {
    const nearest = rows.reduce((best, row) =>
      Math.abs(row.age - target) < Math.abs(best.age - target) ? row : best
    );
    if (!bars.some((bar) => bar.age === nearest.age)) {
      bars.push({ age: nearest.age, value: nearest.cashSurrenderValue ?? 0 });
    }
  }
  return bars.sort((a, b) => a.age - b.age);
}

// ─── Living benefits ──────────────────────────────────────────────────────────

/** 65 when the illustration shows it (NLG's convention), else the age most benefit types share. */
export function chooseLivingBenefitsAge(benefits: ExtractedLivingBenefit[]): number | null {
  const typesByAge = new Map<number, Set<LivingBenefitType>>();
  for (const benefit of benefits) {
    for (const example of benefit.examples) {
      if (!example.verified || example.age === null) continue;
      const types = typesByAge.get(example.age) ?? new Set<LivingBenefitType>();
      types.add(benefit.type);
      typesByAge.set(example.age, types);
    }
  }
  if (typesByAge.has(65)) return 65;
  let best: { age: number; count: number } | null = null;
  for (const [age, types] of typesByAge) {
    const better =
      !best ||
      types.size > best.count ||
      (types.size === best.count && Math.abs(age - 65) < Math.abs(best.age - 65));
    if (better) best = { age, count: types.size };
  }
  return best?.age ?? null;
}

/** Verified amounts printed for the chosen age; failing that, ones not tied to any age ("initial"). */
function examplePool(benefit: ExtractedLivingBenefit, age: number | null): LivingBenefitExample[] {
  const verified = benefit.examples.filter((e) => e.verified);
  const atAge = verified.filter((e) => e.age === age);
  return atAge.length > 0 ? atAge : verified.filter((e) => e.age === null);
}

/**
 * Only chronic illness is paid periodically (IRS per-diem limits), so a chronic "lump sum" figure is
 * a year's acceleration. Terminal, critical and the rest pay one sum per claim, whatever cadence
 * the illustration's wording suggests (Mutual of Omaha's "Initial Annual Acceleration").
 */
function displayFrequency(type: LivingBenefitType, frequency: BenefitFrequency): BenefitFrequency {
  if (type !== "chronic") return "lump_sum";
  return frequency === "monthly" ? "monthly" : "annual";
}

function rowFromExamples(benefit: ExtractedLivingBenefit, pool: LivingBenefitExample[]): LivingBenefitRow | null {
  if (pool.length === 0) return null;
  const frequencies = pool.map((e) => displayFrequency(benefit.type, e.frequency));
  const frequency = frequencies.includes("monthly") ? "monthly" : frequencies[0];
  const group = pool.filter((_, i) => frequencies[i] === frequency);
  const payouts = group.filter((e) => e.kind === "payout");
  const pick = payouts.length > 0 ? payouts : group;
  // Critical illness/injury pay by severity, so the figure is always a ceiling (NLG prints "Up to").
  const ceiling =
    pick.length > 1 ||
    payouts.length === 0 ||
    benefit.type === "critical_illness" ||
    benefit.type === "critical_injury";
  return {
    key: benefit.type,
    label: BENEFIT_LABELS[benefit.type],
    show: true,
    prefix: ceiling ? "Up to" : "",
    amount: Math.max(...pick.map((e) => e.amount)),
    text: "",
    suffix: SUFFIX[frequency],
    source: "illustration",
  };
}

/**
 * No amounts printed: the rider's stated maximum. A dollar cap is never allowed past the
 * percentage cap or the death benefit itself — illustrations quote program-wide limits
 * ("$1,000,000 on all policies") that this policy could never reach.
 */
function rowFromRiderMaximum(benefit: ExtractedLivingBenefit, deathBenefit: number | null): LivingBenefitRow {
  const base = { key: benefit.type, label: BENEFIT_LABELS[benefit.type], show: true };
  const pctCap =
    deathBenefit !== null && deathBenefit > 0
      ? Math.floor(((benefit.maxPercentOfDeathBenefit ?? 100) / 100) * deathBenefit)
      : null;
  const dollarCap = benefit.maxAmount !== null && benefit.maxAmountVerified ? benefit.maxAmount : null;
  const amount =
    dollarCap !== null && pctCap !== null
      ? Math.min(dollarCap, pctCap)
      : (dollarCap ?? (benefit.maxPercentOfDeathBenefit !== null ? pctCap : null));
  if (amount === null) {
    return { ...base, prefix: "", amount: null, text: "Included", suffix: "", source: "included" };
  }
  return {
    ...base,
    prefix: "Up to",
    amount,
    text: "",
    suffix: benefit.type === "chronic" ? "" : "Lump Sum",
    source: "rider_max",
  };
}

function deathBenefitAt(extraction: IllustrationExtraction, age: number | null): number | null {
  const row = age === null ? undefined : extraction.ledger.find((r) => r.age === age && r.verified);
  return row?.deathBenefit ?? extraction.initialDeathBenefit;
}

export function defaultLivingBenefitRows(
  extraction: IllustrationExtraction,
  age: number | null
): LivingBenefitRow[] {
  const rows: LivingBenefitRow[] = [];
  for (const type of BENEFIT_ORDER) {
    const benefit = extraction.livingBenefits.find((b) => b.type === type);
    if (!benefit) continue;
    rows.push(
      rowFromExamples(benefit, examplePool(benefit, age)) ??
        rowFromRiderMaximum(benefit, deathBenefitAt(extraction, age))
    );
  }
  return rows;
}

// ─── Presented By + the whole draft ──────────────────────────────────────────

/** The agent block when there is no earlier presentation to copy it from. */
export function seedPresentedBy(extraction: IllustrationExtraction, profileName: string | null): PresentedBy {
  const name = profileName?.trim() || (extraction.agent.name ? tidyName(extraction.agent.name) : "");
  const lines = [...extraction.agent.addressLines, ...(extraction.agent.phone ? [extraction.agent.phone] : [])];
  return { name, lines };
}

export function buildDefaultPresentation(
  extraction: IllustrationExtraction,
  context: DefaultsContext
): PresentationData {
  const carrier = getCarrier(context.carrierKey);
  const livingBenefitsAge = chooseLivingBenefitsAge(extraction.livingBenefits);
  return {
    carrierKey: carrier.key,
    carrierDisplayName: carrier.displayName || extraction.carrierName || "",
    productName: extraction.productName ?? "",
    productLine: "Indexed Universal Life",
    issuerName: extraction.issuingCompany ?? carrier.defaultIssuer,
    issuerLocation: extraction.issuerAddress ?? carrier.defaultIssuerLocation,
    policyForm: extraction.policyForm ?? "",
    clientName: extraction.insured.name ? tidyName(extraction.insured.name) : "",
    preparedDate: extraction.preparedDate ?? context.today,
    presentedBy: context.presentedBy,
    coverPhoto: DEFAULT_COVER_PHOTO,
    premium: { amount: extraction.premium.amount ?? 0, mode: extraction.premium.mode ?? "Monthly" },
    deathBenefit: extraction.initialDeathBenefit ?? 0,
    cashValueBars: defaultCashValueBars(extraction.ledger, extraction.insured.issueAge),
    livingBenefitsAge,
    livingBenefits: defaultLivingBenefitRows(extraction, livingBenefitsAge),
  };
}
