/**
 * Idempotent provisioner for Phone Finder's two GHL custom fields.
 *
 *  1. results — "Additional Possible Phones" (LARGE_TEXT). Isaac created it by hand; it is found by
 *     its fieldKey (contact.additional_possible_phones_multiline), never by name, because a deleted
 *     single-line field had the same display name. Its folder becomes the Phone Finder folder.
 *  2. trigger — "Find More Phones" (CHECKBOX, one option "Search"). Reused when it exists (saved id
 *     still live, else same name + CHECKBOX), created in that folder otherwise, then verified to
 *     really carry the option the workflow filter matches on.
 *  3. Rewrites lib/phone-finder/ghl-field-ids.ts with the resolved ids.
 *
 * Run:  pnpm phone-finder:fields
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID (already in .env)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  PHONE_FINDER_RESULTS_FIELD_KEY,
  PHONE_FINDER_TRIGGER_FIELD_NAME,
  PHONE_FINDER_TRIGGER_OPTION,
  phoneFinderFieldIds,
  phoneFinderFolderId,
} from "../lib/phone-finder/ghl-field-ids";

const API_BASE = "https://services.leadconnectorhq.com";
const token = process.env.AGENT_CRM_PI;
const locationId = process.env.AGENT_CRM_LOCATION_ID;
if (!token || !locationId) {
  console.error("Missing AGENT_CRM_PI or AGENT_CRM_LOCATION_ID in env.");
  process.exit(1);
}
const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  Version: "2021-07-28",
};

type FieldRecord = {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  parentId: string;
  picklistOptions: string[];
};

function toRecord(f: Record<string, unknown>): FieldRecord | null {
  if (typeof f?.id !== "string") return null;
  return {
    id: f.id,
    name: typeof f.name === "string" ? f.name : "",
    fieldKey: typeof f.fieldKey === "string" ? f.fieldKey : "",
    dataType: typeof f.dataType === "string" ? f.dataType : "",
    parentId: typeof f.parentId === "string" ? f.parentId : "",
    picklistOptions: Array.isArray(f.picklistOptions) ? f.picklistOptions.map(String) : [],
  };
}

async function listFields(): Promise<FieldRecord[]> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields?model=contact`, { headers });
  if (!res.ok) throw new Error(`List custom fields failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.customFields ?? []).map(toRecord).filter(Boolean) as FieldRecord[];
}

async function getField(id: string): Promise<FieldRecord | null> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields/${id}`, { headers });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return toRecord((data?.customField ?? data) as Record<string, unknown>);
}

async function createTrigger(parentId: string): Promise<string | null> {
  const body: Record<string, unknown> = {
    name: PHONE_FINDER_TRIGGER_FIELD_NAME,
    dataType: "CHECKBOX",
    model: "contact",
    options: [PHONE_FINDER_TRIGGER_OPTION],
  };
  if (parentId) body.parentId = parentId;
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  x create "${PHONE_FINDER_TRIGGER_FIELD_NAME}": ${res.status} ${text}`);
    return null;
  }
  try {
    const data = JSON.parse(text);
    const id = data?.customField?.id ?? data?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

async function moveToFolder(field: FieldRecord, parentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields/${field.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ name: field.name, parentId }),
  });
  if (!res.ok) console.warn(`  ! could not move "${field.name}" into the folder: ${res.status}`);
}

function rewriteIdsFile(ids: { folder: string; trigger: string; results: string }) {
  const file = path.join(process.cwd(), "lib", "phone-finder", "ghl-field-ids.ts");
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(/export const phoneFinderFolderId = "[^"]*";/, `export const phoneFinderFolderId = "${ids.folder}";`);
  content = content.replace(/(\n\s*trigger:\s*)"[^"]*"/, `$1"${ids.trigger}"`);
  content = content.replace(/(\n\s*results:\s*)"[^"]*"/, `$1"${ids.results}"`);
  fs.writeFileSync(file, content, "utf8");
  console.log("\nUpdated lib/phone-finder/ghl-field-ids.ts");
}

async function main() {
  console.log("Provisioning Phone Finder custom fields in Agent CRM...\n");
  const fields = await listFields();

  // 1. The results field Isaac created.
  const results = fields.find((f) => f.fieldKey.toLowerCase() === PHONE_FINDER_RESULTS_FIELD_KEY);
  if (!results) {
    console.error(
      `  x No field with key "${PHONE_FINDER_RESULTS_FIELD_KEY}". Create a Multi Line field named "Additional Possible Phones" ` +
        `with that key in GHL (Settings > Custom Fields), then re-run.`
    );
    process.exit(1);
  }
  if (results.dataType !== "LARGE_TEXT") {
    console.warn(`  ! "${results.name}" is ${results.dataType}, expected LARGE_TEXT (multi-line). One number per line needs multi-line.`);
  }
  console.log(`  = results: "${results.name}" (${results.fieldKey}, ${results.dataType}) ${results.id}`);
  const folder = results.parentId || phoneFinderFolderId;

  const leftover = fields.find((f) => f.fieldKey.toLowerCase() === "contact.additional_possible_phones");
  if (leftover) console.log(`  i the old single-line field (${leftover.fieldKey}) still exists; Phone Finder does not use it.`);

  // 2. The trigger checkbox.
  const live = new Map(fields.map((f) => [f.id, f]));
  let trigger: FieldRecord | null =
    (phoneFinderFieldIds.trigger && live.get(phoneFinderFieldIds.trigger)) ||
    fields.find(
      (f) => f.name.trim().toLowerCase() === PHONE_FINDER_TRIGGER_FIELD_NAME.toLowerCase() && f.dataType === "CHECKBOX"
    ) ||
    null;
  if (trigger) {
    console.log(`  = trigger: "${trigger.name}" already exists ${trigger.id}`);
  } else {
    const id = await createTrigger(folder);
    if (!id) process.exit(1);
    console.log(`  + trigger: created "${PHONE_FINDER_TRIGGER_FIELD_NAME}" ${id}`);
    trigger = await getField(id);
    if (!trigger) {
      console.error("  x created the checkbox but cannot read it back; re-run the script.");
      process.exit(1);
    }
  }
  if (folder && trigger.parentId !== folder) {
    await moveToFolder(trigger, folder);
    trigger = (await getField(trigger.id)) ?? trigger;
  }

  // 3. The option the workflow filter matches on must really exist (checked AFTER any move).
  const options = trigger.picklistOptions;
  if (trigger.dataType !== "CHECKBOX" || !options.includes(PHONE_FINDER_TRIGGER_OPTION)) {
    console.warn(
      `\n  ! "${trigger.name}" is ${trigger.dataType} with options ${JSON.stringify(options)}.\n` +
        `    In GHL: Settings > Custom Fields > "${trigger.name}" > make it a Checkbox with ONE option "${PHONE_FINDER_TRIGGER_OPTION}", then re-run.`
    );
  } else {
    console.log(`  = trigger option "${PHONE_FINDER_TRIGGER_OPTION}" present`);
  }

  rewriteIdsFile({ folder, trigger: trigger.id, results: results.id });
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
