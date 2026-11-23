/**
 * Offline checks for what an Impact quote fills in on the Health Coverage application
 * (`lib/impact-quote/prefill.ts`), and for how a pick travels there (`lib/impact-quote/sync.ts`).
 *
 * One case per row of the pre-fill table, the one-tap question's answers, a date typed while it is
 * open, once per quote, a cleared date never filled back in, stale and spent /impact picks, picks
 * the deck sent on its own (`auto`), under-18 and 65+ households, and a submitted intake left alone.
 * Storage is an in-memory stand-in, so the sync helpers run as they do in a browser tab.
 *
 * No network, no database, no API keys. Run with: pnpm test:quote-prefill
 */

import { stableJson } from "../lib/intake-core/diff";
import { healthAlternativeIntake } from "../lib/intake-configs/health-alternative";
import { dentalVisionIntake } from "../lib/intake-configs/dental-vision";
import {
  answerDobQuestion,
  applicantDobTyped,
  applyQuotePrefill,
  choiceWithQuote,
  dobQuestion,
  settleTypedDob,
  storedQuote,
  type PrefillContext,
} from "../lib/impact-quote/prefill";
import { diffIntakeData } from "../lib/intake-core/diff";
import { isQuoteBlock, makeQuoteBlock, pricedMembers, type QuoteBlock } from "../lib/impact-quote/plans";
import {
  GUIDE_CHOICE_TTL_MS,
  GUIDE_SCOPE,
  clearQuoteBlock,
  markPlanChoiceApplied,
  planChoiceUsable,
  publishPlanChoice,
  readPlanChoice,
  readQuoteBlock,
  stashQuoteBlock,
  subscribePlanChoice,
  type PlanChoice,
} from "../lib/impact-quote/sync";
import type { IntakeData, RepeaterRow } from "../lib/intake-core/types";

/** A browser tab's Storage, in memory. */
class MemoryStorage {
  private items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
}
const local = new MemoryStorage();
const session = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true, writable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: session, configurable: true, writable: true });

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);
const show = (v: unknown) => JSON.stringify(v);

const sections = healthAlternativeIntake.sections;
const NOW = new Date("2026-11-22T18:00:00.000Z");
const ctx = (extra: Partial<PrefillContext> = {}): PrefillContext => ({ sections, completed: false, now: NOW, ...extra });

const OLDEST = "1970-05-20";

function block(overrides: Partial<QuoteBlock> = {}): QuoteBlock {
  return {
    id: "q-1",
    at: "2026-11-22T17:00:00.000Z",
    source: "deck",
    asked: 2,
    priced: 2,
    oldestDob: OLDEST,
    senior: false,
    under18: false,
    ...overrides,
  };
}

function pick(overrides: Partial<PlanChoice> = {}): PlanChoice {
  return { tier: "esencial", monthly: 412, at: "2026-11-22T17:00:05.000Z", ...overrides };
}

const quoted = (b: QuoteBlock, overrides: Partial<PlanChoice> = {}): PlanChoice => pick({ ...overrides, quote: b });
const rows = (data: IntakeData): RepeaterRow[] => (Array.isArray(data.dependents) ? (data.dependents as RepeaterRow[]) : []);
const blank = (v: unknown) => v === undefined || v === "";

console.log("\nPlan / price (any quote with a plan)");
{
  const filled = applyQuotePrefill({}, pick(), ctx());
  check("a blank plan takes the pick", filled.impactPlan === "esencial" && filled.impactMonthly === "412.00", show(filled));
  check("a pick with no quote stores no quote", storedQuote(filled) === null);

  const onForm = { impactPlan: "plus", impactMonthly: "455.00" };
  check("a plan on the form stays (load, reload)", applyQuotePrefill(onForm, pick(), ctx()) === onForm);

  const tapped = applyQuotePrefill(onForm, pick({ tier: "premium", monthly: 520 }), ctx({ live: true }));
  check("a live deck tap replaces it", tapped.impactPlan === "premium" && tapped.impactMonthly === "520.00", show(tapped));

  const autoLive = applyQuotePrefill(onForm, pick({ tier: "premium", monthly: 520, auto: true }), ctx({ live: true }));
  check("a live `auto` pick never replaces a plan", autoLive === onForm);

  const autoBlank = applyQuotePrefill({}, pick({ auto: true }), ctx({ live: true }));
  check("an `auto` pick fills a blank plan", autoBlank.impactPlan === "esencial");

  const sameTap = applyQuotePrefill(onForm, pick({ tier: "plus", monthly: 455 }), ctx({ live: true }));
  check("a tap on the plan already there changes nothing", sameTap === onForm);

  const noTier = applyQuotePrefill({}, quoted(block({ asked: 1 }), { tier: null, monthly: null }), ctx());
  check(
    "a quote with no standard plan still fills the household",
    blank(noTier.impactPlan) && noTier.hasDependents === "no" && storedQuote(noTier)?.id === "q-1",
    show(noTier)
  );
}

console.log("\n1 person, 18+ (65+ too)");
{
  const one = applyQuotePrefill({}, quoted(block({ asked: 1, priced: 1 })), ctx());
  check("hasDependents = no", one.hasDependents === "no");
  check("coverage type = Individual", one.coverageType === "Individual");
  check("applicant DOB = the quote's", one.dateOfBirth === OLDEST);
  check("the quote is recorded, with when it ran", storedQuote(one)?.prefilledAt === NOW.toISOString(), show(one.impactQuote));
  check("no question for one person", dobQuestion(one) === null);

  const typed = { coverageType: "Individual + spouse", hasDependents: "no" };
  const kept = applyQuotePrefill(typed, quoted(block({ asked: 1, priced: 1 })), ctx());
  check("answers already on the form stay (blanks only)", kept.coverageType === "Individual + spouse", show(kept));

  const senior = applyQuotePrefill(
    {},
    quoted(block({ asked: 1, priced: 1, senior: true, oldestDob: "1955-02-03" })),
    ctx()
  );
  check(
    "65+: the same fills",
    senior.hasDependents === "no" && senior.coverageType === "Individual" && senior.dateOfBirth === "1955-02-03",
    show(senior)
  );

  const younger = applyQuotePrefill({ dateOfBirth: "1981-07-07" }, quoted(block({ asked: 1, priced: 1 })), ctx());
  check(
    "a different applicant DOB is kept; the size still fills",
    younger.dateOfBirth === "1981-07-07" && younger.hasDependents === "no" && younger.coverageType === "Individual",
    show(younger)
  );

  const covered = { hasDependents: "yes", dependents: [{ firstName: "Ana" }] };
  const disagree = applyQuotePrefill(covered, quoted(block({ asked: 1, priced: 1 })), ctx());
  check(
    "a form that already covers others: nothing but the record",
    disagree.hasDependents === "yes" && blank(disagree.coverageType) && blank(disagree.dateOfBirth),
    show(disagree)
  );
}

console.log("\n2 or 3+, applicant DOB blank");
{
  const two = applyQuotePrefill({}, quoted(block()), ctx());
  check("hasDependents = yes", two.hasDependents === "yes");
  check("coverage type stays blank", blank(two.coverageType));
  check("applicant DOB stays blank", blank(two.dateOfBirth));
  check("no row is added before the answer", rows(two).length === 0);
  check("the question asks about the quote's date", dobQuestion(two)?.oldestDob === OLDEST, show(dobQuestion(two)));

  const three = applyQuotePrefill({}, quoted(block({ asked: 3, priced: 3 })), ctx());
  check("3 or more: no rows guessed", rows(three).length === 0 && three.hasDependents === "yes", show(three));
  check("3 or more: the question too", dobQuestion(three)?.oldestDob === OLDEST);

  const listed = applyQuotePrefill({ dependents: [{ firstName: "Rosa", dateOfBirth: OLDEST }] }, quoted(block()), ctx());
  check("no question when someone listed already has that date", dobQuestion(listed) === null);
}

console.log("\n2 or 3+, applicant DOB = the oldest");
{
  const same2 = applyQuotePrefill({ dateOfBirth: OLDEST }, quoted(block()), ctx());
  check("hasDependents = yes", same2.hasDependents === "yes");
  check("DOB kept, no question, no row", same2.dateOfBirth === OLDEST && dobQuestion(same2) === null && rows(same2).length === 0);
}

console.log("\n2 or 3+, applicant younger than the oldest");
{
  const appended = applyQuotePrefill({ dateOfBirth: "1984-03-01" }, quoted(block()), ctx());
  check("DOB kept", appended.dateOfBirth === "1984-03-01");
  check("hasDependents = yes", appended.hasDependents === "yes");
  const added = rows(appended);
  check(
    "the oldest goes in a new row, every sub-field present",
    added.length === 1 && added[0].dateOfBirth === OLDEST && added[0].firstName === "" && "relationship" in added[0],
    show(added)
  );

  const withRows = {
    dateOfBirth: "1984-03-01",
    hasDependents: "yes",
    dependents: [{ firstName: "Ana", dateOfBirth: "2010-01-01" }, { firstName: "", dateOfBirth: "" }],
  };
  const intoEmpty = rows(applyQuotePrefill(withRows, quoted(block({ asked: 3, priced: 3 })), ctx()));
  check(
    "into the first empty row, nothing else touched",
    intoEmpty.length === 2 && intoEmpty[0].firstName === "Ana" && intoEmpty[1].dateOfBirth === OLDEST,
    show(intoEmpty)
  );

  const already = {
    dateOfBirth: "1984-03-01",
    hasDependents: "yes",
    dependents: [{ firstName: "Rosa", dateOfBirth: OLDEST }],
  };
  check("not twice when the oldest is already listed", rows(applyQuotePrefill(already, quoted(block()), ctx())).length === 1);

  const full = {
    dateOfBirth: "1984-03-01",
    hasDependents: "yes",
    dependents: Array.from({ length: 6 }, (_, i) => ({ firstName: `P${i}` })),
  };
  check("no row past the maximum", rows(applyQuotePrefill(full, quoted(block()), ctx())).length === 6);
}

console.log("\nContradictions: applicant older than the \"oldest\", or No while hasDependents = no");
{
  const older = applyQuotePrefill({ dateOfBirth: "1960-01-01" }, quoted(block()), ctx());
  check(
    "older applicant: no hasDependents, coverage type or rows",
    blank(older.hasDependents) && blank(older.coverageType) && rows(older).length === 0,
    show(older)
  );
  check("older applicant: DOB kept, the plan still fills", older.dateOfBirth === "1960-01-01" && older.impactPlan === "esencial");

  const olderOne = applyQuotePrefill({ dateOfBirth: "1960-01-01" }, quoted(block({ asked: 1, priced: 1 })), ctx());
  check("older applicant, one person: nothing either", blank(olderOne.hasDependents) && blank(olderOne.coverageType));

  const nobody = applyQuotePrefill({ hasDependents: "no" }, quoted(block()), ctx());
  check("hasDependents = no is kept", nobody.hasDependents === "no");
  const answeredNo = answerDobQuestion(nobody, "other", sections);
  check(
    "No while hasDependents = no: no row, nothing added",
    !answeredNo.added && rows(answeredNo.data).length === 0,
    show(answeredNo.data)
  );
  check("…and the question closes", dobQuestion(answeredNo.data) === null);

  const youngerNobody = applyQuotePrefill({ hasDependents: "no", dateOfBirth: "1984-03-01" }, quoted(block()), ctx());
  check("a younger applicant with hasDependents = no: no hidden row", rows(youngerNobody).length === 0);
}

console.log("\nOldest under 18");
{
  const kid = applyQuotePrefill({}, quoted(block({ asked: 2, oldestDob: "2012-06-01", under18: true })), ctx());
  check("never a DOB", blank(kid.dateOfBirth));
  check("no hasDependents or coverage type", blank(kid.hasDependents) && blank(kid.coverageType));
  check("no question", dobQuestion(kid) === null);
  check("the plan fills", kid.impactPlan === "esencial");
  const kidOne = applyQuotePrefill({}, quoted(block({ asked: 1, priced: 1, oldestDob: "2012-06-01", under18: true })), ctx());
  check("one child: no DOB either", blank(kidOne.dateOfBirth) && blank(kidOne.hasDependents));
}

console.log("\nStale / applied elsewhere / no quote block");
{
  const planOnly = applyQuotePrefill({}, pick(), ctx());
  check("no quote block: the plan only", planOnly.impactPlan === "esencial" && blank(planOnly.hasDependents));
  check("nothing to apply: nothing changes", applyQuotePrefill({ a: "1" }, null, ctx()).a === "1");

  const now = Date.parse("2026-11-22T18:00:00.000Z");
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
  check("a guide pick 1 h old applies", planChoiceUsable(pick({ at: hoursAgo(1) }), GUIDE_SCOPE, { now }));
  check("a guide pick 13 h old is stale", !planChoiceUsable(pick({ at: hoursAgo(13) }), GUIDE_SCOPE, { now }));
  check("a guide pick with no time is stale", !planChoiceUsable(pick({ at: undefined }), GUIDE_SCOPE, { now }));
  check("the TTL is 12 hours", GUIDE_CHOICE_TTL_MS === 12 * 3_600_000);
  check(
    "a guide pick applied to another intake doesn't apply",
    !planChoiceUsable(pick({ at: hoursAgo(1), appliedTo: "tok-A" }), GUIDE_SCOPE, { now, token: "tok-B" })
  );
  check(
    "…but still does on the intake it went into",
    planChoiceUsable(pick({ at: hoursAgo(1), appliedTo: "tok-A" }), GUIDE_SCOPE, { now, token: "tok-A" })
  );
  check("a deck (token) pick has no age limit", planChoiceUsable(pick({ at: undefined }), "tok-A", { now }));

  local.clear();
  session.clear();
  const guideBlock = block({ source: "guide", id: "g-1" });
  publishPlanChoice(GUIDE_SCOPE, { ...pick({ at: new Date().toISOString() }), quote: guideBlock });
  const raw = local.getItem("impact-plan:guide") ?? "";
  const kept = JSON.parse(raw) as Record<string, unknown>;
  check(
    "localStorage keeps the plan only: no answers, no birth date (the quote's id at most)",
    !("quote" in kept) && !raw.includes(OLDEST) && !("asked" in kept) && kept.quoteId === "g-1",
    raw
  );
  check("the fresh pick reads back", readPlanChoice(GUIDE_SCOPE, { token: "tok-A" })?.tier === "esencial");
  markPlanChoiceApplied(GUIDE_SCOPE, "tok-A");
  check("spent on tok-A: not for tok-B", readPlanChoice(GUIDE_SCOPE, { token: "tok-B" }) === null);
  check("…still for tok-A (a reload)", readPlanChoice(GUIDE_SCOPE, { token: "tok-A" })?.appliedTo === "tok-A");
  local.setItem("impact-plan:guide", JSON.stringify({ tier: "plus", monthly: 455, at: new Date(Date.now() - 13 * 3_600_000).toISOString() }));
  check("a stored guide pick 13 h old reads as nothing", readPlanChoice(GUIDE_SCOPE, { token: "tok-A" }) === null);
  local.setItem("impact-plan:guide", JSON.stringify({ tier: "nope", monthly: 1 }));
  check("junk in storage reads as nothing", readPlanChoice(GUIDE_SCOPE) === null);

  stashQuoteBlock(GUIDE_SCOPE, guideBlock);
  check("the answers stay in this tab's sessionStorage", readQuoteBlock(GUIDE_SCOPE)?.id === "g-1");
  clearQuoteBlock(GUIDE_SCOPE);
  check("…until cleared", readQuoteBlock(GUIDE_SCOPE) === null);
  session.setItem("impact-quote-block:guide", JSON.stringify({ ...guideBlock, oldestDob: "not a date" }));
  check("a malformed block reads as nothing", readQuoteBlock(GUIDE_SCOPE) === null);

  const merged = choiceWithQuote(null, guideBlock);
  check("answers with no stored pick: household only", merged?.tier === null && merged?.quote?.id === "g-1");
}

console.log("\nThe question's answers");
{
  const asked = applyQuotePrefill({}, quoted(block()), ctx());
  const yes = answerDobQuestion(asked, "applicant", sections);
  check("Yes: the applicant's DOB is the quote's", yes.data.dateOfBirth === OLDEST && !yes.added);
  check("Yes: kept as the answer, question closed", storedQuote(yes.data)?.dobOwner === "applicant" && dobQuestion(yes.data) === null);

  const no = answerDobQuestion(asked, "other", sections);
  check("No: the date goes in Who else to cover", no.added && rows(no.data)[0]?.dateOfBirth === OLDEST, show(no.data.dependents));
  check("No: applicant DOB stays blank", blank(no.data.dateOfBirth));
  check("No: kept as the answer, question closed", storedQuote(no.data)?.dobOwner === "other" && dobQuestion(no.data) === null);

  check("no question: an answer changes nothing", answerDobQuestion(yes.data, "other", sections).data === yes.data);
}

console.log("\nA date typed while the question is open");
{
  const asked = applyQuotePrefill({}, quoted(block()), ctx());
  const sameDate = applicantDobTyped(asked, OLDEST, sections);
  check("the same date counts as Yes", storedQuote(sameDate.data)?.dobOwner === "applicant" && !sameDate.added);

  const later = applicantDobTyped(asked, "1988-09-09", sections);
  check(
    "a later date counts as No: the oldest goes in a row",
    later.added && later.data.dateOfBirth === "1988-09-09" && rows(later.data)[0]?.dateOfBirth === OLDEST,
    show(later.data)
  );
  check("…kept as No", storedQuote(later.data)?.dobOwner === "other");

  const earlier = applicantDobTyped(asked, "1961-01-01", sections);
  check(
    "an earlier date closes the question and writes nothing else",
    earlier.data.dateOfBirth === "1961-01-01" &&
      !earlier.added &&
      rows(earlier.data).length === 0 &&
      !storedQuote(earlier.data)?.dobOwner &&
      dobQuestion(earlier.data) === null,
    show(earlier.data)
  );

  const partial = applicantDobTyped(asked, "", sections);
  check("an unfinished date does nothing", partial.data.dateOfBirth === "" && dobQuestion(partial.data) !== null);

  const closed = applicantDobTyped({ dateOfBirth: "1990-01-01" }, "1991-01-01", sections);
  check("with no question open it is just the date", closed.data.dateOfBirth === "1991-01-01" && !closed.added);
}

console.log("\nOnce per quote");
{
  const first = applyQuotePrefill({}, quoted(block({ asked: 1, priced: 1 })), ctx());
  const again = applyQuotePrefill(first, quoted(block({ asked: 1, priced: 1 })), ctx());
  check("the same quote again changes nothing (a reload)", again === first);

  const changed = { ...first, hasDependents: "yes" };
  check(
    "an answer changed on the form isn't put back",
    applyQuotePrefill(changed, quoted(block({ asked: 1, priced: 1 })), ctx()).hasDependents === "yes"
  );

  const later = block({ id: "q-2", at: "2026-11-22T17:30:00.000Z", asked: 2, priced: 2 });
  const second = applyQuotePrefill(
    { dateOfBirth: "", hasDependents: "", coverageType: "Individual" },
    quoted(later),
    ctx()
  );
  check("a new quote runs on the blanks", second.hasDependents === "yes" && storedQuote(second)?.id === "q-2");

  const older = block({ id: "q-0", at: "2026-11-22T16:00:00.000Z", asked: 1, priced: 1 });
  const notBack = applyQuotePrefill(second, quoted(older), ctx());
  check("an older quote never replaces a newer one", storedQuote(notBack)?.id === "q-2" && notBack.hasDependents === "yes");

  const skipped = applyQuotePrefill({}, quoted(block()), ctx({ planOnly: true }));
  check(
    "unsaved edits in the tab: the plan only, and the quote not recorded",
    skipped.impactPlan === "esencial" && storedQuote(skipped) === null && blank(skipped.hasDependents)
  );
  const later2 = applyQuotePrefill(skipped, quoted(block()), ctx());
  check("…so the next reload still fills the household", later2.hasDependents === "yes" && storedQuote(later2)?.id === "q-1");

  const tap = applyQuotePrefill(
    first,
    pick({ tier: "premium", monthly: 520, at: "2026-11-22T17:10:00.000Z", quote: block({ asked: 1, priced: 1 }) }),
    ctx({ live: true })
  );
  check(
    "a live tap on the same quote: plan replaced, pick time kept on the quote",
    tap.impactPlan === "premium" && storedQuote(tap)?.pickedAt === "2026-11-22T17:10:00.000Z",
    show(tap.impactQuote)
  );
  check("…and the household is not run again", tap.dateOfBirth === first.dateOfBirth && storedQuote(tap)?.prefilledAt === storedQuote(first)?.prefilledAt);
}

console.log("\nA cleared date of birth is never filled back in");
{
  const one = applyQuotePrefill({}, quoted(block({ asked: 1, priced: 1 })), ctx());
  const cleared = { ...one, dateOfBirth: "" };
  check("one person: cleared stays cleared", applyQuotePrefill(cleared, quoted(block({ asked: 1, priced: 1 })), ctx()).dateOfBirth === "");

  const yes = answerDobQuestion(applyQuotePrefill({}, quoted(block()), ctx()), "applicant", sections).data;
  const clearedYes = { ...yes, dateOfBirth: "" };
  check("after Yes: the question stays closed", dobQuestion(clearedYes) === null);
  check("after Yes: a reload doesn't refill it", applyQuotePrefill(clearedYes, quoted(block()), ctx()).dateOfBirth === "");
}

console.log("\nA tab's older copy of the quote is never written back (picks arriving live)");
{
  // Both tabs had q-1 (one person, its DOB filled); the DOB was then cleared and saved.
  const q1 = block({ asked: 1, priced: 1, oldestDob: "1960-01-01" });
  const q2 = block({ id: "q-2", at: "2026-11-22T17:05:00.000Z", asked: 1, priced: 1, oldestDob: "1975-03-03" });
  let server: IntakeData = { ...applyQuotePrefill({}, quoted(q1, { monthly: 900 }), ctx()), dateOfBirth: "" };
  const agentCopy = JSON.parse(JSON.stringify(server)) as IntakeData;
  // q-2's pick reaches the agent's tab while it has unsaved edits: the plan only, on its q-1 copy.
  const agentTab = applyQuotePrefill(agentCopy, pick({ monthly: 450, at: q2.at }), ctx({ live: true, planOnly: true }));
  const agentPatch = diffIntakeData(agentCopy, agentTab);
  check("the plan's price goes in", agentTab.impactMonthly === "450.00", show(agentTab));
  check("…but not the tab's copy of the quote", !("impactQuote" in agentPatch), show(Object.keys(agentPatch)));
  // The presenting tab fills q-2 on saved answers, and the client clears the DOB it filled.
  server = applyQuotePrefill(server, quoted(q2, { monthly: 450, at: q2.at }), ctx());
  check("(q-2 filled the DOB in the presenting tab)", server.dateOfBirth === "1975-03-03");
  server = { ...server, dateOfBirth: "" };
  // The agent tab's save lands last; then it reloads, q-2 still in hand.
  server = { ...server, ...agentPatch };
  const reloaded = applyQuotePrefill(server, quoted(q2, { monthly: 450, at: q2.at }), ctx());
  check("the cleared DOB stays cleared", reloaded.dateOfBirth === "" && storedQuote(reloaded)?.id === "q-2", show(reloaded));

  const onFile = applyQuotePrefill({}, quoted(block()), ctx());
  const other = applyQuotePrefill(
    onFile,
    quoted(block({ id: "q-9", at: "2026-11-22T17:50:00.000Z" }), { tier: "premium", monthly: 520 }),
    ctx({ live: true, planOnly: true })
  );
  check(
    "a live pick from another quote changes the plan, not the quote on file",
    other.impactPlan === "premium" && other.impactQuote === onFile.impactQuote,
    show(other.impactQuote)
  );

  const extra = { ...block({ id: "q-x", at: "2026-11-22T17:59:00.000Z" }), dobOwner: "applicant" } as QuoteBlock;
  const recorded = applyQuotePrefill({}, quoted(extra), ctx());
  check("a block carrying more than its fields records only its own", !storedQuote(recorded)?.dobOwner && dobQuestion(recorded) !== null);
}

console.log("\nClocks: a phone's and the agent's computer's can disagree");
{
  // The client's phone runs fast: its /impact quote says 20:00; the deck quotes at 18:30.
  const future = block({ id: "g-1", source: "guide", asked: 1, priced: 1, at: "2026-11-22T20:00:00.000Z" });
  const guide = applyQuotePrefill({}, quoted(future), ctx());
  const deck = applyQuotePrefill({ ...guide, hasDependents: "" }, quoted(block({ id: "d-1", at: "2026-11-22T18:30:00.000Z" })), ctx());
  check(
    "a deck quote still runs after a /impact quote from a clock that runs fast",
    storedQuote(deck)?.id === "d-1" && deck.hasDependents === "yes",
    show(deck.impactQuote)
  );
  check("…and the earlier quote's id is kept", storedQuote(deck)?.ran?.includes("g-1") === true, show(storedQuote(deck)?.ran));
  const again = applyQuotePrefill({ ...deck, dateOfBirth: "" }, quoted(future), ctx());
  check(
    "a quote that already ran never runs again, whatever its clock",
    again.dateOfBirth === "" && storedQuote(again)?.id === "d-1",
    show(again)
  );
}

console.log("\nA date typed while the question is open counts once the person leaves it");
{
  const asked = applyQuotePrefill({}, quoted(block()), ctx());
  // A keyboard on a closed select passes 1999 on the way to 1970, the quote's own date: only the
  // date it ends on is settled.
  const ended = { ...asked, dateOfBirth: OLDEST };
  const settled = settleTypedDob(ended, sections);
  check(
    "the date it ended on is the quote's: Yes, and no row",
    storedQuote(settled.data)?.dobOwner === "applicant" && rows(settled.data).length === 0 && !settled.added,
    show(settled.data)
  );

  const younger = settleTypedDob({ ...asked, dateOfBirth: "1988-09-09" }, sections);
  check(
    "a later date: No, the oldest goes in a row",
    younger.added && rows(younger.data)[0]?.dateOfBirth === OLDEST && younger.data.dateOfBirth === "1988-09-09",
    show(younger.data)
  );

  const earlier = { ...asked, dateOfBirth: "1961-01-01" };
  check("an earlier date settles nothing", settleTypedDob(earlier, sections).data === earlier);

  const unfinished = { ...asked, dateOfBirth: "" };
  check(
    "no complete date: nothing, and the question stays",
    settleTypedDob(unfinished, sections).data === unfinished && dobQuestion(unfinished) !== null
  );

  const elsewhere = { ...answerDobQuestion(asked, "applicant", sections).data, dateOfBirth: "1988-09-09" };
  check("answered meanwhile in another tab: nothing", settleTypedDob(elsewhere, sections).data === elsewhere);
}

console.log("\nA re-tap on /impact keeps a spent pick spent");
{
  local.clear();
  const g1 = block({ source: "guide", id: "g-1" });
  publishPlanChoice(GUIDE_SCOPE, { ...pick({ at: new Date().toISOString() }), quote: g1 });
  markPlanChoiceApplied(GUIDE_SCOPE, "tok-A");
  publishPlanChoice(GUIDE_SCOPE, { ...pick({ tier: "plus", monthly: 455, at: new Date().toISOString() }), quote: g1 });
  check("the same quote tapped again: still spent for another intake", readPlanChoice(GUIDE_SCOPE, { token: "tok-B" }) === null);
  check("…and the new tap still reaches the intake it went into", readPlanChoice(GUIDE_SCOPE, { token: "tok-A" })?.tier === "plus");
  publishPlanChoice(GUIDE_SCOPE, { ...pick({ at: new Date().toISOString() }), quote: block({ source: "guide", id: "g-2" }) });
  check("a new quote frees it", readPlanChoice(GUIDE_SCOPE, { token: "tok-B" })?.tier === "esencial");
}

console.log("\nSubmitted intake, other lines of business");
{
  const done = { impactPlan: "", dateOfBirth: "", hasDependents: "" };
  check("a submitted intake is left alone", applyQuotePrefill(done, quoted(block({ asked: 1, priced: 1 })), ctx({ completed: true })) === done);
  check("…even a live tap", applyQuotePrefill(done, pick(), ctx({ completed: true, live: true })) === done);
  const dental = { dateOfBirth: "" };
  check(
    "Health Coverage only (no impactPlan field: nothing)",
    applyQuotePrefill(dental, quoted(block({ asked: 1, priced: 1 })), { ...ctx(), sections: dentalVisionIntake.sections }) === dental
  );
}

console.log("\nReloads converge (nothing to save the second time)");
{
  const first = applyQuotePrefill({}, quoted(block({ asked: 1, priced: 1 })), ctx());
  const reloaded = applyQuotePrefill(JSON.parse(JSON.stringify(first)) as IntakeData, quoted(block({ asked: 1, priced: 1 })), ctx());
  check("the same answers come out", same(first, reloaded));
}

console.log("\nQuote blocks and Impact's priced size");
{
  check("65+ prices one person", pricedMembers(2, 70) === 1 && pricedMembers(1, 65) === 1);
  check("under 65 prices as asked", pricedMembers(3, 40) === 3 && pricedMembers(2, null) === 2);
  const made = makeQuoteBlock("deck", 3, OLDEST, { members: 3, senior: false, under18: false }, NOW);
  check("a new block is well formed", isQuoteBlock(made) && made.at === NOW.toISOString() && made.id.length > 0, show(made));
  check("two blocks never share an id", makeQuoteBlock("deck", 1, OLDEST, { members: 1, senior: false, under18: false }).id !== made.id);
  check("junk is not a block", !isQuoteBlock({ ...made, asked: 4 }) && !isQuoteBlock({ ...made, oldestDob: "1970-13-40" }) && !isQuoteBlock(null));
}

/** The broadcast: the quote rides along; a pick with no plan only counts with one. */
async function broadcastChecks() {
  console.log("\nThe live broadcast");
  const received: PlanChoice[] = [];
  const unsubscribe = subscribePlanChoice("tok-live", (choice) => received.push(choice));
  publishPlanChoice("tok-live", quoted(block(), { at: new Date().toISOString() }));
  publishPlanChoice("tok-live", { tier: null, monthly: null });
  publishPlanChoice("tok-live", { tier: null, monthly: null, quote: block({ id: "q-9" }) });
  await new Promise((resolve) => setTimeout(resolve, 300));
  unsubscribe();
  check("the quote rides in the broadcast", received[0]?.quote?.id === "q-1", show(received));
  check("no plan and no quote: not delivered", received.length === 2, show(received));
  check("no plan with a quote: delivered", received[1]?.tier === null && received[1]?.quote?.id === "q-9");
  const stored = local.getItem("impact-plan:tok-live") ?? "";
  check("…while localStorage holds no answers", !("quote" in JSON.parse(stored)) && !stored.includes(OLDEST), stored);

  // A re-tap on a quote already spent on an intake: the broadcast never carries `appliedTo`.
  const spent: PlanChoice[] = [];
  const off = subscribePlanChoice(GUIDE_SCOPE, (choice) => spent.push(choice));
  local.clear();
  const g = block({ source: "guide", id: "g-live" });
  publishPlanChoice(GUIDE_SCOPE, { ...pick({ at: new Date().toISOString() }), quote: g });
  markPlanChoiceApplied(GUIDE_SCOPE, "tok-A");
  publishPlanChoice(GUIDE_SCOPE, { ...pick({ tier: "plus", monthly: 455, at: new Date().toISOString() }), quote: g });
  await new Promise((resolve) => setTimeout(resolve, 300));
  off();
  check("a re-tap's broadcast has no appliedTo", spent.length === 2 && spent.every((c) => !c.appliedTo), show(spent));
}

broadcastChecks()
  .catch((error) => {
    failed++;
    console.log(`  ✗ broadcast checks threw — ${error instanceof Error ? error.message : String(error)}`);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
