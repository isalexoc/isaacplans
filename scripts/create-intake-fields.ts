/**
 * Idempotent provisioner for a line of business's intake custom fields in Agent CRM (GHL).
 *
 *  1. Ensures a custom-field folder named "<Label> Data" exists (reuses a saved id if present).
 *  2. Reads existing custom fields; for each field the config needs, reuses a matching existing
 *     field by name or creates it inside the folder.
 *  3. Writes the resolved ids to lib/intake-configs/ghl-field-ids.generated.json.
 *
 * Two deliberate departures from the three per-LOB scripts this replaces:
 *  - one script for every line, driven by `lib/intake-configs/<lob>.ts`, so adding a line of
 *    business never means writing another provisioner;
 *  - the output is JSON rather than line-anchored regex surgery on a TypeScript file, which was
 *    the fragile part of the original approach.
 *
 * Run:  pnpm intake:fields <lob>        e.g. pnpm intake:fields dental-vision
 *       pnpm intake:fields --all
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID  (already in .env)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { ENGINE_INTAKE_CONFIGS, getIntakeConfig } from "../lib/intake-configs";
import { allRepeaterFields } from "../lib/intake-core/fields";
import type { IntakeField, IntakeFieldType, IntakeLobConfig } from "../lib/intake-core/types";

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const IDS_FILE = path.join(process.cwd(), "lib", "intake-configs", "ghl-field-ids.generated.json");

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
      return "TEXT"; // text, email, ssn, zip, address
  }
}

type FieldSpec = { slug: string; name: string; dataType: GhlDataType; options?: string[] };

/** Ids file shape: `{ "<lob>": { "<slug>": "<id>" }, "_folders": { "<lob>": "<id>" } }`. */
type IdsFile = Record<string, Record<string, string>>;

function readIds(): IdsFile {
  try {
    return JSON.parse(fs.readFileSync(IDS_FILE, "utf8")) as IdsFile;
  } catch {
    return {};
  }
}

function writeIds(ids: IdsFile): void {
  fs.writeFileSync(IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`, "utf8");
}

/**
 * Every custom field this line of business writes: config fields, repeater sub-fields (per-row
 * document uploads live there), the per-row CRM slots, and the share-link meta field.
 *
 * Each line owns all of its fields — nothing is shared with another product, even for values that
 * look identical (SSN, banking). GHL custom fields are global to the location, so sharing would
 * let one line's intake overwrite what another captured on the same contact.
 */
function buildSpecs(config: IntakeLobConfig): FieldSpec[] {
  const prefix = `${config.label} Intake - `;
  const specs: FieldSpec[] = [];
  const seen = new Set<string>();

  const push = (field: IntakeField) => {
    if (!field.crm || field.crm.kind !== "custom") return;
    if (seen.has(field.crm.slug)) return;
    seen.add(field.crm.slug);
    specs.push({
      slug: field.crm.slug,
      // `crmLabel` when the client-facing label would make a bad permanent field name (a question).
      name: `${prefix}${field.crmLabel ?? field.labelEn}`,
      // A repeater collapsed into one field holds many lines of text, whatever its own `type`.
      dataType: field.type === "repeater" ? "LARGE_TEXT" : dataTypeFor(field.type),
      options: field.type === "repeater" ? undefined : field.options?.map((o) => o.labelEn),
    });
  };

  for (const section of config.sections) {
    for (const field of section.fields) {
      push(field);
      for (const sub of field.rowFields ?? []) push(sub);
    }
  }

  // Per-row slots (e.g. dependent 1..6) — one LARGE_TEXT field each.
  for (const repeater of allRepeaterFields(config.sections)) {
    const noun = repeater.rowLabelEn ?? "Row";
    (repeater.crmSlots ?? []).forEach((slug, i) => {
      if (seen.has(slug)) return;
      seen.add(slug);
      specs.push({ slug, name: `${prefix}${noun} ${i + 1}`, dataType: "LARGE_TEXT" });
    });
  }

  // Meta field (not part of the form): the always-current client share link.
  const linkSlug = `${config.slugPrefix}_intake_link`;
  if (!seen.has(linkSlug)) {
    specs.push({ slug: linkSlug, name: `${prefix}Share Link`, dataType: "TEXT" });
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

async function ensureFolder(config: IntakeLobConfig, ids: IdsFile): Promise<string> {
  const saved = ids._folders?.[config.lob];
  if (saved) {
    console.log(`  Reusing existing "${config.label} Data" folder: ${saved}`);
    return saved;
  }
  // A folder is a custom field with documentType "folder" on the main resource.
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `${config.label} Data`,
      model: "contact",
      documentType: "folder",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`  Could not create folder (fields will be created unfoldered): ${res.status} ${text}`);
    return "";
  }
  try {
    const data = JSON.parse(text);
    const id = data?.customFieldFolder?.id ?? data?.customField?.id ?? data?.id ?? "";
    if (typeof id === "string" && id) console.log(`  Created "${config.label} Data" folder: ${id}`);
    return typeof id === "string" ? id : "";
  } catch {
    return "";
  }
}

async function createField(spec: FieldSpec, parentId: string): Promise<string | null> {
  const body: Record<string, unknown> = {
    name: spec.name,
    dataType: spec.dataType,
    model: "contact",
  };
  if (parentId) body.parentId = parentId;
  if (spec.options?.length) body.options = spec.options;

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

async function provision(config: IntakeLobConfig, ids: IdsFile): Promise<void> {
  console.log(`\n=== ${config.label} (${config.lob}) ===`);
  const specs = buildSpecs(config);
  const existing = await getExistingFields();
  const folderId = await ensureFolder(config, ids);

  ids._folders = { ...(ids._folders ?? {}) };
  if (folderId) ids._folders[config.lob] = folderId;
  const resolved: Record<string, string> = { ...(ids[config.lob] ?? {}) };

  let created = 0;
  let reused = 0;
  for (const spec of specs) {
    if (resolved[spec.slug]) continue;

    const match = existing.get(spec.name.trim().toLowerCase());
    if (match) {
      resolved[spec.slug] = match;
      reused += 1;
      continue;
    }

    const id = await createField(spec, folderId);
    if (id) {
      resolved[spec.slug] = id;
      created += 1;
      console.log(`  + ${spec.name}`);
    }
  }

  ids[config.lob] = resolved;
  const missing = specs.filter((s) => !resolved[s.slug]);
  console.log(
    `  ${specs.length} fields — ${created} created, ${reused} reused, ${missing.length} unresolved.`
  );
  if (missing.length) {
    console.warn(`  ! Unresolved: ${missing.map((m) => m.slug).join(", ")}`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a.trim());
  const all = args.includes("--all");
  const requested = args.filter((a) => !a.startsWith("--"));

  let targets: IntakeLobConfig[];
  if (all) {
    targets = ENGINE_INTAKE_CONFIGS;
  } else if (requested.length) {
    targets = [];
    for (const slug of requested) {
      const config = getIntakeConfig(slug);
      if (!config) {
        console.error(
          `Unknown line of business "${slug}". Known: ${ENGINE_INTAKE_CONFIGS.map((c) => c.lob).join(", ")}`
        );
        process.exit(1);
      }
      targets.push(config);
    }
  } else {
    console.error(
      `Usage: pnpm intake:fields <lob> [<lob>…] | --all\n` +
        `Known: ${ENGINE_INTAKE_CONFIGS.map((c) => c.lob).join(", ")}`
    );
    process.exit(1);
  }

  const ids = readIds();
  for (const config of targets) {
    await provision(config, ids);
    // Write after each line so a failure partway through never loses earlier work.
    writeIds(ids);
  }
  console.log(`\nWrote ${path.relative(process.cwd(), IDS_FILE)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
