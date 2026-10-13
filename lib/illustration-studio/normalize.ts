/**
 * Turns the model's structured output into a clean `IllustrationExtraction`.
 *
 * Strict json_schema guarantees the SHAPE; this guarantees the CONTENT is usable: placeholder names
 * become null, impossible numbers are dropped, ledger rows are de-duplicated and ordered, and
 * duplicate riders are merged. Every `verified` flag starts true — ./grounding.ts decides.
 */

import {
  LIVING_BENEFIT_TYPES,
  PREMIUM_MODES,
  type BenefitExampleKind,
  type BenefitFrequency,
  type ExtractedLivingBenefit,
  type ExtractionMeta,
  type IllustrationExtraction,
  type LedgerRow,
  type LivingBenefitExample,
  type LivingBenefitType,
  type PremiumMode,
} from "./types";

/** The model's output, exactly as the schema in ./extract.ts describes it. */
export interface RawExtraction {
  carrierName: string | null;
  issuingCompany: string | null;
  issuerAddress: string | null;
  productName: string | null;
  policyForm: string | null;
  preparedDate: string | null;
  insured: {
    name: string | null;
    gender: string | null;
    issueAge: number | null;
    riskClass: string | null;
    state: string | null;
  };
  agent: {
    name: string | null;
    addressLines: string[];
    phone: string | null;
    email: string | null;
    license: string | null;
  };
  premium: { amount: number | null; mode: string | null };
  initialDeathBenefit: number | null;
  deathBenefitOption: string | null;
  illustratedRate: number | null;
  /** [policyYear, age, premiumOutlay, accumulationValue, cashSurrenderValue, deathBenefit] */
  ledger: (number | null)[][];
  livingBenefits: {
    type: string;
    riderName: string;
    maxPercentOfDeathBenefit: number | null;
    maxAmount: number | null;
    examples: {
      age: number | null;
      amount: number;
      frequency: string;
      kind: string;
      label: string | null;
    }[];
  }[];
  otherRiders: string[];
}

/** Illustration software fills the insured/agent slot with these when no name was typed. */
const PLACEHOLDER_NAME =
  /^(the )?(proposed )?(insured|client|prospect|applicant|owner|agent|producer|name|n\/a|none|unknown|please (fill|enter) in (the )?name)$/i;

/** Dummy agent addresses some quoting software prints (American Amicable: "111 Main St., Anywhere, TX"). */
const PLACEHOLDER_ADDRESS = /\b(anywhere|anytown|any town)\b/i;

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

export function cleanName(value: unknown): string | null {
  const text = cleanText(value);
  return text && !PLACEHOLDER_NAME.test(text) ? text : null;
}

function positiveOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function ageOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 125 ? value : null;
}

function isoDateOrNull(value: unknown): string | null {
  const text = cleanText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isNaN(Date.parse(`${text}T12:00:00Z`)) ? null : text;
}

function stateOrNull(value: unknown): string | null {
  const text = cleanText(value);
  return text && /^[A-Za-z]{2}$/.test(text) ? text.toUpperCase() : null;
}

function premiumModeOrNull(value: unknown): PremiumMode | null {
  return PREMIUM_MODES.find((mode) => mode === value) ?? null;
}

function normalizeLedger(rows: RawExtraction["ledger"]): LedgerRow[] {
  const byYear = new Map<number, LedgerRow>();
  for (const row of rows) {
    if (row.length !== 6) continue;
    const [policyYear, rawAge, premiumOutlay, accumulationValue, cashSurrenderValue, deathBenefit] = row;
    const age = ageOrNull(rawAge);
    if (typeof policyYear !== "number" || !Number.isInteger(policyYear) || policyYear < 1) continue;
    if (age === null || byYear.has(policyYear)) continue; // first occurrence = the main ledger
    byYear.set(policyYear, {
      policyYear,
      age,
      premiumOutlay: nonNegativeOrNull(premiumOutlay),
      accumulationValue: nonNegativeOrNull(accumulationValue),
      cashSurrenderValue: nonNegativeOrNull(cashSurrenderValue),
      deathBenefit: positiveOrNull(deathBenefit),
      verified: true,
    });
  }
  return [...byYear.values()].sort((a, b) => a.policyYear - b.policyYear);
}

function normalizeExample(example: RawExtraction["livingBenefits"][number]["examples"][number]): LivingBenefitExample | null {
  const amount = positiveOrNull(example.amount);
  if (amount === null) return null;
  const frequency: BenefitFrequency =
    example.frequency === "monthly" || example.frequency === "annual" ? example.frequency : "lump_sum";
  const kind: BenefitExampleKind = example.kind === "max_acceleration" ? "max_acceleration" : "payout";
  return { age: ageOrNull(example.age), amount, frequency, kind, label: cleanText(example.label), verified: true };
}

/**
 * Riders the model listed twice (e.g. once from the rider list, once from the benefits page)
 * merge into one entry per type. "other" riders are kept separate — they can be anything.
 */
function normalizeLivingBenefits(items: RawExtraction["livingBenefits"]): ExtractedLivingBenefit[] {
  const merged = new Map<string, ExtractedLivingBenefit>();
  items.forEach((item, index) => {
    const type: LivingBenefitType = LIVING_BENEFIT_TYPES.find((t) => t === item.type) ?? "other";
    const pct = positiveOrNull(item.maxPercentOfDeathBenefit);
    const entry: ExtractedLivingBenefit = {
      type,
      riderName: cleanText(item.riderName) ?? type,
      maxPercentOfDeathBenefit: pct !== null && pct <= 100 ? pct : null,
      maxAmount: positiveOrNull(item.maxAmount),
      maxAmountVerified: true,
      examples: item.examples.map(normalizeExample).filter((e): e is LivingBenefitExample => e !== null),
    };
    const key = type === "other" ? `other:${index}` : type;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, entry);
      return;
    }
    existing.maxPercentOfDeathBenefit ??= entry.maxPercentOfDeathBenefit;
    existing.maxAmount ??= entry.maxAmount;
    existing.examples.push(...entry.examples);
  });
  return [...merged.values()];
}

export function normalizeExtraction(raw: RawExtraction, meta: ExtractionMeta): IllustrationExtraction {
  const gender = raw.insured.gender === "Male" || raw.insured.gender === "Female" ? raw.insured.gender : null;
  return {
    carrierName: cleanText(raw.carrierName),
    issuingCompany: cleanText(raw.issuingCompany),
    issuerAddress: cleanText(raw.issuerAddress),
    productName: cleanText(raw.productName),
    policyForm: cleanText(raw.policyForm),
    preparedDate: isoDateOrNull(raw.preparedDate),
    insured: {
      name: cleanName(raw.insured.name),
      gender,
      issueAge: ageOrNull(raw.insured.issueAge),
      riskClass: cleanText(raw.insured.riskClass),
      state: stateOrNull(raw.insured.state),
    },
    agent: {
      name: cleanName(raw.agent.name),
      addressLines: raw.agent.addressLines
        .map(cleanText)
        .filter((line): line is string => line !== null && !PLACEHOLDER_ADDRESS.test(line)),
      phone: cleanText(raw.agent.phone),
      email: cleanText(raw.agent.email),
      license: cleanText(raw.agent.license),
    },
    premium: { amount: positiveOrNull(raw.premium.amount), mode: premiumModeOrNull(raw.premium.mode), verified: true },
    initialDeathBenefit: positiveOrNull(raw.initialDeathBenefit),
    initialDeathBenefitVerified: true,
    deathBenefitOption: cleanText(raw.deathBenefitOption),
    illustratedRate: positiveOrNull(raw.illustratedRate),
    ledger: normalizeLedger(raw.ledger),
    livingBenefits: normalizeLivingBenefits(raw.livingBenefits),
    otherRiders: raw.otherRiders.map(cleanText).filter((name): name is string => name !== null),
    warnings: [],
    meta,
  };
}
