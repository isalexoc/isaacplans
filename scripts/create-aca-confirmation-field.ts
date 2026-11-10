/**
 * One-time setup for the ACA application review confirmation: the File Upload field the signed
 * PDF is uploaded to, so it shows in the contact's Documents tab (Internal → Custom Fields).
 *
 * Agent CRM has no API for the Documents "+ Add" button; a File Upload custom field is the one
 * documented way for an app to put a file on a contact, and GHL lists those files in Documents.
 *
 * Idempotent: an existing contact field with this name (case- and accent-insensitive) and the
 * File Upload type is reused, never duplicated. A same-named field of another type stops the
 * script. Prints the id to set as ACA_CONFIRMATION_FILE_FIELD_ID in .env and Vercel.
 *
 * Run:  pnpm aca-confirmation:field            (creates the field if needed)
 *       pnpm aca-confirmation:field --dry-run  (reads only, creates nothing)
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID (already in .env)
 */

import "dotenv/config";

const API_BASE = "https://services.leadconnectorhq.com";
const FIELD_NAME = "ACA Confirmación firmada";
const DATA_TYPE = "FILE_UPLOAD";
const ENV_NAME = "ACA_CONFIRMATION_FILE_FIELD_ID";

const dryRun = process.argv.includes("--dry-run");
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

type FieldRecord = { id: string; name: string; fieldKey: string; dataType: string };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

async function listContactFields(): Promise<FieldRecord[]> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields?model=contact`, { headers });
  if (!res.ok) throw new Error(`List custom fields failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { customFields?: Array<Record<string, unknown>> };
  return (data.customFields ?? [])
    .filter((f) => typeof f.id === "string")
    .map((f) => ({
      id: f.id as string,
      name: typeof f.name === "string" ? f.name : "",
      fieldKey: typeof f.fieldKey === "string" ? f.fieldKey : "",
      dataType: typeof f.dataType === "string" ? f.dataType : "",
    }));
}

async function createField(): Promise<string> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: FIELD_NAME, dataType: DATA_TYPE, model: "contact" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create "${FIELD_NAME}" failed: ${res.status} ${text}`);
  const data = JSON.parse(text) as { customField?: { id?: unknown }; id?: unknown };
  const id = data.customField?.id ?? data.id;
  if (typeof id !== "string") throw new Error(`Create "${FIELD_NAME}" returned no id: ${text.slice(0, 300)}`);
  return id;
}

async function main() {
  console.log(`ACA confirmation: File Upload field "${FIELD_NAME}"${dryRun ? " (dry run)" : ""}\n`);
  const fields = await listContactFields();
  const sameName = fields.filter((f) => normalize(f.name) === normalize(FIELD_NAME));

  const existing = sameName.find((f) => f.dataType === DATA_TYPE);
  if (existing) {
    console.log(`  = exists: ${existing.id} (${existing.fieldKey})`);
    printEnv(existing.id);
    return;
  }
  const clash = sameName[0];
  if (clash) {
    console.error(
      `  x A field named "${clash.name}" already exists but is ${clash.dataType}, not ${DATA_TYPE} (${clash.id}). ` +
        "Rename or delete it in Agent CRM (Settings → Custom Fields), then run this again."
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log(`  + would create "${FIELD_NAME}" (${DATA_TYPE}, contact). Nothing was created.`);
    return;
  }
  const id = await createField();
  console.log(`  + created: ${id}`);
  printEnv(id);
}

function printEnv(id: string) {
  console.log(`\nSet this in .env and in Vercel (Production), then redeploy:\n\n${ENV_NAME}=${id}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
