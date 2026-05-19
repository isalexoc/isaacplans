import type { ComparisonTier, PresentationTier } from "@/lib/final-expense-leave-behind-tiers";

export type LeaveBehindQuoteType = "package" | "single" | "compare";

export type LeaveBehindPlanType = "preferred" | "modified" | "guaranteed";

/** Map legacy saved plan types to the current three options. */
export function migrateLeaveBehindPlanType(value: unknown): LeaveBehindPlanType {
  switch (value) {
    case "modified":
      return "modified";
    case "guaranteed":
    case "guaranteedIssue":
      return "guaranteed";
    case "preferred":
    case "standard":
    case "easyIssue":
    default:
      return "preferred";
  }
}

export type CompareTierInputs = {
  natural: string;
  accidental: string;
  premium: string;
};

/** Unified client package: shared story + bronze/silver/gold tier amounts. */
export type PackageQuoteData = {
  prospectName: string;
  tierInputs: Record<ComparisonTier, CompareTierInputs>;
  highlightTier: ComparisonTier;
  planType: LeaveBehindPlanType;
  avoidNames: string;
  protectNames: string;
  phase: 1 | 2;
};

/** @deprecated Legacy single-tier save — migrated to package on load. */
export type SingleQuoteData = {
  prospectName: string;
  naturalDeath: string;
  accidentalDeath: string;
  monthlyPremium: string;
  avoidNames: string;
  protectNames: string;
  planType: LeaveBehindPlanType;
  presentationTier: PresentationTier;
  phase: 1 | 2;
};

/** @deprecated Legacy compare save — migrated to package on load. */
export type CompareQuoteData = {
  prospectName: string;
  tierInputs: Record<ComparisonTier, CompareTierInputs>;
  highlightTier: ComparisonTier;
  planType: LeaveBehindPlanType;
  avoidNames: string;
  protectNames: string;
  phase: 1 | 2;
};

export type LeaveBehindQuoteData = PackageQuoteData | SingleQuoteData | CompareQuoteData;

export type LeaveBehindClientRecord = {
  id: string;
  quoteType: LeaveBehindQuoteType;
  prospectName: string | null;
  quoteData: LeaveBehindQuoteData;
  createdAt: string;
  updatedAt: string;
};

export function isPackageQuoteData(
  quoteType: LeaveBehindQuoteType | string,
  data: LeaveBehindQuoteData
): data is PackageQuoteData {
  return quoteType === "package" && "tierInputs" in data && "highlightTier" in data;
}

export function isSingleQuoteData(
  quoteType: LeaveBehindQuoteType,
  data: LeaveBehindQuoteData
): data is SingleQuoteData {
  return quoteType === "single";
}

export function isCompareQuoteData(
  quoteType: LeaveBehindQuoteType,
  data: LeaveBehindQuoteData
): data is CompareQuoteData {
  return quoteType === "compare";
}

export function displayNameForClient(
  prospectName: string | null,
  quoteData: LeaveBehindQuoteData
): string {
  const fromRow = prospectName?.trim();
  if (fromRow) return fromRow;
  const fromData = quoteData.prospectName?.trim();
  if (fromData) return fromData;
  return "Unnamed client";
}
