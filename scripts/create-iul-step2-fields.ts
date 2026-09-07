/**
 * Idempotent provisioner for the IUL get-covered (Meta ads) Step-2 custom fields in Agent CRM (GHL).
 *
 *  1. Reads every existing contact custom field + folder ONCE from the CRM.
 *  2. Resolves the "IUL Step 2 Ads Form" folder by NAME (so a stale saved id, or a folder that
 *     was deleted and recreated in the GHL UI, is picked up correctly); creates it only if
 *     it is truly absent.
 *  3. For each managed field: validates the saved id still EXISTS in the CRM (a field deleted
 *     in the GHL UI leaves a dead id behind here), else reuses a live field with the same name,
 *     else creates it inside the folder.
 *  4. Rewrites lib/iul-step2-ads/ghl-field-ids.ts with the resolved folder id + field ids.
 *
 * Run:  pnpm iul:step2-fields
 * Env:  AGENT_CRM_PI, AGENT_CRM_LOCATION_ID  (already in .env)
 *
 * Note: `state` and `email` are intentionally NOT custom fields — they are written to the
 * native contact fields by /api/contact-append-iul.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  iulStep2FieldIds,
  iulStep2FolderId,
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

/** The Step-2 quiz answers that need a dedicated custom field, in question order. */
const SPECS: FieldSpec[] = [
  { slug: "iul_s2_age", name: `${FIELD_PREFIX}Current Age`, dataType: "NUMERICAL" },
  {
    slug: "iul_s2_monthly_savings",
    name: `${FIELD_PREFIX}Monthly Savings`,
    dataType: "TEXT",
  },
  {
    slug: "iul_s2_retirement_timeline",
    name: `${FIELD_PREFIX}Retirement Timeline`,
    dataType: "TEXT",
  },
];

type CrmRecord = {
  id: string;
  name: string;
  documentType?: string;
  dataType?: string;
  parentId?: string;
};

/** One live read of the location's contact custom fields (folders included where returned). */
async function fetchCustomFieldRecords(): Promise<CrmRecord[]> {
  const res = await fetch(
    `${API_BASE}/locations/${locationId}/customFields?model=contact`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`List custom fields failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const rows: CrmRecord[] = [];
  for (const f of data.customFields ?? []) {
    if (typeof f?.id === "string" && typeof f?.name === "string") {
      rows.push({
        id: f.id,
        name: f.name,
        documentType: typeof f.documentType === "string" ? f.documentType : undefined,
        dataType: typeof f.dataType === "string" ? f.dataType : undefined,
        parentId: typeof f.parentId === "string" ? f.parentId : undefined,
      });
    }
  }

  return rows;
}

const isFolder = (r: CrmRecord) => r.documentType?.toLowerCase() === "folder";

/**
 * Read ONE custom-field record by id. Returns null when the id is dead — GHL answers 404 for a
 * deleted id and 400 for a malformed one, so ANY non-2xx counts as gone.
 */
async function fetchRecordById(id: string): Promise<CrmRecord | null> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields/${id}`, {
    headers,
  });
  if (!res.ok) return null;
  try {
    const data = await res.json();
    const f = data?.customField ?? data;
    if (typeof f?.id === "string" && typeof f?.name === "string") {
      return { id: f.id, name: f.name, documentType: f.documentType, parentId: f.parentId };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Resolve the "IUL Step 2 Ads Form" folder.
 *
 * The list endpoint returns ONLY fields in this workspace (verified: 279 records, all
 * documentType "field"), so a folder can never be discovered by name from it. The reliable
 * check is a direct GET on the saved id: verify it still resolves to a folder, and only fall
 * back to discovery/creation when it does not.
 */
async function ensureFolder(records: CrmRecord[]): Promise<string> {
  if (iulStep2FolderId) {
    const saved = await fetchRecordById(iulStep2FolderId);
    if (saved && isFolder(saved)) {
      console.log(`Verified folder "${saved.name}": ${saved.id}`);
      return saved.id;
    }
    console.log(
      `Saved folder id ${iulStep2FolderId} no longer resolves to a folder - re-resolving.`
    );
  }

  // Fallback discovery: a surviving field inside the folder reveals its id via parentId.
  // (This cannot find an EMPTY folder — hence the verify-by-id path above.)
  const parentIds = new Set(
    records.filter((r) => r.parentId && r.name.startsWith(FIELD_PREFIX)).map((r) => r.parentId!)
  );
  for (const parentId of parentIds) {
    const candidate = await fetchRecordById(parentId);
    if (
      candidate &&
      isFolder(candidate) &&
      candidate.name.trim().toLowerCase() === FOLDER_NAME.toLowerCase()
    ) {
      console.log(`Discovered folder "${FOLDER_NAME}" via an existing field: ${candidate.id}`);
      return candidate.id;
    }
  }

  // A folder is a custom field with documentType "folder" on the main resource.
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: FOLDER_NAME, model: "contact", documentType: "folder" }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(
      `Could not create folder (will create fields without folder): ${res.status} ${text}`
    );
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
async function assignToFolder(
  fieldId: string,
  name: string,
  parentId: string
): Promise<boolean> {
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
    console.warn(`  x ${spec.name}: ${res.status} ${text}`);
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
  console.log("Provisioning IUL Step-2 ads custom fields in Agent CRM...\n");

  const records = await fetchCustomFieldRecords();
  const liveIds = new Set(records.map((r) => r.id));
  const liveByName = new Map<string, string>();
  for (const r of records) {
    if (!isFolder(r)) liveByName.set(r.name.trim().toLowerCase(), r.id);
  }

  const folderId = await ensureFolder(records);
  const resolved: Record<string, string> = {};

  // 1. Resolve every managed field to a LIVE id (validate saved id -> reuse by name -> create).
  for (const spec of SPECS) {
    const saved = iulStep2FieldIds[spec.slug];
    let id = "";

    if (saved && liveIds.has(saved)) {
      id = saved;
      console.log(`  = ${spec.name}: already provisioned (${id})`);
    } else {
      if (saved) {
        console.log(
          `  ! ${spec.name}: saved id ${saved} no longer exists in the CRM - recreating`
        );
      }
      const existing = liveByName.get(spec.name.trim().toLowerCase());
      if (existing) {
        id = existing;
        console.log(`  ~ ${spec.name}: reusing existing field ${id}`);
      } else {
        const created = await createField(spec, folderId);
        if (created) {
          id = created;
          console.log(`  + ${spec.name}: created ${created}`);
        }
      }
    }

    if (id) resolved[spec.slug] = id;
  }

  // 2. Group fields under the folder (idempotent).
  if (folderId) {
    let moved = 0;
    for (const spec of SPECS) {
      const id = resolved[spec.slug];
      if (!id) continue;
      if (await assignToFolder(id, spec.name, folderId)) moved++;
    }
    console.log(`  - Grouped ${moved} fields under "${FOLDER_NAME}".`);
  }

  rewriteIdsFile(resolved, folderId);

  const total = SPECS.length;
  const count = Object.keys(resolved).length;
  console.log(`\nDone. Resolved ${count}/${total} fields.`);
  console.log(
    "Reminder: state -> native `state` field, email -> native `email` field (no custom fields)."
  );
  if (count < total) {
    console.log("Some fields failed - re-run the script to retry (idempotent).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
