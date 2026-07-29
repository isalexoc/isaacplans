/**
 * Idempotent provisioner for the ACA intake custom fields in Agent CRM (GHL).
 *
 *  1. Ensures a custom-field folder named "ACA Data" exists (reuses the saved id if present).
 *  2. Reads existing custom fields; for each intake field that still needs an id, reuses a
 *     matching existing field by name or creates it (inside the folder).
 *  3. Rewrites lib/aca-intake/ghl-field-ids.ts with the resolved folder id + field ids.
 *
 * Unlike the IUL provisioner this also walks `rowFields` inside repeaters, because the
 * per-member identity documents are declared there.
 *
 * Run:  pnpm aca:fields
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID  (already in .env)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  ACA_SECTIONS,
  MEMBER_SLUGS,
  type AcaField,
  type AcaFieldType,
} from "../lib/aca-intake/fields";
import { acaFieldIds, type AcaFieldSlug } from "../lib/aca-intake/ghl-field-ids";

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const FOLDER_NAME = "ACA Data";
const FIELD_PREFIX = "ACA Intake - ";

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

type GhlDataType =
  | "TEXT"
  | "LARGE_TEXT"
  | "NUMERICAL"
  | "PHONE"
  | "MONETORY"
  | "DATE"
  | "SINGLE_OPTIONS"
  | "FILE_UPLOAD";

function dataTypeFor(type: AcaFieldType): GhlDataType {
  switch (type) {
    case "textarea":
      return "LARGE_TEXT";
    case "number":
      return "NUMERICAL";
    case "money":
      return "MONETORY";
    case "tel":
      return "PHONE";
    case "date":
      return "DATE";
    case "select":
      return "SINGLE_OPTIONS";
    case "file":
      return "FILE_UPLOAD";
    default:
      return "TEXT"; // text, email, ssn, zip
  }
}

type FieldSpec = {
  slug: AcaFieldSlug;
  name: string;
  dataType: GhlDataType;
  options?: string[];
};

/**
 * ACA owns every field it writes — nothing is shared with the IUL intake, even for values
 * that look identical (SSN, banking). Each one is created fresh under "ACA Data" with the
 * "ACA Intake - " prefix, so the two product lines never write to the same CRM field.
 */

/** Every custom field this feature manages (config fields + repeater sub-fields + slots). */
function buildSpecs(): FieldSpec[] {
  const specs: FieldSpec[] = [];
  const seen = new Set<AcaFieldSlug>();

  const push = (field: AcaField) => {
    if (!field.crm || field.crm.kind !== "custom") return;
    if (seen.has(field.crm.slug)) return;
    seen.add(field.crm.slug);
    specs.push({
      slug: field.crm.slug,
      // `crmLabel` when the client-facing label would make a bad permanent field name
      // (a question, or one carrying a {currentYear} token).
      name: `${FIELD_PREFIX}${field.crmLabel ?? field.labelEn}`,
      dataType: dataTypeFor(field.type),
      options: field.options?.map((o) => o.labelEn),
    });
  };

  for (const section of ACA_SECTIONS) {
    for (const field of section.fields) {
      push(field);
      // Per-member document uploads are declared inside the repeater's rowFields.
      for (const sub of field.rowFields ?? []) push(sub);
    }
  }

  MEMBER_SLUGS.forEach((slug, i) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    specs.push({
      slug,
      name: `${FIELD_PREFIX}Household Member ${i + 1}`,
      dataType: "LARGE_TEXT",
    });
  });

  // Text summaries of the doctors / prescriptions repeaters.
  for (const [slug, name] of [
    ["doctors_list", "Doctors"],
    ["prescriptions_list", "Prescriptions"],
  ] as const) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    specs.push({ slug, name: `${FIELD_PREFIX}${name}`, dataType: "LARGE_TEXT" });
  }

  // Meta field (not part of the form): the always-current client share link.
  if (!seen.has("aca_intake_link")) {
    specs.push({
      slug: "aca_intake_link",
      name: `${FIELD_PREFIX}Share Link`,
      dataType: "TEXT",
    });
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
  const { acaDataFolderId } = await import("../lib/aca-intake/ghl-field-ids");
  if (acaDataFolderId) {
    console.log(`Reusing existing ACA Data folder: ${acaDataFolderId}`);
    return acaDataFolderId;
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
    console.log(`Created ACA Data folder: ${id}`);
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
  const file = path.join(process.cwd(), "lib", "aca-intake", "ghl-field-ids.ts");
  let content = fs.readFileSync(file, "utf8");

  // Line-anchored (^ with /m) so this can only ever match the real declaration — an
  // unanchored match would happily rewrite the same text sitting inside a doc comment.
  content = content.replace(
    /^export const acaDataFolderId = "[^"]*";/m,
    `export const acaDataFolderId = "${folderId}";`
  );

  for (const [slug, id] of Object.entries(resolved)) {
    if (!id) continue;
    const re = new RegExp(`(\\n\\s*${slug}:\\s*)"[^"]*"`);
    content = content.replace(re, `$1"${id}"`);
  }

  fs.writeFileSync(file, content, "utf8");
  console.log(`\nUpdated lib/aca-intake/ghl-field-ids.ts`);
}

async function main() {
  console.log("Provisioning ACA intake custom fields in Agent CRM…\n");

  const specs = buildSpecs();
  const existing = await getExistingFields();
  const folderId = await ensureFolder();
  const resolved: Record<string, string> = {};

  // 1. Resolve every managed field to an id (reuse existing by current id / by name, else create).
  for (const spec of specs) {
    let id = acaFieldIds[spec.slug];
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

  // 2. Group every field under the ACA Data folder (idempotent — safe to re-run).
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
