/**
 * Offline checks for Phone Finder — no network, no database, no API keys.
 * Vendor responses are faked with the shapes from the Trestle / EnformionGO docs.
 *
 * Run with: pnpm test:phone-finder
 */

import {
  classifyFound,
  derivePrimaryVerdict,
  extractCandidates,
  rankFound,
  type FoundNumber,
} from "../lib/phone-finder/classify";
import { getPhoneFinderConfig, type PhoneFinderConfig } from "../lib/phone-finder/config";
import {
  createEnformionClient,
  parseEnformionDate,
  parseEnrichResponse,
  type EnformionClient,
  type EnformionResult,
} from "../lib/phone-finder/enformion";
import { formatResultsText, type ResultsView } from "../lib/phone-finder/format";
import type { GhlReadResult } from "../lib/phone-finder/ghl";
import {
  addressLine2,
  buildLeadInputs,
  firstSurnameOnly,
  parseContactSnapshot,
  planEnformionAttempts,
  searchInputHash,
  splitLeadName,
  toDashedPhone,
  toMmDdYyyy,
  usableEmail,
  type ContactSnapshot,
  type EnformionRequestBody,
} from "../lib/phone-finder/inputs";
import { createPhoneFinderLogger, maskPhone } from "../lib/phone-finder/log";
import { runPhoneFinderSearch, type PipelineContext, type PipelineResult } from "../lib/phone-finder/pipeline";
import {
  buildRealContactUrl,
  classifyTrestleFailure,
  createTrestleClient,
  parseLitigatorFlag,
  parseRealContact,
  type RealContactQuery,
  type TrestleCheck,
  type TrestleClient,
} from "../lib/phone-finder/trestle";
import { isAuthorizedBearer, parseWebhookContactId } from "../lib/phone-finder/webhook";

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
const j = (v: unknown) => JSON.stringify(v);

// ── Names ────────────────────────────────────────────────────────────────────
console.log("\nnames");
{
  const n = splitLeadName("María", "García López");
  check("accents stripped, two surnames", j(n) === j({ first: "Maria", middle: "", surnames: ["Garcia", "Lopez"] }), j(n));
  const one = splitLeadName("Juan Carlos Perez", "");
  check("whole name in first-name box (3 tokens)", j(one) === j({ first: "Juan", middle: "", surnames: ["Carlos", "Perez"] }), j(one));
  const four = splitLeadName("Maria Elena Garcia Lopez", "");
  check("4 tokens -> two given names", j(four) === j({ first: "Maria", middle: "Elena", surnames: ["Garcia", "Lopez"] }), j(four));
  const particle = splitLeadName("Jose", "de la Cruz Martinez");
  check("particles stay with their surname", j(particle?.surnames) === j(["de la Cruz", "Martinez"]), j(particle));
  check("'y' separator dropped", j(splitLeadName("Ana", "Ruiz y Gomez")?.surnames) === j(["Ruiz", "Gomez"]));
  check("first name only -> null", splitLeadName("Maria", "") === null);
  check("junk name -> null", splitLeadName("test", "lead") === null);
  check("contactName used when first/last empty", splitLeadName("", "", "Rosa Diaz")?.first === "Rosa");
  check("hyphenated -> paternal part", firstSurnameOnly(splitLeadName("Luis", "Garcia-Lopez")!) === "Garcia");
  check("single surname has no paternal variant", firstSurnameOnly(splitLeadName("Luis", "Garcia")!) === null);
}

// ── Inputs ───────────────────────────────────────────────────────────────────
console.log("\ninputs");
const NOW = new Date("2026-10-16T19:00:00Z");
function contact(overrides: Partial<ContactSnapshot> = {}): ContactSnapshot {
  return {
    id: "abcDEF1234567890xyzA",
    locationId: "LOC1234567890",
    firstName: "Maria",
    lastName: "Garcia Lopez",
    fullName: "",
    email: "maria@gmail.com",
    phone: "+13054120142",
    additionalPhones: [],
    address1: "123 Main St",
    city: "Miami",
    state: "Florida",
    postalCode: "33101-1234",
    dateOfBirth: "1970-05-21T00:00:00.000Z",
    tags: [],
    ...overrides,
  };
}
{
  check("DOB ISO -> MM/DD/YYYY", toMmDdYyyy("1970-05-21T00:00:00.000Z", NOW) === "05/21/1970");
  check("DOB US format kept", toMmDdYyyy("5/2/1970", NOW) === "05/02/1970");
  check("DOB garbage -> ''", toMmDdYyyy("someday", NOW) === "");
  check("DOB in the future -> ''", toMmDdYyyy("2030-01-01", NOW) === "");
  check("placeholder email dropped", usableEmail("no@no.com") === "" && usableEmail("x@example.com") === "");
  check("real email normalised", usableEmail(" Maria@Gmail.COM ") === "maria@gmail.com");
  check("dashed phone", toDashedPhone("+13054120142") === "305-412-0142");

  const inputs = buildLeadInputs(contact({ additionalPhones: ["(786) 412-0100"] }), NOW);
  check("state name -> code, zip 5", inputs.address.state === "FL" && inputs.address.zip === "33101");
  check("addressLine2", addressLine2(inputs.address) === "Miami, FL 33101", addressLine2(inputs.address));
  check("existing keys hold primary + additional", inputs.existingKeys.has("3054120142") && inputs.existingKeys.has("7864120100"));
  check("primary E.164", inputs.primaryE164 === "+13054120142");
  check("non-US primary flagged", buildLeadInputs(contact({ phone: "+52 55 1234 5678" }), NOW).primaryNonUs === true);
  check("bad primary not flagged non-US", buildLeadInputs(contact({ phone: "555-1234" }), NOW).primaryNonUs === false);

  const h1 = searchInputHash(inputs);
  const h2 = searchInputHash(buildLeadInputs(contact({ additionalPhones: ["(786) 412-0100", "+17864120111"], tags: ["x"] }), NOW));
  const h3 = searchInputHash(buildLeadInputs(contact({ email: "other@gmail.com", additionalPhones: ["(786) 412-0100"] }), NOW));
  check("hash ignores additional phones and tags", h1 === h2);
  check("hash changes with the email", h1 !== h3);

  const plan = planEnformionAttempts(inputs, { includePhone: true, phoneDoubtful: true, max: 6 });
  check("plan order", j(plan.map((a) => a.label)) === j(["full", "first_surname", "without_phone", "last_surname", "loose"]), j(plan.map((a) => a.label)));
  check("full body", j(plan[0]!.body) === j({
    FirstName: "Maria", LastName: "Garcia Lopez", Dob: "05/21/1970", Phone: "305-412-0142", Email: "maria@gmail.com",
    Address: { addressLine1: "123 Main St", addressLine2: "Miami, FL 33101" },
  }), j(plan[0]!.body));
  check("first_surname uses the paternal surname", plan[1]!.body.LastName === "Garcia");
  check("without_phone has no Phone", !("Phone" in plan[2]!.body));
  check("last_surname moves the first group to middle", plan[3]!.body.LastName === "Lopez" && plan[3]!.body.MiddleName === "Garcia");
  check("max respected", planEnformionAttempts(inputs, { includePhone: true, phoneDoubtful: true, max: 2 }).length === 2);

  const nameAndWrongPhone = buildLeadInputs(contact({ email: "", address1: "", city: "", state: "", postalCode: "" }), NOW);
  check(
    "phone excluded + nothing else -> no attempts",
    planEnformionAttempts(nameAndWrongPhone, { includePhone: false, phoneDoubtful: false, max: 4 }).length === 0
  );
  check(
    "ZIP alone counts as an address",
    planEnformionAttempts(buildLeadInputs(contact({ email: "", phone: "", address1: "", city: "", state: "", postalCode: "33101" }), NOW), {
      includePhone: false, phoneDoubtful: false, max: 4,
    })[0]?.body.Address?.addressLine2 === "33101"
  );

  const snap = parseContactSnapshot({
    contact: { id: "abcDEF1234567890xyzA", firstName: "A", phone: "+13054120142", additionalPhones: [{ phone: "+17864120100", phoneLabel: "Work" }, "+17864120111"], tags: ["t"] },
  });
  check("snapshot parses additionalPhones objects and strings", j(snap?.additionalPhones) === j(["+17864120100", "+17864120111"]));
  check("snapshot without id -> null", parseContactSnapshot({ contact: { firstName: "A" } }) === null);
}

// ── Trestle ──────────────────────────────────────────────────────────────────
console.log("\ntrestle");
{
  const gradeA = parseRealContact({
    phone: { contact_grade: "A", is_valid: true, activity_score: 92, line_type: "Mobile", name_match: true },
    add_ons: { litigator_checks: { phone_is_litigator_risk: false } },
    warnings: [],
  });
  check("grade A parsed", gradeA.grade === "A" && gradeA.nameMatch === true && gradeA.activityScore === 92 && gradeA.litigator === false);
  check("dotted litigator key", parseLitigatorFlag({ litigator_checks: { "phone.is_litigator_risk": true } }, []) === true);
  check("litigator warning wins", parseLitigatorFlag(null, ["Lead is a Litigator. Must not be contacted."]) === true);
  check("litigator timeout -> null (unknown)", parseLitigatorFlag({ litigator_checks: { phone_is_litigator_risk: null } }, ["TimeoutError: Timeout getting response for litigator check. Partial response returned."]) === null);
  const invalid = parseRealContact({ phone: { contact_grade: "F", is_valid: false, name_match: null }, warnings: ["Invalid Phone"] });
  check("invalid phone: isValid false, nameMatch null", invalid.isValid === false && invalid.nameMatch === null);
  check("403 -> auth", classifyTrestleFailure(403, { errorCode: "AUTHENTICATION_FAILED" }, null) === "auth");
  check("429 quota", classifyTrestleFailure(429, { errorCode: "QUOTA_EXCEEDED" }, null) === "quota");
  check("429 rate limit", classifyTrestleFailure(429, { errorCode: "RATE_LIMIT_EXCEEDED" }, null) === "rate_limit");
  check("timeout", classifyTrestleFailure(0, null, "timeout") === "timeout");

  const q: RealContactQuery = { name: "Maria Garcia", phone: "+13054120142", address: { city: "Miami", state: "FL" }, sourceId: "t" };
  const url = buildRealContactUrl(q);
  check("url: %20, %2B, literal dotted keys, litigator add-on", url.includes("name=Maria%20Garcia") && url.includes("phone=%2B13054120142") && url.includes("&address.city=Miami") && url.includes("add_ons=litigator_checks"), url);
  check("url never carries the key", !url.includes("api_key") && !url.includes("x-api-key"));
}

async function asyncTests() {
  // Trestle client: 429 rate limit is retried in-call, key goes in the header.
  {
    const calls: { url: string; init?: RequestInit }[] = [];
    const responses = [
      new Response(JSON.stringify({ errorCode: "RATE_LIMIT_EXCEEDED" }), { status: 429 }),
      new Response(JSON.stringify({ phone: { is_valid: true, name_match: true }, add_ons: { litigator_checks: { phone_is_litigator_risk: false } } }), { status: 200 }),
    ];
    const client = createTrestleClient({
      apiKey: "KEY123",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return responses.shift()!;
      },
      wait: async () => {},
    });
    const res = await client.realContact({ name: "A B", phone: "+13054120142", sourceId: "t" });
    check("trestle client retries a QPS 429", res.ok === true && calls.length === 2);
    const headers = (calls[0]!.init?.headers ?? {}) as Record<string, string>;
    check("trestle key sent as x-api-key header", headers["x-api-key"] === "KEY123");
  }

  // EnformionGO client: galaxy headers, JSON body, no galaxy-client-type.
  {
    let seen: RequestInit | undefined;
    const client = createEnformionClient({
      apName: "AP",
      apPassword: "PW",
      fetchImpl: async (_url, init) => {
        seen = init;
        return new Response(JSON.stringify({ person: null, isError: false, requestType: "DevAPIContactEnrich" }), { status: 200 });
      },
      wait: async () => {},
    });
    const res = await client.enrich({ FirstName: "A", LastName: "B", Email: "a@b.co" }, "pf_run");
    const h = (seen?.headers ?? {}) as Record<string, string>;
    check("enformion miss", res.kind === "miss");
    check(
      "enformion headers",
      h["galaxy-ap-name"] === "AP" && h["galaxy-ap-password"] === "PW" && h["galaxy-search-type"] === "DevAPIContactEnrich" && h["galaxy-client-session-id"] === "pf_run" && !("galaxy-client-type" in h)
    );
    check("enformion body is the PascalCase request", seen?.body === j({ FirstName: "A", LastName: "B", Email: "a@b.co" }));
  }

  // ── Pipeline with fake ports ────────────────────────────────────────────────
  console.log("\npipeline");
  const cfg: PhoneFinderConfig = { ...getPhoneFinderConfig({} as NodeJS.ProcessEnv), locationId: "LOC1234567890", enabled: true };

  type Fakes = {
    contact?: ContactSnapshot | null;
    readStatus?: number;
    trestle?: (q: RealContactQuery) => TrestleCheck;
    enformion?: (body: EnformionRequestBody, n: number) => EnformionResult;
    slot?: boolean;
    previous?: PipelineContext["previous"];
  };
  const ok = (over: Partial<Extract<TrestleCheck, { ok: true }>> = {}): TrestleCheck => ({
    ok: true, isValid: true, grade: "A", activityScore: 80, lineType: "Mobile", nameMatch: true, litigator: false, ...over,
  });
  const matchWith = (phones: { number: string; type?: string; isConnected?: boolean; last?: string }[], score = 90): EnformionResult =>
    parseEnrichResponse(200, {
      person: {
        personId: "G-1",
        name: { firstName: "MARIA", lastName: "GARCIA" },
        phones: phones.map((p) => ({ number: p.number, type: p.type ?? "mobile", isConnected: p.isConnected ?? true, lastReportedDate: p.last ?? "1/2/2026" })),
      },
      identityScore: score,
      isError: false,
    }, null);

  async function run(f: Fakes) {
    const trestleCalls: RealContactQuery[] = [];
    const enformionCalls: EnformionRequestBody[] = [];
    let slotCalls = 0;
    const trestle: TrestleClient = {
      async realContact(q) {
        trestleCalls.push(q);
        return f.trestle ? f.trestle(q) : ok();
      },
    };
    const enformion: EnformionClient = {
      async enrich(body) {
        enformionCalls.push(body);
        return f.enformion ? f.enformion(body, enformionCalls.length) : { kind: "miss" };
      },
    };
    const ctx: PipelineContext = {
      contactId: "abcDEF1234567890xyzA",
      runId: "pf_test",
      config: cfg,
      ghl: {
        async getContact(): Promise<GhlReadResult> {
          if (f.readStatus) return { ok: false, notFound: f.readStatus === 404, retryable: f.readStatus >= 500, status: f.readStatus };
          return { ok: true, contact: f.contact ?? contact() };
        },
      },
      trestle,
      enformion,
      reserveDailySlot: async () => {
        slotCalls++;
        return f.slot ?? true;
      },
      previous: f.previous ?? { inputHash: null, searchedAt: null },
      now: () => NOW,
      deadlineAt: NOW.getTime() + 240_000,
      timeZone: "America/New_York",
      log: createPhoneFinderLogger(false),
    };
    const result: PipelineResult = await runPhoneFinderSearch(ctx);
    return { result, trestleCalls, enformionCalls, slotCalls };
  }

  {
    // Happy path: one number already on file, one litigator, one verified, one not tied to the name.
    const r = await run({
      trestle: (q) =>
        q.phone === "+17864120199"
          ? ok({ litigator: true, grade: "F" })
          : q.phone === "+19544120123"
            ? ok({ nameMatch: null, activityScore: 61, lineType: "Landline" })
            : ok(),
      enformion: () =>
        matchWith([
          { number: "(305) 412-0142" }, // already the primary
          { number: "(786) 412-0199" },
          { number: "(954) 412-0123", type: "landline", last: "3/25/2024" },
          { number: "(305) 412-0177" },
        ]),
    });
    const w = r.result.kind === "write" ? r.result : null;
    check("happy path writes 'found'", w?.outcome === "found", j(r.result));
    check("primary check + 3 candidate checks", r.trestleCalls.length === 4, String(r.trestleCalls.length));
    check("one EnformionGO search", r.enformionCalls.length === 1);
    check("search used the confirmed phone", r.enformionCalls[0]?.Phone === "305-412-0142");
    check("cost = 4 × $0.035 + $0.25", w?.costMills === 4 * 35 + 250, String(w?.costMills));
    const lines = (w?.text ?? "").split("\n");
    check("verified number first, with ✓", lines[0]?.startsWith("✓ 305-412-0177 · Mobile · registered to this name"), lines[0]);
    check("unverified number second, with •", lines[1]?.startsWith("• 954-412-0123 · Landline · active 61/100 · seen 2024"), lines[1]);
    check("litigator last, DO NOT CALL", lines[2] === "⛔ 786-412-0199 · DO NOT CALL: TCPA litigator", lines[2]);
    check("existing primary not repeated", !(w?.text ?? "").includes("305-412-0142"));
    check("source + consent lines", (w?.text ?? "").includes("EnformionGO (people search) + Trestle (phone checks)") && (w?.text ?? "").includes("call by hand, don't text"));
    check("no tags for a clean primary", w?.tags.length === 0);
    check("searched -> sets cooldown", w?.searched === true && typeof w?.inputHash === "string");
    check("summary counts", w?.summary.found === 3 && w?.summary.verified === 1 && w?.summary.litigator === 1, j(w?.summary));
  }
  {
    const r = await run({
      trestle: (q) => (q.phone === "+13054120142" ? ok({ nameMatch: false }) : ok()),
      enformion: () => matchWith([{ number: "(305) 412-0177" }]),
    });
    check("phone on file belongs to someone else -> not searched with", r.enformionCalls.length === 1 && !("Phone" in r.enformionCalls[0]!));
    check("…and the field says so", r.result.kind === "write" && r.result.text.includes("⚠ The phone on file is registered to someone else."));
  }
  {
    const r = await run({ trestle: (q) => (q.phone === "+13054120142" ? ok({ litigator: true }) : ok()), enformion: () => matchWith([]) });
    check("litigator primary -> tag", r.result.kind === "write" && r.result.tags.includes("tcpa_litigator_risk"));
    check("record with no phones -> 'none'", r.result.kind === "write" && r.result.outcome === "none");
  }
  {
    const inputs = buildLeadInputs(contact(), NOW);
    const r = await run({ previous: { inputHash: searchInputHash(inputs), searchedAt: new Date(NOW.getTime() - 3_600_000) } });
    check("same inputs within cooldown -> skipped, no spend", r.result.kind === "skip" && r.result.reason === "recently_searched" && r.trestleCalls.length === 0 && r.slotCalls === 0);
    const later = await run({ previous: { inputHash: searchInputHash(inputs), searchedAt: new Date(NOW.getTime() - 25 * 3_600_000) } });
    check("after the cooldown -> searches again", later.enformionCalls.length > 0);
  }
  {
    const r = await run({ contact: contact({ email: "", phone: "", address1: "", city: "", state: "", postalCode: "" }) });
    check("nothing to search with -> not_enough_info, free", r.result.kind === "write" && r.result.outcome === "not_enough_info" && r.slotCalls === 0 && r.trestleCalls.length === 0);
    const noName = await run({ contact: contact({ firstName: "", lastName: "" }) });
    check("no name -> not_enough_info", noName.result.kind === "write" && noName.result.text.includes("first and last name"));
  }
  {
    const r = await run({ slot: false });
    check("daily limit -> no vendor calls", r.result.kind === "write" && r.result.outcome === "daily_limit" && r.trestleCalls.length === 0 && r.enformionCalls.length === 0);
  }
  {
    const r = await run({ enformion: () => ({ kind: "miss" }) });
    check("no match after every variant", r.result.kind === "write" && r.result.outcome === "no_match" && r.enformionCalls.length === cfg.maxSearches, String(r.enformionCalls.length));
  }
  {
    const r = await run({ enformion: () => ({ kind: "error", retryable: true, code: "server", status: 503 }) });
    check("EnformionGO 503 -> retry", r.result.kind === "retry");
    const auth = await run({ enformion: () => ({ kind: "error", retryable: false, code: "auth", status: 401 }) });
    check("EnformionGO auth -> failed with reason", auth.result.kind === "write" && auth.result.outcome === "failed" && auth.result.text.includes("account problem"));
    const rejected = await run({ enformion: () => ({ kind: "input_error" }) });
    check("all inputs rejected -> failed", rejected.result.kind === "write" && rejected.result.outcome === "failed");
  }
  {
    const r = await run({ readStatus: 404 });
    check("contact gone -> skip", r.result.kind === "skip" && r.result.reason === "contact_gone");
    const down = await run({ readStatus: 503 });
    check("GHL down -> retry", down.result.kind === "retry");
    const otherLocation = await run({ contact: contact({ locationId: "OTHERLOC12345" }) });
    check("other location -> skip", otherLocation.result.kind === "skip" && otherLocation.result.reason === "wrong_location");
  }
  {
    const r = await run({
      trestle: (q) => (q.phone === "+13054120177" ? { ok: false, failure: "auth", status: 403 } : ok()),
      enformion: () => matchWith([{ number: "(305) 412-0177" }]),
    });
    const w = r.result.kind === "write" ? r.result : null;
    check("failed Trestle check degrades (no retry)", w?.outcome === "found" && (w?.text ?? "").startsWith("• 305-412-0177"), w?.text);
    check("unchecked note", (w?.text ?? "").includes("1 number(s) could not be checked by Trestle"));
    check("unchecked number not billed", w?.costMills === 35 + 250, String(w?.costMills));
  }
  {
    const r = await run({ enformion: () => matchWith([{ number: "(305) 412-0177" }], 60) });
    check("weak identity score is flagged", r.result.kind === "write" && r.result.text.includes("Weak record match (score 60/100)"));
  }
}

// ── EnformionGO parser ───────────────────────────────────────────────────────
console.log("\nenformion");
{
  const m = parseEnrichResponse(200, {
    person: { personId: "G-1", name: { firstName: "MARIA" }, phones: [{ number: "(305) 412-0177", type: "mobile", isConnected: true, lastReportedDate: "3/25/2005" }, { number: "123" }] },
    identityScore: 90,
    pagination: { totalResults: 0 },
  }, null);
  check("match despite totalResults 0", m.kind === "match");
  if (m.kind === "match") {
    check("phones normalised, invalid kept as null", m.phones[0]?.e164 === "+13054120177" && m.phones[1]?.e164 === null);
    check("identityScore", m.identityScore === 90);
  }
  check("date M/D/YYYY -> ISO", parseEnformionDate("3/25/2005") === "2005-03-25");
  // The real no-match body, captured live from EnformionGO on 2026-10-17 (no `person` key at all).
  const liveMiss = {
    message: "No strong matches",
    pagination: { currentPageNumber: 0, resultsPerPage: 0, totalPages: 0, totalResults: 0 },
    databaseQueryInfo: [],
    searchCriteria: [],
    totalRequestExecutionTimeMs: 61,
    requestId: "8bc2b6e5-8dd8-474c-8e21-26c8b79b7621",
    requestType: "DevAPIContactEnrich",
    requestTime: "2026-10-17T09:32:18.3598912-07:00",
    isError: false,
    error: { inputErrors: [], warnings: [] },
  };
  check("live 'No strong matches' body -> miss", parseEnrichResponse(200, liveMiss, null).kind === "miss");
  // The real bad-credentials body, also captured live (HTTP 401).
  const liveAuth = parseEnrichResponse(401, {
    requestId: "x", requestType: "DevAPIContactEnrich", requestTime: "x", isError: true,
    error: { code: "Invalid Galaxy Token", message: "Access denied.", technicalErrorMessage: "Access Denied (Code 1)", inputErrors: [], warnings: [] },
  }, null);
  check("live 401 'Invalid Galaxy Token' -> auth, not retried", liveAuth.kind === "error" && liveAuth.code === "auth" && !liveAuth.retryable);
  check("person null -> miss", parseEnrichResponse(200, { person: null }, null).kind === "miss");
  check("person {} -> miss", parseEnrichResponse(200, { person: {} }, null).kind === "miss");
  check("isError -> input_error", parseEnrichResponse(200, { isError: true }, null).kind === "input_error");
  check("inputErrors -> input_error", parseEnrichResponse(200, { error: { inputErrors: [{}] } }, null).kind === "input_error");
  check("404 envelope -> miss", parseEnrichResponse(404, { requestType: "DevAPIContactEnrich" }, null).kind === "miss");
  const bare404 = parseEnrichResponse(404, null, null);
  check("bare 404 -> non-retryable error", bare404.kind === "error" && !bare404.retryable);
  const auth = parseEnrichResponse(401, {}, null);
  check("401 -> auth, not retried", auth.kind === "error" && auth.code === "auth" && !auth.retryable);
  const down = parseEnrichResponse(503, {}, null);
  check("503 -> retryable", down.kind === "error" && down.retryable);
  check("timeout -> retryable", parseEnrichResponse(0, null, "timeout").kind === "error");
}

// ── Classify / rank / format ─────────────────────────────────────────────────
console.log("\nclassify + format");
{
  const inputs = buildLeadInputs(contact(), NOW);
  check("primary verdict: confirmed", derivePrimaryVerdict(inputs, { ok: true, isValid: true, grade: "A", activityScore: 90, lineType: "Mobile", nameMatch: true, litigator: false }) === "confirmed");
  check("primary verdict: unchecked on failure", derivePrimaryVerdict(inputs, { ok: false, failure: "timeout", status: 0 }) === "unchecked");
  check("primary verdict: none", derivePrimaryVerdict(buildLeadInputs(contact({ phone: "" }), NOW), null) === "none");

  const phones = [
    { e164: "+13054120142", type: "mobile", isConnected: true, lastReported: null, index: 0 },
    { e164: null, type: "", isConnected: null, lastReported: null, index: 1 },
    { e164: "+13054120177", type: "mobile", isConnected: true, lastReported: null, index: 2 },
    { e164: "+13054120177", type: "mobile", isConnected: true, lastReported: null, index: 3 },
  ];
  const cands = extractCandidates(phones, inputs.existingKeys);
  check("candidates drop existing, invalid and duplicates", cands.length === 1 && cands[0]!.e164 === "+13054120177");

  const mk = (e164: string, check: TrestleCheck | null, index = 0) =>
    classifyFound({ e164, type: "mobile", isConnected: true, lastReported: null, index }, check);
  const ranked = rankFound([
    mk("+13054120101", { ok: true, isValid: true, grade: "C", activityScore: 40, lineType: "Landline", nameMatch: null, litigator: false }, 0),
    mk("+13054120102", { ok: true, isValid: false, grade: "F", activityScore: null, lineType: null, nameMatch: null, litigator: false }, 1),
    mk("+13054120103", { ok: true, isValid: true, grade: "A", activityScore: 90, lineType: "Mobile", nameMatch: true, litigator: false }, 2),
    mk("+13054120104", { ok: true, isValid: true, grade: "F", activityScore: 90, lineType: "Mobile", nameMatch: true, litigator: true }, 3),
    mk("+13054120105", { ok: true, isValid: true, grade: "B", activityScore: 70, lineType: "Mobile", nameMatch: null, litigator: false }, 4),
  ]);
  check("rank: verified, possible by activity, litigator last, invalid dropped", j(ranked.map((n) => n.e164.slice(-3))) === j(["103", "105", "101", "104"]), j(ranked.map((n) => n.e164.slice(-3))));

  const base: ResultsView = { outcome: "found", numbers: ranked as FoundNumber[], primaryVerdict: "confirmed", primaryLitigator: false, identityScore: 92, minIdentityScore: 75, uncheckedCount: 0 };
  const text = formatResultsText(base, NOW, "America/New_York");
  check("format: searched line in agent tz", text.includes("Searched Oct 16, 2026, 3:00 PM"), text);
  check("format: primary confirmed line", text.includes("The phone on file is registered to this lead."));
  check("format: activity 40 shown but not flagged disconnected", text.includes("305-412-0101 · Landline · active 40/100") && !text.includes("0101 · Landline · active 40/100 · may be"));
  const dead = formatResultsText(
    { ...base, numbers: [{ ...ranked[0]!, activityScore: 20 }] },
    NOW,
    "UTC"
  );
  check("format: activity ≤30 flagged 'may be disconnected'", dead.includes("active 20/100 · may be disconnected"), dead);
  check("format: daily limit", formatResultsText({ ...base, outcome: "daily_limit", detail: "100 per day" }, NOW, "UTC").startsWith("Daily search limit reached (100 per day)."));
  check("format: failed", formatResultsText({ ...base, outcome: "failed", detail: "x" }, NOW, "UTC").startsWith("Search failed: x."));
  check("format: none", formatResultsText({ ...base, outcome: "none", numbers: [] }, NOW, "UTC").startsWith("No new numbers"));
  check("mask phone", maskPhone("+13054120142") === "305•••••42");
}

// ── Webhook helpers ──────────────────────────────────────────────────────────
console.log("\nwebhook");
{
  check("bearer ok", isAuthorizedBearer("Bearer s3cret-value", "s3cret-value"));
  check("bearer case-insensitive scheme", isAuthorizedBearer("bearer s3cret-value", "s3cret-value"));
  check("wrong secret", !isAuthorizedBearer("Bearer nope", "s3cret-value"));
  check("missing header", !isAuthorizedBearer(null, "s3cret-value"));
  check("no secret configured", !isAuthorizedBearer("Bearer x", ""));
  check("contactId", parseWebhookContactId({ contactId: "abcDEF1234567890xyzA" }) === "abcDEF1234567890xyzA");
  check("contact_id", parseWebhookContactId({ contact_id: "abcDEF1234567890xyzA" }) === "abcDEF1234567890xyzA");
  check("customData.contactId", parseWebhookContactId({ customData: { contactId: "abcDEF1234567890xyzA" } }) === "abcDEF1234567890xyzA");
  check("unrendered merge field rejected", parseWebhookContactId({ contactId: "{{contact.id}}" }) === null);
}

asyncTests()
  .catch((e) => {
    failed++;
    console.log("  ✗ async tests threw:", e);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
