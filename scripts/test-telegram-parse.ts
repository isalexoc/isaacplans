/**
 * Parser harness for the Telegram IUL lead pipeline. No network, no CRM, no database.
 *
 *   pnpm telegram:test-parse            run every assertion
 *   pnpm telegram:test-parse --sample   pretty-print the parse of the real sample
 *
 * The provider's format is known from exactly ONE message, so most of these fixtures are
 * deliberate mutations of it: emoji removed, labels renamed, lines shuffled. They encode the
 * promise that the parser degrades to a review flag instead of inventing data.
 */

import "dotenv/config";
import {
  parseEmpiregrowthLead,
  toE164Nanp,
  type ParsedTelegramLead,
} from "../lib/telegram/parse";
import { validateParsedLead, normalizeCallTime, normalizeSavingsBand, parseEnteredAt } from "../lib/telegram/validate";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}`, detail === undefined ? "" : detail);
  }
}

function eq(actual: unknown, expected: unknown, label: string) {
  assert(actual === expected, `${label} → ${JSON.stringify(actual)}`, `expected ${JSON.stringify(expected)}`);
}

/** The real message, exactly as received (the Bot API omits the client's "Forwarded from" chrome). */
const SAMPLE = [
  "🔔 Nuevo lead IUL",
  "",
  "👤 Miguel Colon",
  "📞 +18647757287",
  "✉️ miguelcolon7061212@gmail.com",
  "📍 Estado: Arkansas",
  "🎯 Ahorrar y crecer mi dinero",
  "💰 Ahorro/mes: Entre $100 y $200",
  "🕐 Mejor hora para llamar: Tarde",
  "📢 Anuncio: DCO Arkansas | WILSON-HOOKS",
  "📅 Entró: 9/15 8:11 AM CDT",
  "🌙 Llamar: 8:12 AM CDT local, fuera de horario",
].join("\n");

function core(p: ParsedTelegramLead, label: string) {
  eq(p.firstName, "Miguel", `${label} firstName`);
  eq(p.lastName, "Colon", `${label} lastName`);
  eq(p.phoneE164, "+18647757287", `${label} phone`);
  eq(p.email, "miguelcolon7061212@gmail.com", `${label} email`);
  eq(p.stateRaw, "Arkansas", `${label} state`);
}

if (process.argv.includes("--sample")) {
  const { parsed, diagnostics } = parseEmpiregrowthLead(SAMPLE);
  const v = validateParsedLead(parsed, diagnostics);
  console.log("\n--- parsed ---");
  console.log(JSON.stringify(parsed, null, 2));
  console.log("\n--- diagnostics ---");
  console.log(JSON.stringify(diagnostics, null, 2));
  console.log("\n--- validation ---");
  console.log(JSON.stringify(v, null, 2));
  process.exit(0);
}

console.log("\n1. the real sample");
{
  const { parsed, diagnostics } = parseEmpiregrowthLead(SAMPLE);
  core(parsed, "sample");
  eq(parsed.goal, "Ahorrar y crecer mi dinero", "sample goal");
  eq(parsed.monthlySavings, "Entre $100 y $200", "sample savings");
  eq(parsed.bestCallTime, "Tarde", "sample callTime");
  eq(parsed.adName, "DCO Arkansas | WILSON-HOOKS", "sample ad");
  eq(parsed.enteredAtRaw, "9/15 8:11 AM CDT", "sample enteredAt");
  eq(parsed.localCallNote, "8:12 AM CDT local, fuera de horario", "sample callNote");
  eq(parsed.language, "es", "sample language");
  assert(diagnostics.unmatchedLines.length === 0, "sample has no unmatched lines", diagnostics.unmatchedLines);

  const v = validateParsedLead(parsed, diagnostics);
  assert(v.ok, "sample validates", v);
  eq(parsed.stateCode, "AR", "sample stateCode");
  eq(parsed.bestCallTime, "Afternoon (2pm - 6pm)", "sample callTime normalized");
  eq(parsed.monthlySavings, "$100 - $200", "sample savings normalized");
}

console.log("\n2. the client's 'Forwarded from' header is stripped");
{
  const { parsed } = parseEmpiregrowthLead("Forwarded from [IUL] Empiregrowth Leads\n" + SAMPLE);
  core(parsed, "forwarded");
}

console.log("\n3. all emoji removed (label tier carries it)");
{
  const stripped = SAMPLE.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, "").trim();
  const { parsed } = parseEmpiregrowthLead(stripped);
  core(parsed, "no-emoji");
  eq(parsed.bestCallTime, "Tarde", "no-emoji callTime");
}

console.log("\n4. lines shuffled (parser is position-independent)");
{
  const shuffled = SAMPLE.split("\n").filter(Boolean).reverse().join("\n");
  const { parsed } = parseEmpiregrowthLead(shuffled);
  core(parsed, "shuffled");
  eq(parsed.adName, "DCO Arkansas | WILSON-HOOKS", "shuffled ad");
}

console.log("\n5. labels renamed, emoji intact (emoji tier carries it)");
{
  const renamed = SAMPLE.replace("Estado:", "Provincia:")
    .replace("Ahorro/mes:", "Presupuesto mensual:")
    .replace("Mejor hora para llamar:", "Mejor hora:");
  const { parsed } = parseEmpiregrowthLead(renamed);
  core(parsed, "renamed");
  eq(parsed.monthlySavings, "Entre $100 y $200", "renamed savings");
  eq(parsed.bestCallTime, "Tarde", "renamed callTime");
}

console.log("\n6. phone written differently");
{
  const alt = SAMPLE.replace("+18647757287", "(864) 775-7287");
  const { parsed } = parseEmpiregrowthLead(alt);
  eq(parsed.phoneE164, "+18647757287", "formatted phone");
}

console.log("\n7. strict NANP validator");
{
  eq(toE164Nanp("+18647757287"), "+18647757287", "valid mobile");
  eq(toE164Nanp("8005551212"), "+18005551212", "800 toll-free is valid");
  eq(toE164Nanp("+11234567890"), null, "rejects NPA starting 1");
  eq(toE164Nanp("9115551234"), null, "rejects N11 area code");
  eq(toE164Nanp("8645550142"), null, "rejects 555-01xx fictional range");
  eq(toE164Nanp("8645551012"), "+18645551012", "555-1012 is outside the fictional range and is valid");
  eq(toE164Nanp("123456789"), null, "rejects 9 digits");
  eq(toE164Nanp("1111111111"), null, "rejects all-identical digits");
  eq(toE164Nanp("20250915081100"), null, "rejects a concatenated timestamp");
  eq(toE164Nanp(""), null, "rejects empty");
}

console.log("\n8. missing name still syncs, but is flagged");
{
  const noName = SAMPLE.split("\n").filter((l) => !l.includes("Miguel")).join("\n");
  const { parsed, diagnostics } = parseEmpiregrowthLead(noName);
  const v = validateParsedLead(parsed, diagnostics);
  assert(v.ok, "phone-only lead still validates", v);
  assert(v.needsReview, "phone-only lead is flagged for review", v);
  assert(v.warnings.includes("no_name"), "warns no_name", v.warnings);
}

console.log("\n9. no valid phone → blocked, never written");
{
  const badPhone = SAMPLE.replace("+18647757287", "N/A");
  const { parsed, diagnostics } = parseEmpiregrowthLead(badPhone);
  const v = validateParsedLead(parsed, diagnostics);
  assert(!v.ok, "no-phone lead does not validate", v);
  eq(v.reviewReason, "no_phone", "reviewReason");
}

console.log("\n10. an unrelated personal DM is not a lead");
{
  const chat = "hey are we still on for lunch tomorrow?";
  const { parsed, diagnostics } = parseEmpiregrowthLead(chat);
  const v = validateParsedLead(parsed, diagnostics);
  assert(!v.ok, "chatter does not validate", v);
  assert(!parsed.phoneE164, "chatter yields no phone", parsed);
}

console.log("\n11. two leads in one message are never silently halved");
{
  const doubled = SAMPLE + "\n\n" + SAMPLE.replace("Miguel Colon", "Ana Ruiz").replace("+18647757287", "+14045551234");
  const { diagnostics } = parseEmpiregrowthLead(doubled);
  assert(diagnostics.warnings.includes("multiple_leads_in_message"), "flags multiple leads", diagnostics.warnings);
}

console.log("\n12. value normalizers");
{
  eq(normalizeCallTime("Tarde"), "Afternoon (2pm - 6pm)", "tarde");
  eq(normalizeCallTime("Mañana"), "Morning (8am - 12pm)", "manana");
  eq(normalizeCallTime("Mediodía"), "Midday (12pm - 2pm)", "mediodia");
  eq(normalizeCallTime("Noche"), "Evening (6pm - 9pm)", "noche");
  eq(normalizeCallTime("3:30 PM"), "3:30 PM", "explicit time passes through");
  eq(normalizeSavingsBand("Entre $100 y $200"), "$100 - $200", "between band");
  eq(normalizeSavingsBand("Menos de $300"), "Less than $300", "less-than band");
  eq(normalizeSavingsBand("Más de $1,000"), "More than $1,000", "more-than band");
  eq(normalizeSavingsBand("algo raro"), "algo raro", "unknown band passes through");
  const iso = parseEnteredAt("9/15 8:11 AM CDT", new Date("2026-09-15T20:00:00Z"));
  assert(Boolean(iso?.startsWith("2026-09-15T08:11")), "parses entered-at", iso);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
