/**
 * Offline checks for the Legal Shield line and the `legal_shield` staff role.
 *
 * The role must reach the Legal Shield line and nothing else; the line must keep LegalShield's
 * rules (no insurance wording, no Isaac Plans branding, nothing sensitive to the CRM) and Isaac's
 * prices exactly. One regex slip in the admin-path rule would expose admin pages and API routes
 * that have no check of their own, so those paths are listed one by one.
 *
 * No network, no database, no API keys. Run with: pnpm test:staff-access
 */

import fs from "node:fs";
import path from "node:path";
import {
  canOpenAdminPath,
  canOperateLine,
  canOperateSession,
  roleFromMetadata,
  shouldSyncClerkUserToCrm,
} from "../lib/auth/staff-roles";
import { isPrivatePagePath } from "../lib/private-pages";
import { isAdsLandingPath, isLegalShieldIntakePath, isLegalShieldLandingPath } from "../lib/ads-landing";
import { deliveryMessage, deliveryPhoneDigits, whatsappDeliveryHref } from "../lib/intake-core/link-delivery";
import { asPackage, lsQuote, lsQuoteSentence, usd } from "../lib/legal-shield/plans";
import { legalShieldIntake } from "../lib/intake-configs/legal-shield";
import { getIntakeConfig } from "../lib/intake-configs";
import { ownerOnlyKeys, ownerOnlySectionKeys } from "../lib/intake-core/fields";
import { groupExcluded, groupReady } from "../lib/intake-core/secure-capture-groups";
import { isValidCardExpiration, isValidCvv, isValidSsnLast4, passesLuhn } from "../lib/intake-core/validation";
import { buildCrmPayloadFromData } from "../lib/intake-core/crm-payload";
import { maskSensitive } from "../lib/intake-shared/masking";
import { buildIntakeShareUrl, buildIntakeViewUrl, buildSecureCaptureUrl } from "../lib/intake-core/share-url";
import { ownerNoticeContent } from "../lib/intake-core/owner-notice";
import { EXCLUSION_TAGS } from "../lib/ai-setter/config";
import { isLobSlug } from "../lib/lob/registry";
import { NOT_INSURANCE_LINE_ES } from "../lib/legal-shield/constants";
import type { IntakeField, IntakeLobConfig } from "../lib/intake-core/types";

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

const admin = { userId: "isaac", role: "admin" as const, isAdmin: true };
const dad = { userId: "ysmael", role: "legal_shield" as const, isAdmin: false };
const visitor = { userId: "someone", role: null, isAdmin: false };

console.log("\nRoles come only from a whitelisted metadata value");
check("admin", roleFromMetadata({ role: "admin" }) === "admin");
check("legal_shield", roleFromMetadata({ role: "legal_shield" }) === "legal_shield");
check("anything else is no role", roleFromMetadata({ role: "Admin" }) === null && roleFromMetadata({ role: "agent" }) === null);
check("missing metadata is no role", roleFromMetadata(undefined) === null && roleFromMetadata(null) === null);

console.log("\nWhich lines each role may operate");
for (const lob of ["health-alternative", "short-term-medical", "dental-vision", "hospital-indemnity", "life-insurance", "iul", "aca"]) {
  check(`legal_shield is refused on ${lob}`, !canOperateLine(dad, lob));
  check(`admin operates ${lob}`, canOperateLine(admin, lob));
}
check("legal_shield operates legal-shield", canOperateLine(dad, "legal-shield"));
check("admin operates legal-shield", canOperateLine(admin, "legal-shield"));
check("a signed-in visitor operates nothing", !canOperateLine(visitor, "legal-shield") && !canOperateLine(visitor, "health-alternative"));

console.log("\nWho may act on one session");
const dadsRow = { ownerUserId: "ysmael" };
const isaacsRow = { ownerUserId: "isaac" };
check("the owner may", canOperateSession(dad, legalShieldIntake, dadsRow));
check("Isaac may on his dad's Legal Shield client (oversight)", canOperateSession(admin, legalShieldIntake, dadsRow));
check("the dad may NOT on Isaac's Legal Shield session", !canOperateSession(dad, legalShieldIntake, isaacsRow));
check("an admin is held to ownership on a line without oversight", !canOperateSession(admin, {}, dadsRow));

console.log("\nThe /admin gate: the legal_shield role reaches the dashboard root and nothing else");
for (const p of ["/admin", "/en/admin", "/es/admin", "/es/admin/", "/en/admin/"]) {
  check(`legal_shield may open ${p}`, canOpenAdminPath("legal_shield", p));
}
for (const p of [
  "/es/admin/meet",
  "/es/admin/meet/",
  "/es/admin%2Fmeet",
  "/es/adminfoo",
  "/ES/ADMIN/meet",
  "/es/admin/lead-holds",
  "/en/admin/ai-setter",
  "/admin/call-study",
  "/api/admin/x",
  "/studio",
  "/es/admin//meet",
]) {
  check(`legal_shield may NOT open ${p}`, !canOpenAdminPath("legal_shield", p));
}
check("admin opens any admin path", canOpenAdminPath("admin", "/es/admin/meet") && canOpenAdminPath("admin", "/admin"));
check("no role opens nothing", !canOpenAdminPath(null, "/es/admin"));

console.log("\nClerk → CRM sync skips the dad's staff login");
check("legal_shield (webhook snake_case) is skipped", !shouldSyncClerkUserToCrm({ public_metadata: { role: "legal_shield" } }));
check("a regular user still syncs", shouldSyncClerkUserToCrm({ public_metadata: {} }));
check("admin still syncs (unchanged)", shouldSyncClerkUserToCrm({ public_metadata: { role: "admin" } }));

console.log("\nEvery Legal Shield intake page is private and gets the associate's chrome");
const LS_PATHS = [
  "/es/legal-shield/intake",
  "/es/legal-shield/intake/tok123",
  "/es/legal-shield/intake/tok123/view",
  "/es/legal-shield/intake/tok123/presentation",
  "/es/legal-shield/intake/privado/cap456",
  "/legal-shield/intake/tok123",
  "/legal-shield/intake/privado/cap456",
];
for (const p of LS_PATHS) {
  check(`private: ${p}`, isPrivatePagePath(p));
  check(`associate header: ${p}`, isLegalShieldIntakePath(p) && isAdsLandingPath(p));
}
check("the funnel is NOT treated as an intake page", !isLegalShieldIntakePath("/legal-shield/proteccion-legal"));
check("the funnel keeps its own branch", isLegalShieldLandingPath("/legal-shield/proteccion-legal"));
check("the funnel is not private (it's a public ad page)", !isPrivatePagePath("/es/legal-shield/proteccion-legal"));

console.log("\nLinks point at the associate's pages, in Spanish");
check("share link", buildIntakeShareUrl(legalShieldIntake, "tok", "en", "https://x.test") === "https://x.test/es/legal-shield/intake/tok");
check(
  "private link (no 'seguro', which also means insurance)",
  buildSecureCaptureUrl("cap", "es", "https://x.test", legalShieldIntake.secureSlug) === "https://x.test/es/legal-shield/intake/privado/cap"
);
check("other lines keep /seguro", buildSecureCaptureUrl("cap", "es", "https://x.test") === "https://x.test/es/seguro/cap");

console.log("\nWhatsApp hand-off from the associate's own phone");
check("US number gets its 1", deliveryPhoneDigits("(540) 555-0100") === "15405550100");
check("11 digits starting with 1", deliveryPhoneDigits("15405550100") === "15405550100");
check("a typo is no recipient", deliveryPhoneDigits("555-01") === null);
const msg = deliveryMessage("application", "es", {
  agentName: "Ysmael Orraiz",
  product: "su solicitud de membresía de LegalShield",
  clientFirstName: "Ana",
  url: "https://x.test/es/legal-shield/intake/tok",
});
check("the message greets, names the associate and the product, ends with the link", msg.startsWith("Hola Ana, le saluda Ysmael Orraiz.") && msg.includes("LegalShield") && msg.endsWith("/tok"), msg);
check("wa.me link encodes the text", whatsappDeliveryHref("15405550100", "a b").endsWith("15405550100?text=a%20b"));

console.log("\nPrices are LegalShield's, exactly");
const full = lsQuote("preferido_idshield", "mensual");
const fullYear = lsQuote("preferido_idshield", "anual");
const legal = lsQuote("solo_preferido", "mensual");
const legalYear = lsQuote("solo_preferido", "anual");
check("package monthly $74.90", usd(full.totalCents) === "$74.90", usd(full.totalCents));
check("package yearly $850.86", usd(fullYear.totalCents) === "$850.86", usd(fullYear.totalCents));
check("package yearly per month $70.91", usd(fullYear.perMonthCents ?? 0) === "$70.91", usd(fullYear.perMonthCents ?? 0));
check("package yearly saves $47.94", usd(fullYear.savingsCents ?? 0) === "$47.94", usd(fullYear.savingsCents ?? 0));
check("Preferred alone monthly $39.95", usd(legal.totalCents) === "$39.95");
check("Preferred alone yearly $431.46 ($35.96/mo, saves $47.94)", usd(legalYear.totalCents) === "$431.46" && usd(legalYear.perMonthCents ?? 0) === "$35.96" && usd(legalYear.savingsCents ?? 0) === "$47.94");
check("an unknown package falls back to the full package", asPackage("basico") === "preferido_idshield");
check("the summary sentence", lsQuoteSentence("preferido_idshield", "mensual") === "Plan Legal Preferencial + IDShield Familiar (3 agencias): $74.90 al mes.");

console.log("\nThe Legal Shield form");
check("legal-shield is not an insurance line (stays out of LobSlug)", !isLobSlug("legal-shield"));
check("the engine serves it", getIntakeConfig("legal-shield") === legalShieldIntake);
check("no public self-start", legalShieldIntake.selfStart === false);
check("Spanish only", legalShieldIntake.fixedLocale === "es");
check("no GHL custom fields", legalShieldIntake.crmCustomFields === false);
check("new sessions start with the full package", legalShieldIntake.initialData?.lsPackage === "preferido_idshield");
const writeOnlyOwner = ownerOnlyKeys(legalShieldIntake.sections);
const hiddenFromClient = ownerOnlySectionKeys(legalShieldIntake.sections);
check("only the associate may write the package switch", writeOnlyOwner.includes("lsPackage"));
check("only the associate may write the notes", ["applicationStatus", "memberNumber", "agentNotes"].every((k) => writeOnlyOwner.includes(k)));
check("the client never receives the notes", ["applicationStatus", "memberNumber", "agentNotes"].every((k) => hiddenFromClient.includes(k)));
check("…but does receive the package (the price note reads it)", !hiddenFromClient.includes("lsPackage"));

console.log("\nNumbers: validation, masking, the CRM");
check("SSN last 4: 4 digits", isValidSsnLast4("1234") && !isValidSsnLast4("123") && !isValidSsnLast4("12a4") && !isValidSsnLast4("12345"));
check("Luhn: a valid test card passes", passesLuhn("4111 1111 1111 1111"));
check("Luhn: a typo fails", !passesLuhn("4111111111111112"));
check("CVV 3 or 4 digits", isValidCvv("123") && isValidCvv("1234") && !isValidCvv("12"));
check("an expired card fails", !isValidCardExpiration("01/20") && isValidCardExpiration("12/39"));
check("a CVV or last-4 is masked completely", maskSensitive({ cardCvv: "123", ssnLast4: "6789" }, ["cardCvv", "ssnLast4"]).ssnLast4 === "••••");
const everyId = (_lob: string, slug: string) => `id-${slug}`;
const payload = buildCrmPayloadFromData(
  legalShieldIntake,
  {
    email: "ana@x.test",
    firstName: "Ana",
    lastName: "Ruiz",
    phone: "5405550100",
    dateOfBirth: "1980-01-02",
    ssnLast4: "6789",
    paymentMethod: "Tarjeta",
    cardNumber: "4111111111111111",
    cardCvv: "123",
  },
  everyId
);
const flat = JSON.stringify(payload);
check("no custom fields at all", payload.customFields.length === 0, flat);
check("native contact fields only (name, email, phone, birth date)", payload.native.email === "ana@x.test" && payload.native.firstName === "Ana");
check("no SSN, card or CVV anywhere in the payload", !/6789|4111111111111111|"123"/.test(flat), flat);

console.log("\nThe secure link asks for the right payment numbers");
const card = legalShieldIntake.secureCapture!.groups.find((g) => g.key === "card")!;
const bank = legalShieldIntake.secureCapture!.groups.find((g) => g.key === "bank")!;
check("card group ready when paying by card", groupReady(card, { paymentMethod: "Tarjeta" }));
check("card group left out when paying by bank", groupExcluded(card, { paymentMethod: "Débito bancario" }) && !groupReady(card, { paymentMethod: "Débito bancario" }));
check("bank group ready when paying by bank", groupReady(bank, { paymentMethod: "Débito bancario" }));
check("nothing asked before the method is chosen", !groupReady(card, {}) && !groupExcluded(card, {}));

console.log("\nLegalShield is not insurance: no insurance wording, no Isaac Plans");
const INSURANCE = /aseguradora|cobertura|p[óo]liza|\bNPN\b|seguro de|insurance|coverage|carrier|\bpolicy\b|Isaac Plans/i;
const ALLOWED = /no es un seguro|not insurance/i;
function strings(config: IntakeLobConfig): string[] {
  const out: string[] = [config.label, config.formTitle.en, config.formTitle.es];
  const fromField = (f: IntakeField) => {
    out.push(f.labelEn, f.labelEs, f.helpEn ?? "", f.helpEs ?? "", f.placeholderEn ?? "", f.placeholderEs ?? "");
    for (const o of f.options ?? []) out.push(o.labelEn, o.labelEs, o.descriptionEn ?? "", o.descriptionEs ?? "");
    for (const sub of f.rowFields ?? []) fromField(sub);
    if (f.rowLabelEn) out.push(f.rowLabelEn, f.rowLabelEs ?? "");
  };
  for (const s of config.sections) {
    out.push(s.titleEn, s.titleEs, s.descriptionEn ?? "", s.descriptionEs ?? "");
    if (s.callout) out.push(s.callout.titleEn, s.callout.titleEs, s.callout.bodyEn, s.callout.bodyEs);
    s.fields.forEach(fromField);
  }
  const p = config.presentation;
  if (p) {
    out.push(p.titleEn, p.titleEs, p.bodyEn, p.bodyEs, p.joinedEn, p.joinedEs, p.openEn, p.openEs);
    for (const t of p.agentToggles ?? []) out.push(t.labelEn, t.labelEs, t.hintEn ?? "", t.hintEs ?? "");
  }
  for (const g of config.secureCapture?.groups ?? []) out.push(g.labelEn, g.labelEs);
  if (config.linkDelivery) out.push(config.linkDelivery.product.en, config.linkDelivery.product.es);
  return out.filter(Boolean);
}
const offenders = strings(legalShieldIntake).filter((s) => INSURANCE.test(s) && !ALLOWED.test(s));
check("no insurance words in the form", offenders.length === 0, offenders.join(" | "));
check("the not-insurance line is on the form", strings(legalShieldIntake).some((s) => s.includes(NOT_INSURANCE_LINE_ES)));
const deckCopy = path.join(process.cwd(), "components/legal-shield-presentation/copy.ts");
if (fs.existsSync(deckCopy)) {
  const text = fs
    .readFileSync(deckCopy, "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"));
  const deckOffenders = text.filter((line) => INSURANCE.test(line) && !ALLOWED.test(line));
  check("no insurance words in the deck copy", deckOffenders.length === 0, deckOffenders.join(" | "));
  check("the deck never names Básico or Premium", !text.some((line) => /B[áa]sico|Premium/.test(line)));
}

console.log("\nIsaac's insurance AI never answers a Legal Shield client");
check("legal_shield_intake is an exclusion tag", (EXCLUSION_TAGS as readonly string[]).includes("legal_shield_intake"));
check(
  "legal_shield_guide_funnel is an exclusion tag",
  (EXCLUSION_TAGS as readonly string[]).includes("legal_shield_guide_funnel")
);
check(
  "Ysmael's search finds funnel leads by legal_shield_guide_funnel",
  (legalShieldIntake.contactSearchTags ?? []).includes("legal_shield_guide_funnel")
);
check(
  "his clients get legal_shield_intake + legal_shield_guide_funnel",
  ["legal_shield_intake", "legal_shield_guide_funnel"].every((t) => (legalShieldIntake.contactTags ?? []).includes(t))
);
check(
  "his clients never get legal_shield (it starts the funnel's opt-in workflow)",
  !(legalShieldIntake.contactTags ?? []).includes("legal_shield")
);

console.log("\nThe newsletter routes require the admin (found during this work)");
for (const route of ["app/api/newsletter/send-post/route.ts", "app/api/newsletter/subscriber-counts/route.ts"]) {
  const text = fs.readFileSync(path.join(process.cwd(), route), "utf8");
  check(`${route} calls getIsAdmin()`, text.includes("getIsAdmin()"));
}

console.log("\nThe associate's email when a client finishes on their own");
{
  const viewUrl = buildIntakeViewUrl(legalShieldIntake, "tok123", "en", "https://example.test");
  check("view link is the Spanish summary", viewUrl === "https://example.test/es/legal-shield/intake/tok123/view", viewUrl);

  const done = ownerNoticeContent({ config: legalShieldIntake, event: { kind: "completed" }, clientName: "Ana Prueba", viewUrl });
  check("completed: Spanish subject with the name", done.subject === "Ana Prueba completó su solicitud", done.subject);
  check("completed: links the summary", done.text.includes(viewUrl) && done.html.includes(viewUrl));

  const secure = ownerNoticeContent({
    config: legalShieldIntake,
    event: { kind: "secure", groups: ["Tarjeta"] },
    clientName: "Ana Prueba",
    viewUrl,
  });
  check("secure link: says what arrived, by label", secure.text.includes("Tarjeta") && /datos privados/.test(secure.subject), secure.text);

  const evil = ownerNoticeContent({
    config: legalShieldIntake,
    event: { kind: "completed" },
    clientName: "<img src=x onerror=alert(1)>\r\nBcc: x@evil.test",
    viewUrl,
  });
  check("a typed name can't inject HTML", !evil.html.includes("<img"));
  check("a typed name can't add mail headers", !/[\r\n]/.test(evil.subject), JSON.stringify(evil.subject));
  check(
    "no name: a neutral word",
    ownerNoticeContent({ config: legalShieldIntake, event: { kind: "completed" }, clientName: null, viewUrl }).subject.startsWith("Su cliente")
  );

  const owner = fs.readFileSync(path.join(process.cwd(), "lib/intake-core/owner-notify.ts"), "utf8");
  check("the notice never reads the answers", !/\.data\b|decrypt/.test(owner));
  const complete = fs.readFileSync(path.join(process.cwd(), "app/api/intake/[lob]/[token]/complete/route.ts"), "utf8");
  check(
    "completion emails only when the client submitted it",
    /if \(access\.role === "client"\) after\(\(\) => notifyIntakeOwner/.test(complete)
  );
  const capture = fs.readFileSync(path.join(process.cwd(), "app/api/intake-capture/[captureToken]/route.ts"), "utf8");
  check("the private link emails after it saves", /notifyIntakeOwner\(config, updated, \{\s*kind: "secure"/.test(capture));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
