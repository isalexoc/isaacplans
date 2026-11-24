/**
 * Offline checks for Lead Guard (lib/lead-guard): the form token and its key ring, the stand-in
 * contact ids, every allow / hold / block rule, the phone and name checks, the Origin check, that a
 * client-wrapped useActionState form renders no no-JavaScript post path, and that every lead form,
 * funnel, action and route is wired to the guard (so a new form can't skip it).
 *
 * No network, no database, no API keys. Run with: pnpm test:lead-guard
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";

// "server-only" only resolves inside Next; map it to its empty build for this script.
const serverOnlyEmpty = path.join(path.dirname(require.resolve("server-only")), "empty.js");
const mod = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = mod._resolveFilename;
mod._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return serverOnlyEmpty;
  return originalResolve.call(this, request, ...rest);
};

const OLD_INTAKE_KEY = Buffer.alloc(32, 7).toString("base64");
delete process.env.LEAD_GUARD_SECRET;
delete process.env.LEAD_GUARD_SECRET_PREVIOUS;
process.env.INTAKE_ENCRYPTION_KEY = OLD_INTAKE_KEY;
process.env.NEXT_PUBLIC_SITE_URL = "https://www.isaacplans.com";

const LG = path.resolve(__dirname, "../lib/lead-guard");
function freshGuardModules() {
  for (const k of Object.keys(require.cache)) if (k.startsWith(LG)) delete require.cache[k];
  return {
    token: require("../lib/lead-guard/token") as typeof import("../lib/lead-guard/token"),
    pseudo: require("../lib/lead-guard/pseudo-id") as typeof import("../lib/lead-guard/pseudo-id"),
  };
}

let { token: tokenMod, pseudo: pseudoMod } = freshGuardModules();
const { decideLeadGuard, looksLikeJunkName, MIN_FILL_MS } = require("../lib/lead-guard/assess") as typeof import("../lib/lead-guard/assess");
const { isValidLeadPhone } = require("../lib/lead-guard/phone") as typeof import("../lib/lead-guard/phone");
const { isForeignOrigin, visitorFromHeaders } = require("../lib/lead-guard/request-context") as typeof import("../lib/lead-guard/request-context");
type Signals = import("../lib/lead-guard/assess").LeadGuardSignals;

let failures = 0;
let passes = 0;
function section(name: string) {
  console.log(`\n── ${name}`);
}
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  }
}

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// ═══ token ═══════════════════════════════════════════════════════════════════════════════════
section("form token");
{
  const { mintLeadToken, verifyLeadToken, TOKEN_MAX_AGE_MS } = tokenMod;
  const now = 1_800_000_000_000;
  const t = mintLeadToken(now)!;
  check("mints a token", typeof t === "string" && t.includes("."));
  const v = verifyLeadToken(t, now + 5_000);
  check("valid token, age measured", v.state === "valid" && "ageMs" in v && v.ageMs === 5_000, v);
  check("missing → missing", verifyLeadToken(undefined).state === "missing" && verifyLeadToken("  ").state === "missing");
  const [payload, sig] = t.split(".");
  const reDated = Buffer.from(JSON.stringify({ v: 1, iat: now - 60_000, n: "x" })).toString("base64url");
  check("re-dated payload with the old signature → forged", verifyLeadToken(`${reDated}.${sig}`, now).state === "forged");
  check("tampered signature → forged", verifyLeadToken(`${payload}.${sig.slice(0, -2)}AA`, now).state === "forged");
  check("garbage → forged", verifyLeadToken("abc", now).state === "forged" && verifyLeadToken("a.b.c", now).state === "forged");
  check("oversized → forged", verifyLeadToken("x".repeat(400), now).state === "forged");
  check("older than 24 h → stale", verifyLeadToken(t, now + TOKEN_MAX_AGE_MS + 1).state === "stale");
  check("from the future (beyond skew) → forged", verifyLeadToken(t, now - 120_000).state === "forged");
  check("small clock skew tolerated", verifyLeadToken(t, now - 30_000).state === "valid");
  check("two tokens differ (nonce)", mintLeadToken(now) !== mintLeadToken(now));

  // Key ring: setting LEAD_GUARD_SECRET later must not invalidate tokens open tabs already hold.
  process.env.LEAD_GUARD_SECRET = "a-new-dedicated-lead-guard-secret-value";
  ({ token: tokenMod, pseudo: pseudoMod } = freshGuardModules());
  check("after adding LEAD_GUARD_SECRET, an old token still verifies", tokenMod.verifyLeadToken(t, now + 1_000).state === "valid");
  const t2 = tokenMod.mintLeadToken(now)!;
  check("new tokens use the new key and verify", tokenMod.verifyLeadToken(t2, now + 1_000).state === "valid" && t2.split(".")[1] !== sig);
}

// ═══ stand-in contact ids ════════════════════════════════════════════════════════════════════
section("stand-in contact ids");
{
  const { makeGuardPseudoId, makeQuarantineId, parseGuardPseudoId, newGuardRecordId, GUARD_RECORD_ID_RE } = pseudoMod;
  check("the admin Release/Discard validator accepts every fresh hold id", Array.from({ length: 50 }, () => newGuardRecordId()).every((id) => GUARD_RECORD_ID_RE.test(id)));
  check("the admin actions validate with the shared GUARD_RECORD_ID_RE", read("app/actions/lead-holds.ts").includes("GUARD_RECORD_ID_RE.test(holdId)") && !read("app/actions/lead-holds.ts").includes("{10}"));
  const hold = makeGuardPseudoId("hold", "AbCdE123456")!;
  const block = makeGuardPseudoId("block", "AbCdE123456")!;
  check("20 base62 chars like a GHL id", /^[0-9A-Za-z]{20}$/.test(hold) && /^[0-9A-Za-z]{20}$/.test(block), { hold, block });
  check("hold and block ids are indistinguishable by shape", hold.slice(0, 12) === block.slice(0, 12) && hold[0] === "L");
  check("hold id round-trips", JSON.stringify(parseGuardPseudoId(hold)) === JSON.stringify({ kind: "hold", id: "AbCdE123456" }));
  check("block id parses as block", parseGuardPseudoId(block)?.kind === "block");
  check("tampered id → null", parseGuardPseudoId(hold.slice(0, 19) + (hold[19] === "a" ? "b" : "a")) === null);
  check("real-looking GHL ids → null", parseGuardPseudoId("UZIWyFtB5fgvreh8N1zE") === null && parseGuardPseudoId("LZIWyFtB5fgvreh8N1zE") === null);
  check("non-strings → null", parseGuardPseudoId(undefined) === null && parseGuardPseudoId(12345) === null);
  const q = makeQuarantineId("UZIWyFtB5fgvreh8N1zE")!;
  check("quarantine id carries the CRM contact id", JSON.stringify(parseGuardPseudoId(q)) === JSON.stringify({ kind: "quarantine", ghlContactId: "UZIWyFtB5fgvreh8N1zE" }));
  check("tampered quarantine id → null", parseGuardPseudoId(q.slice(0, -1) + (q.endsWith("a") ? "b" : "a")) === null);
}

// ═══ decisions ═══════════════════════════════════════════════════════════════════════════════
section("allow / hold / block");
{
  const base: Signals = {
    jsSubmit: true,
    token: { state: "valid", ageMs: 30_000 },
    freshToken: false,
    honeypot: "empty",
    originMissing: false,
    originForeign: false,
    phoneValid: true,
    phoneAcknowledged: false,
    nameJunk: false,
    blobIssue: null,
    rateTripped: null,
  };
  const funnel: Partial<Signals> = { jsSubmit: null, honeypot: "absent" };
  const d = (patch: Partial<Signals>) => decideLeadGuard({ ...base, ...patch });
  const is = (patch: Partial<Signals>, verdict: string, reason?: string) => {
    const r = d(patch);
    return r.verdict === verdict && (!reason || r.reasons.includes(reason as never));
  };
  check("clean server-action submission → allow", is({}, "allow"));
  check("clean funnel submission → allow", is(funnel, "allow"));
  // BLOCK: only bot certainties
  check("native no-JS post of a server action → block", is({ jsSubmit: false }, "block", "no_js_post"));
  check("several lead types at once → block", is({ ...funnel, blobIssue: "multi_blob" }, "block", "multi_blob"));
  check("JSON with no token and no Origin → block (a script)", is({ ...funnel, token: { state: "missing" }, originMissing: true }, "block", "scripted_post"));
  check("JSON with a forged token and no Origin → block", is({ ...funnel, token: { state: "forged" }, originMissing: true }, "block", "scripted_post"));
  // HOLD: everything a real person could ever produce
  check("no token but a browser Origin (old tab) → hold, never block", is({ ...funnel, token: { state: "missing" } }, "hold", "token_missing"));
  check("forged token (e.g. a key change) → hold, never block", is({ token: { state: "forged" } }, "hold", "token_forged"));
  check("stale token → hold", is({ token: { state: "stale", ageMs: 9e9 } }, "hold", "token_stale"));
  check("server-only lead type from a browser (deploy skew) → hold", is({ ...funnel, blobIssue: "server_only_blob" }, "hold", "server_only_blob"));
  check("no lead type → hold", is({ ...funnel, blobIssue: "no_blob" }, "hold", "no_blob"));
  check("honeypot filled (autofill risk) → hold, never block", is({ honeypot: "filled" }, "hold", "honeypot"));
  check("honeypot + no token (browser) → still only hold", is({ ...funnel, honeypot: "filled", token: { state: "missing" } }, "hold"));
  check(`sent < ${MIN_FILL_MS} ms after render → hold`, is({ token: { state: "valid", ageMs: MIN_FILL_MS - 1 } }, "hold", "too_fast"));
  check("…unless the token was fetched just now (old tab)", is({ token: { state: "valid", ageMs: 100 }, freshToken: true }, "allow"));
  check("sent right at the threshold → allow", is({ token: { state: "valid", ageMs: MIN_FILL_MS } }, "allow"));
  check("invalid phone → hold", is({ phoneValid: false }, "hold", "phone_invalid"));
  check("invalid phone confirmed by the visitor → hold (unverified)", is({ phoneValid: false, phoneAcknowledged: true }, "hold", "phone_unverified"));
  check("phone unknown (no phone / check failed) → allow", is({ phoneValid: null }, "allow"));
  check("junk name → hold", is({ nameJunk: true }, "hold", "name_junk"));
  check("foreign Origin → hold", is({ originForeign: true }, "hold", "origin_foreign"));
  check("strict-form burst → hold", is({ rateTripped: "strict_rate" }, "hold", "strict_rate"));
  check("daily cap → hold", is({ ...funnel, rateTripped: "daily_cap" }, "hold", "daily_cap"));
  check("a block reason wins over hold reasons", is({ jsSubmit: false, phoneValid: false }, "block"));
  check("no-Origin rule never applies to server actions", is({ originMissing: true, token: { state: "missing" } }, "hold", "token_missing"));
  check("token unavailable (no key) is not treated as missing", is({ token: { state: "unavailable" } }, "allow"));
}

// ═══ phone ═══════════════════════════════════════════════════════════════════════════════════
section("phone validity (libphonenumber-js max)");
{
  // Shapes of the bot's numbers (unassigned area codes): made-up digits, not the real ones.
  for (const n of ["+16662345678", "+12002345678", "+18522345678", "+17832345678", "+14592345678", "+18862345678"]) {
    check(`${n.slice(0, 5)}… is invalid`, isValidLeadPhone(n) === false);
  }
  for (const n of ["+13052345678", "+17862345678", "+12122345678", "+14152345678", "+19542345678", "+17872345678"]) {
    check(`${n.slice(0, 5)}… is valid`, isValidLeadPhone(n) === true);
  }
  check("Canadian number is valid", isValidLeadPhone("+14162345678") === true);
  check("national format with default US", isValidLeadPhone("(305) 234-5678") === true);
  check("empty → null", isValidLeadPhone("") === null && isValidLeadPhone(undefined) === null);
  check("garbage → false", isValidLeadPhone("call me") === false);
  check(
    "phone.ts uses the core API with explicit max metadata (no loader-dependent require)",
    read("lib/lead-guard/phone.ts").includes("libphonenumber-js/core") && read("lib/lead-guard/phone.ts").includes("metadata.max.json")
  );
}

// ═══ names ═══════════════════════════════════════════════════════════════════════════════════
section("junk names");
{
  for (const n of ["http://spam.example", "visit www.x.co", "buy at shop.ru", "<b>x</b>", "a@b.com", "Smith2", "Bit.ly"]) {
    check(`"${n}" is junk`, looksLikeJunkName(n));
  }
  for (const n of ["María José", "O'Brien", "Mary-Ann", "St. John", "De La Cruz", "Nguyễn", "Jr."]) {
    check(`"${n}" is a name`, !looksLikeJunkName(n));
  }
}

// ═══ origin ══════════════════════════════════════════════════════════════════════════════════
section("Origin check");
{
  const h = (o: Record<string, string>) => visitorFromHeaders({ get: (k: string) => o[k.toLowerCase()] ?? null });
  check("same host → not foreign", !isForeignOrigin(h({ origin: "https://www.isaacplans.com", host: "www.isaacplans.com" })));
  check("apex vs www of the site → not foreign", !isForeignOrigin(h({ origin: "https://isaacplans.com", host: "www.isaacplans.com" })));
  check("no Origin → not foreign", !isForeignOrigin(h({ host: "www.isaacplans.com" })));
  check("another site → foreign", isForeignOrigin(h({ origin: "https://evil.example", host: "www.isaacplans.com" })));
  check("next-action header detected", h({ "next-action": "abc123" }).hasNextActionHeader && !h({}).hasNextActionHeader);
  check("first x-forwarded-for hop is the visitor", h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }).ip === "203.0.113.9");
}

// ═══ SSR: a client-wrapped action leaves no no-JavaScript post path ══════════════════════════
section("SSR of a client-wrapped useActionState form");
{
  const React = require("react") as typeof import("react");
  const { renderToString } = require("react-dom/server") as typeof import("react-dom/server");
  const wrapped = async (prev: { n: number }) => ({ n: prev.n + 1 });
  function Form() {
    const [, formAction] = React.useActionState(wrapped, { n: 0 });
    return React.createElement(
      "form",
      { action: formAction },
      React.createElement("input", { name: "firstName" }),
      React.createElement("button", { type: "submit" }, "Send")
    );
  }
  const html = renderToString(React.createElement(Form));
  check("no $ACTION_ progressive-enhancement fields", !html.includes("$ACTION_"), html);
  check("form action is React's javascript:throw guard", /action="javascript:throw/.test(html), html.slice(0, 200));
}

// ═══ wiring: every lead entry point goes through the guard ═══════════════════════════════════
section("wiring");
{
  const FORMS = [
    "components/contact-lead-form.tsx",
    "components/agent-crm/agent-crm-lead-form.tsx",
    "components/aca-lead-form.tsx",
    "components/dental-vision-lead-form.tsx",
    "components/final-expense-lead-form.tsx",
    "components/health-alternative-lead-form.tsx",
    "components/hospital-indemnity-lead-form.tsx",
    "components/iul-lead-form.tsx",
    "components/life-insurance-lead-form.tsx",
    "components/short-term-medical-lead-form.tsx",
  ];
  for (const f of FORMS) {
    const s = read(f);
    check(
      `${path.basename(f)}: wrapped action + honeypot`,
      /useActionState\(guardedSubmit,/.test(s) && /withLeadGuardAction\(/.test(s) && s.includes("<LeadGuardHoneypot")
    );
  }

  const allTsx: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.tsx$/.test(e.name)) allTsx.push(rel);
    }
  };
  walk("components");
  walk("app");
  const unwrapped = allTsx.filter((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    return /from "@\/app\/actions\/(?!lead-holds)/.test(s) && /useActionState\(\s*submit\w*/.test(s);
  });
  check("no form passes a lead server action straight to useActionState", unwrapped.length === 0, unwrapped);

  const FUNNELS = [
    "components/aca/aca-get-covered-funnel.tsx",
    "components/final-expense/final-expense-get-covered-funnel.tsx",
    "components/health-alternative/health-alternative-get-covered-funnel.tsx",
    "components/life-insurance/life-insurance-get-covered-funnel.tsx",
    "components/iul/iul-get-covered-funnel.tsx",
    "components/iul/guia/iul-guia-funnel.tsx",
    "components/legal-shield/legal-shield-optin-funnel.tsx",
    "components/iul-lead-gen-form.tsx",
    "components/blog-lead-magnet-modal.tsx",
    "components/guide-detail-client.tsx",
    "components/guide-unlock-modal.tsx",
    "components/lead-magnet-form.tsx",
    "components/referral-partners/partner-lead-form.tsx",
  ];
  for (const f of FUNNELS) {
    check(`${path.basename(f)}: sends leadGuard`, read(f).includes("leadGuard: await getLeadGuardPayload()"));
  }
  const browserCallers = allTsx.filter((f) => /fetch\(\s*["'`]\/api\/create-contact/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  const missing = browserCallers.filter((f) => !FUNNELS.includes(f.replace(/\\/g, "/")));
  check("every browser caller of /api/create-contact is in the wired list", missing.length === 0, missing);
  for (const f of ["components/iul/guia/iul-guia-funnel.tsx", "components/legal-shield/legal-shield-optin-funnel.tsx"]) {
    const s = read(f);
    check(`${path.basename(f)}: no silent client-side bot return`, !s.includes("if (honeypot.trim()) return") && !s.includes("MIN_DWELL_MS") && s.includes("<LeadGuardHoneypot"));
  }

  const ACTIONS = ["contact", "agent-crm-affiliate", "aca", "dental-vision", "final-expense", "health-alternative", "hospital-indemnity", "iul", "life-insurance", "short-term-medical"];
  for (const a of ACTIONS) {
    const s = read(`app/actions/${a}.ts`);
    check(`actions/${a}.ts goes through submitGuardedActionLead`, s.includes("submitGuardedActionLead(") && !/fetch\([^)]*\/api\/create-contact/.test(s) && s.includes("errors: outcome.errors"));
  }

  const route = read("app/api/create-contact/route.ts");
  check("create-contact route: gate, then the in-process core", route.indexOf("gateCreateContact(") > 0 && route.indexOf("createContactCore(") > route.indexOf("gateCreateContact("));
  check("create-contact route caps the body size", route.includes("MAX_BODY_BYTES"));
  const core = read("lib/create-contact/core.ts");
  check("core never reads the HTTP request", !/\brequest\s*[.,)]/.test(core.slice(core.indexOf("export async function createContactCore"))));
  check("core no longer logs the payload or returns the CRM contact object", !core.includes("Creating contact with payload") && !/contact: createResponseData\.contact/.test(core));
  check("core: a released duplicate runs the workflow ladder", /if \(ctx\.released\) \{\r?\n\s+await runWorkflowLadder\(targetId\)/.test(core));
  check("core: names/email on an existing contact only fill blanks", core.includes("keptFields") && core.includes("Datos distintos en un formulario"));
  check(
    "core: the duplicate merge carries web_verified / web_released",
    /\.\.\.localeTags,[\s\S]{0,260}\.\.\.guardTags,\r?\n\s+\];/.test(core) && core.includes("agentCrmAddContactTags(targetId, guardTags")
  );
  check("core: our own placeholder names count as blank", core.includes("isPlaceholderName(existingRow.firstName, existingRow.lastName)"));
  check("no HTTP self-hop module left", !fs.existsSync(path.join(ROOT, "lib/lead-guard/internal.ts")));
  const release = read("lib/lead-guard/release.ts");
  check("release: a 502 (merge failed) keeps the hold held", release.includes("const ok = Boolean(contactId) && result.status < 400;") && !release.includes("result.status === 502"));
  check("release: marked released before the step-2 drain; only replayed rows deleted", release.indexOf("await markLeadHoldReleased(") > 0 && release.indexOf("await markLeadHoldReleased(") < release.indexOf("listAppendsAfter(holdId, seen)") && release.includes("await deleteLeadHoldAppends(seen)"));
  check("release: lead-magnet and partner replays carry the original consent time", release.includes("processPartnerLead(body, visitor, released)") && release.includes("leadAllowed: true, released"));
  check("release: a lead magnet whose CRM step failed stays held", release.includes("const crmFailed ="));
  const guard = read("lib/lead-guard/server.ts");
  check("guard: a lead nobody could store gets the form's error, never a false success", guard.includes("if (!heldAs) {") && guard.includes("{ kind: \"unavailable\" }") && read("app/api/create-contact/route.ts").includes("gate.kind === \"unavailable\""));
  check("guard: a hold stored too late is superseded (never a second copy)", guard.includes("supersedeLeadHold(id)"));
  check("root layout renders the page token", read("app/[locale]/layout.tsx").includes("data-lgt={leadToken"));

  for (const r of ["app/api/contact-append-address/route.ts", "app/api/contact-append-iul/route.ts", "app/api/legal-shield/append/route.ts", "app/api/iul/guia-email/route.ts", "app/api/legal-shield/guide-email/route.ts"]) {
    const s = read(r);
    check(`${r.split("/").slice(-2, -1)[0]}: intercepts stand-in ids (respond / continue)`, s.includes("interceptGuardPseudoId(") && s.includes('guardIntercept?.action === "continue"'));
  }
  for (const r of ["app/api/iul/guia-email/route.ts", "app/api/legal-shield/guide-email/route.ts"]) {
    const s = read(r);
    check(`${r.split("/").slice(-2, -1)[0]}: sends only to the email on file (typed when it matches, else the CRM one), CRM first name`, s.includes("const to = emailOk ? emailTrimmed : phoneOk && crmEmail ? crmEmail : null;") && s.includes("firstName: crmFirstName"));
  }
  check("lead-magnets/download gates, then the shared processor", read("app/api/lead-magnets/download/route.ts").includes("gateFrontDoor(") && read("app/api/lead-magnets/download/route.ts").includes("processLeadMagnetDownload("));
  check("partners/lead gates, then the shared processor", read("app/api/partners/lead/route.ts").includes("gateFrontDoor(") && read("app/api/partners/lead/route.ts").includes("processPartnerLead("));
  check("referral intake calls create-contact in-process", read("lib/referral-partners/lead-intake.ts").includes("createContactCore("));

  // No server code may call create-contact over HTTP (it would be judged as an anonymous browser).
  const serverFiles = [
    ...fs.readdirSync(path.join(ROOT, "app/actions")).map((f) => `app/actions/${f}`),
    "lib/lead-magnets/download.ts",
    "lib/referral-partners/lead-intake.ts",
    "lib/lead-guard/release.ts",
  ];
  const overHttp = serverFiles.filter((f) => /fetch\([^;]*\/api\/create-contact/.test(read(f).replace(/^\s*(\/\/|\*).*$/gm, "")));
  check("no server-side create-contact over HTTP", overHttp.length === 0, overHttp);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
