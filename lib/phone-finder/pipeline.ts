/**
 * The search itself, free of the database so the CLI and the offline tests can run it.
 *
 *   GET contact -> inputs -> (cooldown?) -> enough to search? -> daily slot
 *   -> Trestle on the phone on file -> EnformionGO (up to N name variants, stop at first match)
 *   -> Trestle on each new number (3 at a time) -> rank -> field text
 *
 * Retry policy, chosen so a retry almost never pays twice:
 *  - A Trestle failure DEGRADES: the number is shown without ✓, the run goes on.
 *  - An EnformionGO account error (401/403, unexpected 4xx) FAILS the run with a visible reason.
 *  - A transient GHL read or EnformionGO error RETRIES; at that point only the $0.035 primary
 *    check can have been paid.
 * The caller persists the returned text before writing it, so a failed CRM write retries without
 * any vendor call.
 */

import {
  classifyFound,
  derivePrimaryVerdict,
  extractCandidates,
  rankFound,
  type FoundNumber,
  type PrimaryVerdict,
} from "./classify";
import { PHONE_FINDER_LITIGATOR_TAG, TRESTLE_REAL_CONTACT_MILLS, type PhoneFinderConfig } from "./config";
import type { EnformionClient, EnformionResult } from "./enformion";
import { formatResultsText, type PhoneFinderOutcome, type ResultsView } from "./format";
import type { GhlPort } from "./ghl";
import {
  buildLeadInputs,
  displayName,
  hasAddress,
  planEnformionAttempts,
  searchInputHash,
  type LeadInputs,
} from "./inputs";
import { maskPhone, type PhoneFinderLogger } from "./log";
import type { TrestleCheck, TrestleClient } from "./trestle";

/** PII-free record of a run, kept on the DB row. */
export type PhoneFinderRunSummary = {
  outcome: PhoneFinderOutcome | "recently_searched" | "contact_gone" | "wrong_location";
  primaryVerdict: PrimaryVerdict | null;
  primaryLitigator: boolean;
  identityScore: number | null;
  searches: number;
  matchedWith: string | null;
  found: number;
  verified: number;
  litigator: number;
  unchecked: number;
};

export type PipelineContext = {
  contactId: string;
  runId: string;
  config: PhoneFinderConfig;
  ghl: Pick<GhlPort, "getContact">;
  trestle: TrestleClient;
  enformion: EnformionClient;
  /** Reserve today's slot under the daily cap. False = limit reached. */
  reserveDailySlot: () => Promise<boolean>;
  /** The last finished search for this contact (same-input cooldown). */
  previous: { inputHash: string | null; searchedAt: Date | null };
  now: () => Date;
  /** Epoch ms. No new vendor call starts within 20 s of it. */
  deadlineAt: number;
  timeZone: string;
  log: PhoneFinderLogger;
};

export type PipelineResult =
  /** Write `text` to the field (and `tags` to the contact). `searched` = a paid search ran. */
  | {
      kind: "write";
      outcome: PhoneFinderOutcome;
      text: string;
      tags: string[];
      costMills: number;
      inputHash: string | null;
      searched: boolean;
      summary: PhoneFinderRunSummary;
    }
  /** Nothing to write. */
  | { kind: "skip"; reason: "contact_gone" | "wrong_location" | "recently_searched"; costMills: number; summary: PhoneFinderRunSummary }
  /** Transient: try the whole run again later. */
  | { kind: "retry"; reason: string; costMills: number };

const CANDIDATE_CONCURRENCY = 3;
const DEADLINE_MARGIN_MS = 20_000;

function emptySummary(outcome: PhoneFinderRunSummary["outcome"]): PhoneFinderRunSummary {
  return {
    outcome,
    primaryVerdict: null,
    primaryLitigator: false,
    identityScore: null,
    searches: 0,
    matchedWith: null,
    found: 0,
    verified: 0,
    litigator: 0,
    unchecked: 0,
  };
}

function trestleQueryFor(inputs: LeadInputs, name: string, phone: string, sourceId: string) {
  const a = inputs.address;
  return {
    name,
    phone,
    ...(inputs.email ? { email: inputs.email } : {}),
    address: { street: a.line1, city: a.city, state: a.state, zip: a.zip },
    sourceId,
  };
}

export async function runPhoneFinderSearch(ctx: PipelineContext): Promise<PipelineResult> {
  const { config, log } = ctx;
  let costMills = 0;
  const timeLeft = () => ctx.deadlineAt - ctx.now().getTime() > DEADLINE_MARGIN_MS;

  // 1. Contact.
  const read = await ctx.ghl.getContact(ctx.contactId);
  if (!read.ok) {
    if (read.notFound) return { kind: "skip", reason: "contact_gone", costMills, summary: emptySummary("contact_gone") };
    return { kind: "retry", reason: `ghl_read_${read.status}`, costMills };
  }
  const contact = read.contact;
  if (config.locationId && contact.locationId && contact.locationId !== config.locationId) {
    log.warn("Contact belongs to another location; ignoring", { contactId: ctx.contactId });
    return { kind: "skip", reason: "wrong_location", costMills, summary: emptySummary("wrong_location") };
  }

  const inputs = buildLeadInputs(contact, ctx.now());
  const inputHash = searchInputHash(inputs);
  const view = (overrides: Partial<ResultsView> & Pick<ResultsView, "outcome">): ResultsView => ({
    numbers: [],
    primaryVerdict: "none",
    primaryLitigator: false,
    identityScore: null,
    minIdentityScore: config.minIdentityScore,
    uncheckedCount: 0,
    ...overrides,
  });
  const write = (
    v: ResultsView,
    summary: PhoneFinderRunSummary,
    opts: { searched: boolean; tags?: string[] }
  ): PipelineResult => ({
    kind: "write",
    outcome: v.outcome,
    text: formatResultsText(v, ctx.now(), ctx.timeZone),
    tags: opts.tags ?? [],
    costMills,
    inputHash,
    searched: opts.searched,
    summary,
  });

  // 2. Same inputs searched recently: the field already holds that answer.
  const cooldownMs = config.rerunCooldownHours * 3_600_000;
  if (
    cooldownMs > 0 &&
    ctx.previous.inputHash === inputHash &&
    ctx.previous.searchedAt &&
    ctx.now().getTime() - ctx.previous.searchedAt.getTime() < cooldownMs
  ) {
    return { kind: "skip", reason: "recently_searched", costMills, summary: emptySummary("recently_searched") };
  }

  // 3. Anything to search with? (Free — no slot spent.)
  if (!inputs.name) {
    return write(view({ outcome: "not_enough_info", detail: "the contact needs a first and last name" }), emptySummary("not_enough_info"), {
      searched: false,
    });
  }
  if (!inputs.email && !hasAddress(inputs) && !inputs.primaryE164) {
    return write(view({ outcome: "not_enough_info", detail: "add an email or a street address/ZIP" }), emptySummary("not_enough_info"), {
      searched: false,
    });
  }

  // 4. Daily cap, reserved before the first paid call.
  if (!(await ctx.reserveDailySlot())) {
    return write(view({ outcome: "daily_limit", detail: `${config.dailyLimit} per day` }), emptySummary("daily_limit"), {
      searched: false,
    });
  }

  const summary = emptySummary("none");
  const leadName = displayName(inputs.name);

  // 5. The phone on file: whose is it, and is it a litigator?
  let primaryCheck: TrestleCheck | null = null;
  if (inputs.primaryE164) {
    primaryCheck = await ctx.trestle.realContact(trestleQueryFor(inputs, leadName, inputs.primaryE164, "phone-finder-primary"));
    if (primaryCheck.ok) costMills += TRESTLE_REAL_CONTACT_MILLS;
    else log.warn("Trestle check of the phone on file failed", { contactId: ctx.contactId, failure: primaryCheck.failure, status: primaryCheck.status });
  }
  const primaryVerdict = derivePrimaryVerdict(inputs, primaryCheck);
  const primaryLitigator = primaryCheck?.ok === true && primaryCheck.litigator === true;
  summary.primaryVerdict = primaryVerdict;
  summary.primaryLitigator = primaryLitigator;
  const tags = primaryLitigator ? [PHONE_FINDER_LITIGATOR_TAG] : [];
  const baseView = { primaryVerdict, primaryLitigator };

  // 6. EnformionGO. Leave the phone out when Trestle says it is someone else's — it would steer the
  //    match to that person.
  const includePhone = primaryVerdict !== "other_person" && primaryVerdict !== "invalid";
  const phoneDoubtful = primaryVerdict === "unknown" || primaryVerdict === "unchecked";
  const attempts = planEnformionAttempts(inputs, { includePhone, phoneDoubtful, max: config.maxSearches });
  if (attempts.length === 0) {
    summary.outcome = "not_enough_info";
    const detail =
      primaryVerdict === "other_person"
        ? "the phone on file belongs to someone else and there is no email or address to search with"
        : "add an email or a street address/ZIP";
    return write(view({ ...baseView, outcome: "not_enough_info", detail }), summary, { searched: true, tags });
  }

  let match: Extract<EnformionResult, { kind: "match" }> | null = null;
  let inputErrors = 0;
  for (const attempt of attempts) {
    if (!timeLeft()) return { kind: "retry", reason: "time_budget", costMills };
    summary.searches++;
    const result = await ctx.enformion.enrich(attempt.body, ctx.runId);
    if (result.kind === "match") {
      match = result;
      summary.matchedWith = attempt.label;
      costMills += config.enformionPriceMills;
      break;
    }
    if (result.kind === "miss") continue;
    if (result.kind === "input_error") {
      inputErrors++;
      continue;
    }
    log.warn("EnformionGO error", { contactId: ctx.contactId, code: result.code, status: result.status });
    if (result.retryable) return { kind: "retry", reason: `enformion_${result.code}`, costMills };
    summary.outcome = "failed";
    const detail =
      result.code === "auth"
        ? "EnformionGO account problem (check the API keys and plan limits)"
        : `EnformionGO answered ${result.status}`;
    return write(view({ ...baseView, outcome: "failed", detail }), summary, { searched: false, tags });
  }

  if (!match) {
    if (inputErrors === attempts.length) {
      summary.outcome = "failed";
      return write(view({ ...baseView, outcome: "failed", detail: "EnformionGO rejected the search details" }), summary, {
        searched: false,
        tags,
      });
    }
    summary.outcome = "no_match";
    return write(view({ ...baseView, outcome: "no_match" }), summary, { searched: true, tags });
  }
  summary.identityScore = match.identityScore;

  // 7. New numbers only, then check each with Trestle against the LEAD's name.
  const candidates = extractCandidates(match.phones, inputs.existingKeys);
  const found: FoundNumber[] = [];
  for (let i = 0; i < candidates.length; i += CANDIDATE_CONCURRENCY) {
    const wave = candidates.slice(i, i + CANDIDATE_CONCURRENCY);
    const checks = timeLeft()
      ? await Promise.all(
          wave.map((c) => ctx.trestle.realContact(trestleQueryFor(inputs, leadName, c.e164, "phone-finder-candidate")))
        )
      : wave.map(() => null);
    wave.forEach((c, j) => {
      const check = checks[j] ?? null;
      if (check?.ok) costMills += TRESTLE_REAL_CONTACT_MILLS;
      else if (check) log.warn("Trestle check of a found number failed", { contactId: ctx.contactId, phone: maskPhone(c.e164), failure: check.failure });
      found.push(classifyFound(c, check));
    });
  }

  const ranked = rankFound(found);
  summary.found = ranked.length;
  summary.verified = ranked.filter((n) => n.bucket === "verified").length;
  summary.litigator = ranked.filter((n) => n.bucket === "litigator").length;
  summary.unchecked = found.filter((n) => !n.checked).length;
  summary.outcome = ranked.length > 0 ? "found" : "none";

  return write(
    view({
      ...baseView,
      outcome: summary.outcome,
      numbers: ranked,
      identityScore: match.identityScore,
      uncheckedCount: summary.unchecked,
    }),
    summary,
    { searched: true, tags }
  );
}
