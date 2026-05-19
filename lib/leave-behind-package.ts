import type { ComparisonTier, PresentationTier } from "@/lib/final-expense-leave-behind-tiers";
import { COMPARISON_TIER_ORDER } from "@/lib/final-expense-leave-behind-tiers";
import type {
  CompareQuoteData,
  CompareTierInputs,
  LeaveBehindPlanType,
  LeaveBehindQuoteData,
  LeaveBehindQuoteType,
  PackageQuoteData,
  SingleQuoteData,
} from "@/lib/leave-behind-clients";
import {
  isCompareQuoteData,
  isPackageQuoteData,
  isSingleQuoteData,
} from "@/lib/leave-behind-clients";
import {
  formatPremiumForQuote,
  parsePremiumAmount,
  parseWholeDollarInput,
} from "@/lib/leave-behind-money-input";

export type PackagePreviewAsset = ComparisonTier | "compare";

export const PACKAGE_PREVIEW_ASSETS: PackagePreviewAsset[] = [
  "bronze",
  "silver",
  "gold",
  "compare",
];

export function emptyTierInputs(): Record<ComparisonTier, CompareTierInputs> {
  const empty: CompareTierInputs = { natural: "", accidental: "", premium: "" };
  return { bronze: { ...empty }, silver: { ...empty }, gold: { ...empty } };
}

export function emptyPackageData(): PackageQuoteData {
  return {
    prospectName: "",
    tierInputs: emptyTierInputs(),
    highlightTier: "gold",
    planType: "preferred",
    avoidNames: "",
    protectNames: "",
    phase: 1,
  };
}

export function parseNames(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tierComputedFromInputs(tier: ComparisonTier, inp: CompareTierInputs) {
  const coverageNum = parseInt(parseWholeDollarInput(inp.natural), 10) || 0;
  const naturalNum = coverageNum;
  const accidentalNum = coverageNum;
  const premiumNum = parsePremiumAmount(inp.premium);
  return {
    naturalNum,
    accidentalNum,
    premiumNum,
    premiumDisplay: formatPremiumForQuote(inp.premium),
    total: naturalNum + accidentalNum,
  };
}

function syncTierInputs(raw?: Record<ComparisonTier, CompareTierInputs> | null) {
  const base = emptyTierInputs();
  if (!raw) return base;
  for (const tier of COMPARISON_TIER_ORDER) {
    const block = raw[tier];
    if (!block) continue;
    const coverage = parseWholeDollarInput(block.natural || block.accidental || "");
    base[tier] = { natural: coverage, accidental: coverage, premium: block.premium ?? "" };
  }
  return base;
}

/** Normalize any saved row into the unified package shape for the editor. */
export function toPackageData(
  quoteType: LeaveBehindQuoteType | string,
  data: LeaveBehindQuoteData
): PackageQuoteData {
  if (quoteType === "package" && isPackageQuoteData(quoteType, data)) {
    return {
      ...data,
      tierInputs: syncTierInputs(data.tierInputs),
    };
  }

  if (quoteType === "compare" && isCompareQuoteData("compare", data)) {
    return {
      prospectName: data.prospectName,
      tierInputs: syncTierInputs(data.tierInputs),
      highlightTier: data.highlightTier,
      planType: data.planType,
      avoidNames: data.avoidNames,
      protectNames: data.protectNames,
      phase: data.phase,
    };
  }

  if (quoteType === "single" && isSingleQuoteData("single", data)) {
    const tierInputs = emptyTierInputs();
    const coverage = parseWholeDollarInput(data.naturalDeath || data.accidentalDeath || "");
    const tier = data.presentationTier;
    if (COMPARISON_TIER_ORDER.includes(tier as ComparisonTier)) {
      tierInputs[tier as ComparisonTier] = {
        natural: coverage,
        accidental: coverage,
        premium: data.monthlyPremium,
      };
    }
    return {
      prospectName: data.prospectName,
      tierInputs,
      highlightTier: COMPARISON_TIER_ORDER.includes(tier as ComparisonTier)
        ? (tier as ComparisonTier)
        : "gold",
      planType: data.planType,
      avoidNames: data.avoidNames,
      protectNames: data.protectNames,
      phase: data.phase,
    };
  }

  return emptyPackageData();
}

export function singleCardTierFromPackage(
  data: PackageQuoteData,
  tier: ComparisonTier
): {
  prospectName: string;
  naturalDeath: string;
  accidentalDeath: string;
  monthlyPremium: string;
  avoidNames: string;
  protectNames: string;
  planType: LeaveBehindPlanType;
  presentationTier: PresentationTier;
} {
  const block = data.tierInputs[tier];
  return {
    prospectName: data.prospectName,
    naturalDeath: block.natural,
    accidentalDeath: block.accidental,
    monthlyPremium: block.premium,
    avoidNames: data.avoidNames,
    protectNames: data.protectNames,
    planType: data.planType,
    presentationTier: tier,
  };
}

export function compareDataFromPackage(data: PackageQuoteData): CompareQuoteData {
  return {
    prospectName: data.prospectName,
    tierInputs: data.tierInputs,
    highlightTier: data.highlightTier,
    planType: data.planType,
    avoidNames: data.avoidNames,
    protectNames: data.protectNames,
    phase: data.phase,
  };
}

export function isProspectNameComplete(prospectName: string): boolean {
  return Boolean(prospectName.trim());
}

export function isTierCoverageComplete(
  tier: ComparisonTier,
  tierInputs: Record<ComparisonTier, CompareTierInputs>
): boolean {
  const inp = tierInputs[tier];
  const coverageNum = parseInt(parseWholeDollarInput(inp.natural), 10) || 0;
  return Boolean(inp.natural.trim()) && coverageNum >= 1;
}

export function validateTierForCard(
  tier: ComparisonTier,
  tierInputs: Record<ComparisonTier, CompareTierInputs>
): Partial<Record<ComparisonTier, boolean>> {
  return isTierCoverageComplete(tier, tierInputs) ? {} : { [tier]: true };
}

export function validatePackageTiers(
  tierInputs: Record<ComparisonTier, CompareTierInputs>
): Partial<Record<ComparisonTier, boolean>> {
  const errs: Partial<Record<ComparisonTier, boolean>> = {};
  for (const tier of COMPARISON_TIER_ORDER) {
    if (!isTierCoverageComplete(tier, tierInputs)) errs[tier] = true;
  }
  return errs;
}

export function allTiersCompleteForCompare(
  tierInputs: Record<ComparisonTier, CompareTierInputs>
): boolean {
  return Object.keys(validatePackageTiers(tierInputs)).length === 0;
}

export function validateForPreviewAsset(
  asset: PackagePreviewAsset,
  tierInputs: Record<ComparisonTier, CompareTierInputs>
): Partial<Record<ComparisonTier, boolean>> {
  if (asset === "compare") return validatePackageTiers(tierInputs);
  return validateTierForCard(asset, tierInputs);
}

/** Prefer last-edited tier when complete; otherwise first complete tier; else last edited or bronze. */
export function pickDefaultPackagePreviewAsset(
  tierInputs: Record<ComparisonTier, CompareTierInputs>,
  lastEditedTier?: ComparisonTier | null
): ComparisonTier {
  if (lastEditedTier && isTierCoverageComplete(lastEditedTier, tierInputs)) {
    return lastEditedTier;
  }
  for (const tier of COMPARISON_TIER_ORDER) {
    if (isTierCoverageComplete(tier, tierInputs)) return tier;
  }
  return lastEditedTier ?? "bronze";
}

export function packageFilenameSlug(prospectName: string, suffix: string): string {
  const base = prospectName.trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "client";
  return `senior-life-${base}-${suffix}-${Date.now()}.png`;
}
