/**
 * What a quote screen fills in on the Health Coverage application.
 *
 * The deck's quote slide and /impact's quote screen ask two things: how many people (1, 2, or
 * "3 or more") and the oldest one's date of birth. Whoever answered shouldn't have to type it again,
 * so the application starts from it:
 *
 * | Quote                                        | hasDependents | coverageType | Applicant DOB | Who else to cover            |
 * |----------------------------------------------|---------------|--------------|---------------|------------------------------|
 * | 1 person, 18+ (65+ too)                      | "no"          | "Individual" | = oldest DOB  | –                            |
 * | 2 or 3+, applicant DOB blank                 | "yes"         | –            | asked (below) | "No" → oldest DOB, first empty row |
 * | 2 or 3+, applicant DOB = the oldest          | "yes"         | –            | kept          | –                            |
 * | 2 or 3+, applicant younger than the oldest   | "yes"         | –            | kept          | oldest DOB, first empty row  |
 * | applicant older than the "oldest" (any size) | –             | –            | kept          | – (a contradiction)          |
 * | oldest person under 18                       | –             | –            | never         | –                            |
 *
 * plus the plan and its price, whatever the household. The rules around it:
 *  - Only blanks are filled; nothing on the form is replaced. The one exception is the plan: a deck
 *    tap arriving live in the agent's open form replaces it (the agent and the client deciding now),
 *    unless the deck sent it on its own (`auto`).
 *  - The household part runs at most once per quote (its id, and the ids before it, stay in
 *    `data.impactQuote`), so an answer cleared on the form is never filled back in, and never on a
 *    submitted intake. An older quote from the same kind of screen (same device clock) never
 *    replaces the one on file; across screens only the id counts, since a phone's clock and the
 *    agent's computer's can disagree.
 *  - The quote on file takes a later pick (its plan, price and time) only when that pick came with
 *    the same quote: a tab's copy of another quote can be older than the one saved, and writing it
 *    back would undo what another tab recorded.
 *  - "3 or more" never guesses how many rows to create.
 *  - A one-person quote on a form that already says others are covered is a contradiction too: it
 *    fills nothing but the plan.
 *  - Health Coverage only: a config with an `impactPlan` field.
 *  - The form calls this only on answers just read from the server, so a stale tab never writes
 *    derived values over what another tab saved.
 *
 * The one-tap question ("Is this your date of birth?") is `dobQuestion` / `answerDobQuestion`, and
 * `applicantDobTyped` reads a date typed while it is open: the same date is a Yes, a later one a No,
 * an earlier one closes it. The form decides that once the person leaves the date
 * (`settleTypedDob`), so a year the selects pass through on the way never counts.
 *
 * `data.impactQuote` is a hidden key: it survives sanitizing, and the CRM payload, the summary, the
 * PDF/email and the completion check all walk the config's sections, so none of them sees it.
 *
 * Pure (no DOM, no storage): the offline test (`pnpm test:quote-prefill`) imports it.
 */

import { emptyRow, fieldByKey, isRowFilled } from "@/lib/intake-core/fields";
import type { IntakeData, IntakeField, IntakeSection, RepeaterRow } from "@/lib/intake-core/types";
import { ageOn, isQuoteBlock, type ImpactTierKey, type QuoteBlock } from "./plans";
import type { PlanChoice } from "./sync";

/** Where the quote lives on the intake's answers. */
export const QUOTE_KEY = "impactQuote";

/** The answers a quote fills: the shared ancillary keys Health Coverage is built on. */
const APPLICANT_DOB = "dateOfBirth";
const HAS_DEPENDENTS = "hasDependents";
const COVERAGE_TYPE = "coverageType";
const DEPENDENTS = "dependents";
const JUST_ME = "Individual";

export type DobOwner = "applicant" | "other";

/** `data.impactQuote`. */
export type StoredQuote = QuoteBlock & {
  /** The plan picked with it. */
  tier: ImpactTierKey | null;
  monthly: number | null;
  /** When a pick from a quote screen last went into the plan (ISO). */
  pickedAt?: string;
  /** When the household part ran (ISO). */
  prefilledAt?: string;
  /** The one-tap question's answer. It only hides the question: nothing is filled from it later. */
  dobOwner?: DobOwner;
  /** Earlier quotes whose household already went into this intake (ids, newest last): never again. */
  ran?: string[];
};

/** How many earlier quote ids `ran` keeps. */
const MAX_RAN = 10;

export type PrefillContext = {
  /** The form's sections. */
  sections: IntakeSection[];
  /** The intake was submitted: nothing changes. */
  completed: boolean;
  /** A deck pick arriving now in an open form: a tapped (not `auto`) plan replaces the form's. */
  live?: boolean;
  /**
   * Not answers just read from the server (a pick arriving live, or a tab with unsaved edits): the
   * plan only. A new quote isn't recorded, so its household runs on the next fresh read.
   */
  planOnly?: boolean;
  now?: Date;
};

export type PrefillResult = { data: IntakeData; added: boolean };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isDob = (value: string): boolean => ageOn(value) !== null;

function planFieldOf(sections: IntakeSection[]): IntakeField | undefined {
  return sections.flatMap((s) => s.fields).find((f) => f.type === "impactPlan");
}

/** The quote on the answers, when there is a well-formed one. */
export function storedQuote(data: IntakeData): StoredQuote | null {
  const value = data[QUOTE_KEY];
  return isQuoteBlock(value) ? (value as StoredQuote) : null;
}

/** A stored plan choice with the quote block kept apart from it (sessionStorage or a broadcast). */
export function choiceWithQuote(choice: PlanChoice | null, block: QuoteBlock | null): PlanChoice | null {
  if (!block) return choice;
  return { ...(choice ?? { tier: null, monthly: null }), quote: block };
}

/** Fill one answer when the form has the question, it is blank, and (for a list) the value is an option. */
function fillBlank(data: IntakeData, sections: IntakeSection[], key: string, value: string): void {
  const field = fieldByKey(sections, key);
  if (!field || str(data[key])) return;
  if (field.options && !field.options.some((o) => o.value === value)) return;
  data[key] = value;
}

/**
 * The oldest person goes in "Who else to cover": the first empty row, or a new one while there's
 * room. Nothing when the form says nobody else is covered (a row would hide under "No"), or when
 * someone there already has that date.
 */
function addOldest(data: IntakeData, oldestDob: string, sections: IntakeSection[]): PrefillResult {
  const field = fieldByKey(sections, DEPENDENTS);
  const hasDependents = str(data[HAS_DEPENDENTS]);
  if (!field || field.type !== "repeater" || hasDependents === "no") return { data, added: false };
  const rows: RepeaterRow[] = Array.isArray(data[DEPENDENTS]) ? [...(data[DEPENDENTS] as RepeaterRow[])] : [];
  if (rows.some((row) => str(row?.dateOfBirth) === oldestDob)) return { data, added: false };
  const blankAt = rows.findIndex((row) => !isRowFilled(field, row ?? {}));
  if (blankAt >= 0) rows[blankAt] = { ...emptyRow(field), ...rows[blankAt], dateOfBirth: oldestDob };
  else if (rows.length < (field.maxRows ?? 8)) rows.push({ ...emptyRow(field), dateOfBirth: oldestDob });
  else return { data, added: false };
  const next: IntakeData = { ...data, [DEPENDENTS]: rows };
  fillBlank(next, sections, HAS_DEPENDENTS, "yes");
  return { data: next, added: true };
}

/** The plan and its price: a blank plan takes the pick; a live tap replaces it. */
function applyPlan(
  data: IntakeData,
  choice: PlanChoice,
  field: IntakeField,
  ctx: PrefillContext,
  now: string
): IntakeData {
  if (!choice.tier) return data;
  const current = str(data[field.key]);
  if (current && !(ctx.live && !choice.auto)) return data;
  const monthly = choice.monthly !== null ? choice.monthly.toFixed(2) : null;
  const pairedKey = field.pairedKey;
  const samePrice = !pairedKey || monthly === null || str(data[pairedKey]) === monthly;
  if (current === choice.tier && samePrice) return data;
  const next: IntakeData = { ...data, [field.key]: choice.tier };
  if (pairedKey && monthly !== null) next[pairedKey] = monthly;
  // Only a pick that came with the quote on file updates it (see the rules above).
  const stored = storedQuote(data);
  if (stored && choice.quote?.id === stored.id) {
    next[QUOTE_KEY] = { ...stored, tier: choice.tier, monthly: choice.monthly, pickedAt: choice.at ?? now };
  }
  return next;
}

function ranIds(stored: StoredQuote): string[] {
  return Array.isArray(stored.ran) ? stored.ran.filter((id): id is string => typeof id === "string") : [];
}

/**
 * A quote the household part hasn't run for on this intake: neither the one on file nor one before
 * it. Two quotes from the same kind of screen share a device clock, so the older of those is out of
 * date; across screens (the client's phone on /impact, the agent's computer on the deck) the clocks
 * can disagree, so there a new id is enough.
 */
function isNewQuote(data: IntakeData, block: QuoteBlock): boolean {
  const stored = storedQuote(data);
  if (!stored) return true;
  if (block.id === stored.id || ranIds(stored).includes(block.id)) return false;
  return block.source !== stored.source || Date.parse(block.at) > Date.parse(stored.at);
}

/** The block's own fields, whatever else a page sent along with it. */
function blockFields(b: QuoteBlock): QuoteBlock {
  return {
    id: b.id,
    at: b.at,
    source: b.source,
    asked: b.asked,
    priced: b.priced,
    oldestDob: b.oldestDob,
    senior: b.senior,
    under18: b.under18,
  };
}

/** The table above, once per quote. The quote is recorded whatever it fills. */
function applyHousehold(
  data: IntakeData,
  choice: PlanChoice,
  block: QuoteBlock,
  sections: IntakeSection[],
  now: string
): IntakeData {
  const before = storedQuote(data);
  const ran = before ? [...ranIds(before).filter((id) => id !== before.id), before.id].slice(-MAX_RAN) : [];
  const record: StoredQuote = {
    ...blockFields(block),
    tier: choice.tier,
    monthly: choice.monthly,
    pickedAt: choice.at ?? now,
    prefilledAt: now,
    ...(ran.length ? { ran } : {}),
  };
  const next: IntakeData = { ...data, [QUOTE_KEY]: record };
  // A child as the oldest person: that date is never the applicant's, and the size alone says too little.
  if (block.under18) return next;
  const applicant = str(data[APPLICANT_DOB]);
  const oldest = block.oldestDob;
  // An applicant older than the household's oldest person: the quote doesn't describe this form.
  if (isDob(applicant) && applicant < oldest) return next;

  if (block.asked === 1) {
    // Just the applicant, unless the form already covers other people: then the two disagree.
    if (str(data[HAS_DEPENDENTS]) === "yes") return next;
    fillBlank(next, sections, HAS_DEPENDENTS, "no");
    fillBlank(next, sections, COVERAGE_TYPE, JUST_ME);
    fillBlank(next, sections, APPLICANT_DOB, oldest);
    return next;
  }

  // Two or more. Who they are (a spouse? children?) is the form's question, so coverage type waits.
  fillBlank(next, sections, HAS_DEPENDENTS, "yes");
  // Blank: the one-tap question asks whose date it is. The same date: the applicant is the oldest.
  if (!applicant || !isDob(applicant) || applicant === oldest) return next;
  // The applicant is younger, so the oldest is someone else on the plan.
  return addOldest(next, oldest, sections).data;
}

/**
 * Fill in what `choice` (and the quote riding on it) says about this application, following the
 * table above. Returns `data` itself when nothing changes.
 */
export function applyQuotePrefill(data: IntakeData, choice: PlanChoice | null, ctx: PrefillContext): IntakeData {
  if (!choice || ctx.completed) return data;
  const plan = planFieldOf(ctx.sections);
  if (!plan) return data;
  const now = (ctx.now ?? new Date()).toISOString();
  let next = applyPlan(data, choice, plan, ctx, now);
  const block = choice.quote;
  if (block && !ctx.planOnly && isNewQuote(next, block)) next = applyHousehold(next, choice, block, ctx.sections, now);
  return next;
}

/**
 * The one-tap question above the applicant's date of birth: did the quote use theirs? Asked for a
 * household of two or more while that date is blank, until answered, and not when someone in
 * "Who else to cover" already has the quote's date.
 */
export function dobQuestion(data: IntakeData): { oldestDob: string } | null {
  const quote = storedQuote(data);
  if (!quote || quote.dobOwner || quote.under18 || quote.asked === 1) return null;
  if (str(data[APPLICANT_DOB])) return null;
  const rows = Array.isArray(data[DEPENDENTS]) ? (data[DEPENDENTS] as RepeaterRow[]) : [];
  if (rows.some((row) => str(row?.dateOfBirth) === quote.oldestDob)) return null;
  return { oldestDob: quote.oldestDob };
}

/**
 * The answer: "applicant" fills their date of birth; "other" puts it in "Who else to cover"
 * (`added`), except when the form says nobody else is covered, where it writes nothing. Either way
 * the question closes.
 */
export function answerDobQuestion(data: IntakeData, owner: DobOwner, sections: IntakeSection[]): PrefillResult {
  const question = dobQuestion(data);
  const quote = storedQuote(data);
  if (!question || !quote) return { data, added: false };
  const answered: IntakeData = { ...data, [QUOTE_KEY]: { ...quote, dobOwner: owner } };
  if (owner === "other") return addOldest(answered, question.oldestDob, sections);
  if (fieldByKey(sections, APPLICANT_DOB)) answered[APPLICANT_DOB] = question.oldestDob;
  return { data: answered, added: false };
}

/**
 * The applicant's date of birth was typed (`before` is the answers just before). While the
 * question is open, the quote's own date counts as "yes, mine", a later one (a younger applicant)
 * as "someone else's", and an earlier one just closes it: nothing more is written.
 */
export function applicantDobTyped(before: IntakeData, dob: string, sections: IntakeSection[]): PrefillResult {
  const typed: IntakeData = { ...before, [APPLICANT_DOB]: dob };
  const question = dobQuestion(before);
  const quote = storedQuote(before);
  if (!question || !quote || !isDob(dob) || dob < question.oldestDob) return { data: typed, added: false };
  const owner: DobOwner = dob === question.oldestDob ? "applicant" : "other";
  const answered: IntakeData = { ...typed, [QUOTE_KEY]: { ...quote, dobOwner: owner } };
  return owner === "other" ? addOldest(answered, question.oldestDob, sections) : { data: answered, added: false };
}

/**
 * The form's way in to `applicantDobTyped`: the applicant's date was typed while the question was
 * open, and the person has now left it, so only the date they ended on counts (selects step through
 * other years on the way, and each step is a complete date). Judged on the quote on file, which may
 * have been answered meanwhile in another tab. Returns `data` itself when it settles nothing.
 */
export function settleTypedDob(data: IntakeData, sections: IntakeSection[]): PrefillResult {
  const dob = str(data[APPLICANT_DOB]);
  if (!isDob(dob)) return { data, added: false };
  const result = applicantDobTyped({ ...data, [APPLICANT_DOB]: "" }, dob, sections);
  return result.data[QUOTE_KEY] === data[QUOTE_KEY] ? { data, added: false } : result;
}
