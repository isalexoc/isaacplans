/**
 * Idempotent provisioner for the IUL intake custom fields in Agent CRM (GHL).
 *
 *  1. Ensures a custom-field folder named "IUL Data" exists (reuses the saved id if present).
 *  2. Reads existing custom fields; for each intake field that still needs an id, reuses a
 *     matching existing field by name or creates it (inside the folder).
 *  3. Rewrites lib/iul-intake/ghl-field-ids.ts with the resolved folder id + field ids.
 *
 * Run:  pnpm tsx scripts/create-iul-intake-fields.ts
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID  (already in .env)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  INTAKE_SECTIONS,
  BENEFICIARY_SLUGS,
  type IntakeField,
  type IntakeFieldType,
} from "../lib/iul-intake/fields";
import { ghlFieldIds, type GhlFieldSlug } from "../lib/iul-intake/ghl-field-ids";

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const FOLDER_NAME = "IUL Data";
const FIELD_PREFIX = "IUL Intake - ";

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

function dataTypeFor(type: IntakeFieldType): GhlDataType {
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
      return "TEXT"; // text, email, ssn
  }
}

type FieldSpec = {
  slug: GhlFieldSlug;
  name: string;
  dataType: GhlDataType;
  options?: string[];
  /** Reused pre-existing CRM fields — never relocated into the IUL Data folder. */
  reused: boolean;
};

/** Slugs that map to pre-existing CRM fields we only reuse (left in their own folders). */
const REUSED_SLUGS = new Set<GhlFieldSlug>([
  "gender",
  "ssn",
  "premium_payment_mode",
  "additional_comments",
  "agent",
]);

/** Every custom field this feature manages (from the config + beneficiary slots). */
function buildSpecs(): FieldSpec[] {
  const specs: FieldSpec[] = [];

  for (const section of INTAKE_SECTIONS) {
    for (const field of section.fields as IntakeField[]) {
      if (!field.crm || field.crm.kind !== "custom") continue;
      specs.push({
        slug: field.crm.slug,
        name: `${FIELD_PREFIX}${field.labelEn}`,
        dataType: dataTypeFor(field.type),
        options: field.options?.map((o) => o.labelEn),
        reused: REUSED_SLUGS.has(field.crm.slug),
      });
    }
  }

  BENEFICIARY_SLUGS.forEach((slug, i) => {
    specs.push({
      slug,
      name: `${FIELD_PREFIX}Beneficiary ${i + 1}`,
      dataType: "LARGE_TEXT",
      reused: false,
    });
  });

  // Meta field (not part of the form): the always-current client share link.
  specs.push({
    slug: "iul_intake_link",
    name: `${FIELD_PREFIX}Share Link`,
    dataType: "TEXT",
    reused: false,
  });

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
  const { iulDataFolderId } = await import("../lib/iul-intake/ghl-field-ids");
  if (iulDataFolderId) {
    console.log(`Reusing existing IUL Data folder: ${iulDataFolderId}`);
    return iulDataFolderId;
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
    console.log(`Created IUL Data folder: ${id}`);
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
  const file = path.join(process.cwd(), "lib", "iul-intake", "ghl-field-ids.ts");
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(
    /export const iulDataFolderId = "[^"]*";/,
    `export const iulDataFolderId = "${folderId}";`
  );

  for (const [slug, id] of Object.entries(resolved)) {
    if (!id) continue;
    const re = new RegExp(`(\\n\\s*${slug}:\\s*)"[^"]*"`);
    content = content.replace(re, `$1"${id}"`);
  }

  fs.writeFileSync(file, content, "utf8");
  console.log(`\nUpdated lib/iul-intake/ghl-field-ids.ts`);
}

async function main() {
  console.log("Provisioning IUL intake custom fields in Agent CRM…\n");

  const specs = buildSpecs();
  const existing = await getExistingFields();
  const folderId = await ensureFolder();
  const resolved: Record<string, string> = {};

  // 1. Resolve every managed field to an id (reuse existing by current id / by name, else create).
  for (const spec of specs) {
    let id = ghlFieldIds[spec.slug];
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

  // 2. Group non-reused fields under the IUL Data folder (idempotent).
  if (folderId) {
    let moved = 0;
    for (const spec of specs) {
      if (spec.reused) continue;
      const id = resolved[spec.slug];
      if (!id) continue;
      if (await assignToFolder(id, spec.name, folderId)) moved++;
    }
    console.log(`  • Grouped ${moved} fields under "${FOLDER_NAME}".`);
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
