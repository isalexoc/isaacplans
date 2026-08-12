import { NextRequest, NextResponse } from "next/server";
import {
  alreadySubmitted,
  isResponse,
  loadAuthorizedSession,
} from "@/lib/intake-core/route-helpers";
import {
  clientCanEdit,
  ensureCrmContactForSession,
  toIntakeSession,
  updateIntakeData,
  type IntakeSessionRow,
} from "@/lib/intake-core/server";
import {
  allFileFields,
  allRepeaterFields,
  fieldByKey,
  rowFieldByKey,
} from "@/lib/intake-core/fields";
import { crmFieldId } from "@/lib/intake-core/ghl-field-ids";
import { decryptIntakeData, encryptIntakeData } from "@/lib/intake-core/sensitive";
import {
  agentCrmGetBaseCredentials,
  agentCrmUploadCustomFieldFile,
  agentCrmSetFileField,
} from "@/lib/agent-crm-contacts";
import type {
  FileRef,
  IntakeData,
  IntakeField,
  IntakeLobConfig,
  RepeaterRow,
} from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

export const runtime = "nodejs";

/**
 * Vercel's serverless request-body cap is 4.5 MB, so anything larger never reaches this handler.
 * The client compresses images before upload (lib/image-compress.ts), which keeps phone photos
 * well under this; the limit here is the backstop with a readable message.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

/** Identifies which file field an upload targets: a top-level one, or one inside a repeater row. */
type FileTarget = {
  field: IntakeField;
  crmFieldId: string;
  /** Set only for per-row uploads. */
  repeaterKey?: string;
  rowIndex?: number;
};

function crmIdFor(config: IntakeLobConfig, field: IntakeField | undefined): string | null {
  if (!field || field.type !== "file" || field.crm?.kind !== "custom") return null;
  return crmFieldId(config.lob, field.crm.slug);
}

/**
 * Resolve the upload target from the request parts.
 * Top-level:  fieldKey=docPhotoId
 * Per-row:    repeaterKey=dependents & rowIndex=2 & rowField=docProofOfAge
 */
function resolveTarget(
  config: IntakeLobConfig,
  fieldKey: string,
  repeaterKey: string,
  rowFieldKey: string,
  rowIndexRaw: string
): FileTarget | null {
  if (repeaterKey && rowFieldKey) {
    const repeater = fieldByKey(config.sections, repeaterKey);
    if (!repeater || repeater.type !== "repeater") return null;
    const rowIndex = Number.parseInt(rowIndexRaw, 10);
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= (repeater.maxRows ?? 8)) {
      return null;
    }
    const sub = rowFieldByKey(config.sections, repeaterKey, rowFieldKey);
    const id = crmIdFor(config, sub);
    if (!sub || !id) return null;
    return { field: sub, crmFieldId: id, repeaterKey, rowIndex };
  }

  const field = fieldByKey(config.sections, fieldKey);
  const id = crmIdFor(config, field);
  if (!field || !id) return null;
  return { field, crmFieldId: id };
}

/** Read the current FileRef[] at a target (top-level key or a row sub-key). */
function filesAt(data: IntakeData, target: FileTarget): FileRef[] {
  if (target.repeaterKey !== undefined && target.rowIndex !== undefined) {
    const rows = data[target.repeaterKey];
    if (!Array.isArray(rows)) return [];
    const row = rows[target.rowIndex] as RepeaterRow | undefined;
    const v = row?.[target.field.key];
    return Array.isArray(v) ? (v as FileRef[]) : [];
  }
  const v = data[target.field.key];
  return Array.isArray(v) ? (v as FileRef[]) : [];
}

/** Write a FileRef[] to a target, creating the row if the repeater array is short. */
function setFilesAt(data: IntakeData, target: FileTarget, files: FileRef[]): void {
  if (target.repeaterKey !== undefined && target.rowIndex !== undefined) {
    const rows: RepeaterRow[] = Array.isArray(data[target.repeaterKey])
      ? [...(data[target.repeaterKey] as RepeaterRow[])]
      : [];
    while (rows.length <= target.rowIndex) rows.push({});
    rows[target.rowIndex] = { ...(rows[target.rowIndex] ?? {}), [target.field.key]: files };
    data[target.repeaterKey] = rows;
    return;
  }
  data[target.field.key] = files;
}

/**
 * Every file URL already known anywhere in this session for a given CRM slug.
 *
 * Per-row document slugs are SHARED buckets in the CRM — every dependent's document lands on the
 * same custom field. GHL echoes back the whole bucket after an upload, so we diff against this set
 * to work out which entries are new and belong to the row that just uploaded. Without it, row 2's
 * upload would overwrite row 1's file list.
 */
function knownUrlsForSlug(config: IntakeLobConfig, data: IntakeData, slug: string): Set<string> {
  const urls = new Set<string>();
  const collect = (v: unknown) => {
    if (!Array.isArray(v)) return;
    for (const f of v as FileRef[]) {
      if (f?.url) urls.add(f.url);
    }
  };

  for (const field of allFileFields(config.sections)) {
    if (field.crm?.kind === "custom" && field.crm.slug === slug) collect(data[field.key]);
  }
  for (const repeater of allRepeaterFields(config.sections)) {
    const subs = (repeater.rowFields ?? []).filter(
      (s) => s.type === "file" && s.crm?.kind === "custom" && s.crm.slug === slug
    );
    if (subs.length === 0) continue;
    const rows = data[repeater.key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows as RepeaterRow[]) {
      for (const sub of subs) collect(row?.[sub.key]);
    }
  }
  return urls;
}

/** Persist the whole decrypted payload back to the DB (re-encrypting sensitive fields). */
async function persist(
  config: IntakeLobConfig,
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<void> {
  const encrypted = encryptIntakeData(config, decrypted);
  const nextStatus = row.status === "completed" ? "completed" : "in_progress";
  await updateIntakeData(row.token, encrypted, nextStatus);
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Prefix a per-row document with that person's name, so the shared CRM bucket shows
 * "Maria Gonzalez - Photo ID.jpg" instead of six files called IMG_4821.jpg.
 */
function buildFileName(data: IntakeData, target: FileTarget, original: string): string {
  if (target.repeaterKey === undefined || target.rowIndex === undefined) {
    return original || "upload";
  }
  const rows = data[target.repeaterKey];
  const row = Array.isArray(rows) ? ((rows[target.rowIndex] ?? {}) as RepeaterRow) : {};
  const who =
    [str(row.firstName), str(row.lastName)].filter(Boolean).join(" ") ||
    str(row.fullName) ||
    `Row ${target.rowIndex + 1}`;
  const ext = original.includes(".") ? original.slice(original.lastIndexOf(".")) : "";
  return `${who} - ${target.field.labelEn}${ext}`;
}

// POST /api/intake/[lob]/[token]/files — upload a file, store in CRM media, attach to the field
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const loaded = await loadAuthorizedSession(lob, token, { claim: true });
    if (isResponse(loaded)) return loaded;
    const { config, row, access } = loaded;

    // A client cannot attach files to a submitted form unless the admin re-opened it.
    if (access.role === "client" && !clientCanEdit(row)) return alreadySubmitted();

    const form = await request.formData();
    const file = form.get("file");
    const target = resolveTarget(
      config,
      String(form.get("fieldKey") ?? ""),
      String(form.get("repeaterKey") ?? ""),
      String(form.get("rowField") ?? ""),
      String(form.get("rowIndex") ?? "")
    );

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (!target) {
      return NextResponse.json({ success: false, error: "Unknown file field" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large (max 4 MB). Try taking the photo again." },
        { status: 400 }
      );
    }

    const decrypted = decryptIntakeData(config, (row.data ?? {}) as IntakeData);

    const creds = agentCrmGetBaseCredentials();
    // A session started anonymously has no CRM contact until the client supplies an email or
    // phone. Uploads attach to a contact's file field, so make sure one exists rather than failing
    // a document upload the client can't do anything about.
    await ensureCrmContactForSession(config, row, decrypted);
    if (!creds || !row.crmContactId) {
      return NextResponse.json(
        { success: false, error: "CRM is not configured for this session." },
        { status: 400 }
      );
    }

    const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
    const slug = target.field.crm?.kind === "custom" ? target.field.crm.slug : "";
    const before = knownUrlsForSlug(config, decrypted, slug);

    // Attach the file to the contact's FILE_UPLOAD custom field via the dedicated endpoint.
    // (Setting field_value URLs on the contact update is silently ignored by GHL.)
    const fieldFiles = await agentCrmUploadCustomFieldFile(
      file,
      buildFileName(decrypted, target, file.name || "upload"),
      row.crmContactId,
      creds.locationId,
      target.crmFieldId,
      creds.token,
      logTag
    );
    if (!fieldFiles) {
      return NextResponse.json({ success: false, error: "Upload failed" }, { status: 502 });
    }

    // GHL returns the whole shared bucket — keep only what is new and attach it to THIS row.
    const added = fieldFiles.filter((f) => f.url && !before.has(f.url));
    const existing = filesAt(decrypted, target);
    const next: FileRef[] =
      added.length > 0
        ? [...existing, ...added.map((f) => ({ url: f.url, name: f.name }))]
        : [...existing, { url: "", name: file.name || "file" }];

    setFilesAt(decrypted, target, next);
    await persist(config, row, decrypted);

    return NextResponse.json({
      success: true,
      field: target.field.key,
      repeaterKey: target.repeaterKey ?? null,
      rowIndex: target.rowIndex ?? null,
      files: next,
      session: toIntakeSession(
        { ...row, status: row.status === "completed" ? "completed" : "in_progress" },
        access.role,
        decrypted
      ),
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token/files] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to upload file" }, { status: 500 });
  }
}

// DELETE /api/intake/[lob]/[token]/files?field=…&url=… (&repeaterKey=…&rowIndex=…)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    // No claiming on delete: removing a file should never be the act that binds a session.
    const loaded = await loadAuthorizedSession(lob, token, { claim: false });
    if (isResponse(loaded)) return loaded;
    const { config, row, access } = loaded;

    // A client cannot remove files from a submitted form unless the admin re-opened it.
    if (access.role === "client" && !clientCanEdit(row)) return alreadySubmitted();

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url") ?? "";
    const target = resolveTarget(
      config,
      searchParams.get("field") ?? "",
      searchParams.get("repeaterKey") ?? "",
      searchParams.get("rowField") ?? "",
      searchParams.get("rowIndex") ?? ""
    );
    if (!target || !url) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    const decrypted = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
    const next = filesAt(decrypted, target).filter((f) => f.url !== url);
    setFilesAt(decrypted, target, next);
    await persist(config, row, decrypted);

    // Best-effort: rewrite the shared CRM bucket to everything still referenced for this slug.
    const creds = agentCrmGetBaseCredentials();
    const slug = target.field.crm?.kind === "custom" ? target.field.crm.slug : "";
    if (creds && row.crmContactId && slug) {
      const remaining = Array.from(knownUrlsForSlug(config, decrypted, slug));
      await agentCrmSetFileField(
        row.crmContactId,
        target.crmFieldId,
        remaining,
        creds.token,
        `[${config.slugPrefix.toUpperCase()}_INTAKE]`
      );
    }

    return NextResponse.json({
      success: true,
      field: target.field.key,
      repeaterKey: target.repeaterKey ?? null,
      rowIndex: target.rowIndex ?? null,
      files: next,
      session: toIntakeSession(row, access.role, decrypted),
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token/files] DELETE`, error);
    return NextResponse.json({ success: false, error: "Failed to remove file" }, { status: 500 });
  }
}
