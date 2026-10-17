/**
 * Dry run of Phone Finder against one GHL contact. NEVER writes to GHL and never touches the DB.
 *
 *   pnpm phone-finder:try <contactId>              free: reads the contact, prints the search plan
 *   pnpm phone-finder:try <contactId> --yes        paid: runs the real vendor calls (~$0.30-0.45)
 *   add --show-pii                                 print names/numbers unmasked
 *
 * Use it on your own contact first to confirm both vendor accounts work, then on a few leads whose
 * right number you already know.
 */

import "dotenv/config";

import { getPhoneFinderConfig } from "../lib/phone-finder/config";
import { createEnformionClient } from "../lib/phone-finder/enformion";
import { createGhlPort } from "../lib/phone-finder/ghl";
import { buildLeadInputs, displayName, hasAddress, planEnformionAttempts } from "../lib/phone-finder/inputs";
import { createPhoneFinderLogger, maskPhone } from "../lib/phone-finder/log";
import { runPhoneFinderSearch } from "../lib/phone-finder/pipeline";
import { createTrestleClient } from "../lib/phone-finder/trestle";
import { getAgentLocalTimezone } from "../lib/timezone";

const args = process.argv.slice(2);
const contactId = args.find((a) => !a.startsWith("--"));
const paid = args.includes("--yes");
const showPii = args.includes("--show-pii");

const mask = (text: string) => (showPii ? text : text.replace(/\b(\d{3})-\d{3}-(\d{2})(\d{2})\b/g, "$1-•••-••$3"));
const present = (v: string) => (v ? (showPii ? v : "yes") : "—");

async function main() {
  if (!contactId) {
    console.error("Usage: pnpm phone-finder:try <contactId> [--yes] [--show-pii]");
    process.exit(1);
  }
  const config = getPhoneFinderConfig();
  if (!config.piToken) {
    console.error("AGENT_CRM_PI is not set.");
    process.exit(1);
  }
  const ghl = createGhlPort({ token: config.piToken });
  const read = await ghl.getContact(contactId);
  if (!read.ok) {
    console.error(`Could not read the contact (HTTP ${read.status}).`);
    process.exit(1);
  }
  const inputs = buildLeadInputs(read.contact);
  console.log("\nInputs");
  console.log(`  name:      ${inputs.name ? (showPii ? displayName(inputs.name) : `${inputs.name.first[0]}. (${inputs.name.surnames.length} surname group(s))`) : "— (not searchable)"}`);
  console.log(`  email:     ${present(inputs.email)}`);
  const a = inputs.address;
  const addressLabel = hasAddress(inputs) ? "yes" : a.state || a.city ? `partial (${[a.city && "city", a.state && "state"].filter(Boolean).join(" + ")} only)` : "—";
  console.log(`  address:   ${showPii && (hasAddress(inputs) || a.state || a.city) ? JSON.stringify(a) : addressLabel}`);
  console.log(`  dob:       ${present(inputs.dob)}`);
  console.log(`  phone:     ${inputs.primaryE164 ? (showPii ? inputs.primaryE164 : maskPhone(inputs.primaryE164)) : inputs.primaryNonUs ? "non-US" : inputs.primaryRaw ? "invalid" : "—"}`);
  console.log(`  on file:   ${inputs.existingKeys.size} number(s)`);

  const plan = planEnformionAttempts(inputs, { includePhone: true, phoneDoubtful: true, max: config.maxSearches });
  console.log(`\nSearch plan (before Trestle's verdict on the phone): ${plan.length} attempt(s)`);
  for (const a of plan) {
    const fields = Object.keys(a.body).join(", ");
    console.log(`  - ${a.label}: ${fields}${showPii ? `  ${JSON.stringify(a.body)}` : ""}`);
  }

  if (!paid) {
    console.log("\nFree run only. Add --yes to make the real (paid) vendor calls. Nothing is written to GHL either way.\n");
    return;
  }
  if (!config.trestleApiKey || !config.enformionApName || !config.enformionApPassword) {
    console.error("\nTRESTLE_API_KEY, ENFORMION_AP_NAME and ENFORMION_AP_PASSWORD must be set for --yes.");
    process.exit(1);
  }

  const tz = getAgentLocalTimezone();
  const result = await runPhoneFinderSearch({
    contactId,
    runId: `pf_try_${Date.now()}`,
    config,
    ghl,
    trestle: createTrestleClient({ apiKey: config.trestleApiKey }),
    enformion: createEnformionClient({ apName: config.enformionApName, apPassword: config.enformionApPassword }),
    reserveDailySlot: async () => true,
    previous: { inputHash: null, searchedAt: null },
    now: () => new Date(),
    deadlineAt: Date.now() + 240_000,
    timeZone: tz,
    log: createPhoneFinderLogger(true),
  });

  console.log(`\nResult: ${result.kind}${result.kind === "write" ? ` / ${result.outcome}` : ""}${"reason" in result ? ` (${result.reason})` : ""}`);
  console.log(`Estimated cost: $${(result.costMills / 1000).toFixed(3)}`);
  if (result.kind === "write") {
    console.log(`Summary: ${JSON.stringify(result.summary)}`);
    if (result.tags.length) console.log(`Tags it would add: ${result.tags.join(", ")}`);
    console.log("\nField text it would write (NOT written):\n");
    console.log(mask(result.text).replace(/^/gm, "  "));
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
