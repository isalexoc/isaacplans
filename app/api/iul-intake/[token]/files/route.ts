import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getIntakeByToken,
  bindClientUser,
  canAccessIntake,
  updateIntakeData,
  toIntakeSession,
  type IntakeSessionRow,
} from "@/lib/iul-intake/server";
import { fieldByKey, type FileRef } from "@/lib/iul-intake/fields";
import { ghlFieldIds } from "@/lib/iul-intake/ghl-field-ids";
import type { IntakeData } from "@/lib/iul-intake/schema";
import { encryptIntakeData, decryptIntakeData } from "@/lib/crypto/field-encryption";
import {
  agentCrmGetBaseCredentials,
  agentCrmUploadMedia,
  agentCrmSetFileField,
} from "@/lib/agent-crm-contacts";

type RouteContext = { params: Promise<{ token: string }> };

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

function roleOf(row: IntakeSessionRow, userId: string): "owner" | "client" {
  return row.ownerUserId === userId ? "owner" : "client";
}

function fileFieldId(fieldKey: string): string | null {
  const field = fieldByKey(fieldKey);
  if (!field || field.type !== "file" || field.crm?.kind !== "custom") return null;
  return ghlFieldIds[field.crm.slug] || null;
}

function currentFiles(data: IntakeData, fieldKey: string): FileRef[] {
  const v = data[fieldKey];
  return Array.isArray(v) ? (v as FileRef[]) : [];
}

/** Persist the new file list (plaintext URLs) and mirror it to the CRM file field. */
async function syncFiles(
  row: IntakeSessionRow,
  fieldKey: string,
  files: FileRef[]
): Promise<IntakeData> {
  const decrypted = decryptIntakeData((row.data ?? {}) as IntakeData);
  decrypted[fieldKey] = files;
  const encrypted = encryptIntakeData(decrypted);
  const nextStatus = row.status === "completed" ? "completed" : "in_progress";
  await updateIntakeData(row.token, encrypted, nextStatus);

  const creds = agentCrmGetBaseCredentials();
  const fieldId = fileFieldId(fieldKey);
  if (creds && row.crmContactId && fieldId) {
    await agentCrmSetFileField(
      row.crmContactId,
      fieldId,
      files.map((f) => f.url),
      creds.token,
      "[IUL_INTAKE]"
    );
  }
  return decrypted;
}

// POST /api/iul-intake/[token]/files — upload a file, store in CRM media, append to field
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const access = canAccessIntake(row, userId);
    if (!access.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (access.shouldClaim) {
      await bindClientUser(token, userId);
      row.clientUserId = userId;
    }

    const form = await request.formData();
    const file = form.get("file");
    const fieldKey = String(form.get("fieldKey") ?? "");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (!fileFieldId(fieldKey)) {
      return NextResponse.json({ success: false, error: "Unknown file field" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File too large (max 15 MB)" }, { status: 400 });
    }

    const creds = agentCrmGetBaseCredentials();
    if (!creds || !row.crmContactId) {
      return NextResponse.json(
        { success: false, error: "CRM is not configured for this session." },
        { status: 400 }
      );
    }

    const uploaded = await agentCrmUploadMedia(file, file.name || "upload", creds.locationId, creds.token, "[IUL_INTAKE]");
    if (!uploaded) {
      return NextResponse.json({ success: false, error: "Upload failed" }, { status: 502 });
    }

    const decryptedNow = decryptIntakeData((row.data ?? {}) as IntakeData);
    const next = [...currentFiles(decryptedNow, fieldKey), { url: uploaded.url, name: file.name || "file", fileId: uploaded.fileId }];
    const decrypted = await syncFiles(row, fieldKey, next);

    return NextResponse.json({
      success: true,
      field: fieldKey,
      files: next,
      session: toIntakeSession({ ...row, status: row.status === "completed" ? "completed" : "in_progress" }, roleOf(row, userId), decrypted),
    });
  } catch (error) {
    console.error("[iul-intake/:token/files] POST", error);
    return NextResponse.json({ success: false, error: "Failed to upload file" }, { status: 500 });
  }
}

// DELETE /api/iul-intake/[token]/files?field=...&url=... — remove a file from a field
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (!canAccessIntake(row, userId).allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fieldKey = searchParams.get("field") ?? "";
    const url = searchParams.get("url") ?? "";
    if (!fileFieldId(fieldKey) || !url) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    const decryptedNow = decryptIntakeData((row.data ?? {}) as IntakeData);
    const next = currentFiles(decryptedNow, fieldKey).filter((f) => f.url !== url);
    const decrypted = await syncFiles(row, fieldKey, next);

    return NextResponse.json({
      success: true,
      field: fieldKey,
      files: next,
      session: toIntakeSession(row, roleOf(row, userId), decrypted),
    });
  } catch (error) {
    console.error("[iul-intake/:token/files] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to remove file" }, { status: 500 });
  }
}
