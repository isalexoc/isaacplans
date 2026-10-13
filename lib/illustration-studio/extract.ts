/**
 * Reads a carrier illustration's text (from ./pdf-text.ts) and returns the facts the two summary
 * pages need, verified against that same text.
 *
 * The model only TRANSCRIBES: it never computes a number. Every derived value ("Up to" amounts,
 * which ages to chart) is decided deterministically in ./defaults.ts, and every number it copies is
 * checked in ./grounding.ts.
 *
 * Not `server-only` (see ./openai.ts) so the test script can run it live.
 */

import { chatJsonSchema } from "./openai";
import { buildNumberIndex, groundExtraction } from "./grounding";
import { normalizeExtraction, type RawExtraction } from "./normalize";
import { LIVING_BENEFIT_TYPES, PREMIUM_MODES, type IllustrationExtraction } from "./types";

/**
 * Number-dense ledger text tokenizes at roughly 3 characters per token, so this keeps the prompt
 * near 60k tokens — well inside gpt-4o's 128k window with room for the answer. The largest
 * sample (Transamerica, 40 pages) is ~129k characters.
 */
const MAX_INPUT_CHARS = 180_000;
/** Covers, product summaries and the first ledger page almost always sit in the first pages. */
const ALWAYS_KEEP_PAGES = 3;
const MAX_OUTPUT_TOKENS = 6000;

const SYSTEM_PROMPT = `You read the text of a life insurance policy illustration (usually an Indexed Universal Life illustration from a US carrier) and return the facts an agent needs for a one-page client summary.

The text was extracted from the PDF. Pages start with "=== PAGE n ===". Each line is one visual line of the page and " | " separates table columns.

RULES
- Copy every number exactly as printed, as a plain number without "$", "%" or commas. Never calculate, round, estimate or infer a number. If it is not printed, use null.
- Names: use null for placeholders such as "Insured", "Client", "Prospect" or "Please fill in name".
- Dates: YYYY-MM-DD.

FIELDS
- carrierName: the carrier brand, e.g. "Americo", "Transamerica", "Mutual of Omaha", "F&G", "American Amicable", "National Life Group".
- issuingCompany: the legal name of the company that issues the policy, e.g. "United of Omaha Life Insurance Company".
- issuerAddress: that company's address as printed (at least city and state), else null.
- productName: the product's own name, without the carrier name, the generic product type or trademark symbols, e.g. "Instant Decision IUL", "Intelligent Choice", "FlexLife", "Financial Foundation IUL II", "Everlast".
- policyForm: the base policy form number, else null.
- preparedDate: the date the illustration was prepared.
- insured: the proposed insured's name, gender, issue age, underwriting/risk class (e.g. "Standard Non-Tobacco") and issue state as a 2-letter code.
- agent: the agent/producer presenting the illustration — name, address lines, phone, email, license number. Empty/null when absent or a placeholder.
- premium: the initial planned premium per payment as printed and its mode, e.g. 213.87 + "Monthly". If only an annual figure is printed, use it with "Annual".
- initialDeathBenefit: the initial death benefit / face amount / specified amount at issue.
- deathBenefitOption: as printed, e.g. "Option A - Level".
- illustratedRate: the non-guaranteed illustrated (current) interest rate in percent, e.g. 8.45.

LEDGER
Every row of the main policy ledger, for the CURRENT / ILLUSTRATED NON-GUARANTEED scenario only: the column group labeled e.g. "Non-Guaranteed Illustrated", "Current", "Current Illustrated Values", "Illustrated Values (5.97%)" or "Non-Guaranteed Assumptions - Current" — the scenario at the highest illustrated rate. Never use Guaranteed, Midpoint or Alternate columns.
- Each row is an array: [policyYear, age, premiumOutlay, accumulationValue, cashSurrenderValue, deathBenefit].
- policyYear and age exactly as printed on that row (some ledgers print age first, some print every year, some skip years — copy what is printed, never fill gaps).
- accumulationValue is also called account value, policy value or accumulated value; cashSurrenderValue is also called surrender value or net cash value; deathBenefit is also called net death benefit. Use null for a column that does not exist.
- Use the main ledger once. Ignore the same values repeated in cost-and-expense summaries, IRR reports or numeric summaries.
- The ledger usually continues across several pages: keep going to its very last row (typically age 95–121). A lapse in the Guaranteed or Alternate scenario does NOT end the current scenario.
- Skip only rows where the current scenario itself shows "Lapse", "*" or no values.

LIVING BENEFITS
One entry per accelerated death benefit / living benefit rider that this illustration lists as INCLUDED or attached to THIS policy (riders list, rider descriptions, benefit summaries). Do not add benefits that only appear in generic marketing text.
- type: terminal, chronic, critical_illness, critical_injury, alzheimers, confined_care or other.
- riderName: as printed.
- maxPercentOfDeathBenefit: the stated maximum share of the death benefit that can be accelerated, e.g. "up to 95% of the base death benefit" → 95; else null.
- maxAmount: a stated maximum dollar amount that can be accelerated for this policy, e.g. "Initial Maximum Acceleration: $297,545"; else null. Never use program-wide limits such as "$1,000,000 on all policies".
- examples: EVERY dollar amount the illustration shows for this benefit on this policy — when a table gives amounts by age and by severity or life expectancy, include every cell. For each: age (null when not tied to an age), amount, frequency, kind and label.
  - frequency: lump_sum, monthly or annual. Chronic illness benefits are usually paid monthly or yearly: an amount described as annual, per year, or "for the first claim year" is annual.
  - kind: "payout" = the amount actually paid to the client (discounted benefit); "max_acceleration" = the amount of death benefit accelerated, before discounts.
  - label: the severity, life-expectancy or other qualifier printed with the amount (e.g. "Category 4 Critical", "3 Year LE"), else null.

otherRiders: names of any other riders included.`;

const str = { type: ["string", "null"] };
const num = { type: ["number", "null"] };
const int = { type: ["integer", "null"] };

function strictObject(properties: Record<string, unknown>) {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

function nullableEnum(values: readonly string[]) {
  return { anyOf: [{ type: "string", enum: values }, { type: "null" }] };
}

const EXTRACTION_SCHEMA = strictObject({
  carrierName: str,
  issuingCompany: str,
  issuerAddress: str,
  productName: str,
  policyForm: str,
  preparedDate: str,
  insured: strictObject({
    name: str,
    gender: nullableEnum(["Male", "Female"]),
    issueAge: int,
    riskClass: str,
    state: str,
  }),
  agent: strictObject({
    name: str,
    addressLines: { type: "array", items: { type: "string" } },
    phone: str,
    email: str,
    license: str,
  }),
  premium: strictObject({ amount: num, mode: nullableEnum(PREMIUM_MODES) }),
  initialDeathBenefit: num,
  deathBenefitOption: str,
  illustratedRate: num,
  // Arrays, not objects: a full ledger is ~80 rows and keys would triple the output (and latency).
  ledger: { type: "array", items: { type: "array", items: num } },
  livingBenefits: {
    type: "array",
    items: strictObject({
      type: { type: "string", enum: LIVING_BENEFIT_TYPES },
      riderName: { type: "string" },
      maxPercentOfDeathBenefit: num,
      maxAmount: num,
      examples: {
        type: "array",
        items: strictObject({
          age: int,
          amount: { type: "number" },
          frequency: { type: "string", enum: ["lump_sum", "monthly", "annual"] },
          kind: { type: "string", enum: ["payout", "max_acceleration"] },
          label: str,
        }),
      },
    }),
  },
  otherRiders: { type: "array", items: { type: "string" } },
});

function digitDensity(text: string): number {
  return text.length === 0 ? 0 : (text.match(/\d/g)?.length ?? 0) / text.length;
}

/**
 * Joins the pages with markers, dropping the least number-dense pages (index disclaimers, legal
 * boilerplate) first when the whole document is over the cap.
 */
export function prepareModelInput(pages: string[]): { text: string; droppedPages: number[] } {
  const total = pages.reduce((sum, page) => sum + page.length, 0);
  const dropped = new Set<number>();
  if (total > MAX_INPUT_CHARS) {
    let remaining = total;
    const candidates = pages
      .map((page, i) => ({ i, density: digitDensity(page), length: page.length }))
      .filter((page) => page.i >= ALWAYS_KEEP_PAGES)
      .sort((a, b) => a.density - b.density);
    for (const page of candidates) {
      if (remaining <= MAX_INPUT_CHARS) break;
      dropped.add(page.i);
      remaining -= page.length;
    }
  }
  const text = pages
    .map((page, i) => (dropped.has(i) ? null : `=== PAGE ${i + 1} ===\n${page}`))
    .filter((block): block is string => block !== null)
    .join("\n\n");
  return { text, droppedPages: [...dropped].map((i) => i + 1).sort((a, b) => a - b) };
}

export type ExtractIllustrationResult =
  | { ok: true; extraction: IllustrationExtraction }
  | { ok: false; error: string };

export async function extractIllustration(pages: string[]): Promise<ExtractIllustrationResult> {
  const { text, droppedPages } = prepareModelInput(pages);
  const result = await chatJsonSchema<RawExtraction>({
    system: SYSTEM_PROMPT,
    user: text,
    schemaName: "illustration_extraction",
    schema: EXTRACTION_SCHEMA,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  if (!result.ok) return result;

  const normalized = normalizeExtraction(result.data, {
    model: result.model,
    pageCount: pages.length,
    sentChars: text.length,
    droppedPages,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  });
  return { ok: true, extraction: groundExtraction(normalized, buildNumberIndex(pages)) };
}
