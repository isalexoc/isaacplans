/**
 * Shared types for the Illustration Studio: what the AI extracts from a carrier's illustration,
 * and the editable presentation the two-page PDF is rendered from.
 *
 * No server-only imports — the admin client, the API routes, the PDF renderer and the test script
 * all use these.
 */

export const CARRIER_KEYS = [
  "americo",
  "american_amicable",
  "fg",
  "mutual_of_omaha",
  "transamerica",
  "national_life",
  "other",
] as const;
export type CarrierKey = (typeof CARRIER_KEYS)[number];

export const PREMIUM_MODES = ["Monthly", "Quarterly", "Semi-Annual", "Annual"] as const;
export type PremiumMode = (typeof PREMIUM_MODES)[number];

export const LIVING_BENEFIT_TYPES = [
  "terminal",
  "chronic",
  "critical_illness",
  "critical_injury",
  "alzheimers",
  "confined_care",
  "other",
] as const;
export type LivingBenefitType = (typeof LIVING_BENEFIT_TYPES)[number];

export type BenefitFrequency = "lump_sum" | "monthly" | "annual";
/** `payout`: what the client actually receives. `max_acceleration`: death benefit accelerated, before discounts. */
export type BenefitExampleKind = "payout" | "max_acceleration";

// ─── Extraction (AI output after normalization + grounding) ──────────────────

export interface LedgerRow {
  policyYear: number;
  age: number;
  premiumOutlay: number | null;
  accumulationValue: number | null;
  cashSurrenderValue: number | null;
  deathBenefit: number | null;
  /** False when this row's numbers couldn't all be found together on one line of the PDF text. */
  verified: boolean;
}

export interface LivingBenefitExample {
  age: number | null;
  amount: number;
  frequency: BenefitFrequency;
  kind: BenefitExampleKind;
  label: string | null;
  verified: boolean;
}

export interface ExtractedLivingBenefit {
  type: LivingBenefitType;
  riderName: string;
  maxPercentOfDeathBenefit: number | null;
  maxAmount: number | null;
  maxAmountVerified: boolean;
  examples: LivingBenefitExample[];
}

export interface ExtractionMeta {
  model: string;
  pageCount: number;
  /** Characters actually sent to the model (after the size cap). */
  sentChars: number;
  /** Pages left out to stay under the size cap, 1-based. */
  droppedPages: number[];
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface IllustrationExtraction {
  carrierName: string | null;
  issuingCompany: string | null;
  issuerAddress: string | null;
  productName: string | null;
  policyForm: string | null;
  /** YYYY-MM-DD */
  preparedDate: string | null;
  insured: {
    name: string | null;
    gender: "Male" | "Female" | null;
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
  premium: { amount: number | null; mode: PremiumMode | null; verified: boolean };
  initialDeathBenefit: number | null;
  initialDeathBenefitVerified: boolean;
  deathBenefitOption: string | null;
  /** Percent, e.g. 8.45. */
  illustratedRate: number | null;
  /** Current / illustrated non-guaranteed scenario only, ages that are multiples of 5. */
  ledger: LedgerRow[];
  livingBenefits: ExtractedLivingBenefit[];
  otherRiders: string[];
  /** Human-readable problems found by grounding, shown in the editor. */
  warnings: string[];
  meta: ExtractionMeta;
}

// ─── Presentation (what the PDF renders; edited by the agent) ────────────────

export const COVER_PHOTO_KEYS = ["young_family", "senior_couple", "dad_daughter", "family_home"] as const;
export type CoverPhotoKey = (typeof COVER_PHOTO_KEYS)[number];

export interface CashValueBar {
  age: number;
  value: number;
}

export type LivingBenefitSource = "illustration" | "rider_max" | "included" | "manual";
export type LivingBenefitPrefix = "" | "Up to";

export interface LivingBenefitRow {
  key: string;
  label: string;
  show: boolean;
  prefix: LivingBenefitPrefix;
  /** Null renders `text` instead (e.g. "Included"). */
  amount: number | null;
  text: string;
  /** "Lump Sum", "Per Month", "Per Year" or "". */
  suffix: string;
  source: LivingBenefitSource;
}

export interface PresentedBy {
  name: string;
  lines: string[];
}

export interface PresentationData {
  carrierKey: CarrierKey;
  carrierDisplayName: string;
  productName: string;
  /** The band on the cover, e.g. "Indexed Universal Life". */
  productLine: string;
  issuerName: string;
  issuerLocation: string;
  policyForm: string;
  clientName: string;
  /** YYYY-MM-DD */
  preparedDate: string;
  presentedBy: PresentedBy;
  coverPhoto: CoverPhotoKey;
  premium: { amount: number; mode: PremiumMode };
  deathBenefit: number;
  cashValueBars: CashValueBar[];
  /** The "at age N" in the living-benefits heading; null drops the age. */
  livingBenefitsAge: number | null;
  livingBenefits: LivingBenefitRow[];
}

// ─── Stored records ───────────────────────────────────────────────────────────

export interface IllustrationSummaryRecord {
  id: string;
  carrierKey: CarrierKey;
  clientName: string;
  productName: string;
  sourceFileName: string;
  extraction: IllustrationExtraction;
  presentation: PresentationData;
  createdAt: string;
  updatedAt: string;
}

export interface IllustrationSummaryListItem {
  id: string;
  carrierKey: CarrierKey;
  carrierDisplayName: string;
  clientName: string;
  productName: string;
  premium: { amount: number; mode: PremiumMode };
  deathBenefit: number;
  createdAt: string;
  updatedAt: string;
}
