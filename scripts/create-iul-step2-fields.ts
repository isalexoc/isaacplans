/**
 * Idempotent provisioner for the IUL get-covered (Meta ads) Step-2 custom fields in Agent CRM (GHL).
 *
 *  1. Ensures a custom-field folder named "IUL Step 2 Ads Form" exists (reuses the saved id if present).
 *  2. Reads existing custom fields; for each Step-2 field that still needs an id, reuses a
 *     matching existing field by name or creates it (inside the folder).
 *  3. Rewrites lib/iul-step2-ads/ghl-field-ids.ts with the resolved folder id + field ids.
 *
 * Run:  pnpm tsx scripts/create-iul-step2-fields.ts
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID  (already in .env)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  iulStep2FieldIds,
  type IulStep2FieldSlug,
} from "../lib/iul-step2-ads/ghl-field-ids";

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const FOLDER_NAME = "IUL Step 2 Ads Form";
const FIELD_PREFIX = "IUL Step 2 - ";

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
  Version: API_VERSION,
};

type GhlDataType = "TEXT" | "LARGE_TEXT" | "NUMERICAL";

type FieldSpec = {
  slug: IulStep2FieldSlug;
  name: string;
  dataType: GhlDataType;
};

const SPECS: FieldSpec[] = [
  { slug: "iul_s2_age", name: `${FIELD_PREFIX}Current Age`, dataType: "NUMERICAL" },
  {
    slug: "iul_s2_retirement_timeline",
    name: `${FIELD_PREFIX}Retirement Timeline`,
    dataType: "TEXT",
  },
  {
    slug: "iul_s2_monthly_savings",
    name: `${FIELD_PREFIX}Monthly Savings`,
    dataType: "TEXT",
  },
  {
    slug: "iul_s2_investments",
    name: `${FIELD_PREFIX}Current Investments`,
    dataType: "LARGE_TEXT",
  },
];

async function getExistingFields(): Promise<Map<string, string>> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields?model=contact`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`List custom fields failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const map = new Map<string, string>();
  for (const f of data.customFields ?? []) {
    if (typeof f?.name === "string" && typeof f?.id === "string") {
      map.set(f.name.trim().toLowerCase(), f.id);
    }
  }
  return map;
}

async function ensureFolder(): Promise<string> {
  const { iulStep2FolderId } = await import("../lib/iul-step2-ads/ghl-field-ids");
  if (iulStep2FolderId) {
    console.log(`Reusing existing folder: ${iulStep2FolderId}`);
    return iulStep2FolderId;
  }
  // A folder is a custom field with documentType "folder" on the main resource.
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: FOLDER_NAME, model: "contact", documentType: "folder" }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`Could not create folder (will create fields without folder): ${res.status} ${text}`);
    return "";
  }
  try {
    const data = JSON.parse(text);
    const id = data?.customFieldFolder?.id ?? data?.customField?.id ?? data?.id ?? "";
    console.log(`Created "${FOLDER_NAME}" folder: ${id}`);
    return typeof id === "string" ? id : "";
  } catch {
    return "";
  }
}

/** Move a field into the folder (PUT requires the name alongside parentId). */
async function assignToFolder(fieldId: string, name: string, parentId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields/${fieldId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) {
    console.warn(`  ! could not move ${name}: ${res.status}`);
    return false;
  }
  return true;
}

async function createField(spec: FieldSpec, parentId: string): Promise<string | null> {
  const body: Record<string, unknown> = {
    name: spec.name,
    dataType: spec.dataType,
    model: "contact",
  };
  if (parentId) body.parentId = parentId;

  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`  ✗ ${spec.name}: ${res.status} ${text}`);
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

function rewriteIdsFile(resolved: Record<string, string>, folderId: string) {
  const file = path.join(process.cwd(), "lib", "iul-step2-ads", "ghl-field-ids.ts");
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(
    /export const iulStep2FolderId = "[^"]*";/,
    `export const iulStep2FolderId = "${folderId}";`
  );

  for (const [slug, id] of Object.entries(resolved)) {
    if (!id) continue;
    const re = new RegExp(`(\\n\\s*${slug}:\\s*)"[^"]*"`);
    content = content.replace(re, `$1"${id}"`);
  }

  fs.writeFileSync(file, content, "utf8");
  console.log(`\nUpdated lib/iul-step2-ads/ghl-field-ids.ts`);
}

async function main() {
  console.log("Provisioning IUL Step-2 ads custom fields in Agent CRM…\n");

  const existing = await getExistingFields();
  const folderId = await ensureFolder();
  const resolved: Record<string, string> = {};

  // 1. Resolve every managed field to an id (reuse existing by current id / by name, else create).
  for (const spec of SPECS) {
    let id = iulStep2FieldIds[spec.slug];
    if (!id) id = existing.get(spec.name.trim().toLowerCase()) ?? "";
    if (id) {
      resolved[spec.slug] = id;
    } else {
      const created = await createField(spec, folderId);
      if (created) {
        resolved[spec.slug] = created;
        console.log(`  ✓ ${spec.name}: created ${created}`);
      }
    }
  }

  // 2. Group fields under the folder (idempotent).
  if (folderId) {
    let moved = 0;
    for (const spec of SPECS) {
      const id = resolved[spec.slug];
      if (!id) continue;
      if (await assignToFolder(id, spec.name, folderId)) moved++;
    }
    console.log(`  • Grouped ${moved} fields under "${FOLDER_NAME}".`);
  }

  rewriteIdsFile(resolved, folderId);

  const total = SPECS.length;
  const count = Object.keys(resolved).length;
  console.log(`\nDone. Resolved ${count}/${total} fields.`);
  if (count < total) {
    console.log("Some fields failed — re-run the script to retry (idempotent).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
