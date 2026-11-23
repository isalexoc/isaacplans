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
  agentPublicPagesOpen,
  agentTakesApplications,
  isAgentLob,
  parseGateFlag,
  readPlatformPreview,
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
import {
  agentPageAlternates,
  agentPagePath,
  decideTokenPage,
  PRODUCT_RESPONSE_HEADERS,
  productNotFoundHtml,
  productRoute,
  type ProductRoute,
  type TokenPageOwnerFact,
} from "../lib/tenancy/product-routes";
import {
  agentPublicProfile,
  formatWhatsapp,
  languagesLabel,
  normalizeE164,
  safeImpactReferralUrl,
  safePhotoUrl,
  whatsappHref,
  type AgentProfileSource,
} from "../lib/tenancy/profile";
import { buildIsaacProfile, ISAAC_AGENT } from "../lib/tenancy/isaac-agent";
import {
  DEFAULT_PLATFORM_NAME,
  mainSiteUrl,
  platformName,
  productHostLabel,
  productPublicOrigin,
  productRedirectOrigin,
  publicOriginFor,
  publicOriginForOwnerWith,
} from "../lib/tenancy/site-urls";
import { buildIntakeShareUrl, buildSecureCaptureUrl } from "../lib/intake-core/share-url";
import { DECK_COPY } from "../components/impact-presentation/copy";
import { GUIDE_SCOPE, guideScopeFor, isGuideScope, planChoiceUsable } from "../lib/impact-quote/sync";
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

console.log("\nProduct domain: the address book (lib/tenancy/product-routes.ts)");
{
  const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx"; // nanoid(24)-shaped
  const same = (a: ProductRoute, b: ProductRoute) => JSON.stringify(a) === JSON.stringify(b);
  const rewrites: [string, string][] = [
    ["/en/maria-lopez", "/en/a/maria-lopez"],
    ["/es/maria-lopez", "/es/a/maria-lopez"],
    ["/en/maria-lopez/apply", "/en/a/maria-lopez/apply"],
    ["/es/maria-lopez/aplicar", "/es/a/maria-lopez/apply"],
    ["/es/maria-lopez/apply", "/es/a/maria-lopez/apply"],
    ["/en/maria-lopez/aplicar", "/en/a/maria-lopez/apply"],
    ["/en/maria-lopez/privacy", "/en/a/maria-lopez/privacy"],
    ["/es/maria-lopez/privacidad", "/es/a/maria-lopez/privacy"],
    ["/en/Maria-Lopez", "/en/a/maria-lopez"],
    ["/en/maria-lopez/", "/en/a/maria-lopez"],
    ["/es/juan23/Aplicar", "/es/a/juan23/apply"],
  ];
  for (const [path, to] of rewrites) {
    const route = productRoute(path);
    check(`${path} → ${to}`, route.kind === "rewrite" && route.to === to, JSON.stringify(route));
  }
  const passes: [string, "en" | "es"][] = [
    [`/en/health-alternative/intake/${TOKEN}`, "en"],
    [`/es/alternativa-de-salud/admision/${TOKEN}`, "es"],
    [`/en/secure/${TOKEN}`, "en"],
    [`/es/seguro/${TOKEN}`, "es"],
  ];
  for (const [path, locale] of passes) {
    check(`${path.replace(TOKEN, "<token>")} passes through (the client's own link)`, same(productRoute(path), { kind: "pass", locale }));
  }
  // A token page in the other language's words goes to next-intl, which redirects it to the
  // locale's own (/es/secure/… → /es/seguro/…): those names are the client's own links anyway.
  const crossLocale: [string, "en" | "es"][] = [
    [`/es/secure/${TOKEN}`, "es"],
    [`/en/seguro/${TOKEN}`, "en"],
    [`/es/health-alternative/intake/${TOKEN}`, "es"],
    [`/en/alternativa-de-salud/admision/${TOKEN}`, "en"],
  ];
  for (const [path, locale] of crossLocale) {
    check(`${path.replace(TOKEN, "<token>")} → next-intl (its redirect to the locale's words)`, same(productRoute(path), { kind: "pass", locale }));
  }
  const notFound = [
    // The agent's views of a token, and the dashboard: they live on isaacplans.com.
    `/en/health-alternative/intake/${TOKEN}/view`,
    `/en/health-alternative/intake/${TOKEN}/presentation`,
    `/es/alternativa-de-salud/admision/${TOKEN}/presentacion`,
    "/en/health-alternative/intake",
    "/es/alternativa-de-salud/admision",
    // Isaac's page names in the other language: a 404 straight away, never next-intl's redirect to
    // his other spelling (/es/about → /es/sobre-mi would map his site on this domain).
    "/es/about",
    "/en/sobre-mi",
    "/es/contact-me",
    "/en/gastos-finales/admision",
    `/es/iul/secure/${TOKEN}`,
    // Not a token.
    "/en/secure/short",
    "/en/secure/has%20space",
    // Isaac's other lines and pages.
    `/en/life-insurance/intake/${TOKEN}`,
    `/en/iul/secure/${TOKEN}`,
    "/en/impact",
    "/es/impacto",
    "/en/contact-me",
    "/es/contacto",
    "/en/blog",
    "/es/preguntas-frecuentes",
    "/en/admin",
    "/en/admin/agents",
    "/es/agente",
    "/en/presentations/x",
    // Reserved and provider-name slugs, the internal route itself, the bare locale.
    "/en/apply",
    "/es/privacidad",
    "/en/a",
    "/en/a/maria-lopez",
    "/es/a/maria-lopez/apply",
    "/en/impact-maria",
    "/en/maria-acn",
    "/en",
    "/es",
    // Shapes that aren't an agent's page.
    "/en/maria-lopez/apply/now",
    "/en/maria-lopez/blog",
    "/en/ma",
    "/en/maria_lopez",
  ];
  for (const path of notFound) {
    const route = productRoute(path);
    check(`${path.replace(TOKEN, "<token>")} → 404`, route.kind === "not_found" && !route.api, JSON.stringify(route));
  }
  // Every top-level page of i18n/routing.ts, in both languages, is a 404 as /{l}/{segment}: no agent
  // can be given a slug next-intl would localize or redirect first.
  const segments = topLevelPathSegments(routing.pathnames as unknown as Record<string, string | Record<string, string>>);
  const reached = segments.flatMap((s) => ["en", "es"].map((l) => `/${l}/${s}`)).filter((p) => productRoute(p).kind !== "not_found");
  check(`every localized top-level path (${segments.length}, both locales) is a 404 there`, reached.length === 0, reached.join(", "));

  const apis: [string, boolean][] = [
    ["/api/intake/health-alternative/start", true],
    [`/api/intake/health-alternative/${TOKEN}`, true],
    [`/api/intake/health-alternative/${TOKEN}/patch`, true],
    [`/api/intake/health-alternative/${TOKEN}/complete`, true],
    ["/api/intake/health-alternative", false],
    ["/api/intake/health-alternative-x/y", false],
    ["/api/intake/life-insurance/start", false],
    ["/api/intake/dental-vision/x", false],
    ["/api/admin/impact-quote-image", false],
    ["/api/admin/agents", false],
    ["/api/blog/search", false],
    ["/api/crankwheel/meetings", false],
    ["/api/iul-intake/x", false],
    ["/api", false],
  ];
  for (const [path, allowed] of apis) {
    const route = productRoute(path);
    check(
      `${path.replace(TOKEN, "<token>")} → ${allowed ? "through" : "404 (JSON)"}`,
      allowed ? route.kind === "api" : route.kind === "not_found" && route.api,
      JSON.stringify(route)
    );
  }
  for (const path of ["/studio", "/studio/structure", "/studio/x/y"]) {
    const route = productRoute(path);
    check(`${path} → 404`, route.kind === "not_found" && !route.api);
  }
  // Without a locale prefix (or with a miscased one), next-intl only sees a path it would send to a
  // page that exists; anything else is a 404 straight away.
  for (const path of ["/maria-lopez", "/maria-lopez/aplicar", `/secure/${TOKEN}`, `/alternativa-de-salud/admision/${TOKEN}`, "/ES/maria-lopez", `/En/secure/${TOKEN}`]) {
    check(`${path.replace(TOKEN, "<token>")} → next-intl's redirect to the locale's page`, productRoute(path).kind === "intl", JSON.stringify(productRoute(path)));
  }
  for (const path of ["/", "/blog", "/about", "/sobre-mi", "/contacto", "/impacto", "/a/maria-lopez", "/ES/about", "/EN", "/fr/maria-lopez"]) {
    const route = productRoute(path);
    check(`${path} → 404 without next-intl`, route.kind === "not_found" && !route.api, JSON.stringify(route));
  }

  check(
    "agent page links use the locale's own words",
    agentPagePath("en", "maria-lopez") === "/en/maria-lopez" &&
      agentPagePath("es", "maria-lopez", "apply") === "/es/maria-lopez/aplicar" &&
      agentPagePath("en", "maria-lopez", "apply") === "/en/maria-lopez/apply" &&
      agentPagePath("es", "maria-lopez", "privacy") === "/es/maria-lopez/privacidad" &&
      JSON.stringify(agentPageAlternates("maria-lopez", "privacy")) ===
        JSON.stringify({ en: "/en/maria-lopez/privacy", es: "/es/maria-lopez/privacidad" })
  );
  check(
    "…and every one of them comes back through the table to the same internal page",
    (["guide", "apply", "privacy"] as const).every((page) =>
      (["en", "es"] as const).every((l) => {
        const route = productRoute(agentPagePath(l, "maria-lopez", page));
        return route.kind === "rewrite" && route.to === `/${l}/a/maria-lopez${page === "guide" ? "" : `/${page}`}`;
      })
    )
  );
  check(
    "every product response is private, unindexed, unframeable and sends no Referer",
    PRODUCT_RESPONSE_HEADERS["x-private-page"] === "1" &&
      PRODUCT_RESPONSE_HEADERS["X-Robots-Tag"] === "noindex, nofollow" &&
      PRODUCT_RESPONSE_HEADERS["Content-Security-Policy"] === "frame-ancestors 'none'" &&
      PRODUCT_RESPONSE_HEADERS["Referrer-Policy"] === "no-referrer"
  );
  const html = productNotFoundHtml("es") + productNotFoundHtml(null);
  check("the product 404 page names nobody and is noindex", !/isaac/i.test(html) && html.includes('content="noindex'));
}

console.log("\nToken pages: which domain serves a client's link");
{
  const decide = (
    surface: AppSurface,
    owner: TokenPageOwnerFact,
    over: { gates?: TenancyGates; keepsMainView?: boolean; productConfigured?: boolean; lob?: string } = {}
  ) =>
    decideTokenPage({
      surface,
      lob: over.lob ?? HA,
      owner,
      gates: over.gates ?? OFF,
      keepsMainView: over.keepsMainView ?? false,
      productConfigured: over.productConfigured ?? true,
    });
  check("main: Isaac's token renders as always", decide("main", "platform") === "render");
  check("main: an unknown token renders as always (the API says not found)", decide("main", "missing") === "render");
  check("main: a failed lookup renders as always (the API answers 503)", decide("main", "unknown") === "render");
  check("main: an agent's client is sent to the product domain", decide("main", testAgent) === "redirect");
  check("main: the owner or an operator keeps the page (the API decides)", decide("main", testAgent, { keepsMainView: true }) === "render");
  check("main: …even for a paused agent (they get the audited answer)", decide("main", pausedAgent, { keepsMainView: true }) === "render");
  check("main: a paused agent's client → 404, not a redirect", decide("main", pausedAgent) === "not_found");
  check("main: a real agent's client while TENANT_CLIENT_DATA is off → 404", decide("main", realAgent) === "not_found");
  check("main: a real agent's client once it is on → redirect", decide("main", realAgent, { gates: ON }) === "redirect");
  check("main: no product domain configured → 404, never Isaac's page", decide("main", testAgent, { productConfigured: false }) === "not_found");
  check("product: Isaac's token → 404", decide("product", "platform") === "not_found");
  check("product: an unknown token → 404", decide("product", "missing") === "not_found");
  check("product: a failed lookup → retry (500), never a 404 that sticks", decide("product", "unknown") === "retry");
  check("product: an open agent's token → the agent's shell", decide("product", testAgent) === "tenant");
  check("product: a paused agent's token → 404", decide("product", pausedAgent) === "not_found");
  check("product: a real agent's token while TENANT_CLIENT_DATA is off → 404", decide("product", realAgent) === "not_found");
  check("product: an agent's token on another line → 404", decide("product", testAgent, { lob: "life-insurance" }) === "not_found");
}

console.log("\nPublic pages gate (guide, Apply, privacy)");
{
  check("PLATFORM_PREVIEW is off unless exactly on", !readPlatformPreview({}) && readPlatformPreview({ PLATFORM_PREVIEW: "1" }) && !readPlatformPreview({ PLATFORM_PREVIEW: "preview" }));
  check("a real agent needs TENANT_PUBLIC_PAGES", !agentPublicPagesOpen(realAgent, OFF, true) && agentPublicPagesOpen(realAgent, { ...OFF, publicPages: true }, false));
  check("a test agent shows on a preview deployment with the gate off", agentPublicPagesOpen(testAgent, OFF, true));
  check("a test agent never shows on a production product domain with the gate off", !agentPublicPagesOpen(testAgent, OFF, false));
  check("a test agent shows once the gate is on", agentPublicPagesOpen(testAgent, { ...OFF, publicPages: true }, false));
  check("a paused or invited agent never shows", !agentPublicPagesOpen(pausedAgent, ON, true) && !agentPublicPagesOpen(invitedAgent, ON, true));
}

console.log("\nPublic origins (lib/tenancy/site-urls.ts; urls.ts publicOriginForOwner)");
{
  const env = { NEXT_PUBLIC_SITE_URL: "https://www.isaacplans.com/", PRODUCT_PUBLIC_URL: "https://guide.example.com/ignored/path" };
  check("Isaac's site defaults to www.isaacplans.com", mainSiteUrl({}) === "https://www.isaacplans.com");
  check("NEXT_PUBLIC_SITE_URL wins, without a trailing slash", mainSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://staging.example/" }) === "https://staging.example");
  check("PRODUCT_PUBLIC_URL is read as its origin", productPublicOrigin(env) === "https://guide.example.com");
  check(
    "a missing or malformed product URL is null",
    productPublicOrigin({}) === null &&
      productPublicOrigin({ PRODUCT_PUBLIC_URL: "guide.example.com" }) === null &&
      productPublicOrigin({ PRODUCT_PUBLIC_URL: "ftp://guide.example.com" }) === null &&
      productPublicOrigin({ PRODUCT_PUBLIC_URL: "https://u:p@guide.example.com" }) === null
  );
  check(
    "a local preview host works over http (localhost, *.local), any other only over https",
    productPublicOrigin({ PRODUCT_PUBLIC_URL: "http://pilot.local:3001" }) === "http://pilot.local:3001" &&
      productPublicOrigin({ PRODUCT_PUBLIC_URL: "http://localhost:3001" }) === "http://localhost:3001" &&
      productPublicOrigin({ PRODUCT_PUBLIC_URL: "http://guide.example.com" }) === null &&
      productPublicOrigin({ PRODUCT_PUBLIC_URL: "http://localhost.example.com" }) === null
  );
  check("platform owner → Isaac's site", publicOriginFor(true, env) === "https://www.isaacplans.com");
  check("anyone else → the product domain", publicOriginFor(false, env) === "https://guide.example.com");
  check("no product domain → Isaac's site (whose token pages then 404 for an agent)", publicOriginFor(false, { NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL }) === "https://www.isaacplans.com");

  // isaacplans.com's 307 for an agent's client: never to the site answering, never to Isaac's own.
  const redirectTo = (product: string, requestHost: string | null, site = "https://www.isaacplans.com") =>
    productRedirectOrigin({ requestHost, env: { NEXT_PUBLIC_SITE_URL: site, PRODUCT_PUBLIC_URL: product } });
  check("the 307 goes to the product domain", redirectTo("https://guide.example.com", "www.isaacplans.com") === "https://guide.example.com");
  check("…never to the site answering (a loop)", redirectTo("https://guide.example.com", "guide.example.com") === null && redirectTo("https://www.guide.example.com", "guide.example.com") === null);
  check("…never to Isaac's own site, www or not", redirectTo("https://isaacplans.com", "preview.vercel.app") === null && redirectTo("https://www.isaacplans.com", null) === null);
  check("…never to the default site either, whatever NEXT_PUBLIC_SITE_URL says", redirectTo("https://isaacplans.com", null, "https://staging.example") === null);
  check("…never in plain http to a public host, and nowhere without a product domain", redirectTo("http://guide.example.com", "www.isaacplans.com") === null && redirectTo("", "www.isaacplans.com") === null);
  check("…two local ports are two sites", redirectTo("http://localhost:3001", "localhost:3000") === "http://localhost:3001");

  // Isaac's links are the ones the share-link builder always made: its old default was
  // NEXT_PUBLIC_SITE_URL ?? https://www.isaacplans.com, trailing slashes trimmed.
  const ha = ENGINE_INTAKE_CONFIGS.find((c) => c.lob === HA);
  const T = "AbCdEfGhIjKlMnOp";
  const oldBase = (value: string | undefined) => value ?? "https://www.isaacplans.com";
  check(
    "Isaac's application and secure links are unchanged (env unset, or with a trailing slash)",
    ha !== undefined &&
      [undefined, "https://www.isaacplans.com/", "https://staging.example//"].every((value) => {
        const site = mainSiteUrl({ NEXT_PUBLIC_SITE_URL: value });
        return (["en", "es"] as const).every(
          (l) =>
            buildIntakeShareUrl(ha, T, l, site) === buildIntakeShareUrl(ha, T, l, oldBase(value)) &&
            buildSecureCaptureUrl(T, l, site) === buildSecureCaptureUrl(T, l, oldBase(value))
        );
      }) &&
      buildIntakeShareUrl(ha, T, "es", mainSiteUrl({})) === `https://www.isaacplans.com/es/alternativa-de-salud/admision/${T}`
  );

  check("the platform's name defaults", platformName({}) === DEFAULT_PLATFORM_NAME && platformName({ PLATFORM_NAME: "  Guía Salud " }) === "Guía Salud");
  check("the product host label drops the scheme and www", productHostLabel({ PRODUCT_PUBLIC_URL: "https://www.guide.example.com" }) === "guide.example.com" && productHostLabel({}) === null);
}

console.log("\nImpact referral links: Impact's own https hosts only");
{
  for (const ok of [
    "https://impacthealthsharing.com/enroll",
    "https://www.impacthealthsharing.com/enroll?ref=AB12",
    "https://IMPACTHEALTHSHARING.COM/x",
    "https://mysharable.com",
    "https://impact.mysharable.com/r/abc",
  ]) {
    check(`accepts ${ok}`, safeImpactReferralUrl(ok) !== null);
  }
  for (const bad of [
    "http://impacthealthsharing.com/enroll",
    "https://impacthealthsharing.com.evil.com/",
    "https://evilimpacthealthsharing.com/",
    "https://evil.com/impacthealthsharing.com",
    "https://evil.com/?u=https://impacthealthsharing.com",
    "https://user@impacthealthsharing.com/",
    "https://impacthealthsharing.com:8443/",
    "https://mysharable.co/",
    "https://impacthealthsharing.co/",
    "impacthealthsharing.com/enroll",
    "javascript:alert(1)",
    "//impacthealthsharing.com",
    "",
  ]) {
    check(`refuses ${bad || "(empty)"}`, safeImpactReferralUrl(bad) === null);
  }
  check("refuses nothing at all", safeImpactReferralUrl(null) === null && safeImpactReferralUrl(undefined) === null);
}

console.log("\nAgent profiles (lib/tenancy/profile.ts)");
{
  // The card his screens drew before the platform (the AGENT constant once in
  // components/impact-presentation/copy.ts), field for field.
  const OLD_CARD = {
    name: "Isaac Orraiz",
    whatsapp: "(540) 681-3507",
    whatsappDigits: "15406813507",
    site: "isaacplans.com",
    photo: "/images/impact/presentation/agent-isaac.jpg",
    languages: "Español · English",
  };
  check(
    "ISAAC_AGENT is the old card, unchanged",
    (Object.keys(OLD_CARD) as (keyof typeof OLD_CARD)[]).every((key) => ISAAC_AGENT[key] === OLD_CARD[key])
  );
  const isaac = buildIsaacProfile({ licensedStateCount: 14, iboNumber: " IBO-1 ", siteUrl: "https://www.isaacplans.com/" });
  check("Isaac's name is the old card's", isaac.displayName === OLD_CARD.name && `${isaac.firstName} ${isaac.lastName}` === OLD_CARD.name);
  check("…his WhatsApp prints exactly as before", formatWhatsapp(isaac.whatsappE164) === OLD_CARD.whatsapp && isaac.whatsappDigits === OLD_CARD.whatsappDigits);
  check("…his languages print exactly as before", languagesLabel(isaac.languages) === OLD_CARD.languages);
  check("…his site line is the same", isaac.siteLabel === OLD_CARD.site);
  check("…his photo stays the app's own file (optimized as before) and has an absolute URL", isaac.photoPath === OLD_CARD.photo && isaac.photoUrl === `https://www.isaacplans.com${OLD_CARD.photo}`);
  check("…licensed, in the Sanity count of states", isaac.licensed && isaac.licensedStateCount === 14);
  check("…IBO # from env, trimmed; none → a dash on the card", isaac.iboNumber === "IBO-1" && buildIsaacProfile({ licensedStateCount: 0, siteUrl: "x" }).iboNumber === null);
  check("…his pages have no slug and his pronoun is kept", isaac.slug === null && isaac.pronoun === "he");
  check(
    "…his wa.me link is the same as before",
    whatsappHref(isaac.whatsappDigits, DECK_COPY.es.guide.whatsappText(isaac.firstName)) ===
      `https://wa.me/${OLD_CARD.whatsappDigits}?text=${encodeURIComponent("Hola Isaac, vi la presentación de Impact y tengo una pregunta.")}`
  );
  // The copy that used to say "Isaac" says exactly the same for him.
  check("es WhatsApp message", DECK_COPY.es.guide.whatsappText(isaac.firstName) === "Hola Isaac, vi la presentación de Impact y tengo una pregunta.");
  check("en WhatsApp message", DECK_COPY.en.guide.whatsappText(isaac.firstName) === "Hi Isaac, I saw the Impact presentation and I have a question.");
  check(
    "es no-prices message",
    DECK_COPY.es.quote.error(isaac.firstName, isaac.pronoun) ===
      "No pudimos traer los precios ahora. Escríbale a Isaac por WhatsApp y le envía su cotización."
  );
  check(
    "en no-prices message",
    DECK_COPY.en.quote.error(isaac.firstName, isaac.pronoun) ===
      "We couldn't get the prices right now. Message Isaac on WhatsApp and he'll send your quote."
  );
  check(
    "the service line for Isaac's two languages",
    DECK_COPY.es.agent.facts.service(isaac.languages) === "Atención personalizada en español y en inglés" &&
      DECK_COPY.en.agent.facts.service(isaac.languages) === "Personal service in English and Spanish"
  );
  check(
    "the licensed line is unchanged",
    DECK_COPY.en.agent.facts.licensed(14) === "Licensed health agent in 14 states" &&
      DECK_COPY.es.agent.facts.licensed(0) === "Agente de salud licenciado"
  );

  const row: AgentProfileSource = {
    slug: "maria-lopez",
    firstName: " María ",
    lastName: "López",
    photoUrl: "https://res.cloudinary.com/demo/image/upload/maria.jpg",
    whatsappE164: "+1 (555) 010-2000",
    languages: ["es", "fr", "EN", "es"],
    licensed: false,
    licensedStates: ["VA", "md"],
    iboNumber: " 7788 ",
    impactReferralUrl: "https://impacthealthsharing.com.evil.com/x",
  };
  const maria = agentPublicProfile(row, { PRODUCT_PUBLIC_URL: "https://www.guide.example.com" });
  check("an agent's name, slug and site line are their own", maria.displayName === "María López" && maria.firstName === "María" && maria.slug === "maria-lopez" && maria.siteLabel === "guide.example.com/maria-lopez");
  check("an agent's WhatsApp is normalized to E.164", maria.whatsappE164 === "+15550102000" && maria.whatsappDigits === "15550102000" && formatWhatsapp(maria.whatsappE164) === "(555) 010-2000");
  check("only en/es, once each, in their order", JSON.stringify(maria.languages) === JSON.stringify(["es", "en"]));
  check("not licensed: no states counted, so no 'licensed' line", !maria.licensed && maria.licensedStateCount === 0);
  check("licensed: unique two-letter states counted", agentPublicProfile({ ...row, licensed: true, licensedStates: ["va", "VA", "md", "x1", ""] }, {}).licensedStateCount === 2);
  check("their own IBO #, never Isaac's", maria.iboNumber === "7788");
  check("a look-alike Impact link is dropped", maria.impactReferralUrl === null);
  check("an agent has no pronoun yet: the English message is worded without one", maria.pronoun === null && DECK_COPY.en.quote.error(maria.firstName, maria.pronoun) === "We couldn't get the prices right now. Message María on WhatsApp for your quote.");
  check("no product domain: no site line", agentPublicProfile(row, {}).siteLabel === null);
  check("an agent's photo is an outside https URL, never the app's own path", maria.photoUrl === row.photoUrl && maria.photoPath === null);
  for (const bad of ["http://res.cloudinary.com/x.jpg", "https://127.0.0.1/x.jpg", "https://2130706433/x.jpg", "https://[::1]/x.jpg", "https://localhost/x.jpg", "https://intranet/x.jpg", "https://files.local/x.jpg", "/images/x.jpg", "javascript:alert(1)"]) {
    check(`photo ${bad} is dropped`, safePhotoUrl(bad) === null);
  }
  // Never Isaac's own media: his Cloudinary account (by name, or the one in env) or his site.
  for (const bad of [
    "https://res.cloudinary.com/isaacdev/image/upload/v1/agents/maria.jpg",
    "https://res.cloudinary.com/IsaacDev/image/upload/maria.jpg",
    "https://isaacdev-res.cloudinary.com/image/upload/maria.jpg",
    "https://res.cloudinary.com/main-cloud/image/upload/maria.jpg",
    "https://www.isaacplans.com/images/maria.jpg",
    "https://cdn.isaacplans.com/maria.jpg",
    "https://staging.example/maria.jpg",
  ]) {
    const env = { NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "main-cloud", NEXT_PUBLIC_SITE_URL: "https://staging.example" };
    check(`photo ${bad} (Isaac's media) is dropped`, safePhotoUrl(bad, env) === null);
  }
  check(
    "another Cloudinary account is fine",
    safePhotoUrl("https://res.cloudinary.com/agents-media/image/upload/maria.jpg", { NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "main-cloud" }) !== null &&
      agentPublicProfile({ ...row, photoUrl: "https://res.cloudinary.com/isaacdev/image/upload/m.jpg" }, {}).photoUrl === null
  );
  check("a number that isn't E.164 is dropped", normalizeE164("555-0102") === null && normalizeE164("+0123456789") === null && normalizeE164(null) === null);
  check("no number: no wa.me link", whatsappHref(null) === null && whatsappHref("12") === null);
  check(
    "the service line follows the agent's languages",
    DECK_COPY.es.agent.facts.service(["es"]) === "Atención personalizada en español" &&
      DECK_COPY.en.agent.facts.service(["es"]) === "Personal service in Spanish" &&
      DECK_COPY.en.agent.facts.service([]) === null
  );
  check("no name at all: the slug stands in", agentPublicProfile({ ...row, firstName: null, lastName: null }, {}).displayName === "maria-lopez");
}

console.log("\nGuide plan key per agent (lib/impact-quote/sync.ts)");
{
  check("Isaac's /impact keeps \"guide\"", guideScopeFor(null) === GUIDE_SCOPE && guideScopeFor("") === "guide");
  check("an agent's guide is guide:<slug>", guideScopeFor(" Maria-Lopez ") === "guide:maria-lopez");
  check("two agents never share a key", guideScopeFor("maria-lopez") !== guideScopeFor("juan-perez"));
  check("both are guide scopes; a token isn't", isGuideScope("guide") && isGuideScope("guide:maria-lopez") && !isGuideScope("AbCdEfGh"));
  const now = Date.parse("2026-11-23T12:00:00Z");
  const pick = (hoursAgo: number) => ({ tier: "esencial" as const, monthly: 300, at: new Date(now - hoursAgo * 3600_000).toISOString() });
  check("an agent's guide pick expires after 12 hours, like Isaac's", planChoiceUsable(pick(1), "guide:maria-lopez", { now }) && !planChoiceUsable(pick(13), "guide:maria-lopez", { now }));
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
    // The product domain's pages and shell.
    "app/[locale]/a",
    "app/[locale]/secure",
    "components/tenant",
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

console.log("\nGuard: nothing of Isaac's in the product domain's browser code");
{
  const read = (path: string) => readFileSync(join(ROOT, ...path.split("/")), "utf8");
  /** Every repo module a file reaches through value imports (type-only imports never ship). */
  const reachable = (roots: readonly string[]): string[] => {
    const seen = new Set<string>();
    const queue = roots.map((r) => join(ROOT, ...r.split("/")));
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const imp of importsOf(readFileSync(file, "utf8"))) {
        const target = resolveModule(file, imp.spec);
        if (target) queue.push(target);
      }
    }
    return Array.from(seen).map(rel).sort();
  };
  /** Code without its comments (block comments and whole comment lines; strings are left alone). */
  const code = (source: string) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");
  const IDENTITY = [/5406813507/, /681-3507/, /Orraiz/i, /isaacplans/i, /agent-isaac/i];

  // The client components an agent's guide page draws: the product frame's two, and the guide's.
  const guideClient = reachable([
    "components/theme-provider.tsx",
    "components/ui/toaster.tsx",
    "components/impact-presentation/impact-guide.tsx",
    "components/impact-presentation/guide-quote.tsx",
  ]);
  const SERVER_SIDE_ONLY = [
    "i18n/navigation.ts", // next-intl's navigation: its browser code carries Isaac's whole route table
    "i18n/routing.ts",
    "lib/tenancy/isaac-agent.ts",
    "lib/tenancy/isaac-profile.ts",
    "lib/tenancy/profile.ts",
    "lib/tenancy/site-urls.ts",
    "components/site-shell/main-shell.tsx",
  ];
  const wrong = guideClient.filter((f) => SERVER_SIDE_ONLY.includes(f));
  check(`the guide's browser code (${guideClient.length} modules) reaches no route table, profile builder or Isaac's frame`, guideClient.length > 4 && wrong.length === 0, wrong.join(", "));
  const spelled = guideClient.filter((f) => IDENTITY.some((re) => re.test(code(read(f)))));
  check("…and none of it spells out Isaac's name, number, site or photo", spelled.length === 0, spelled.join(", "));
  check("copy.ts, which every client page ships, carries no agent's identity", !IDENTITY.some((re) => re.test(code(read("components/impact-presentation/copy.ts")))));

  // The page frame: chosen at build time, and the product's imports nothing of Isaac's.
  const layoutImports = importsOf(read("app/[locale]/layout.tsx")).map((i) => i.spec).sort();
  check(
    "the [locale] layout imports its frame only through active-shell (nothing of Isaac's itself)",
    JSON.stringify(layoutImports) ===
      JSON.stringify(
        ["@/app/globals.css", "@/components/site-shell/active-shell", "@/i18n/routing", "@/lib/tenancy/surface", "next-intl", "next/font/google", "next/navigation"].sort()
      ),
    layoutImports.join(", ")
  );
  const productFrame = importsOf(read("components/site-shell/product-shell.tsx")).map((i) => i.spec).sort();
  check(
    "the product frame imports only the theme, toasts, next-intl's provider and the platform's own settings",
    JSON.stringify(productFrame) ===
      JSON.stringify(["./shared", "@/components/theme-provider", "@/components/ui/toaster", "@/lib/tenancy/site-urls", "next-intl", "next/script", "next/server"].sort()),
    productFrame.join(", ")
  );
  check("the shared frame module imports nothing that runs", importsOf(read("components/site-shell/shared.ts")).length === 0);
  const config = read("next.config.mjs");
  const swap = config.match(/const ACTIVE_SHELL_REQUEST = \/(.+)\/;/);
  check(
    "next.config.mjs swaps exactly the layout's frame import for the product's on the product build",
    swap !== null &&
      new RegExp(swap[1]).test("@/components/site-shell/active-shell") &&
      !new RegExp(swap[1]).test("@/components/site-shell/active-shell-x") &&
      config.includes('new URL("./components/site-shell/product-shell.tsx", import.meta.url)') &&
      exists(join(ROOT, "components", "site-shell", "product-shell.tsx"))
  );
  check("active-shell is Isaac's frame by default (his build, and what TypeScript checks)", /from "\.\/main-shell"/.test(read("components/site-shell/active-shell.ts")));
}

console.log("\nPublic origins: the real publicOriginForOwner core (async)");
void (async () => {
  try {
    const env = { NEXT_PUBLIC_SITE_URL: "https://www.isaacplans.com/", PRODUCT_PUBLIC_URL: "https://guide.example.com" };
    // lib/tenancy/urls.ts is publicOriginForOwnerWith(owner, opts, isPlatformOwner); this stand-in
    // follows crm.ts's isPlatformOwner: crmOwnerDecision, and Clerk only for "ask_clerk".
    const seenOpts: unknown[] = [];
    const fakeIsPlatformOwner =
      (surface: AppSurface, clerkAdmins: readonly string[] = []) =>
      async (owner: string | null | undefined, opts: { adminCaller?: string | null }): Promise<boolean> => {
        seenOpts.push(opts);
        const decision = crmOwnerDecision(owner, {
          allowlist: buildCrmOwnerAllowlist({ CRM_OWNER_USER_IDS: ISAAC }),
          surface,
          adminCaller: opts.adminCaller ?? null,
        });
        return decision === "allow" || (decision === "ask_clerk" && clerkAdmins.includes(String(owner)));
      };
    const origin = async (owner: string, surface: AppSurface, opts: { adminCaller?: string | null } = {}, clerkAdmins: string[] = []) =>
      (await publicOriginForOwnerWith(owner, opts, fakeIsPlatformOwner(surface, clerkAdmins), env)).origin;
    check("Isaac (listed) → his site", (await origin(ISAAC, "main")) === "https://www.isaacplans.com");
    check("an unlisted admin vouching for himself → his site", (await origin(ADMIN2, "main", { adminCaller: ADMIN2 })) === "https://www.isaacplans.com");
    check("…the caller's options reach the CRM rule untouched", seenOpts.some((o) => (o as { adminCaller?: string }).adminCaller === ADMIN2));
    check("an unlisted Clerk admin → his site", (await origin(ADMIN2, "main", {}, [ADMIN2])) === "https://www.isaacplans.com");
    check("an agent → the product domain", (await origin(AGENT_A, "main")) === "https://guide.example.com");
    check("an admin vouching for someone else's session → the product domain", (await origin(AGENT_A, "main", { adminCaller: ADMIN2 })) === "https://guide.example.com");
    check("on the product domain, even Isaac's id → the product domain", (await origin(ISAAC, "product")) === "https://guide.example.com");
    const both = await publicOriginForOwnerWith(AGENT_A, {}, fakeIsPlatformOwner("main"), env);
    check("it reports whether the owner is Isaac's side (urls.ts warns once without a product domain)", both.platformOwner === false);
  } catch (error) {
    check("the async checks ran", false, error instanceof Error ? error.message : String(error));
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();

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
