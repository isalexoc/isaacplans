import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAcaIntakeByToken,
  bindAcaClientUser,
  canAccessAcaIntake,
  acaClientCanEdit,
  updateAcaIntakeData,
  toAcaIntakeSession,
  memberDisplayName,
  type AcaIntakeSessionRow,
} from "@/lib/aca-intake/server";
import {
  fieldByKey,
  rowFieldByKey,
  allFileFields,
  allRepeaterFields,
  type AcaField,
  type FileRef,
  type RepeaterRow,
} from "@/lib/aca-intake/fields";
import { acaFieldIds } from "@/lib/aca-intake/ghl-field-ids";
import type { AcaIntakeData } from "@/lib/aca-intake/schema";
import { encryptAcaIntakeData, decryptAcaIntakeData } from "@/lib/aca-intake/encryption";
import {
  agentCrmGetBaseCredentials,
  agentCrmUploadCustomFieldFile,
  agentCrmSetFileField,
} from "@/lib/agent-crm-contacts";

type RouteContext = { params: Promise<{ token: string }> };

export const runtime = "nodejs";

/**
 * Vercel's serverless request-body cap is 4.5 MB, so anything larger never reaches this
 * handler. The client compresses images before upload (lib/image-compress.ts), which keeps
 * phone photos well under this; the limit here is the backstop with a readable message.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

/** Identifies which file field an upload targets: a top-level one, or one inside a repeater row. */
type FileTarget = {
  field: AcaField;
  crmFieldId: string;
  /** Set only for per-row uploads. */
  repeaterKey?: string;
  rowIndex?: number;
};

function roleOf(row: AcaIntakeSessionRow, userId: string): "owner" | "client" {
  return row.ownerUserId === userId ? "owner" : "client";
}

function crmIdFor(field: AcaField | undefined): string | null {
  if (!field || field.type !== "file" || field.crm?.kind !== "custom") return null;
  return acaFieldIds[field.crm.slug] || null;
}

/**
 * Resolve the upload target from the request parts.
 * Top-level:  fieldKey=docPhotoId
 * Per-row:    repeaterKey=householdMembers & rowIndex=2 & rowField=docLegalPresenceFront
 */
function resolveTarget(
  fieldKey: string,
  repeaterKey: string,
  rowFieldKey: string,
  rowIndexRaw: string
): FileTarget | null {
  if (repeaterKey && rowFieldKey) {
    const repeater = fieldByKey(repeaterKey);
    if (!repeater || repeater.type !== "repeater") return null;
    const rowIndex = Number.parseInt(rowIndexRaw, 10);
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= (repeater.maxRows ?? 8)) {
      return null;
    }
    const sub = rowFieldByKey(repeaterKey, rowFieldKey);
    const crmFieldId = crmIdFor(sub);
    if (!sub || !crmFieldId) return null;
    return { field: sub, crmFieldId, repeaterKey, rowIndex };
  }

  const field = fieldByKey(fieldKey);
  const crmFieldId = crmIdFor(field);
  if (!field || !crmFieldId) return null;
  return { field, crmFieldId };
}

/** Read the current FileRef[] at a target (top-level key or a row sub-key). */
function filesAt(data: AcaIntakeData, target: FileTarget): FileRef[] {
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
function setFilesAt(data: AcaIntakeData, target: FileTarget, files: FileRef[]): void {
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
 * The three per-member document slugs are SHARED buckets in the CRM — every household
 * member's green card lands on the same `aca_doc_legal_front` field. GHL echoes back the
 * whole bucket after an upload, so we diff against this set to work out which entries are
 * new and belong to the row that just uploaded. Without it, member 2's upload would
 * overwrite member 1's file list.
 */
function knownUrlsForSlug(data: AcaIntakeData, slug: string): Set<string> {
  const urls = new Set<string>();
  const collect = (v: unknown) => {
    if (!Array.isArray(v)) return;
    for (const f of v as FileRef[]) {
      if (f?.url) urls.add(f.url);
    }
  };

  for (const field of allFileFields()) {
    if (field.crm?.kind === "custom" && field.crm.slug === slug) collect(data[field.key]);
  }
  for (const repeater of allRepeaterFields()) {
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
async function persist(row: AcaIntakeSessionRow, decrypted: AcaIntakeData): Promise<void> {
  const encrypted = encryptAcaIntakeData(decrypted);
  const nextStatus = row.status === "completed" ? "completed" : "in_progress";
  await updateAcaIntakeData(row.token, encrypted, nextStatus);
}

/**
 * Prefix a per-member document with the member's name, so the shared CRM bucket shows
 * "Maria Gonzalez - Legal presence FRONT.jpg" instead of eight files called IMG_4821.jpg.
 */
function buildFileName(
  data: AcaIntakeData,
  target: FileTarget,
  original: string
): string {
  if (target.repeaterKey !== "householdMembers" || target.rowIndex === undefined) {
    return original || "upload";
  }
  const rows = data.householdMembers;
  const row = Array.isArray(rows) ? ((rows[target.rowIndex] ?? {}) as RepeaterRow) : {};
  const who = memberDisplayName(row) || `Member ${target.rowIndex + 1}`;
  const ext = original.includes(".") ? original.slice(original.lastIndexOf(".")) : "";
  return `${who} - ${target.field.labelEn}${ext}`;
}

// POST /api/aca-intake/[token]/files — upload a file, store in CRM media, attach to the field
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const access = canAccessAcaIntake(row, userId);
    if (!access.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (access.shouldClaim) {
      await bindAcaClientUser(token, userId);
      row.clientUserId = userId;
    }
    // A client cannot attach files to a submitted form unless the admin re-opened it.
    if (roleOf(row, userId) === "client" && !acaClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const target = resolveTarget(
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

    const creds = agentCrmGetBaseCredentials();
    if (!creds || !row.crmContactId) {
      return NextResponse.json(
        { success: false, error: "CRM is not configured for this session." },
        { status: 400 }
      );
    }

    const decrypted = decryptAcaIntakeData((row.data ?? {}) as AcaIntakeData);
    const slug = target.field.crm?.kind === "custom" ? target.field.crm.slug : "";
    const before = knownUrlsForSlug(decrypted, slug);

    // Attach the file to the contact's FILE_UPLOAD custom field via the dedicated endpoint.
    // (Setting field_value URLs on the contact update is silently ignored by GHL.)
    const fieldFiles = await agentCrmUploadCustomFieldFile(
      file,
      buildFileName(decrypted, target, file.name || "upload"),
      row.crmContactId,
      creds.locationId,
      target.crmFieldId,
      creds.token,
      "[ACA_INTAKE]"
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
    await persist(row, decrypted);

    return NextResponse.json({
      success: true,
      field: target.field.key,
      repeaterKey: target.repeaterKey ?? null,
      rowIndex: target.rowIndex ?? null,
      files: next,
      session: toAcaIntakeSession(
        { ...row, status: row.status === "completed" ? "completed" : "in_progress" },
        roleOf(row, userId),
        decrypted
      ),
    });
  } catch (error) {
    console.error("[aca-intake/:token/files] POST", error);
    return NextResponse.json({ success: false, error: "Failed to upload file" }, { status: 500 });
  }
}

// DELETE /api/aca-intake/[token]/files?field=…&url=… (&repeaterKey=…&rowIndex=…)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (!canAccessAcaIntake(row, userId).allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    // A client cannot remove files from a submitted form unless the admin re-opened it.
    if (roleOf(row, userId) === "client" && !acaClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url") ?? "";
    const target = resolveTarget(
      searchParams.get("field") ?? "",
      searchParams.get("repeaterKey") ?? "",
      searchParams.get("rowField") ?? "",
      searchParams.get("rowIndex") ?? ""
    );
    if (!target || !url) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    const decrypted = decryptAcaIntakeData((row.data ?? {}) as AcaIntakeData);
    const next = filesAt(decrypted, target).filter((f) => f.url !== url);
    setFilesAt(decrypted, target, next);
    await persist(row, decrypted);

    // Best-effort: rewrite the shared CRM bucket to everything still referenced for this slug.
    const creds = agentCrmGetBaseCredentials();
    const slug = target.field.crm?.kind === "custom" ? target.field.crm.slug : "";
    if (creds && row.crmContactId && slug) {
      const remaining = Array.from(knownUrlsForSlug(decrypted, slug));
      await agentCrmSetFileField(row.crmContactId, target.crmFieldId, remaining, creds.token, "[ACA_INTAKE]");
    }

    return NextResponse.json({
      success: true,
      field: target.field.key,
      repeaterKey: target.repeaterKey ?? null,
      rowIndex: target.rowIndex ?? null,
      files: next,
      session: toAcaIntakeSession(row, roleOf(row, userId), decrypted),
    });
  } catch (error) {
    console.error("[aca-intake/:token/files] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to remove file" }, { status: 500 });
  }
}
