/**
 * Offline checks for the agent platform's client-data rules (Phase 1, chunk C2): what an agent sees
 * of their clients' numbers, who may reveal or erase one, the alerts, the RI/WA rule, Impact's state
 * notices and the messages an agent sends a client. Isaac's own applications must come through every
 * one of these unchanged.
 *
 *  - masked owner views and the reveal authorization table (the token route's rule, then the
 *    reveal's own), the reveal target parser, and the masked round trip (a mask sent back is a no-op);
 *  - the hidden platform keys a save can't write;
 *  - the alert decision and its once-only flag, the jobs' payloads, the alert address and email (no
 *    client details);
 *  - Rhode Island and Washington; Impact's notices (verbatim copies, looked up by state and language);
 *  - the purge: which keys (repeater sub-fields included), idempotence (the route's too), the 30-day
 *    hops, a later completion superseding an older job, and the daily reconcile as its backstop;
 *  - the delivery messages per locale (Spanish with "usted"), and the wa.me / sms: links;
 *  - guards over the routes: no-store and audit-before-value on reveal, owner-only reveal/purge,
 *    exact-JSON and same-origin requests, denied rows for signed-in callers only, the RI/WA refusal
 *    on completion, signature checks first on the queue routes, and the notices kept out of the
 *    shared form's bundle.
 *
 * No network, no database, no API keys. Run with: pnpm test:agent-data
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  AGENT_ALERTS_KEY,
  AGENT_JOB_MAX_DELAY_SECONDS,
  AGENT_PURGE_AFTER_DAYS,
  agentAlertAddress,
  agentApplicationBlocked,
  agentOwnerMayActOnSensitive,
  agentPurgeDueAt,
  agentPurgeSuperseded,
  alertEventKey,
  alertSentFlag,
  alertStartedDue,
  ENTERED_IN_IMPACT_KEY,
  isJsonContentType,
  parseAgentAlertJob,
  parseAgentPurgeJob,
  parseRevealTarget,
  PLATFORM_DATA_KEYS,
  purgeHopDelaySeconds,
  revealFieldName,
  revealStoredValue,
  sameOriginFetch,
  SENSITIVE_PURGED_KEY,
  sensitiveMasked,
  withoutPlatformKeys,
} from "../lib/tenancy/agent-data";
import { agentAlertEmail } from "../lib/tenancy/agent-alert-email";
import {
  deliveryMessage,
  deliveryPhoneDigits,
  firstNameOf,
  smsDeliveryHref,
  whatsappDeliveryHref,
} from "../lib/tenancy/delivery";
import {
  DEFAULT_STATE_NOTICE,
  IMPACT_NOTICES_SOURCES,
  IMPACT_NOTICES_VERSION,
  IMPACT_UNAVAILABLE_STATES,
  impactNoticeFor,
  impactUnavailableIn,
  normalizeStateCode,
  STATE_NOTICES,
} from "../lib/impact-disclosures/notices";
import {
  IMPACT_UNAVAILABLE_STATES as AVAILABILITY_UNAVAILABLE_STATES,
  impactStateName,
  impactUnavailableIn as availabilityUnavailableIn,
} from "../lib/impact-disclosures/availability";
import { blankSensitiveValues, planSensitivePurge, sensitiveFieldNames, sensitiveValuesHeld } from "../lib/intake-core/purge";
import { planIntakePatch, withoutUnchanged } from "../lib/intake-core/patch";
import { sensitiveRowKeys, sensitiveScalarKeys } from "../lib/intake-core/fields";
import { stableJson } from "../lib/intake-core/diff";
import { maskSensitive } from "../lib/intake-shared/masking";
import { decideTokenAccess, type TokenAccessInput } from "../lib/tenancy/operator";
import type { AgentGateFields, TenancyGates } from "../lib/tenancy/gates";
import { healthAlternativeIntake } from "../lib/intake-configs/health-alternative";
import type { IntakeData } from "../lib/intake-core/types";

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

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, ...path.split("/")), "utf8");
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

const SECTIONS = healthAlternativeIntake.sections;
const HA = "health-alternative";
const OFF: TenancyGates = { publicPages: false, clientData: false, leadStore: false };
const testAgent: AgentGateFields = { status: "active", isTest: true };
const pausedAgent: AgentGateFields = { status: "paused", isTest: true };

// Fake ids only (the repo is public).
const ISAAC = "user_isaac_test";
const AGENT_A = "user_agent_a";
const AGENT_B = "user_agent_b";
const DEVICE = "device_client_1";

/* ─── masked views and reveal ─────────────────────────────────────────────── */

console.log("\nMasked owner views (lib/tenancy/agent-data.ts sensitiveMasked)");
{
  check("the client's browser always gets masks", sensitiveMasked({ role: "client", ownerIsAgent: false }) && sensitiveMasked({ role: "client", ownerIsAgent: true }));
  check("an agent's own view of their client's application gets masks", sensitiveMasked({ role: "owner", ownerIsAgent: true }));
  check("Isaac's owner view is unchanged: the values", !sensitiveMasked({ role: "owner", ownerIsAgent: false }));
}

console.log("\nReveal and purge: who (the token route's rule, then the agent-owner rule)");
{
  /** The whole path a reveal takes: `decideTokenAccess` (loadAuthorizedSession), then the route's own rule. */
  const reveal = (input: Partial<TokenAccessInput> & { userId: string | null; ownerUserId: string }) => {
    const { ownerUserId, ...rest } = input;
    const ownerAgent = rest.ownerAgent === undefined ? testAgent : rest.ownerAgent;
    const decision = decideTokenAccess({
      lob: HA,
      row: { ownerUserId, clientUserId: null, clientDeviceId: DEVICE, expiresAt: null },
      deviceId: null,
      impersonated: false,
      callerKind: "client",
      ownerAgreementsAccepted: true,
      surface: "main",
      gates: OFF,
      ...rest,
      ownerAgent,
    });
    if (decision.outcome !== "allow") return { allowed: false, outcome: decision.outcome, audited: decision.outcome === "deny" && decision.audit };
    const allowed = agentOwnerMayActOnSensitive({
      role: decision.access.role,
      ownerIsAgent: ownerAgent !== null && ownerAgent !== "unknown",
      impersonated: rest.impersonated ?? false,
    });
    return { allowed, outcome: allowed ? "reveal" : "refused_403_audited", audited: !allowed };
  };

  check("the owning agent (active, agreements accepted) may reveal", reveal({ userId: AGENT_A, ownerUserId: AGENT_A }).allowed);
  const impersonated = reveal({ userId: AGENT_A, ownerUserId: AGENT_A, impersonated: true });
  check("…not while impersonated (403, audited)", !impersonated.allowed && impersonated.audited, JSON.stringify(impersonated));
  const noTerms = reveal({ userId: AGENT_A, ownerUserId: AGENT_A, ownerAgreementsAccepted: false });
  check("…not before accepting the current agreements (403, audited)", !noTerms.allowed && noTerms.audited);
  const paused = reveal({ userId: AGENT_A, ownerUserId: AGENT_A, ownerAgent: pausedAgent });
  check("…not while paused (403, audited)", !paused.allowed && paused.audited);
  const isaac = reveal({ userId: ISAAC, ownerUserId: AGENT_A, callerKind: "admin" });
  check("Isaac (admin) on an agent's application: denied and audited", !isaac.allowed && isaac.audited, JSON.stringify(isaac));
  const isaacImpersonating = reveal({ userId: ISAAC, ownerUserId: AGENT_A, callerKind: "admin", impersonated: true });
  check("…impersonating someone else: denied and audited", !isaacImpersonating.allowed && isaacImpersonating.audited);
  const otherAgent = reveal({ userId: AGENT_B, ownerUserId: AGENT_A, callerKind: "agent" });
  check("another agent: denied and audited", !otherAgent.allowed && otherAgent.audited);
  const client = reveal({ userId: null, ownerUserId: AGENT_A, deviceId: DEVICE, surface: "product" });
  check("the client's own browser (product domain, bound device): refused", client.outcome === "refused_403_audited");
  const ownSession = reveal({ userId: ISAAC, ownerUserId: ISAAC, ownerAgent: null });
  check("Isaac on his own application (never masked): refused, nothing to reveal", ownSession.outcome === "refused_403_audited");
  const unknown = reveal({ userId: AGENT_A, ownerUserId: AGENT_A, ownerAgent: "unknown" });
  check("a failed owner lookup: retry, nothing revealed", !unknown.allowed && unknown.outcome === "retry");
  check(
    "the agent-owner rule alone: owner + agent + in person only",
    agentOwnerMayActOnSensitive({ role: "owner", ownerIsAgent: true, impersonated: false }) &&
      !agentOwnerMayActOnSensitive({ role: "owner", ownerIsAgent: true, impersonated: true }) &&
      !agentOwnerMayActOnSensitive({ role: "owner", ownerIsAgent: false, impersonated: false }) &&
      !agentOwnerMayActOnSensitive({ role: "client", ownerIsAgent: true, impersonated: false })
  );
}

console.log("\nReveal: which value (parseRevealTarget)");
{
  const scalars = sensitiveScalarKeys(SECTIONS);
  check("Health Coverage's sensitive scalars are SSN/ITIN, ID number and the bank numbers", same(scalars, ["ssn", "idDocNumber", "routingNumber", "accountNumber"]), scalars.join(","));
  check("…and each added person's SSN", same(sensitiveRowKeys(SECTIONS), [["dependents", ["ssn"]]]));
  for (const key of scalars) {
    const target = parseRevealTarget(SECTIONS, { field: key });
    check(`"${key}" is a target`, target?.kind === "scalar" && revealFieldName(target) === key);
  }
  const row = parseRevealTarget(SECTIONS, { field: "dependents.ssn", rowIndex: 2 });
  check('"dependents.ssn" row 2 is a target, logged as its name only', row?.kind === "row" && row.rowIndex === 2 && revealFieldName(row) === "dependents.ssn");
  check("a non-sensitive field is not", parseRevealTarget(SECTIONS, { field: "firstName" }) === null && parseRevealTarget(SECTIONS, { field: "bankName" }) === null);
  check("a non-sensitive sub-field is not", parseRevealTarget(SECTIONS, { field: "dependents.firstName", rowIndex: 0 }) === null);
  check("a row field needs a valid index", parseRevealTarget(SECTIONS, { field: "dependents.ssn" }) === null && parseRevealTarget(SECTIONS, { field: "dependents.ssn", rowIndex: -1 }) === null && parseRevealTarget(SECTIONS, { field: "dependents.ssn", rowIndex: 1.5 }) === null && parseRevealTarget(SECTIONS, { field: "dependents.ssn", rowIndex: 6 }) === null);
  check("a scalar takes no index", parseRevealTarget(SECTIONS, { field: "ssn", rowIndex: 0 }) === null);
  check("junk is not a target", [null, "ssn", [], {}, { field: 7 }, { field: "__proto__" }, { field: "a.b.c" }, { field: "constructor" }].every((b) => parseRevealTarget(SECTIONS, b) === null));
  const data: IntakeData = { ssn: "enc:v1:x", dependents: [{ ssn: "enc:v1:a" }, { ssn: "enc:v1:b" }] };
  check(
    "the stored value at a target (still encrypted, decrypted by the route only)",
    revealStoredValue({ kind: "scalar", key: "ssn" }, data) === "enc:v1:x" &&
      revealStoredValue({ kind: "row", repeaterKey: "dependents", subKey: "ssn", rowIndex: 1 }, data) === "enc:v1:b" &&
      revealStoredValue({ kind: "row", repeaterKey: "dependents", subKey: "ssn", rowIndex: 5 }, data) === undefined
  );
}

console.log("\nMasked round trip: a mask an agent's form sends back changes nothing (planIntakePatch)");
{
  const stored: IntakeData = {
    firstName: "Ana",
    ssn: "123456789",
    idDocNumber: "D1234567",
    routingNumber: "021000021",
    accountNumber: "000123456789",
    hasDependents: "yes",
    dependents: [
      { firstName: "Luis", idType: "SSN", ssn: "987654321" },
      { firstName: "Eva", idType: "None", ssn: "" },
    ],
  };
  const masked = maskSensitive(stored, sensitiveScalarKeys(SECTIONS), sensitiveRowKeys(SECTIONS));
  check("the view the agent gets holds no number", !/\d{5,}/.test(JSON.stringify(masked)), JSON.stringify(masked));
  const echoed = withoutUnchanged(planIntakePatch(SECTIONS, masked, stored), stored);
  check("the whole masked view sent back writes nothing", Object.keys(echoed).length === 0, JSON.stringify(echoed));
  const edited = withoutUnchanged(planIntakePatch(SECTIONS, { ...masked, firstName: "Ana María" }, stored), stored);
  check("an edit beside the masks writes only the edit", same(Object.keys(edited), ["firstName"]), JSON.stringify(edited));
}

console.log("\nHidden platform keys");
{
  check("three keys, all the server's", same(PLATFORM_DATA_KEYS, [AGENT_ALERTS_KEY, ENTERED_IN_IMPACT_KEY, SENSITIVE_PURGED_KEY]));
  const sent: IntakeData = { firstName: "Ana", agentAlerts: { started: "x" }, enteredInImpactAt: "2026-01-01", sensitivePurgedAt: "y", impactQuote: { id: "q" } };
  const kept = withoutPlatformKeys(sent);
  check("a save (or the client's view) loses them, and only them", same(kept, { firstName: "Ana", impactQuote: { id: "q" } }), JSON.stringify(kept));
  check("…without touching the object it was given", "agentAlerts" in sent);
  check(
    "no config field uses one of their names (the CRM payload, summary and completion check never see them)",
    !SECTIONS.flatMap((s) => s.fields).some((f) => PLATFORM_DATA_KEYS.includes(f.key))
  );
  const save = read("lib/intake-core/save.ts");
  check("every shared-intake save strips them first", /const incoming = withoutPlatformKeys\(sanitizeIntakeData\(config\.sections, body\?\.\[field\]\)\);/.test(save));
  check("…and answers the caller through sessionDataForCaller (masks for agents and clients)", (save.match(/sessionDataForCaller\(/g) ?? []).length >= 2 && /sensitiveMasked\(caller\)/.test(save));
  check("the load route answers through the same rule", /sessionDataForCaller\(/.test(read("app/api/intake/[lob]/[token]/route.ts")) && !/maskSensitiveForClient/.test(read("app/api/intake/[lob]/[token]/route.ts")));
  check("…and so does the files route", /sessionDataForCaller\(config, caller, data\)/.test(read("app/api/intake/[lob]/[token]/files/route.ts")));
}

/* ─── alerts ──────────────────────────────────────────────────────────────── */

console.log("\nAlerts: the started alert's decision and its once-only flag");
{
  check("a client save with an email: due", alertStartedDue({ role: "client", data: { email: "a@b.co" } }));
  check("a client save with a phone only: due", alertStartedDue({ role: "client", data: { phone: "5405550100" } }));
  check("no email or phone yet (an anonymous start, a link preview): not due", !alertStartedDue({ role: "client", data: { firstName: "Ana" } }) && !alertStartedDue({ role: "client", data: { email: "  ", phone: "" } }));
  check("the agent's own typing: not news", !alertStartedDue({ role: "owner", data: { email: "a@b.co" } }));
  check("once flagged, never again", !alertStartedDue({ role: "client", data: { email: "a@b.co", agentAlerts: { started: "2026-11-23T00:00:00Z" } } }));
  check("a flag object of the wrong shape doesn't block it", alertStartedDue({ role: "client", data: { email: "a@b.co", agentAlerts: "junk" } }));
  const server = read("lib/intake-core/server.ts");
  const claim = server.slice(server.indexOf("export async function claimSessionDataFlag"), server.indexOf("export async function releaseSessionDataFlag"));
  check(
    "the flag is claimed in ONE conditional statement (only if not set; one winner)",
    /\.update\(intakeSessions\)/.test(claim) && /is null`/.test(claim) && /\.returning\(/.test(claim) && !/\bselect\(/.test(claim)
  );
  const jobs = read("lib/tenancy/agent-jobs.ts");
  check(
    "the started alert claims the flag before queuing and gives it back if queuing fails",
    /claimSessionDataFlag\(session\.id, AGENT_ALERTS_KEY, "started"/.test(jobs) && /if \(!queued\) await releaseSessionDataFlag\(session\.id, AGENT_ALERTS_KEY, "started"\)/.test(jobs)
  );
  check("…and only for an agent's application (the save checks the owner)", /if \(loaded\.ownerAgent\) await alertAgentOnFirstClientSave\(/.test(read("lib/intake-core/save.ts")));
}

console.log("\nAlerts: events, jobs, address and email");
{
  check("event keys", alertEventKey("started") === "started" && alertEventKey("completed", 1795401146333) === "completed:1795401146333" && alertEventKey("secure_submit", "cap_123") === "secure_submit:cap_123");
  check("each event has its own sent flag", alertSentFlag("started") === "sent:started" && alertSentFlag("completed:1") !== alertSentFlag("completed:2"));
  const job = { kind: "completed", lob: HA, sessionId: "abc_DEF-123", event: "completed:1795401146333" };
  check("a well-formed alert job parses", same(parseAgentAlertJob(job), job));
  check(
    "a malformed one doesn't (unknown kind, an event of another kind, a bad id)",
    parseAgentAlertJob({ ...job, kind: "deleted" }) === null &&
      parseAgentAlertJob({ ...job, event: "started" }) === null &&
      parseAgentAlertJob({ ...job, sessionId: "a b" }) === null &&
      parseAgentAlertJob(null) === null
  );
  check(
    "alerts go to the alert email, else the contact email, else the login email",
    agentAlertAddress({ alertEmail: "alerts@x.co", contactEmail: "c@x.co", email: "l@x.co" }) === "alerts@x.co" &&
      agentAlertAddress({ alertEmail: null, contactEmail: "c@x.co", email: "l@x.co" }) === "c@x.co" &&
      agentAlertAddress({ alertEmail: " ", contactEmail: "not-an-email", email: "l@x.co" }) === "l@x.co" &&
      agentAlertAddress({ alertEmail: null, contactEmail: null, email: null }) === null
  );
  const url = "https://www.example.com/es/agente";
  for (const locale of ["en", "es"] as const) {
    for (const kind of ["started", "completed", "secure_submit"] as const) {
      const email = agentAlertEmail({ kind, locale, dashboardUrl: url });
      check(`${locale}/${kind}: a subject, and the dashboard link in text and HTML`, email.subject.length > 10 && email.text.includes(url) && email.html.includes(url));
    }
  }
  const es = agentAlertEmail({ kind: "completed", locale: "es", dashboardUrl: url });
  check("Spanish uses usted", /Abra su panel/.test(es.text) && !/\btu\b|\babre\b/i.test(es.text));
  check(
    "…and one closing line that fits every alert (no pronoun to agree with \"solicitud\" or \"formulario\")",
    ["started", "completed", "secure_submit"].every((kind) =>
      agentAlertEmail({ kind: kind as "started", locale: "es", dashboardUrl: url }).text.includes("Abra su panel para ver los detalles:")
    )
  );
  check(
    "the email builder takes no client data at all (kind, locale and the dashboard link only)",
    /export function agentAlertEmail\(input: \{\s*kind: AgentAlertKind;\s*locale: "en" \| "es";\s*dashboardUrl: string;\s*\}\)/.test(read("lib/tenancy/agent-alert-email.ts"))
  );
  const notify = read("app/api/queue/agent-notify/route.ts");
  check("the notify route checks the QStash signature before anything else", notify.indexOf("verifyQStashRequest(req, rawBody)") > 0 && notify.indexOf("verifyQStashRequest(req, rawBody)") < notify.indexOf("JSON.parse(rawBody)"));
  check(
    "…looks the owner up again and skips Isaac's applications",
    /const agent = await ownerAgentOf\(session\.ownerUserId\);/.test(notify) && /if \(!agent\) return done\("not_agent"\);/.test(notify)
  );
  check(
    "…claims the event's flag before sending, and gives it back when the send fails",
    notify.indexOf("claimSessionDataFlag(") < notify.indexOf("sendTransactionalEmail(") && /releaseSessionDataFlag\(session\.id, AGENT_ALERTS_KEY, flag\)/.test(notify)
  );
  check("…and sends only the alert email (no session data reaches it)", /sendTransactionalEmail\(\{ to, \.\.\.email \}\)/.test(notify));
  check(
    "…and with email off on the deployment, reads nothing (the check comes before the session read)",
    notify.indexOf("transactionalEmailConfigured()") > 0 && notify.indexOf("transactionalEmailConfigured()") < notify.indexOf("getIntakeSessionById(")
  );
  const complete = read("app/api/intake/[lob]/[token]/complete/route.ts");
  check(
    "completion queues the purge (and, when the client completed it, the alert) for an agent's application only",
    /if \(ownerAgent\) await afterAgentCompletion\(updated, access\.role\);/.test(complete)
  );
  const jobsSource = read("lib/tenancy/agent-jobs.ts");
  check(
    "…the alert only for the client's completion, the purge for every one",
    /if \(by === "client"\) \{[\s\S]*?kind: "completed"[\s\S]*?\r?\n {2}\}\r?\n {2}try \{\s*const scheduled = await scheduleAgentPurge\(/.test(jobsSource)
  );
  const capture = read("app/api/intake-capture/[captureToken]/route.ts");
  check(
    "a secure-link submit is on record and alerts the agent, for an agent's application only",
    /if \(ownerAgent\) \{[\s\S]*?action: "secure_submit"[\s\S]*?kind: "secure_submit"/.test(capture)
  );
  const transactional = read("lib/email/transactional.ts");
  check(
    "Resend over REST with fetch; skipped (logged once) without RESEND_API_KEY / PLATFORM_EMAIL_FROM",
    /https:\/\/api\.resend\.com\/emails/.test(transactional) && /RESEND_API_KEY/.test(transactional) && /PLATFORM_EMAIL_FROM/.test(transactional) && /warnedUnconfigured/.test(transactional)
  );
  const senderCode = transactional
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  check(
    "the sender imports nothing and reads none of Isaac's CRM or mailbox settings",
    !/\bfrom\s+["']/.test(senderCode) && !/AGENT_CRM_|agentCrmGetBaseCredentials|EMAIL_(HOST|PORT|USER|PASS)|nodemailer/i.test(senderCode)
  );
  const agentJobs = read("lib/tenancy/agent-jobs.ts");
  check("with QStash off, nothing is queued (no inline fallback)", /if \(!isQStashPublishConfigured\(\)\)/.test(agentJobs) && !/sendTransactionalEmail/.test(agentJobs));
}

/* ─── Rhode Island, Washington, and Impact's notices ──────────────────────── */

console.log("\nRhode Island and Washington");
{
  check("Impact's footer: not available in RI and WA", same(IMPACT_UNAVAILABLE_STATES, ["RI", "WA"]));
  for (const value of ["RI", "ri", " WA ", "wa", "R.I.", "Rhode Island", "washington", "W.A."]) {
    check(`"${value}" is unavailable`, impactUnavailableIn(value));
  }
  for (const value of ["VA", "Virginia", "West Virginia", "DC", "Washington DC", "", null, 42, "XX", "Rhode"]) {
    check(`"${String(value)}" is not`, !impactUnavailableIn(value));
  }
  check("an agent's application from WA is blocked", agentApplicationBlocked({ ownerIsAgent: true, state: "WA" }));
  check("Isaac's is never blocked (unchanged)", !agentApplicationBlocked({ ownerIsAgent: false, state: "WA" }) && !agentApplicationBlocked({ ownerIsAgent: false, state: "RI" }));
  check("an agent's from VA goes through", !agentApplicationBlocked({ ownerIsAgent: true, state: "VA" }));
  const complete = read("app/api/intake/[lob]/[token]/complete/route.ts");
  check(
    "the complete route refuses it server-side, before validating, with a code the form explains",
    /agentApplicationBlocked\(\{ ownerIsAgent: ownerAgent !== null, state: decrypted\.state \}\)/.test(complete) &&
      complete.indexOf("agentApplicationBlocked(") < complete.indexOf("validateForCompletion(") &&
      /code: "state_unavailable"/.test(complete)
  );
  const form = read("components/intake/intake-form.tsx");
  check(
    "the form: the message at the state question and at submit, and Submit disabled",
    /field\.key === "state" && stateBlocked/.test(form) && /disabled=\{completing \|\| stateBlocked\}/.test(form) && /const agentRules = agentArea \|\| agentOwned;/.test(form)
  );
  check("only agents' applications get the rules (the product domain's client form, the agent area)", /agentOwned \/>/.test(read("app/[locale]/health-alternative/intake/[token]/page.tsx")));
  check(
    "one list and one rule: the notices module re-exports the availability module's",
    AVAILABILITY_UNAVAILABLE_STATES === IMPACT_UNAVAILABLE_STATES && availabilityUnavailableIn === impactUnavailableIn
  );
  check("the message names the state", impactStateName("wa") === "Washington" && impactStateName("Rhode Island") === "Rhode Island" && impactStateName("") === "");
  const withoutBlockComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");
  check("the availability module carries no notice text", !/notices/.test(withoutBlockComments(read("lib/impact-disclosures/availability.ts"))));
  check(
    "the shared form (Isaac's intakes too) never bundles the notices: availability statically, the notice component through next/dynamic",
    !/from "@\/lib\/impact-disclosures\/notices"/.test(form) &&
      !/from "@\/components\/intake\/impact-state-notice"/.test(form) &&
      /from "@\/lib\/impact-disclosures\/availability"/.test(form) &&
      (form.match(/dynamic\(\s*\(\) => import\("@\/components\/intake\/impact-state-notice"\)/g) ?? []).length === 2
  );
  check("…nor does lib/tenancy/agent-data.ts, which the form imports", !/impact-disclosures\/notices/.test(withoutBlockComments(read("lib/tenancy/agent-data.ts"))));
}

console.log("\nImpact's state notices (lib/impact-disclosures/notices.ts)");
{
  check("versioned, with both sources", IMPACT_NOTICES_VERSION === "2026-11-23" && IMPACT_NOTICES_SOURCES.en.startsWith("https://www.impacthealthsharing.com/") && IMPACT_NOTICES_SOURCES.es.startsWith("https://www.impacthealthsharing.com/es/"));
  const codes = Object.keys(STATE_NOTICES);
  check(`${codes.length} states, every key a real two-letter code`, codes.length === 31 && codes.every((c) => normalizeStateCode(c) === c));
  check("no notice for a state Impact doesn't serve", !codes.some((c) => IMPACT_UNAVAILABLE_STATES.includes(c)));
  check(
    "every notice has a title and text (English always; Spanish where Impact's Spanish page has one)",
    Object.values(STATE_NOTICES).every(
      (n) => n.en.title && n.en.paragraphs.length > 0 && n.en.paragraphs.every((p) => p.length > 20 || p.endsWith("?")) && (n.es === null || (n.es.title && n.es.paragraphs.length > 0))
    )
  );
  check("26 have Impact's Spanish text; MA, MT, TN, UT and WV don't", codes.filter((c) => STATE_NOTICES[c].es).length === 26 && ["MA", "MT", "TN", "UT", "WV"].every((c) => STATE_NOTICES[c].es === null));
  const fl = impactNoticeFor("FL", "en");
  check("Florida, English: its statute's notice", fl?.text.title === "Florida Statute 624.1265" && fl.language === "en" && !fl.general && fl.text.paragraphs[0].includes("Florida Insurance Code"));
  const flEs = impactNoticeFor("fl", "es");
  check("Florida, Spanish: Impact's Spanish text", flEs?.language === "es" && flEs.text.title === "Florida Estatuto 624.1265");
  const mt = impactNoticeFor("Montana", "es");
  check("Montana in a Spanish form: Impact's English text (no Spanish one exists)", mt?.language === "en" && mt.text.title.startsWith("Montana"));
  const ca = impactNoticeFor("CA", "en");
  check("a state Impact doesn't list: its general notice", ca?.general === true && ca.text === DEFAULT_STATE_NOTICE.en && ca.state === "CA");
  check("no state yet: the general notice", impactNoticeFor("", "es")?.general === true && impactNoticeFor(null, "es")?.text === DEFAULT_STATE_NOTICE.es);
  check("RI and WA: no notice (blocked instead)", impactNoticeFor("WA", "en") === null && impactNoticeFor("ri", "es") === null);
  check("New Jersey keeps its link", STATE_NOTICES.NJ.en.links?.[0]?.href.startsWith("https://www.nj.gov/") === true && STATE_NOTICES.NJ.en.paragraphs.some((p) => p.includes("Learn more here")));
  const source = read("lib/impact-disclosures/notices.ts");
  check("the source and fetch date are in the file's comment", source.includes("https://www.impacthealthsharing.com/disclosures (fetched 2026-11-23)") && source.includes("https://www.impacthealthsharing.com/es/disclosures (fetched 2026-11-23)"));
}

/* ─── purge ───────────────────────────────────────────────────────────────── */

console.log("\nPurge: which keys, and only those");
{
  check(
    "the purge covers SSN/ITIN, the ID number, both bank numbers and each person's SSN",
    same(sensitiveFieldNames(SECTIONS), ["ssn", "idDocNumber", "routingNumber", "accountNumber", "dependents.ssn"])
  );
  const stored: IntakeData = {
    firstName: "Ana",
    taxIdType: "SSN",
    ssn: "enc:v1:aaa",
    idDocType: "Passport",
    idDocNumber: "enc:v1:bbb",
    bankName: "Bank of Example",
    routingNumber: "enc:v1:ccc",
    accountNumber: "enc:v1:ddd",
    accountType: "Checking",
    dependents: [
      { firstName: "Luis", idType: "SSN", ssn: "enc:v1:eee" },
      { firstName: "Eva", idType: "None", ssn: "" },
    ],
    agentAlerts: { started: "t" },
  };
  const { patch, fields } = planSensitivePurge(SECTIONS, stored);
  check("every sensitive scalar is blanked", ["ssn", "idDocNumber", "routingNumber", "accountNumber"].every((k) => patch[k] === null));
  check(
    "each person's SSN is blanked and the rest of the row kept",
    same(patch.dependents, [
      { firstName: "Luis", idType: "SSN", ssn: "" },
      { firstName: "Eva", idType: "None", ssn: "" },
    ])
  );
  check("nothing else is written (names, bank name, account type, the alert flags)", same(Object.keys(patch).sort(), ["accountNumber", "dependents", "idDocNumber", "routingNumber", "ssn"]));
  check("the audit names what had a value", same(fields, ["ssn", "idDocNumber", "routingNumber", "accountNumber", "dependents.ssn"]));
  const after = { ...stored, ...patch };
  const again = planSensitivePurge(SECTIONS, after);
  check("idempotent: a purged application has nothing left to erase", Object.keys(again.patch).length === 0 && again.fields.length === 0);
  check("…and blanking it again changes nothing", same(blankSensitiveValues(SECTIONS, after), after));
  const partial = planSensitivePurge(SECTIONS, { firstName: "Ana", accountNumber: "enc:v1:x" });
  check("one number left: erased, with every sensitive scalar nulled (one saved meanwhile goes too)", partial.patch.accountNumber === null && partial.patch.ssn === null && same(partial.fields, ["accountNumber"]));
  check("the shared purge-after-sync transform is the same one", /return blankSensitiveValues\(config\.sections, data\);/.test(read("lib/intake-core/sensitive.ts")));
  const masked = maskSensitive(stored, sensitiveScalarKeys(SECTIONS), sensitiveRowKeys(SECTIONS));
  check(
    "a number on file, typed, or masked in the agent's view counts as held; a purged application holds none",
    sensitiveValuesHeld(SECTIONS, stored) && sensitiveValuesHeld(SECTIONS, masked) && sensitiveValuesHeld(SECTIONS, { dependents: [{ ssn: "••• •• 4321" }] }) && !sensitiveValuesHeld(SECTIONS, after) && !sensitiveValuesHeld(SECTIONS, { firstName: "Ana" })
  );
  const form = read("components/intake/intake-form.tsx");
  check(
    "the form brings \"Entered in Impact\" back when a number is typed again after it",
    /const enteredAndClear = Boolean\(enteredAt\) && !sensitiveValuesHeld\(config\.sections, data\);/.test(form) && /\{enteredAndClear \? \(/.test(form)
  );
}

console.log("\nPurge: the agent's action and the 30-day job");
{
  const route = read("app/api/intake/[lob]/[token]/purge/route.ts");
  check("the owning agent in person only", /agentOwnerMayActOnSensitive\(\{ role: access\.role, ownerIsAgent: ownerAgent !== null, impersonated: Boolean\(actor\) \}\)/.test(route));
  check("completed applications only", /if \(row\.status !== "completed"\)/.test(route));
  check(
    "one statement: the erased values and enteredInImpactAt together, then a purge row",
    /await patchIntakeData\(token, \{\s*\.\.\.patch,\s*\[ENTERED_IN_IMPACT_KEY\]: enteredBefore \?\? at,/.test(route) && route.indexOf("patchIntakeData(") < route.indexOf('action: "purge"')
  );
  check(
    "idempotent: marked already and nothing back on file answers the first date, with no write and no new row",
    /if \(enteredBefore && Object\.keys\(patch\)\.length === 0\) \{\s*return NextResponse\.json\(\{ success: true, enteredInImpactAt: enteredBefore, erased: \[\] \}\);/.test(route) &&
      route.indexOf("if (enteredBefore && Object.keys(patch).length === 0)") < route.indexOf("patchIntakeData(")
  );
  const completedAt = new Date("2026-11-23T12:00:00Z");
  const due = agentPurgeDueAt(completedAt);
  check(`due ${AGENT_PURGE_AFTER_DAYS} days after completion`, due === Math.floor(completedAt.getTime() / 1000) + 30 * 86_400);
  const t0 = completedAt.getTime() / 1000;
  check("the first hop is capped under QStash's 7-day limit", purgeHopDelaySeconds(due, t0) === AGENT_JOB_MAX_DELAY_SECONDS && AGENT_JOB_MAX_DELAY_SECONDS < 7 * 86_400);
  let at = t0;
  let hops = 0;
  for (let wait = purgeHopDelaySeconds(due, at); wait !== null && hops < 20; wait = purgeHopDelaySeconds(due, at)) {
    at += wait;
    hops++;
  }
  check(`it lands on the due time in ${hops} hops`, hops === 5 && Math.abs(at - due) <= 60, `${hops} hops, ${at - due}s off`);
  check("due (or past due): no hop, purge now", purgeHopDelaySeconds(due, due) === null && purgeHopDelaySeconds(due, due + 3600) === null);
  const job = { lob: HA, sessionId: "abc_DEF-123", dueAt: due };
  check("a well-formed purge job parses", same(parseAgentPurgeJob(job), job));
  check("a malformed one doesn't", parseAgentPurgeJob({ ...job, dueAt: "soon" }) === null && parseAgentPurgeJob({ ...job, sessionId: "" }) === null);
  const purgeRoute = read("app/api/queue/agent-purge/route.ts");
  check(
    "the job: signature first, then a hop with no database read until due",
    purgeRoute.indexOf("verifyQStashRequest(") < purgeRoute.indexOf("purgeHopDelaySeconds(") &&
      purgeRoute.indexOf("purgeHopDelaySeconds(") < purgeRoute.indexOf("getIntakeSessionById(")
  );
  const jobs = read("lib/tenancy/agent-jobs.ts");
  check(
    "…skips Isaac's applications, and anything not completed or already purged",
    /if \(!agent\) return done\("not_agent"\);/.test(purgeRoute) &&
      /return done\("not_completed"\)/.test(purgeRoute) &&
      /eraseAgentApplicationSensitive\(config, session\)/.test(purgeRoute) &&
      /if \(Object\.keys\(patch\)\.length === 0\) return "nothing_left";/.test(jobs)
  );

  // Reopened and completed again: the older chain stands down.
  check("the job of the application's own completion is not superseded", !agentPurgeSuperseded(due, completedAt));
  check("…nor by a completion moved by under a minute", !agentPurgeSuperseded(due, new Date(completedAt.getTime() + 30_000)));
  check("completed again 3 days later: the older job stands down", agentPurgeSuperseded(due, new Date(completedAt.getTime() + 3 * 86_400_000)));
  check("no completion date on file: the job keeps its own date", !agentPurgeSuperseded(due, null));
  check(
    "the job checks it once due, after the completed check and before erasing anything",
    purgeRoute.indexOf('return done("not_completed")') < purgeRoute.indexOf("agentPurgeSuperseded(job.dueAt, session.completedAt)") &&
      purgeRoute.indexOf("agentPurgeSuperseded(job.dueAt, session.completedAt)") < purgeRoute.indexOf("eraseAgentApplicationSensitive(config, session)")
  );
  check(
    "the erase is one statement with the stamp, then a purge row by the system",
    /await patchIntakeData\(session\.token, \{ \.\.\.patch, \[SENSITIVE_PURGED_KEY\]: new Date\(\)\.toISOString\(\) \}\)/.test(jobs) &&
      jobs.indexOf("await patchIntakeData(session.token") < jobs.indexOf('action: "purge"') &&
      /actorRole: "system"/.test(jobs)
  );
}

console.log("\nPurge: the daily backstop (queue-reconcile)");
{
  const reconcile = read("app/api/cron/queue-reconcile/route.ts");
  check("the existing daily reconcile runs it, guarded (no new cron)", /agentPurges = await reconcileAgentPurges\(\);/.test(reconcile) && /try \{\s*agentPurges = await reconcileAgentPurges\(\);\s*\} catch/.test(reconcile));
  const crons = (JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] }).crons;
  check("vercel.json gains no cron (the reconcile stays daily)", crons.length === 3 && crons.some((c) => c.path === "/api/cron/queue-reconcile" && c.schedule === "0 7 * * *"));
  const jobs = read("lib/tenancy/agent-jobs.ts");
  const sweep = jobs.slice(jobs.indexOf("export async function reconcileAgentPurges"));
  check(
    "30 days after completion, on the agent lines only, each erased the way the job erases",
    /AGENT_PURGE_AFTER_DAYS \* 86_400_000/.test(sweep) && /for \(const lob of AGENT_LOBS\)/.test(sweep) && /eraseAgentApplicationSensitive\(config, session\)/.test(sweep) && !/publishJob|sendTransactionalEmail/.test(sweep)
  );
  const server = read("lib/intake-core/server.ts");
  const queryStart = server.indexOf("export async function listAgentSessionsHoldingSensitive");
  const query = queryStart < 0 ? "" : server.slice(queryStart, server.indexOf("\nexport ", queryStart + 1));
  check(
    "the query: completed, before the cutoff, an agent's (an agents row) and never an id listed as Isaac's",
    /eq\(intakeSessions\.status, "completed"\)/.test(query) &&
      /lt\(intakeSessions\.completedAt, completedBefore\)/.test(query) &&
      /exists \(select 1 from \$\{agents\} where \$\{agents\.clerkUserId\} = \$\{intakeSessions\.ownerUserId\}\)/.test(query) &&
      /notInArray\(intakeSessions\.ownerUserId, listed\)/.test(query)
  );
  check(
    "…holding a sensitive value, scalars and repeater sub-fields, by the config's keys",
    /sensitiveScalarKeys\(config\.sections\)/.test(query) && /sensitiveRowKeys\(config\.sections\)/.test(query) && /jsonb_array_elements/.test(query)
  );
  check("…bounded, oldest first, and none before migration 0046", /\.limit\(limit\)/.test(query) && /asc\(intakeSessions\.completedAt\)/.test(query) && /if \(isMissingTableError\(error\)\) return \[\];/.test(query));
}

/* ─── delivery ────────────────────────────────────────────────────────────── */

console.log("\nDelivery: the messages an agent sends a client");
{
  const url = "https://guide.example.com/es/alternativa-de-salud/admision/tok123";
  const es = deliveryMessage("application", "es", { agentName: "María López", clientFirstName: "Ana", url });
  check("Spanish, usted, naming the agent, the link last", es === `Hola Ana, le saluda María López. Este es el enlace a su solicitud de cobertura de salud: ${url}`, es);
  const en = deliveryMessage("application", "en", { agentName: "María López", clientFirstName: "Ana", url });
  check("English, naming the agent", en === `Hi Ana, this is María López. Here is the link to your health coverage application: ${url}`, en);
  const secureEs = deliveryMessage("secure", "es", { agentName: "María López", clientFirstName: null, url });
  check("the secure link's: private, once, usted", secureEs.startsWith("Hola, le saluda María López.") && /su enlace privado y seguro/.test(secureEs) && /una sola vez/.test(secureEs) && secureEs.endsWith(url));
  const guide = deliveryMessage("guide", "en", { agentName: "María López", clientFirstName: "Ana", url });
  check("the guide's is nobody's in particular (no client name)", guide.startsWith("Hi, this is María López.") && !guide.includes("Ana"));
  for (const kind of ["application", "secure", "guide"] as const) {
    const text = deliveryMessage(kind, "es", { agentName: "Agente", url });
    check(`es/${kind}: never "tú"`, !/\b(tu|tú|te|haz|abre|llena)\b/i.test(text), text);
  }
  const sneaky = deliveryMessage("application", "en", { agentName: "Bad\nName\u0007", clientFirstName: "A\r\nB", url });
  check("names stay on one line", !/[\r\n\u0007]/.test(sneaky));
  check("first names", firstNameOf("María  López") === "María" && firstNameOf(null) === "");
  check(
    "phones: a US number gets its 1, an international one keeps its code, junk is null",
    deliveryPhoneDigits("(540) 555-0100") === "15405550100" &&
      deliveryPhoneDigits("15405550100") === "15405550100" &&
      deliveryPhoneDigits("+52 55 1234 5678") === "525512345678" &&
      deliveryPhoneDigits("555-0100") === null &&
      deliveryPhoneDigits("") === null &&
      deliveryPhoneDigits(null) === null
  );
  const wa = whatsappDeliveryHref("15405550100", es);
  check("WhatsApp: wa.me to the client's number with the message", wa.startsWith("https://wa.me/15405550100?text=") && decodeURIComponent(wa.split("?text=")[1]) === es);
  check("WhatsApp without a number lets the agent pick the contact", whatsappDeliveryHref(null, "hola").startsWith("https://wa.me/?text="));
  const sms = smsDeliveryHref("15405550100", es);
  check("SMS: the number and the body both phones read", sms.startsWith("sms:+15405550100?&body=") && decodeURIComponent(sms.split("&body=")[1]) === es);
  check("SMS without a number", smsDeliveryHref(null, "hola") === "sms:?&body=hola");
  const dash = read("components/intake/intake-dashboard.tsx");
  check(
    "the dashboard offers them in agent mode only, with a client link, and keeps its own Copy",
    /\{agentMode && clientLinks && \(s\.status !== "completed" \|\| s\.reopenedForClient\) && \(\s*<DeliveryButtons/.test(dash) && /showCopy=\{false\}/.test(dash)
  );
  const buttons = read("components/agent/delivery-buttons.tsx");
  check("WhatsApp and SMS only with a usable phone (or for the guide, any contact)", /const direct = digits !== null \|\| anyRecipient;/.test(buttons));
  check("the share sheet only where the browser has one", /typeof navigator\.share === "function"/.test(buttons));
  check("nothing sends through a CRM", !/agent-crm|leadconnector|crmCredsForOwner|fetch\(/i.test(buttons + read("lib/tenancy/delivery.ts")));
}

/* ─── reveal route guards ─────────────────────────────────────────────────── */

console.log("\nThe reveal route");
{
  const route = read("app/api/intake/[lob]/[token]/reveal/route.ts");
  check("never cached", /"Cache-Control": "no-store, max-age=0"/.test(route) && (route.match(/headers: NO_STORE|\.\.\.NO_STORE/g) ?? []).length >= 2);
  check("no claim: a reveal never binds a browser", /loadAuthorizedSession\(lob, token, \{ claim: false \}\)/.test(route));
  check("the owning agent in person only, and a refusal is a denied row", /agentOwnerMayActOnSensitive\(/.test(route) && /action: "denied"/.test(route));
  check(
    "the reveal row is written before the value is sent, and no row means no value",
    route.indexOf('action: "reveal"') < route.indexOf("answer({ success: true, value })") && /if \(!logged\)/.test(route)
  );
  check("the audit takes the field's name, never the value", /fields: \[revealFieldName\(target\)\]/.test(route));
  check(
    "JSON only, as the exact media type (a CORS-safelisted text/plain body that merely mentions JSON is refused)",
    isJsonContentType("application/json") &&
      isJsonContentType("application/json; charset=utf-8") &&
      isJsonContentType(" Application/JSON ") &&
      !isJsonContentType("text/plain;application/json") &&
      !isJsonContentType("text/plain; charset=application/json") &&
      !isJsonContentType("application/json-patch+json") &&
      !isJsonContentType("") &&
      !isJsonContentType(null)
  );
  check(
    "from this site's pages only: same-origin, or a client that says nothing",
    sameOriginFetch("same-origin") && sameOriginFetch(null) && !sameOriginFetch("cross-site") && !sameOriginFetch("same-site") && !sameOriginFetch("none")
  );
  const purge = read("app/api/intake/[lob]/[token]/purge/route.ts");
  for (const [name, source] of [["reveal", route], ["purge", purge]] as const) {
    check(
      `${name}: both request checks come before the session is even loaded`,
      /isJsonContentType\(request\.headers\.get\("content-type"\)\)/.test(source) &&
        /sameOriginFetch\(request\.headers\.get\("sec-fetch-site"\)\)/.test(source) &&
        source.indexOf("isJsonContentType(") < source.indexOf("loadAuthorizedSession(") &&
        source.indexOf("sameOriginFetch(") < source.indexOf("loadAuthorizedSession(") &&
        !/\.includes\("application\/json"\)/.test(source)
    );
    check(
      `${name}: a refusal is a denied row for signed-in callers only (a link can't fill the log)`,
      /if \(userId\) \{\s*await logSensitiveAccess\(\{\s*action: "denied",/.test(source) && (source.match(/action: "denied"/g) ?? []).length === 1
    );
  }
  const form = read("components/intake/intake-form.tsx");
  check(
    "the form's Show buttons exist only in the agent's own view (never presenting, never Isaac's pages)",
    /useSensitiveReveal\(lob, token, agentArea && agentChrome\)/.test(form)
  );
  const reveal = read("components/intake/sensitive-reveal.tsx");
  check("a revealed value is checked against the mask it was asked for", /if \(maskValue\(value\) !== shown\) throw new Error\("stale"\)/.test(reveal));
  check("…and kept in the page's memory only (no save, no storage)", !/localStorage|sessionStorage|setData|saveIntakePatch/.test(reveal));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
