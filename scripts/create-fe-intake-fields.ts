/**
 * Idempotent provisioner for the Final Expense intake custom fields in Agent CRM (GHL).
 *
 *  1. Ensures a custom-field folder named "FE Intake Data" exists (reuses the saved id if present).
 *  2. Reads existing custom fields; for each intake field that still needs an id, reuses a
 *     matching existing field by name or creates it (inside the folder).
 *  3. Rewrites lib/fe-intake/ghl-field-ids.ts with the resolved folder id + field ids.
 *
 * Run:  pnpm fe-intake:fields
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID  (already in .env)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { FE_SECTIONS, type FeField, type FeFieldType } from "../lib/fe-intake/fields";
import { feFieldIds, type FeFieldSlug } from "../lib/fe-intake/ghl-field-ids";

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const FOLDER_NAME = "FE Intake Data";
const FIELD_PREFIX = "FE Intake - ";

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

type GhlDataType = "TEXT" | "SINGLE_OPTIONS";

function dataTypeFor(type: FeFieldType): GhlDataType {
  return type === "select" ? "SINGLE_OPTIONS" : "TEXT"; // text, email, ssn, zip, tel, dob, drug
}

type FieldSpec = {
  slug: FeFieldSlug;
  name: string;
  dataType: GhlDataType;
  options?: string[];
};

/** Every custom field this feature manages. */
function buildSpecs(): FieldSpec[] {
  const specs: FieldSpec[] = [];
  const seen = new Set<FeFieldSlug>();

  const push = (field: FeField) => {
    if (!field.crm || field.crm.kind !== "custom") return;
    if (seen.has(field.crm.slug)) return;
    seen.add(field.crm.slug);
    specs.push({
      slug: field.crm.slug,
      name: `${FIELD_PREFIX}${field.crmLabel ?? field.labelEn}`,
      dataType: dataTypeFor(field.type),
      options: field.options?.map((o) => o.labelEn),
    });
  };

  for (const section of FE_SECTIONS) {
    for (const field of section.fields) push(field);
  }

  if (!seen.has("medications_list")) {
    specs.push({ slug: "medications_list", name: `${FIELD_PREFIX}Medications`, dataType: "TEXT" });
  }

  if (!seen.has("beneficiaries_list")) {
    specs.push({ slug: "beneficiaries_list", name: `${FIELD_PREFIX}Beneficiaries`, dataType: "TEXT" });
  }

  // Meta field (not part of the form): the always-current client share link.
  if (!seen.has("fe_intake_link")) {
    specs.push({ slug: "fe_intake_link", name: `${FIELD_PREFIX}Share Link`, dataType: "TEXT" });
  }

  return specs;
}

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
  const { feDataFolderId } = await import("../lib/fe-intake/ghl-field-ids");
  if (feDataFolderId) {
    console.log(`Reusing existing FE Intake Data folder: ${feDataFolderId}`);
    return feDataFolderId;
  }
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
    console.log(`Created FE Intake Data folder: ${id}`);
    return typeof id === "string" ? id : "";
  } catch {
    return "";
  }
}

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
  if (spec.options && spec.options.length) body.options = spec.options;

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
  const file = path.join(process.cwd(), "lib", "fe-intake", "ghl-field-ids.ts");
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(
    /^export const feDataFolderId = "[^"]*";/m,
    `export const feDataFolderId = "${folderId}";`
  );

  for (const [slug, id] of Object.entries(resolved)) {
    if (!id) continue;
    const re = new RegExp(`(\\n\\s*${slug}:\\s*)"[^"]*"`);
    content = content.replace(re, `$1"${id}"`);
  }

  fs.writeFileSync(file, content, "utf8");
  console.log(`\nUpdated lib/fe-intake/ghl-field-ids.ts`);
}

async function main() {
  console.log("Provisioning Final Expense intake custom fields in Agent CRM…\n");

  const specs = buildSpecs();
  const existing = await getExistingFields();
  const folderId = await ensureFolder();
  const resolved: Record<string, string> = {};

  for (const spec of specs) {
    let id = feFieldIds[spec.slug];
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

  if (folderId) {
    let moved = 0;
    for (const spec of specs) {
      const id = resolved[spec.slug];
      if (!id) continue;
      if (await assignToFolder(id, spec.name, folderId)) moved++;
    }
    console.log(`  • Grouped ${moved} fields under "${FOLDER_NAME}".`);
  } else {
    console.warn(
      `\n  ! No folder id — fields were created at the top level, not under "${FOLDER_NAME}".`
    );
  }

  rewriteIdsFile(resolved, folderId);

  const total = specs.length;
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
