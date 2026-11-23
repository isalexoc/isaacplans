/**
 * Offline checks for the agent platform's tenancy foundation (lib/tenancy/): the pure decisions
 * that keep Isaac's single-tenant flows exactly as they were and keep agents' clients' data out of
 * his CRM.
 *
 *  - surface parsing (`APP_SURFACE`) and the launch gates (all off unless exactly on);
 *  - the CRM allowlist: who may use Isaac's GHL credentials, including with `CRM_OWNER_USER_IDS`
 *    unset, and that every default-owner env var in the code is on the list;
 *  - agent slug rules, including every localized top-level path in i18n/routing.ts;
 *  - the operator gate and the token-route decision table: admin owner / admin non-owner / agent
 *    owner / agent non-owner / client / impersonated / paused or gated agent / failed lookups /
 *    product surface; and the secure link's own rule;
 *  - a GUARD over the source tree: no intake, secure-link or CrankWheel path may read Isaac's CRM
 *    credentials except through lib/tenancy/crm.ts, neither itself nor through a module it imports
 *    (one hop; a short allowlist of exports that take the token from their caller).
 *
 * No network, no database, no API keys. Run with: pnpm test:tenancy
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { parseAppSurface, type AppSurface } from "../lib/tenancy/surface";
import {
  agentMayOperate,
  agentTakesApplications,
  isAgentLob,
  parseGateFlag,
  readTenancyGates,
  type AgentGateFields,
  type TenancyGates,
} from "../lib/tenancy/gates";
import {
  buildCrmOwnerAllowlist,
  crmOwnerDecision,
  parseOwnerIds,
  PLATFORM_OWNER_ENV_VARS,
} from "../lib/tenancy/crm-allowlist";
import {
  checkAgentSlug,
  containsProviderName,
  FIXED_RESERVED_SLUGS,
  RESERVED_SLUGS,
  topLevelPathSegments,
} from "../lib/tenancy/slugs";
import {
  callerIsOperator,
  decideClientDataFlow,
  decideIntakeOperator,
  decideTokenAccess,
  type OwnerAgentFact,
  type SignedInCallerKind,
  type TokenAccessDecision,
} from "../lib/tenancy/operator";
import { isMissingTableError } from "../lib/tenancy/db-errors";
import { resolveIntakeAccess, type IntakeAccessRow } from "../lib/intake-shared/access";
import { ENGINE_INTAKE_CONFIGS } from "../lib/intake-configs";
import { routing } from "../i18n/routing";

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

const OFF: TenancyGates = { publicPages: false, clientData: false, leadStore: false };
const ON: TenancyGates = { publicPages: true, clientData: true, leadStore: false };
const HA = "health-alternative";

const testAgent: AgentGateFields = { status: "active", isTest: true };
const realAgent: AgentGateFields = { status: "active", isTest: false };
const pausedAgent: AgentGateFields = { status: "paused", isTest: true };
const invitedAgent: AgentGateFields = { status: "invited", isTest: true };

// Fake ids only. Real Clerk ids never appear in code (the repo is public).
const ISAAC = "user_isaac_test";
const ADMIN2 = "user_admin_two";
const AGENT_A = "user_agent_a";
const AGENT_B = "user_agent_b";
const CLIENT = "user_blog_reader";

console.log("\nSurface (APP_SURFACE)");
{
  check("unset → main", parseAppSurface(undefined) === "main");
  check("empty → main", parseAppSurface("") === "main");
  check('"product" → product', parseAppSurface("product") === "product");
  check('" Product " → product (trim, any case)', parseAppSurface(" Product ") === "product");
  check('"prod" (a typo) → main, never the product shell', parseAppSurface("prod") === "main");
  check('"main" → main', parseAppSurface("main") === "main");
}

console.log("\nLaunch gates");
{
  const none = readTenancyGates({});
  check("all three are off when unset", !none.publicPages && !none.clientData && !none.leadStore);
  for (const v of ["true", "TRUE", "1", "on", "yes", " On "]) {
    check(`"${v}" turns a gate on`, parseGateFlag(v));
  }
  for (const v of ["false", "0", "off", "no", "", "enabled", "truee"]) {
    check(`"${v}" leaves a gate off`, !parseGateFlag(v));
  }
  const some = readTenancyGates({ TENANT_PUBLIC_PAGES: "true", TENANT_CLIENT_DATA: "nope", LEAD_STORE: "1" });
  check("each gate reads its own var", some.publicPages && !some.clientData && some.leadStore);

  check("a test agent operates with the gates off", agentMayOperate(testAgent, OFF));
  check("a real agent does not operate while TENANT_CLIENT_DATA is off", !agentMayOperate(realAgent, OFF));
  check("a real agent operates once TENANT_CLIENT_DATA is on", agentMayOperate(realAgent, ON));
  check("a paused agent never operates", !agentMayOperate(pausedAgent, ON));
  check("an invited agent never operates", !agentMayOperate(invitedAgent, ON));
  check("a test agent takes applications with the gates off", agentTakesApplications(testAgent, OFF));
  check(
    "a real agent needs BOTH public pages and client data to take applications",
    !agentTakesApplications(realAgent, { ...OFF, clientData: true }) &&
      !agentTakesApplications(realAgent, { ...OFF, publicPages: true }) &&
      agentTakesApplications(realAgent, ON)
  );
  check("agents work Health Coverage only", isAgentLob(HA) && !isAgentLob("life-insurance") && !isAgentLob("short-term-medical"));
}

console.log("\nCRM allowlist (who may use Isaac's GHL credentials)");
{
  const empty = buildCrmOwnerAllowlist({});
  check("unset env → empty allowlist", empty.size === 0);
  check(
    "CRM_OWNER_USER_IDS splits on commas and spaces",
    parseOwnerIds(` ${ISAAC}, ${ADMIN2}\n user_three `).join("|") === `${ISAAC}|${ADMIN2}|user_three`
  );
  check('"*" is never a wildcard', parseOwnerIds("*").length === 0 && !buildCrmOwnerAllowlist({ CRM_OWNER_USER_IDS: "*" }).has("*"));

  const defaultsOnly = buildCrmOwnerAllowlist({ INTAKE_DEFAULT_OWNER_USER_ID: ISAAC });
  const main = { allowlist: defaultsOnly, surface: "main" as const };
  check("a default-owner var alone lists Isaac", defaultsOnly.has(ISAAC));
  check("listed owner → allow", crmOwnerDecision(ISAAC, main) === "allow");
  check("agent owner → never allow (ask Clerk, which says not admin)", crmOwnerDecision(AGENT_A, main) === "ask_clerk");
  check("empty owner → deny", crmOwnerDecision("", main) === "deny" && crmOwnerDecision(null, main) === "deny");
  check(
    "product surface → deny even for a listed owner",
    crmOwnerDecision(ISAAC, { allowlist: defaultsOnly, surface: "product" }) === "deny"
  );
  check(
    "product surface → deny even with an admin caller",
    crmOwnerDecision(ISAAC, { allowlist: empty, surface: "product", adminCaller: ISAAC }) === "deny"
  );

  // CRM_OWNER_USER_IDS unset and the default-owner vars hold some other id: Isaac's dashboard-created
  // applications must still reach his CRM.
  const otherDefault = { allowlist: buildCrmOwnerAllowlist({ INTAKE_DEFAULT_OWNER_USER_ID: "user_someone_else" }), surface: "main" as const };
  check(
    "unlisted Isaac on his own operator route (adminCaller = owner) → allow",
    crmOwnerDecision(ISAAC, { ...otherDefault, adminCaller: ISAAC }) === "allow"
  );
  check(
    "unlisted Isaac's session saved by the CLIENT → ask Clerk (role admin → allow)",
    crmOwnerDecision(ISAAC, otherDefault) === "ask_clerk"
  );
  check(
    "an admin can't vouch for someone else's session",
    crmOwnerDecision(AGENT_A, { ...otherDefault, adminCaller: ISAAC }) === "ask_clerk"
  );
  check(
    "with nothing set at all, an admin still vouches for himself",
    crmOwnerDecision(ISAAC, { allowlist: empty, surface: "main", adminCaller: ISAAC }) === "allow"
  );

  const all = buildCrmOwnerAllowlist(
    Object.fromEntries(PLATFORM_OWNER_ENV_VARS.map((name, i) => [name, `user_${i}`]))
  );
  check("every platform owner var feeds the list", all.size === PLATFORM_OWNER_ENV_VARS.length);

  for (const config of ENGINE_INTAKE_CONFIGS) {
    check(
      `${config.lob}'s owner var (${config.ownerEnvVar}) is on the list`,
      (PLATFORM_OWNER_ENV_VARS as readonly string[]).includes(config.ownerEnvVar)
    );
  }
  // Any *_DEFAULT_OWNER_USER_ID the code reads is one of Isaac's self-start owners.
  const used = new Set<string>();
  for (const file of sourceFiles(join(ROOT, "lib"))) {
    for (const m of readFileSync(file, "utf8").matchAll(/\b([A-Z][A-Z0-9_]*_DEFAULT_OWNER_USER_ID)\b/g)) {
      used.add(m[1]);
    }
  }
  const missing = Array.from(used).filter((v) => !(PLATFORM_OWNER_ENV_VARS as readonly string[]).includes(v));
  check("every default-owner var read in lib/ is on the list", missing.length === 0, missing.join(", "));
}

console.log("\nAgent slugs");
{
  for (const ok of ["maria-lopez", "abc", "isaacnunez", "juan23", "a1b", "x".repeat(40)]) {
    const r = checkAgentSlug(ok);
    check(`"${ok}" is accepted`, r.ok, r.ok ? undefined : r.reason);
  }
  check('" Maria-Lopez " normalizes to "maria-lopez"', (() => {
    const r = checkAgentSlug(" Maria-Lopez ");
    return r.ok && r.slug === "maria-lopez";
  })());
  for (const bad of ["ab", "x".repeat(41), "maria_lopez", "-maria", "maria-", "ma--ria", "maría", "maria lopez", "", "../x"]) {
    const r = checkAgentSlug(bad);
    check(`"${bad}" fails the format rule`, !r.ok && r.reason === "format", r.ok ? "accepted" : r.reason);
  }
  for (const word of ["api", "admin", "agent", "agente", "studio", "intake", "admision", "secure", "seguro", "apply", "aplicar", "privacy", "privacidad", "presentations", "unauthorized", "sign-in"]) {
    const r = checkAgentSlug(word);
    check(`"${word}" is reserved`, !r.ok && r.reason === "reserved", r.ok ? "accepted" : r.reason);
  }
  const segments = topLevelPathSegments(routing.pathnames as unknown as Record<string, string | Record<string, string>>);
  const unreserved = segments.filter((s) => !RESERVED_SLUGS.has(s));
  check(`every top-level localized path (${segments.length}) is reserved`, unreserved.length === 0, unreserved.join(", "));
  for (const s of ["contacto", "contact-me", "alternativa-de-salud", "health-alternative", "gastos-finales", "impacto", "socios", "seguro-de-vida"]) {
    check(`"${s}" (a localized path) is reserved`, RESERVED_SLUGS.has(s));
  }
  check("the fixed list includes the routing words", ["a", "api", "admin", "agent", "agente", "studio", "impact", "impacto", "intake", "secure", "seguro"].every((w) => FIXED_RESERVED_SLUGS.includes(w)));
  for (const bad of ["impact-maria", "mariaimpact", "maria-impacto", "acn-maria", "maria-acn", "acnmaria", "mariaacn"]) {
    const r = checkAgentSlug(bad);
    check(`"${bad}" contains a provider name`, !r.ok && r.reason === "provider_name", r.ok ? "accepted" : r.reason);
  }
  check('"isaacnunez" is not taken for "acn"', !containsProviderName("isaacnunez"));
}

console.log("\nOperator gate (dashboard, create, reset, reopen, send-link, secure link, quote image, deck)");
{
  const facts = (over: Partial<Parameters<typeof decideIntakeOperator>[0]> = {}) => ({
    userId: AGENT_A,
    isAdmin: false,
    agent: null,
    impersonated: false,
    ...over,
  });
  const d = (f: Parameters<typeof decideIntakeOperator>[0], lob = HA, gates = OFF) => decideIntakeOperator(f, lob, gates);

  const signedOut = d(facts({ userId: null }));
  check("signed out → 401", !signedOut.ok && signedOut.status === 401);
  const admin = d(facts({ userId: ISAAC, isAdmin: true }), "life-insurance");
  check("admin → operator on every line (as today)", admin.ok && admin.kind === "admin");
  const impersonatedAdmin = d(facts({ userId: ISAAC, isAdmin: true, impersonated: true }));
  check("an impersonated admin is still an admin (unchanged)", impersonatedAdmin.ok && impersonatedAdmin.kind === "admin");
  const plain = d(facts({ userId: CLIENT }));
  check("signed-in non-admin without an agent row → 403", !plain.ok && plain.status === 403 && plain.reason === "not_operator");
  const agent = d(facts({ agent: testAgent }));
  check("active test agent on Health Coverage → operator", agent.ok && agent.kind === "agent");
  const otherLine = d(facts({ agent: testAgent }), "life-insurance");
  check("agent on an insurance line → 403", !otherLine.ok && otherLine.reason === "line");
  const gated = d(facts({ agent: realAgent }));
  check("real agent while TENANT_CLIENT_DATA is off → 403", !gated.ok && gated.reason === "inactive");
  const open = d(facts({ agent: realAgent }), HA, ON);
  check("real agent once it's on → operator", open.ok && open.kind === "agent");
  const paused = d(facts({ agent: pausedAgent }), HA, ON);
  check("paused agent → 403", !paused.ok && paused.reason === "inactive");
  const invited = d(facts({ agent: invitedAgent }), HA, ON);
  check("invited agent → 403", !invited.ok && invited.reason === "inactive");
  const impersonated = d(facts({ agent: testAgent, impersonated: true }));
  check("impersonated agent → 403", !impersonated.ok && impersonated.reason === "impersonated");
}

console.log("\nToken routes (load, save, files, complete): the access table");
{
  const row = (owner: string, over: Partial<IntakeAccessRow> = {}): IntakeAccessRow => ({
    ownerUserId: owner,
    clientUserId: null,
    clientDeviceId: null,
    ...over,
  });
  const decide = (input: {
    row: IntakeAccessRow;
    userId?: string | null;
    deviceId?: string | null;
    impersonated?: boolean;
    callerKind?: SignedInCallerKind;
    ownerAgent?: OwnerAgentFact;
    surface?: AppSurface;
    gates?: TenancyGates;
    lob?: string;
  }): TokenAccessDecision =>
    decideTokenAccess({
      lob: input.lob ?? HA,
      row: input.row,
      userId: input.userId ?? null,
      deviceId: input.deviceId ?? null,
      impersonated: input.impersonated ?? false,
      callerKind: input.callerKind ?? "client",
      ownerAgent: input.ownerAgent === undefined ? null : input.ownerAgent,
      surface: input.surface ?? "main",
      gates: input.gates ?? OFF,
    });
  const allowed = (r: TokenAccessDecision, role: "owner" | "client", claim = false) =>
    r.outcome === "allow" && r.access.role === role && r.access.shouldClaim === claim;
  const deniedAudited = (r: TokenAccessDecision) => r.outcome === "deny" && r.audit && !r.claimedByOtherDevice;

  // Isaac's own sessions, no agents anywhere: exactly today's rule.
  check("admin owner → owner", allowed(decide({ row: row(ISAAC), userId: ISAAC, deviceId: "d1" }), "owner"));
  check(
    "anonymous client opens an unclaimed link → claims it (today)",
    allowed(decide({ row: row(ISAAC), deviceId: "d1" }), "client", true)
  );
  check(
    "anonymous client with the bound device → client",
    allowed(decide({ row: row(ISAAC, { clientDeviceId: "d1" }), deviceId: "d1" }), "client")
  );
  const elsewhere = decide({ row: row(ISAAC, { clientDeviceId: "d1" }), deviceId: "d2" });
  check(
    "another device on a claimed link → 403 claimed_elsewhere, not audited (today)",
    elsewhere.outcome === "deny" && elsewhere.claimedByOtherDevice && !elsewhere.audit
  );
  check(
    "signed-in plain client (blog account) on an unclaimed link → claims it (today)",
    allowed(decide({ row: row(ISAAC), userId: CLIENT, deviceId: "d1", callerKind: "client" }), "client", true)
  );
  check(
    "legacy Clerk-bound client → client (today)",
    allowed(decide({ row: row(ISAAC, { clientUserId: CLIENT, clientDeviceId: "d9" }), userId: CLIENT, deviceId: "d1" }), "client")
  );

  // Operators who aren't the owner: denied, audited, never claim.
  check(
    "admin non-owner on an agent's unclaimed link → 403 + audit, no claim",
    deniedAudited(decide({ row: row(AGENT_B), userId: ISAAC, deviceId: "d1", callerKind: "admin", ownerAgent: testAgent }))
  );
  check(
    "second admin on Isaac's unclaimed link → 403 + audit, no claim",
    deniedAudited(decide({ row: row(ISAAC), userId: ADMIN2, deviceId: "d1", callerKind: "admin" }))
  );
  check(
    "agent A on agent B's unclaimed link → 403 + audit, no claim",
    deniedAudited(decide({ row: row(AGENT_B), userId: AGENT_A, deviceId: "d1", callerKind: "agent", ownerAgent: testAgent }))
  );
  check(
    "agent A on a link B's client claimed → 403 + audit, and no hint that a client holds it",
    deniedAudited(decide({ row: row(AGENT_B, { clientDeviceId: "dB" }), userId: AGENT_A, deviceId: "dA", callerKind: "agent", ownerAgent: testAgent }))
  );
  check(
    "agent A on Isaac's unclaimed link → 403 + audit",
    deniedAudited(decide({ row: row(ISAAC), userId: AGENT_A, deviceId: "dA", callerKind: "agent" }))
  );
  check(
    "a caller whose agent lookup failed never claims → 503 retry, not audited",
    decide({ row: row(ISAAC), userId: CLIENT, deviceId: "d1", callerKind: "unknown" }).outcome === "retry"
  );
  check(
    "…but an impersonated caller whose lookup failed is still an audited 403",
    deniedAudited(decide({ row: row(ISAAC), userId: CLIENT, deviceId: "d1", impersonated: true, callerKind: "unknown" }))
  );
  check(
    "…and one already bound to the session still gets in as its client",
    allowed(decide({ row: row(ISAAC, { clientDeviceId: "d1" }), userId: CLIENT, deviceId: "d1", callerKind: "unknown" }), "client")
  );
  check(
    "an operator's own application on someone else's page (already bound to them) → client, no claim",
    allowed(decide({ row: row(ISAAC, { clientDeviceId: "dA", clientUserId: AGENT_A }), userId: AGENT_A, deviceId: "dA", callerKind: "agent" }), "client")
  );

  // Agent owners.
  check(
    "agent owner (active test agent) → owner",
    allowed(decide({ row: row(AGENT_A), userId: AGENT_A, deviceId: "dA", ownerAgent: testAgent }), "owner")
  );
  check(
    "agent owner while paused → 403 + audit",
    deniedAudited(decide({ row: row(AGENT_A), userId: AGENT_A, ownerAgent: pausedAgent, gates: ON }))
  );
  check(
    "real agent owner while TENANT_CLIENT_DATA is off → 403 + audit",
    deniedAudited(decide({ row: row(AGENT_A), userId: AGENT_A, ownerAgent: realAgent }))
  );
  check(
    "real agent owner once it's on → owner",
    allowed(decide({ row: row(AGENT_A), userId: AGENT_A, ownerAgent: realAgent, gates: ON }), "owner")
  );
  check(
    "impersonated agent owner → 403 + audit",
    deniedAudited(decide({ row: row(AGENT_A), userId: AGENT_A, impersonated: true, ownerAgent: testAgent }))
  );
  check(
    "agent-owned session on an insurance line → 403 + audit for the agent",
    deniedAudited(decide({ row: row(AGENT_A), userId: AGENT_A, ownerAgent: testAgent, lob: "life-insurance" }))
  );

  // Clients of agents.
  check(
    "client of an active test agent → claims as today",
    allowed(decide({ row: row(AGENT_A), deviceId: "dc", ownerAgent: testAgent }), "client", true)
  );
  check(
    "client of a paused agent → 404",
    decide({ row: row(AGENT_A, { clientDeviceId: "dc" }), deviceId: "dc", ownerAgent: pausedAgent, gates: ON }).outcome === "unavailable"
  );
  check(
    "client of a real agent while the gates are off → 404",
    decide({ row: row(AGENT_A, { clientDeviceId: "dc" }), deviceId: "dc", ownerAgent: realAgent }).outcome === "unavailable"
  );
  check(
    "client of a real agent once TENANT_CLIENT_DATA is on → client",
    allowed(decide({ row: row(AGENT_A, { clientDeviceId: "dc" }), deviceId: "dc", ownerAgent: realAgent, gates: ON }), "client")
  );
  check(
    "an operator on a paused agent's session still gets the audited 403, not a quiet 404",
    deniedAudited(decide({ row: row(AGENT_B, { clientDeviceId: "dc" }), userId: ISAAC, deviceId: "dI", callerKind: "admin", ownerAgent: pausedAgent, gates: ON }))
  );
  check(
    "an impersonated plain client never claims → 403 + audit",
    deniedAudited(decide({ row: row(ISAAC), userId: CLIENT, deviceId: "d1", impersonated: true, callerKind: "client" }))
  );

  // The owner lookup failed: never read as "not an agent".
  check(
    "owner lookup failed + impersonated owner → 503 retry, never the owner's decrypted view",
    decide({ row: row(AGENT_A), userId: AGENT_A, impersonated: true, ownerAgent: "unknown" }).outcome === "retry"
  );
  check(
    "owner lookup failed + the owner themself → 503 retry (a paused agent stays out)",
    decide({ row: row(AGENT_A), userId: AGENT_A, ownerAgent: "unknown" }).outcome === "retry"
  );
  check(
    "owner lookup failed + a client → 503 retry, no claim (a gated agent's client stays out)",
    decide({ row: row(AGENT_A), deviceId: "dc", ownerAgent: "unknown" }).outcome === "retry"
  );

  // Surfaces: client access only on the owner's surface.
  check(
    "Isaac's token on the product domain → 404",
    decide({ row: row(ISAAC, { clientDeviceId: "d1" }), deviceId: "d1", surface: "product" }).outcome === "unavailable"
  );
  check(
    "Isaac's unclaimed token on the product domain → 404, not a claim",
    decide({ row: row(ISAAC), deviceId: "d1", surface: "product" }).outcome === "unavailable"
  );
  check(
    "an active test agent's token on the product domain → its client, as on main",
    allowed(decide({ row: row(AGENT_A), deviceId: "dc", ownerAgent: testAgent, surface: "product" }), "client", true)
  );
  check(
    "a paused agent's token on the product domain → 404",
    decide({ row: row(AGENT_A, { clientDeviceId: "dc" }), deviceId: "dc", ownerAgent: pausedAgent, surface: "product", gates: ON }).outcome === "unavailable"
  );

  check("only a plain, non-impersonated client may claim", !callerIsOperator("client", false) && callerIsOperator("client", true) && callerIsOperator("admin", false) && callerIsOperator("agent", false) && callerIsOperator("unknown", false));

  // The older intakes (FE, ACA, IUL) never pass `operator`: their rule is byte-for-byte today's.
  const legacy = resolveIntakeAccess(row(ISAAC), { userId: ADMIN2, deviceId: "d1" });
  check("without the operator flag the shared rule is unchanged (a signed-in non-owner claims)", legacy.allowed && legacy.shouldClaim && !legacy.operatorDenied);
}

console.log("\nSecure link (no token, no sign-in): may client data flow into the owner's application?");
{
  const flow = (ownerAgent: OwnerAgentFact, over: { surface?: AppSurface; gates?: TenancyGates; lob?: string } = {}) =>
    decideClientDataFlow({ lob: over.lob ?? HA, ownerAgent, surface: over.surface ?? "main", gates: over.gates ?? OFF });
  check("Isaac's link on isaacplans.com → accept (today)", flow(null) === "accept");
  check("Isaac's link on the product domain → closed (404)", flow(null, { surface: "product" }) === "closed");
  check("an active test agent's link → accept", flow(testAgent) === "accept" && flow(testAgent, { surface: "product" }) === "accept");
  check("a paused agent's link → closed", flow(pausedAgent, { gates: ON }) === "closed");
  check("a real agent's link while TENANT_CLIENT_DATA is off → closed", flow(realAgent) === "closed");
  check("an agent's link on an insurance line → closed", flow(testAgent, { lob: "life-insurance" }) === "closed");
  check("the owner lookup failed → retry (503), never accept", flow("unknown") === "retry" && flow("unknown", { surface: "product" }) === "retry");
}

console.log("\nMissing-table detection (migration 0046 not applied yet)");
{
  check("SQLSTATE 42P01 → missing table", isMissingTableError({ code: "42P01" }));
  check("the Postgres message → missing table", isMissingTableError(new Error('relation "agents" does not exist')));
  check("a wrapped cause → missing table", isMissingTableError({ message: "query failed", cause: { code: "42P01" } }));
  check("another error is not", !isMissingTableError({ code: "23505", message: "duplicate key value" }));
  check("a connection error is not", !isMissingTableError(new Error("fetch failed")));
  check("null is not", !isMissingTableError(null));
}

console.log("\nGuard: Isaac's CRM credentials only through lib/tenancy/crm.ts");
{
  const GUARDED = [
    "lib/intake-core",
    "lib/intake-shared",
    "app/api/intake",
    "app/api/intake-capture",
    "app/[locale]/health-alternative",
    "app/api/crankwheel",
    "lib/crankwheel",
  ];
  // Reading Isaac's GHL credentials: the base-credentials helper, the env vars themselves, and the
  // call-summary config that carries his Private Integration token (`piToken`).
  const READERS = [
    /\bagentCrmGetBaseCredentials\b/,
    /\bAGENT_CRM_PI\b/,
    /\bAGENT_CRM_LOCATION_ID\b/,
    /\bAGENT_CRM_API_KEY\b/,
    /\bpiToken\b/,
    /\bgetCallSummaryConfig\b/,
  ];
  const readerIn = (text: string) => READERS.find((re) => re.test(text));
  // Modules a guarded file may import although they read the credentials: the adapter itself, and
  // the module that defines the helper (its other exports all take a token; importing the helper
  // by name is caught by the direct check below).
  const EXEMPT_MODULES = new Set(["lib/tenancy/crm.ts", "lib/agent-crm-contacts.ts"]);
  // Elsewhere, only these exports of a credential-reading module, each verified below to take the
  // token from its caller (or to touch no CRM at all) and not to read the credentials itself.
  const TOKEN_ONLY_IMPORTS: Record<string, readonly string[]> = {
    "lib/iul-intake/server.ts": ["resolveCrmContactLocale", "getIntakeByToken"],
    "lib/agent-crm-call-summary.ts": ["createContactNote"],
  };
  const guardedAbs = GUARDED.map((dir) => join(ROOT, ...dir.split("/")));
  const isGuarded = (abs: string) => guardedAbs.some((dir) => abs === dir || abs.startsWith(dir + sep));

  /** One hop: what a guarded file imports from outside the guarded folders that reads the credentials. */
  const oneHopViolations = (file: string, source: string): string[] => {
    const out: string[] = [];
    for (const imp of importsOf(source)) {
      const target = resolveModule(file, imp.spec);
      if (!target || isGuarded(target)) continue;
      const name = rel(target);
      if (EXEMPT_MODULES.has(name)) continue;
      const targetHit = readerIn(readFileSync(target, "utf8"));
      if (!targetHit) continue;
      const allowed = TOKEN_ONLY_IMPORTS[name] ?? [];
      const bad = imp.names.filter((n) => !allowed.includes(n));
      if (bad.length) out.push(`${rel(file)} imports ${bad.join(", ")} from ${name}, which reads the credentials (${targetHit.source})`);
    }
    return out;
  };

  let scanned = 0;
  const direct: string[] = [];
  const viaImport: string[] = [];
  for (const abs of guardedAbs) {
    check(`${relative(ROOT, abs).split(sep).join("/")} exists`, exists(abs));
    for (const file of sourceFiles(abs)) {
      scanned++;
      const source = readFileSync(file, "utf8");
      const hit = readerIn(source);
      if (hit) direct.push(`${rel(file)} (${hit.source})`);
      viaImport.push(...oneHopViolations(file, source));
    }
  }
  // The guard itself: a route that pushes a session through a helper reading Isaac's credentials
  // inside (IUL's link sync), or pulls in the call-summary config, must fail it.
  const fakeRoute = join(ROOT, "app", "api", "intake", "[lob]", "[token]", "quote-image", "route.ts");
  check(
    "the guard catches a helper that reads the credentials inside (IUL's syncIntakeLinkToCrm)",
    oneHopViolations(fakeRoute, 'import { resolveCrmContactLocale, syncIntakeLinkToCrm } from "@/lib/iul-intake/server";').length === 1
  );
  check(
    "the guard catches a namespace import of such a module, and the call-summary pipeline",
    oneHopViolations(fakeRoute, 'import * as iul from "@/lib/iul-intake/server";').length === 1 &&
      oneHopViolations(fakeRoute, 'import { processCallSummary } from "@/lib/agent-crm-call-summary";').length === 1
  );
  check(
    "the guard lets the token-only exports and the adapter through",
    oneHopViolations(
      fakeRoute,
      'import { createContactNote } from "@/lib/agent-crm-call-summary";\nimport { crmCredsForOwner } from "@/lib/tenancy/crm";\nimport { agentCrmUpdateContact } from "@/lib/agent-crm-contacts";'
    ).length === 0
  );
  check(
    `no guarded file (${scanned} scanned) reads the CRM credentials directly`,
    scanned > 0 && direct.length === 0,
    direct.join("; ")
  );
  check(
    "no guarded file reaches them through a module it imports (one hop, allowlisted token-only exports aside)",
    viaImport.length === 0,
    viaImport.join("; ")
  );
  for (const [name, exportsAllowed] of Object.entries(TOKEN_ONLY_IMPORTS)) {
    const source = readFileSync(join(ROOT, ...name.split("/")), "utf8");
    for (const fn of exportsAllowed) {
      const body = topLevelFunction(source, fn);
      const hit = body ? readerIn(body) : undefined;
      check(
        `${name}#${fn} is still a top-level function that doesn't read the credentials itself`,
        body !== null && !hit,
        body === null ? "not found" : hit?.source
      );
    }
  }
  // The guard's own parser, on the shapes it must understand.
  const parsed = importsOf(
    [
      'import a, { b, type C, d as e } from "@/x";',
      'import type { F } from "@/y";',
      'import * as g from "@/z";',
      "import {",
      "  // why this one (a comment the parser must skip)",
      "  q,",
      '} from "@/s";',
      'export { h } from "./w";',
      'export * from "@/v";',
      "const note = \"copied from '@/r' in a string\";",
      'const m = await import("@/u");',
      'import "@/t";',
    ].join("\n")
  );
  check(
    "the guard's import parser reads named, default, namespace, multi-line, re-export, dynamic and bare imports",
    JSON.stringify(parsed) ===
      JSON.stringify([
        { spec: "@/x", names: ["default", "b", "d"] },
        { spec: "@/z", names: ["*"] },
        { spec: "@/s", names: ["q"] },
        { spec: "./w", names: ["h"] },
        { spec: "@/v", names: ["*"] },
        { spec: "@/u", names: ["*"] },
        { spec: "@/t", names: ["*"] },
      ]),
    JSON.stringify(parsed)
  );
  // lib/tenancy: only crm.ts touches them.
  const tenancyHits = sourceFiles(join(ROOT, "lib", "tenancy"))
    .filter((f) => readerIn(readFileSync(f, "utf8")))
    .map(rel);
  check("in lib/tenancy only crm.ts uses the base credentials", tenancyHits.join(",") === "lib/tenancy/crm.ts", tenancyHits.join(","));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

// ── helpers ──────────────────────────────────────────────────────────────────

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!exists(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}

function rel(abs: string): string {
  return relative(ROOT, abs).split(sep).join("/");
}

type ParsedImport = { spec: string; names: string[] };

/**
 * The value imports of a module: `{ spec, names }`, where a name is an imported export ("default"
 * for a default import) or "*" (namespace, `export *`, dynamic or bare import: everything).
 * Type-only imports are left out: they can't call anything.
 */
function importsOf(source: string): ParsedImport[] {
  const out: ParsedImport[] = [];
  // Each `from "…"` closes the import/export statement that last started a line before it.
  const starts = Array.from(source.matchAll(/^[ \t]*(import|export)\b/gm)).map((m) => ({
    keyword: m[1],
    at: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  for (const m of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
    const at = m.index ?? 0;
    const start = starts.filter((s) => s.at < at).pop();
    if (!start) continue;
    const clause = source
      .slice(start.end, at)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")
      .trim();
    // Not an import clause (a `from "…"` inside code or a string): skip. Type-only: can't call.
    if (!/^[\w$*{}\s,]+$/.test(clause) || /^type\s/.test(clause)) continue;
    const names: string[] = [];
    if (clause.includes("*")) names.push("*");
    const braced = clause.match(/\{([^}]*)\}/);
    const outside = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+[\w$]+/, "").replace(/,/g, " ").trim();
    if (start.keyword === "import" && outside) names.push("default");
    if (braced) {
      for (const part of braced[1].split(",")) {
        const item = part.trim();
        if (!item || /^type\s/.test(item)) continue;
        names.push(item.split(/\s+as\s+/)[0].trim());
      }
    }
    if (names.length) out.push({ spec: m[1], names });
  }
  for (const m of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) out.push({ spec: m[1], names: ["*"] });
  for (const m of source.matchAll(/^[ \t]*import\s*["']([^"']+)["']/gm)) out.push({ spec: m[1], names: ["*"] });
  return out;
}

/** A source file for an `@/…` or relative import, or null (a package). */
function resolveModule(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, ...spec.slice(2).split("/"));
  else if (spec.startsWith(".")) base = join(fromFile, "..", ...spec.split("/"));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next one
    }
  }
  return null;
}

/** A top-level function's text: its `export … function name` line through the `}` that closes it at column 0. */
function topLevelFunction(source: string, name: string): string | null {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^export\\s+(async\\s+)?function\\s+${name}\\b`).test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^\}/.test(line));
  return end < 0 ? null : lines.slice(start, end + 1).join("\n");
}
