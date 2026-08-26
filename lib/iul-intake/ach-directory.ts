/**
 * The FedACH directory, in memory: bank name + state → routing numbers, and the reverse.
 *
 * Replaces two third-party calls that used to sit in the middle of a live sales call — a metered
 * premium search API and a free reverse-lookup service. Both are gone. Every answer below comes
 * from data compiled into the deployment, so a lookup is a map read: no key, no quota, no rate
 * limit shared across every client filling a form, and nothing to time out while Isaac waits on
 * the phone. It also removes the last third party that saw any part of a client's bank details.
 *
 * ─── The one thing that shapes the whole design ───
 *
 * The Fed's `state` column is the institution's ADMINISTRATIVE address, not the customer's. In the
 * real file, 103 of Bank of America's 106 routing numbers say Virginia. So filtering the directory
 * by state — which is what a "search by bank and state" API does — throws away every correct
 * answer for exactly the banks people actually use.
 *
 * Hence two sources, in priority order:
 *   1. `CURATED_BANKS` — hand-verified per-state numbers for the big banks. See that file for how
 *      each was checked; the checks rejected real published numbers, so they are not decoration.
 *   2. This directory — for everything else. 84% of institutions register exactly ONE routing
 *      number, and for those the state is irrelevant: the answer is confident whatever state the
 *      client names. That single fact is what makes free data good enough here.
 *
 * Results are labelled with which of those produced them, because "this is the number" and "one of
 * these three is the number" are different things to say out loud to a client.
 */

import "server-only";
import { gunzipSync } from "node:zlib";
import { ACH_DIRECTORY_GZ_BASE64, ACH_DIRECTORY_META } from "./data/ach-directory.generated";
import { CURATED_BANKS } from "./data/bank-state-routing";
import { isValidRouting } from "./validation";

export type AchInstitution = {
  routingNumber: string;
  bankName: string;
  city: string;
  state: string;
};

/** How sure we are, which decides what the agent says rather than just what they see. */
export type MatchConfidence =
  /** A hand-verified number for this exact bank and state. */
  | "curated"
  /** The bank registers a single routing number nationwide, so the state cannot change it. */
  | "single"
  /** Several plausible numbers. The client confirms which is theirs. */
  | "candidates";

export type RoutingMatch = AchInstitution & { confidence: MatchConfidence };

type Indexed = { inst: AchInstitution; norm: string };

type Loaded = {
  byRouting: Map<string, AchInstitution>;
  all: Indexed[];
};

let loaded: Loaded | null = null;

/** Lowercase, strip punctuation, collapse whitespace — so "M&T" and "M and T" meet. */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Noise words that appear in half the directory and match nothing useful on their own.
 *
 * Without this, a search for "First National Bank" scores every institution containing "bank".
 * They are dropped from the QUERY only — never from the stored names, which still have to match
 * when someone deliberately types them.
 */
const STOPWORDS = new Set(["bank", "na", "the", "of", "and", "fsb", "co", "company", "inc"]);

/** Inflate and index once per process. ~190 KB gzipped, ~730 KB of text, well under a second. */
function load(): Loaded {
  if (loaded) return loaded;

  const tsv = gunzipSync(Buffer.from(ACH_DIRECTORY_GZ_BASE64, "base64")).toString("utf8");
  const byRouting = new Map<string, AchInstitution>();
  const all: Indexed[] = [];

  for (const line of tsv.split("\n")) {
    if (!line) continue;
    const [routingNumber, bankName, city, state] = line.split("\t");
    if (!routingNumber || !bankName) continue;
    const inst: AchInstitution = { routingNumber, bankName, city: city ?? "", state: state ?? "" };
    byRouting.set(routingNumber, inst);
    all.push({ inst, norm: normalise(bankName) });
  }

  loaded = { byRouting, all };
  return loaded;
}

export function achDirectoryMeta() {
  return ACH_DIRECTORY_META;
}

/**
 * Title-case a CITY only.
 *
 * Bank names stay exactly as the Fed publishes them, in capitals. Every attempt to prettify them
 * mangles something: the source is entirely uppercase, so nothing distinguishes the initialism
 * "NA" from the preposition "OF", and title-casing turns JPMORGAN into "Jpmorgan". Capitals are
 * also how the name prints on the client's own statement, which reads as more official, not less.
 */
function titleCaseCity(raw: string): string {
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function present(inst: AchInstitution, confidence: MatchConfidence): RoutingMatch {
  return { ...inst, city: titleCaseCity(inst.city), confidence };
}

/**
 * Build a match for a routing number we already trust.
 *
 * The name comes from the Fed directory where possible — it is how the bank prints on the client's
 * statement — but the CITY AND STATE ARE DELIBERATELY DROPPED, and this is the subtle part. The
 * directory would report Bank of America's Texas number as "Henrico, VA", because that is the
 * bank's head office. An agent who searched Texas and read back "Virginia" would assume the tool
 * was broken and type the number by hand instead. So a curated result carries the state that was
 * actually asked for, which is the state the number is genuinely for.
 */
function fromRouting(
  rn: string,
  fallbackName: string,
  state: string,
  confidence: MatchConfidence
): RoutingMatch | null {
  if (!isValidRouting(rn)) return null;
  const inst = load().byRouting.get(rn);
  return {
    routingNumber: rn,
    bankName: inst?.bankName ?? fallbackName,
    city: "",
    state,
    confidence,
  };
}

/** Enough for a picker; beyond this the agent should narrow by city instead of scrolling. */
const MAX_RESULTS = 8;

/**
 * Look up candidate ACH routing numbers for a bank in a given state.
 *
 * `state` is where the account was OPENED, not where the client lives now — somebody who moved
 * from California to Texas keeps the California number, and the UI label says so.
 *
 * Never throws and never returns a number that fails the ABA checksum.
 */
export function searchRoutingNumbers(params: {
  bankName: string;
  state: string;
  city?: string;
}): RoutingMatch[] {
  const query = normalise(params.bankName ?? "");
  const state = (params.state ?? "").trim().toUpperCase();
  const city = normalise(params.city ?? "");
  if (!query) return [];

  // ── 1. Curated: the only source that knows a bank's number varies by state ──
  const curated = CURATED_BANKS.find((b) =>
    b.aliases.some((a) => {
      const alias = normalise(a);
      return query === alias || query.includes(alias) || alias.includes(query);
    })
  );
  if (curated) {
    // One number for the whole country is the only genuinely "single" case. Truist still runs both
    // the SunTrust and BB&T numbers, so two come back — and two numbers is a question for the
    // client, never a confident answer, whatever the source.
    if (curated.nationwide?.length) {
      const confidence: MatchConfidence = curated.nationwide.length === 1 ? "single" : "candidates";
      const out = curated.nationwide
        .map((rn) => fromRouting(rn, curated.name, state, confidence))
        .filter((m): m is RoutingMatch => m !== null);
      if (out.length) return out;
    }
    const forState = state ? curated.byState?.[state] : undefined;
    if (forState?.length) {
      const confidence: MatchConfidence = forState.length === 1 ? "curated" : "candidates";
      const out = forState
        .map((rn) => fromRouting(rn, curated.name, state, confidence))
        .filter((m): m is RoutingMatch => m !== null);
      if (out.length) return out;
    }
    // A curated bank with nothing for this state (TD Bank in Texas) falls through to the
    // directory rather than guessing — the client may bank somewhere with a similar name.
  }

  // ── 2. Directory: every token of the query must appear in the institution's name ──
  const tokens = query.split(" ").filter((t) => t && !STOPWORDS.has(t));
  if (!tokens.length) return [];

  const hits = load().all.filter(({ norm }) => tokens.every((t) => norm.includes(t)));
  if (!hits.length) return [];

  // If everything found belongs to one institution registering ONE number, the state cannot
  // change the answer — say it with confidence. This covers 84% of the directory.
  const distinct = new Set(hits.map((h) => h.inst.routingNumber));
  if (distinct.size === 1) {
    const only = hits[0].inst;
    return isValidRouting(only.routingNumber) ? [present(only, "single")] : [];
  }

  // Otherwise rank: same state first, then a city match, then the rest. Everything the client
  // might plausibly have, ordered by how likely it is, and labelled as needing confirmation.
  const score = (h: Indexed) => {
    let s = 0;
    if (state && h.inst.state === state) s -= 2;
    if (city && normalise(h.inst.city).includes(city)) s -= 1;
    return s;
  };

  const seen = new Set<string>();
  const out: RoutingMatch[] = [];
  for (const h of [...hits].sort((a, b) => score(a) - score(b))) {
    const rn = h.inst.routingNumber;
    if (seen.has(rn) || !isValidRouting(rn)) continue;
    seen.add(rn);
    out.push(present(h.inst, "candidates"));
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

/**
 * The reverse: nine digits in, the bank's name out, so whoever typed it can confirm it is theirs.
 *
 * This is the reassurance half of the story, and it is the stronger one — it involves no guessing
 * at all. It catches a transposed digit that still happens to pass the checksum.
 *
 * Returns null for anything not confidently known. Every caller renders null as *nothing at all*
 * rather than a warning: telling a client their real routing number "was not found" would be worse
 * than staying quiet, and this file's 2018 vintage means a bank chartered since then is a genuine
 * miss rather than a bad number.
 */
export function lookupBankByRouting(routingNumber: string): AchInstitution | null {
  const digits = (routingNumber ?? "").replace(/\D/g, "");
  if (!isValidRouting(digits)) return null;
  const inst = load().byRouting.get(digits);
  return inst ? { ...inst, city: titleCaseCity(inst.city) } : null;
}
