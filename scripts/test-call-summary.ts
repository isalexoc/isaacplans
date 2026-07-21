/**
 * Test harness for the AI call-summary pipeline. Never posts CRM notes.
 *
 * Formatter-only (deterministic, no API calls):
 *   pnpm test:call-summary --formatter-only
 *
 * Live OpenAI run on a sample transcript (needs OPENAI_API_KEY in .env):
 *   pnpm test:call-summary fe-en     (also: fe-es, aca-es, iul-en)
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  maskSensitiveNumbers,
  normalizeStructuredSummary,
  type StructuredCallSummary,
} from "../lib/call-summary-structured";
import { formatStructuredNote } from "../lib/call-summary-note-format";
import { summarizeCallTranscript } from "../lib/openai-call-summary";
import { getCallSummaryConfig } from "../lib/agent-crm-call-summary-config";

const FIXTURES_DIR = join(process.cwd(), "scripts", "data", "call-transcripts");

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function printNote(label: string, note: string): void {
  console.log(`\n===== ${label} =====\n`);
  console.log(note);
  console.log();
}

function runMaskingAssertions(): void {
  const masked = maskSensitiveNumbers(
    "SSN is 123-45-6789, Visa card 4111 1111 1111 1111, routing number 021000021, " +
      "account 883412907, call me at 813-555-0147, DOB 03/15/1954, ZIP 32803, premium $54.30"
  );
  assert(masked.includes("•••-••-6789"), `SSN not masked: ${masked}`);
  assert(!masked.includes("123-45"), `SSN prefix leaked: ${masked}`);
  assert(masked.includes("•••• 1111"), `card not masked: ${masked}`);
  assert(!masked.includes("4111 1111"), `card prefix leaked: ${masked}`);
  assert(masked.includes("•••0021"), `routing number not masked: ${masked}`);
  assert(masked.includes("•••2907"), `account number not masked: ${masked}`);
  assert(masked.includes("813-555-0147"), `phone number was wrongly masked: ${masked}`);
  assert(masked.includes("03/15/1954"), `DOB was wrongly masked: ${masked}`);
  assert(masked.includes("32803"), `ZIP was wrongly masked: ${masked}`);
  assert(masked.includes("$54.30"), `premium was wrongly masked: ${masked}`);
  console.log("✓ maskSensitiveNumbers assertions passed");
}

const FULL_EN: StructuredCallSummary = {
  language: "en",
  lineOfBusiness: "final_expense",
  disposition: "quoted",
  title: "FE — quoted $10k Aetna, callback Tue 2pm",
  summary:
    "Maria called about burial coverage for herself. Quoted $10,000 with Aetna at $54.30/mo. " +
    "She wants her son Carlos on the next call before deciding. Callback set for Tuesday 2 PM.",
  clientProfile: {
    name: "María López",
    dob: "03/15/1948",
    age: "78",
    address: "4512 W Oak St, Tampa FL 33607",
    phone: "(813) 555-0147",
  },
  health: {
    heightWeight: "5'2\" / 165 lbs",
    tobacco: "No",
    conditions: ["diabetes (oral meds)", "high blood pressure"],
    medications: ["metformin 500mg", "lisinopril"],
  },
  financial: {
    income: "Social Security $1,200/mo",
    budget: "$50–60/mo",
    paymentMethod: "Direct Express card, deposits on the 3rd",
  },
  policy: {
    carrier: "Aetna (Protection Series)",
    faceAmount: "$10,000",
    premium: "$54.30/mo",
    beneficiary: "son Carlos López",
  },
  quotes: [{ carrier: "Mutual of Omaha", faceAmount: "$10,000", premium: "$62.50/mo" }],
  objections: ["Wants son Carlos to hear details before signing"],
  nextSteps: [
    { action: "Call back with Carlos on the line", date: "Tue 7/22 2:00 PM", owner: "agent" },
    { action: "Client will locate her Direct Express card", owner: "client" },
  ],
  followUpDate: "Tue 7/22 2:00 PM",
  coaching: [
    "Strong discovery, but no trial close after the quote",
    "Next call: open with Carlos, restate the $54.30 level premium",
  ],
};

const SPARSE_ES: StructuredCallSummary = {
  language: "es",
  lineOfBusiness: "aca",
  disposition: "needs_info",
  title: "ACA — falta carta de terminación",
  summary:
    "Carlos perdió el seguro del trabajo. Hogar de 4, ingreso de $42,000. Se cotizará Ambetter mañana a las 11.",
  clientProfile: { name: "Carlos Ramírez", householdSize: "4" },
  financial: { income: "$42,000/año (hogar)", subsidy: "~$1,400/mes APTC" },
  nextSteps: [{ action: "Cliente envía carta de terminación por texto", owner: "client" }],
  followUpDate: "mañana 11:00 AM",
};

/** Simulates sloppy model output: wrong enums, string next steps, numbers, junk. */
const MALFORMED_RAW: unknown = {
  language: "Spanish",
  lineOfBusiness: "Final Expense",
  disposition: "callback scheduled",
  title: "Llamada con la señora García",
  summary: "La cliente pidió información de la póliza para el esposo. Quedó de llamar el martes.",
  clientProfile: { name: "Ana García", age: 66, email: "N/A" },
  health: { conditions: "artritis" },
  nextSteps: ["Llamar el martes por la tarde"],
  quotes: "no quotes",
  coaching: [],
};

function runFollowUpDateIsoAssertions(): void {
  const valid = normalizeStructuredSummary({
    title: "t",
    summary: "s",
    followUpDateIso: "2026-07-22T14:00:00-04:00",
  });
  assert(valid.followUpDateIso === new Date("2026-07-22T14:00:00-04:00").toISOString(), "valid ISO should pass through");

  const garbage = normalizeStructuredSummary({ title: "t", summary: "s", followUpDateIso: "not a date" });
  assert(garbage.followUpDateIso === undefined, "unparseable date should drop to undefined");

  const hallucinated = normalizeStructuredSummary({
    title: "t",
    summary: "s",
    followUpDateIso: "2040-01-01T00:00:00Z",
  });
  assert(hallucinated.followUpDateIso === undefined, ">2yr-out date should drop to undefined (hallucination guard)");

  console.log("✓ followUpDateIso normalizer assertions passed");
}

function runFormatterOnly(): void {
  runMaskingAssertions();
  runFollowUpDateIsoAssertions();

  printNote("FULL — English final expense", formatStructuredNote(FULL_EN));
  printNote("SPARSE — Spanish ACA", formatStructuredNote(SPARSE_ES));

  const normalized = normalizeStructuredSummary(MALFORMED_RAW);
  assert(normalized.language === "es", `expected es, got ${normalized.language}`);
  assert(normalized.lineOfBusiness === "final_expense", `expected final_expense, got ${normalized.lineOfBusiness}`);
  assert(normalized.disposition === "other", `expected other, got ${normalized.disposition}`);
  assert(normalized.clientProfile?.age === "66", "numeric age should coerce to string");
  assert(normalized.clientProfile?.email === undefined, "N/A placeholder should be dropped");
  assert(normalized.health?.conditions?.[0] === "artritis", "string conditions should wrap into array");
  assert(normalized.nextSteps?.[0]?.action === "Llamar el martes por la tarde", "string next step should map to action");
  assert(normalized.quotes === undefined, "non-array quotes should be dropped");
  assert(normalized.coaching === undefined, "empty coaching array should be dropped");
  console.log("✓ normalizeStructuredSummary assertions passed");
  printNote("MALFORMED (normalized) — Spanish", formatStructuredNote(normalized));

  const degenerate = normalizeStructuredSummary("just a plain string from the model");
  assert(degenerate.summary === "just a plain string from the model", "degenerate summary should carry raw text");
  assert(formatStructuredNote(degenerate).length > 0, "degenerate note should still render");
  console.log("✓ degenerate-input assertions passed");

  console.log("\nAll formatter checks passed.");
}

async function runLiveFixture(name: string): Promise<void> {
  const file = join(FIXTURES_DIR, `${name}.txt`);
  let transcript: string;
  try {
    transcript = readFileSync(file, "utf8");
  } catch {
    const available = readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.replace(/\.txt$/, ""))
      .join(", ");
    console.error(`Fixture "${name}" not found. Available: ${available}`);
    process.exit(1);
  }

  const config = getCallSummaryConfig();
  if (!config.openaiApiKey) {
    console.error("OPENAI_API_KEY is not set in .env — cannot run a live test.");
    process.exit(1);
  }

  console.log(`Summarizing fixture "${name}" with ${config.openaiModel}...`);
  const result = await summarizeCallTranscript(
    {
      transcript,
      direction: "inbound",
      callDurationSeconds: 754,
      callStatus: "completed",
      contactId: "test-contact-000",
      dateAdded: new Date().toISOString(),
    },
    config
  );

  console.log(`\nTitle: ${result.title}`);
  console.log(
    `Detected: lob=${result.structured?.lineOfBusiness} disposition=${result.structured?.disposition} language=${result.structured?.language}`
  );
  console.log(
    `Follow-up: "${result.structured?.followUpDate ?? "(none)"}" -> followUpDateIso=${result.structured?.followUpDateIso ?? "(none)"}`
  );
  printNote(`NOTE BODY — ${name}`, result.body);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--formatter-only")) {
    runFormatterOnly();
    return;
  }
  await runLiveFixture(args[0] ?? "fe-en");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
