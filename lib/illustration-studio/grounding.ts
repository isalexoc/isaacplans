/**
 * Proves the AI's numbers came from the illustration, following the grounding check in
 * `lib/telegram/extract-openai.ts`: schema-conformant output is not the same as correct output.
 *
 * Three checks, because "the number appears somewhere" alone would pass a value lifted from the
 * GUARANTEED column of the right row:
 *   1. every premium / death benefit / benefit amount must appear in the PDF text;
 *   2. every ledger row's numbers must sit together on ONE reconstructed line (see ./pdf-text.ts),
 *      which ties year, age and value to the same row;
 *   3. sanity: cash surrender value never exceeds accumulation value, and age − year stays constant.
 *
 * Failures never delete core numbers — they flip `verified` and add a warning, and the editor
 * highlights them. Unverified living-benefit amounts are skipped by ./defaults.ts.
 */

import { formatCurrency } from "./format";
import type { IllustrationExtraction, LedgerRow } from "./types";

const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/** Canonical form for comparison: "2,400.00", "2400" and "$2,400" all become "2400.00". */
function numberKey(value: number): string {
  return value.toFixed(2);
}

export interface NumberIndex {
  all: Set<string>;
  lines: Set<string>[];
}

export function buildNumberIndex(pages: string[]): NumberIndex {
  const all = new Set<string>();
  const lines: Set<string>[] = [];
  for (const page of pages) {
    for (const line of page.split("\n")) {
      const keys = new Set<string>();
      for (const match of line.match(NUMBER_PATTERN) ?? []) {
        const value = Number(match.replace(/,/g, ""));
        if (!Number.isFinite(value)) continue;
        keys.add(numberKey(value));
        all.add(numberKey(value));
      }
      if (keys.size > 0) lines.push(keys);
    }
  }
  return { all, lines };
}

function appears(value: number | null, index: NumberIndex): boolean {
  return value !== null && index.all.has(numberKey(value));
}

function rowValues(row: LedgerRow): number[] {
  return [
    row.policyYear,
    row.age,
    row.premiumOutlay,
    row.accumulationValue,
    row.cashSurrenderValue,
    row.deathBenefit,
  ].filter((value): value is number => value !== null);
}

function rowOnOneLine(row: LedgerRow, index: NumberIndex): boolean {
  const keys = rowValues(row).map(numberKey);
  return index.lines.some((line) => keys.every((key) => line.has(key)));
}

function rowIsSane(row: LedgerRow, ageOffset: number | undefined): boolean {
  if (
    row.accumulationValue !== null &&
    row.cashSurrenderValue !== null &&
    row.cashSurrenderValue > row.accumulationValue + 1
  ) {
    return false;
  }
  return ageOffset === undefined || row.age - row.policyYear === ageOffset;
}

/** The age − policy year offset most rows agree on; a row that disagrees was mis-read. */
function commonAgeOffset(ledger: LedgerRow[]): number | undefined {
  const counts = new Map<number, number>();
  for (const row of ledger) counts.set(row.age - row.policyYear, (counts.get(row.age - row.policyYear) ?? 0) + 1);
  let best: [number, number] | undefined;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  return best?.[0];
}

function groundLedger(ledger: LedgerRow[], index: NumberIndex): { ledger: LedgerRow[]; warning: string | null } {
  const offset = commonAgeOffset(ledger);
  const grounded = ledger.map((row) => ({
    ...row,
    verified: rowOnOneLine(row, index) && rowIsSane(row, offset),
  }));
  const failedAges = grounded.filter((row) => !row.verified).map((row) => row.age);
  if (failedAges.length === 0) return { ledger: grounded, warning: null };
  return {
    ledger: grounded,
    warning: `Cash values at age${failedAges.length > 1 ? "s" : ""} ${failedAges.join(", ")} couldn't be matched to one row of the illustration — check them before charting those ages.`,
  };
}

export function groundExtraction(
  extraction: IllustrationExtraction,
  index: NumberIndex
): IllustrationExtraction {
  const warnings: string[] = [];

  const premiumVerified = appears(extraction.premium.amount, index);
  if (extraction.premium.amount === null) warnings.push("No planned premium was found — enter it.");
  else if (!premiumVerified) {
    warnings.push(`The premium (${formatCurrency(extraction.premium.amount, true)}) wasn't found in the PDF text — double-check it.`);
  }

  const dbVerified = appears(extraction.initialDeathBenefit, index);
  if (extraction.initialDeathBenefit === null) warnings.push("No initial death benefit was found — enter it.");
  else if (!dbVerified) {
    warnings.push(`The death benefit (${formatCurrency(extraction.initialDeathBenefit)}) wasn't found in the PDF text — double-check it.`);
  }

  const { ledger, warning: ledgerWarning } = groundLedger(extraction.ledger, index);
  if (ledger.length === 0) warnings.push("No cash values were found — enter the chart values by hand.");
  if (ledgerWarning) warnings.push(ledgerWarning);

  let droppedAmounts = 0;
  const livingBenefits = extraction.livingBenefits.map((benefit) => {
    const examples = benefit.examples.map((example) => {
      const verified = appears(example.amount, index);
      if (!verified) droppedAmounts++;
      return { ...example, verified };
    });
    const maxAmountVerified = benefit.maxAmount === null || appears(benefit.maxAmount, index);
    if (!maxAmountVerified) droppedAmounts++;
    return { ...benefit, examples, maxAmountVerified };
  });
  if (droppedAmounts > 0) {
    warnings.push(
      `${droppedAmounts} living-benefit amount${droppedAmounts > 1 ? "s" : ""} weren't found in the PDF text and were left out.`
    );
  }

  return {
    ...extraction,
    premium: { ...extraction.premium, verified: premiumVerified },
    initialDeathBenefitVerified: dbVerified,
    ledger,
    livingBenefits,
    warnings,
  };
}
