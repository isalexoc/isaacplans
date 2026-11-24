/**
 * Offline checks for the shared intake form's autosave: what a save sends and what it writes.
 *
 * Covers the pure pieces whose failure is silent data loss rather than an error: the key diff the
 * browser sends (`lib/intake-core/diff.ts`), and the server's patch planner
 * (`lib/intake-core/patch.ts`), which must keep a stored SSN or bank number when a mask or an empty
 * value comes back, give a dependent's mask back that person's own number when rows move, never
 * store a mask or a fake encryption envelope, write only the keys a save carries (and of those,
 * only the ones that change), and let a legacy whole-form body merge without dropping anything.
 * The server merges with `data || patch`; `jsonbMerge` below stands in for that statement.
 *
 * No network, no database, no API keys. Run with: pnpm test:intake-autosave
 */

import { diffIntakeData, stableJson } from "../lib/intake-core/diff";
import { planIntakePatch, withoutUnchanged } from "../lib/intake-core/patch";
import { sanitizeIntakeData } from "../lib/intake-core/schema";
import { fieldByKey, sensitiveRowKeys, sensitiveScalarKeys } from "../lib/intake-core/fields";
import { healthAlternativeIntake } from "../lib/intake-configs/health-alternative";
import { buildCrmPayloadFromData } from "../lib/intake-core/crm-payload";
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

const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);
const keys = (data: IntakeData) => Object.keys(data).sort().join(",");

/** What `coalesce(data, '{}') || patch` does to a jsonb object. */
const jsonbMerge = (stored: IntakeData, patch: IntakeData): IntakeData => ({ ...stored, ...patch });

const sections = healthAlternativeIntake.sections;

/**
 * One save as the server runs it (`lib/intake-core/save.ts`): sanitize the body, plan the patch,
 * leave out what wouldn't change, merge the rest into what's stored.
 */
function serverSave(stored: IntakeData, body: unknown): { patch: IntakeData; after: IntakeData } {
  const patch = withoutUnchanged(planIntakePatch(sections, sanitizeIntakeData(sections, body), stored), stored);
  return { patch, after: Object.keys(patch).length ? jsonbMerge(stored, patch) : stored };
}

const SSN = "123456789";
const MASKED_SSN = "•••••6789";

console.log("\nThe config under test");
{
  const scalars = sensitiveScalarKeys(sections);
  const rows = sensitiveRowKeys(sections);
  check("SSN is a sensitive scalar", scalars.includes("ssn"), scalars.join(","));
  check("bank numbers are sensitive scalars", scalars.includes("routingNumber") && scalars.includes("accountNumber"));
  check(
    "each added person's SSN is a sensitive row field",
    rows.some(([repeater, subs]) => repeater === "dependents" && subs.includes("ssn")),
    JSON.stringify(rows)
  );
}

console.log("\ndiffIntakeData");
{
  const base: IntakeData = { firstName: "Ana", lastName: "Ruiz", dateOfBirth: "1980-03-12" };

  check("nothing changed, nothing to send", keys(diffIntakeData(base, { ...base })) === "");
  check(
    "one changed answer is the only key sent",
    same(diffIntakeData(base, { ...base, firstName: "Ana María" }), { firstName: "Ana María" })
  );
  check(
    "a new answer is sent",
    same(diffIntakeData(base, { ...base, sex: "Female" }), { sex: "Female" })
  );
  check(
    "a key missing from the form is not an unset",
    keys(diffIntakeData(base, { firstName: "Ana", lastName: "Ruiz" })) === ""
  );
  check("an undefined value is not sent", keys(diffIntakeData(base, { ...base, sex: undefined })) === "");
  check(
    "clearing an answer is a change",
    same(diffIntakeData({ ...base, ssn: null }, { ...base, ssn: "" }), { ssn: "" })
  );

  // jsonb hands rows back with its own key order; the form builds them in declared order.
  const fromServer: IntakeData = { dependents: [{ ssn: "", lastName: "Ruiz", firstName: "Leo" }] };
  const inForm: IntakeData = { dependents: [{ firstName: "Leo", lastName: "Ruiz", ssn: "" }] };
  check("row key order alone is not a change", keys(diffIntakeData(fromServer, inForm)) === "");

  const edited: IntakeData = { dependents: [{ firstName: "Leo", lastName: "Ruiz", ssn: "", dateOfBirth: "2015-06-01" }] };
  const rowDiff = diffIntakeData(fromServer, edited);
  check("a row edit sends the whole repeater", same(rowDiff, edited), JSON.stringify(rowDiff));
  check(
    "row order is a change",
    keys(diffIntakeData({ list: [{ a: "1" }, { a: "2" }] }, { list: [{ a: "2" }, { a: "1" }] })) === "list"
  );
}

console.log("\nBaseline bookkeeping (what the hook does with the diff)");
{
  const loaded: IntakeData = { firstName: "Ana", dateOfBirth: "" };
  check("opening the form sends nothing", keys(diffIntakeData(loaded, { ...loaded })) === "");

  const sent = diffIntakeData(loaded, { ...loaded, dateOfBirth: "1980-03-12" });
  // While that save is on the wire the agent keeps typing.
  const screen: IntakeData = { firstName: "Ana María", dateOfBirth: "1980-03-12" };
  const afterSuccess = { ...loaded, ...sent };
  check(
    "after a save, only what was typed meanwhile is left to send",
    same(diffIntakeData(afterSuccess, screen), { firstName: "Ana María" })
  );
  check(
    "after a failed save, its keys are still dirty",
    keys(diffIntakeData(loaded, screen)) === "dateOfBirth,firstName"
  );
}

console.log("\nPatch planner: masks and empty values never replace a stored secret");
{
  const stored: IntakeData = {
    firstName: "Ana",
    ssn: SSN,
    routingNumber: "021000021",
    accountNumber: "000123456789",
  };

  const masked = planIntakePatch(sections, { ssn: MASKED_SSN }, stored);
  check("a returning mask keeps the stored SSN", masked.ssn === SSN, String(masked.ssn));

  const emptied = planIntakePatch(sections, { accountNumber: "" }, stored);
  check("an empty value keeps the stored account number", emptied.accountNumber === "000123456789");

  const retyped = planIntakePatch(sections, { ssn: "987654321" }, stored);
  check("a newly typed SSN replaces the stored one", retyped.ssn === "987654321");

  const fresh = planIntakePatch(sections, { ssn: "555667777" }, {});
  check("with nothing on file the value is written as sent", fresh.ssn === "555667777");

  const nameOnly = planIntakePatch(sections, { firstName: "Ana María" }, stored);
  check(
    "a patch writes only its own keys (no stored secret is added back)",
    keys(nameOnly) === "firstName",
    keys(nameOnly)
  );

  const notSensitive = planIntakePatch(sections, { firstName: "" }, stored);
  check("an ordinary answer can be cleared", notSensitive.firstName === "");
}

console.log("\nPatch planner: sensitive row fields, rows in place");
{
  const stored: IntakeData = {
    dependents: [
      { firstName: "Leo", lastName: "Ruiz", ssn: "111223333" },
      { firstName: "Mia", lastName: "Ruiz", ssn: "444556666" },
    ],
  };
  const incoming: IntakeData = {
    dependents: [
      { firstName: "Leonardo", lastName: "Ruiz", ssn: "•••••3333" },
      { firstName: "Mia", lastName: "Ruiz", ssn: "" },
      { firstName: "Sol", lastName: "Ruiz", ssn: "777889999" },
    ],
  };
  const patch = planIntakePatch(sections, incoming, stored);
  const rows = (patch.dependents ?? []) as Array<Record<string, string>>;
  check("row 1 mask keeps its stored SSN", rows[0]?.ssn === "111223333", rows[0]?.ssn);
  check("row 1 name edit is kept", rows[0]?.firstName === "Leonardo");
  check("row 2 empty SSN keeps its stored SSN", rows[1]?.ssn === "444556666", rows[1]?.ssn);
  check("a new row's typed SSN is written", rows[2]?.ssn === "777889999");
  check("only the repeater key is written", keys(patch) === "dependents");
}

console.log("\nPatch planner: a person's mask goes back to that person's number when rows move");
{
  const stored: IntakeData = {
    dependents: [
      { firstName: "Leo", ssn: "111223333" },
      { firstName: "Mia", ssn: "444556666" },
      { firstName: "Sol", ssn: "" },
    ],
  };
  const ssns = (data: IntakeData) => ((data.dependents ?? []) as Array<Record<string, string>>).map((r) => r.ssn);

  // The client removes Leo: everyone below moves up a row.
  const removed = planIntakePatch(
    sections,
    { dependents: [{ firstName: "Mia", ssn: "•••••6666" }, { firstName: "Sol", ssn: "" }] },
    stored
  );
  check("Mia keeps her own SSN, not Leo's", ssns(removed)[0] === "444556666", ssns(removed).join(","));
  check("Sol, with none on file, doesn't inherit Mia's", ssns(removed)[1] === "", ssns(removed).join(","));

  const three: IntakeData = {
    dependents: [
      { firstName: "Leo", ssn: "111223333" },
      { firstName: "Mia", ssn: "444556666" },
      { firstName: "Sol", ssn: "777889999" },
    ],
  };
  const middle = planIntakePatch(
    sections,
    { dependents: [{ firstName: "Leo", ssn: "•••••3333" }, { firstName: "Sol", ssn: "•••••9999" }] },
    three
  );
  check("removing the middle person keeps the first one's SSN", ssns(middle)[0] === "111223333");
  check("and the person who moved up keeps their own", ssns(middle)[1] === "777889999", ssns(middle).join(","));

  const corrected: IntakeData = { dependents: [{ firstName: "Leo", ssn: "999990000" }] };
  const stale = planIntakePatch(sections, { dependents: [{ firstName: "Leonardo", ssn: "•••••3333" }] }, corrected);
  check(
    "a mask older than the number now on file keeps the number on file",
    ssns(stale)[0] === "999990000",
    ssns(stale).join(",")
  );

  const nothingOnFile = planIntakePatch(sections, { dependents: [{ firstName: "Ana", ssn: "•••••4444" }] }, {});
  check("a row mask that stands for nothing on file is stored empty", ssns(nothingOnFile)[0] === "");
}

console.log("\nPatch planner: only real strings are stored as sensitive values");
{
  const stored: IntakeData = { ssn: SSN };
  check("a mask with nothing on file is stored empty", planIntakePatch(sections, { ssn: MASKED_SSN }, {}).ssn === "");

  const envelope = "enc:v1:AAAA:BBBB:CCCC";
  check("a fake encryption envelope is never stored", planIntakePatch(sections, { ssn: envelope }, {}).ssn === "");
  check("a fake envelope keeps the SSN on file", planIntakePatch(sections, { ssn: envelope }, stored).ssn === SSN);
  check("a number is never stored as an SSN", planIntakePatch(sections, { ssn: 123456789 }, {}).ssn === "");
  check("null keeps the SSN on file", planIntakePatch(sections, { ssn: null }, stored).ssn === SSN);

  const rowEnvelope = planIntakePatch(sections, { dependents: [{ firstName: "Leo", ssn: envelope }] }, {});
  check(
    "a fake envelope in a row is never stored",
    ((rowEnvelope.dependents ?? []) as Array<Record<string, string>>)[0]?.ssn === ""
  );
}

console.log("\nA save that changes nothing writes nothing");
{
  const stored: IntakeData = {
    firstName: "Ana",
    ssn: SSN,
    dependents: [{ lastName: "Ruiz", firstName: "Leo", ssn: "111223333" }],
  };
  const masks = serverSave(stored, { ssn: MASKED_SSN });
  check("a mask turned back into the number on file writes nothing", keys(masks.patch) === "", keys(masks.patch));
  const rows = serverSave(stored, { dependents: [{ firstName: "Leo", lastName: "Ruiz", ssn: "•••••3333" }] });
  check("an unchanged repeater with masks writes nothing", keys(rows.patch) === "", keys(rows.patch));
  const one = serverSave(stored, { firstName: "Ana", ssn: "" });
  check("an empty SSN with one on file writes nothing", keys(one.patch) === "", keys(one.patch));
  check(
    "only changed keys are written",
    keys(withoutUnchanged({ firstName: "Ana", lastName: "Ruiz" }, stored)) === "lastName"
  );
}

console.log("\nLegacy whole-form PATCH merges, never drops");
{
  const stored: IntakeData = {
    firstName: "Ana",
    lastName: "Ruiz",
    dateOfBirth: "1980-03-12",
    ssn: SSN,
    impactPlan: "premium",
  };
  // A tab opened before the deploy: its copy predates the DOB and the plan, and holds a mask.
  const staleBody = { firstName: "Ana", lastName: "Ruiz Soto", ssn: MASKED_SSN };
  const { patch, after } = serverSave(stored, staleBody);
  check("the legacy body's own keys are written", after.lastName === "Ruiz Soto");
  check("a key the body left out is kept", after.dateOfBirth === "1980-03-12" && after.impactPlan === "premium");
  check("the mask in the body keeps the stored SSN", after.ssn === SSN, String(after.ssn));
  const planned = planIntakePatch(sections, sanitizeIntakeData(sections, staleBody), stored);
  check("the planner answers for the body's keys only", keys(planned) === "firstName,lastName,ssn", keys(planned));
  check("of those, only the one that changes is written", keys(patch) === "lastName", keys(patch));
}

console.log("\nTwo tabs saving at once (the bug this fixes)");
{
  const stored: IntakeData = { firstName: "", dateOfBirth: "" };
  // The presenting tab sends the DOB; the stale intake tab sends its own change, in either order.
  const presenting = { dateOfBirth: "1980-03-12" };
  const staleTab = { firstName: "Ana", dateOfBirth: "" };
  const staleDiff = diffIntakeData(stored, staleTab);
  check("the stale tab only sends what it changed", keys(staleDiff) === "firstName");

  const ab = serverSave(serverSave(stored, presenting).after, staleDiff).after;
  const ba = serverSave(serverSave(stored, staleDiff).after, presenting).after;
  check("DOB then name keeps both", ab.dateOfBirth === "1980-03-12" && ab.firstName === "Ana");
  check("name then DOB keeps both", ba.dateOfBirth === "1980-03-12" && ba.firstName === "Ana");
}

console.log("\nEmpty patches write nothing");
{
  const stored: IntakeData = { firstName: "Ana", ssn: SSN };
  for (const [label, body] of [
    ["an empty object", {}],
    ["a missing body", undefined],
    ["a string", "firstName=Ana"],
    ["null", null],
  ] as const) {
    const { patch, after } = serverSave(stored, body);
    check(`${label} plans no write`, keys(patch) === "" && after === stored, keys(patch));
  }
}

console.log("\nPatches are still sanitized");
{
  const field = fieldByKey(sections, "dependents");
  const max = field?.maxRows ?? 8;
  const many = Array.from({ length: max + 5 }, (_, i) => ({ firstName: `P${i}` }));
  const patch = planIntakePatch(sections, sanitizeIntakeData(sections, { dependents: many }), {});
  check(
    `a repeater in a patch is clamped to its ${max} rows`,
    Array.isArray(patch.dependents) && (patch.dependents as unknown[]).length === max
  );
}

console.log("\nNo SSN, card or bank number ever reaches the CRM");
{
  // Pretend every slug is provisioned, so nothing is hidden by a missing GHL id.
  const everyId = (_lob: string, slug: string) => `id-${slug}`;
  const data: IntakeData = {
    firstName: "Ana",
    lastName: "Ruiz",
    taxIdType: "SSN",
    ssn: SSN,
    bankName: "Chase",
    routingNumber: "021000021",
    accountNumber: "000123456789",
    accountType: "Checking",
    hasDependents: "yes",
    dependents: [{ firstName: "Leo", lastName: "Ruiz", relationship: "Son", idType: "SSN", ssn: "987654321" }],
  };
  const payload = buildCrmPayloadFromData(healthAlternativeIntake, data, everyId);
  const values = payload.customFields.map((f) => String(f.field_value)).join("\n");
  check("the applicant's SSN is never a custom field", !payload.customFields.some((f) => f.id === "id-ha_ssn"));
  check("bank numbers are never custom fields", !/021000021|000123456789/.test(values), values);
  check("a dependent's SSN is blanked inside the row text", !/987654321/.test(values), values);
  check("the dependent row itself still syncs", /Leo Ruiz/.test(values), values);
  check("non-sensitive answers still sync (bank name)", values.includes("Chase"), values);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
