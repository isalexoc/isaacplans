import { NextRequest, NextResponse } from "next/server";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import {
  agentCrmGetBaseCredentials,
  agentCrmUploadCustomFieldFile,
} from "@/lib/agent-crm-contacts";
import { decryptIntakeData, encryptIntakeData } from "@/lib/crypto/field-encryption";
import { ghlFieldIds } from "@/lib/iul-intake/ghl-field-ids";
import type { FileRef } from "@/lib/iul-intake/fields";
import type { IntakeData } from "@/lib/iul-intake/schema";
import { updateIntakeData, ensureIulCrmContactForSession } from "@/lib/iul-intake/server";
import {
  getDocumentCaptureByToken,
  markDocumentCaptureOpened,
  recordDocumentUpload,
} from "@/lib/iul-intake/document-capture";
import { getIntakeById } from "@/lib/iul-intake/secure-capture";
import {
  storeDocumentInCloudinary,
  deliverableFor,
  safeDocumentName,
  MAX_DOCUMENT_BYTES,
} from "@/lib/iul-intake/document-upload";

/**
 * The client's side of the document-upload link.
 *
 * Along with the secure-capture route, this is one of only two endpoints in the IUL feature an
 * unauthenticated stranger can write to, so it stays narrow: one file per request, a size cap, a
 * live link required, and nothing about the application echoed back.
 *
 * ─── Two things this route must never do ───
 *
 * 1. **Never call `ensureIulDeviceId()`.** That mints the `iul_intake_device` cookie, and
 *    `resolveIntakeAccess` grants a claim to any device on an unclaimed session — so minting it on
 *    the client's phone would silently hand that phone the whole intake session and lock the
 *    client's laptop out with `claimed_elsewhere`. The capture token is the only credential here.
 * 2. **Never list what has already been uploaded.** The client sees a count of what THEY sent this
 *    visit, held in their own browser. Returning the stored list would turn a forwarded link into
 *    a way to read back someone's identity documents.
 *
 * Unlike the secure-capture link, a successful upload does NOT close this one: the agent rarely
 * knows upfront how many documents they need, so it stays open until revoked or the application
 * completes.
 */

export const runtime = "nodejs";
/** Cloudinary upload plus a CRM upload, on a phone connection. The default 15s is not enough. */
export const maxDuration = 60;

type RouteContext = { params: Promise<{ captureToken: string }> };

/** The field every link-uploaded document lands on — "Other documents" in the Documents step. */
const TARGET_FIELD_KEY = "attachmentOther";

/**
 * Extensions refused regardless of the "any file type" promise.
 *
 * Nothing here is a document anybody photographs or scans, and the list costs a real client
 * nothing. A link can be forwarded, and an endpoint that will store any executable a stranger
 * sends is an invitation, however unguessable the token.
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "com", "bat", "cmd", "msi", "scr", "pif", "vbs", "vbe", "js", "jse",
  "wsf", "wsh", "ps1", "psm1", "jar", "apk", "app", "dmg", "sh", "bash", "dll",
]);

function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec((name ?? "").trim());
  return m ? m[1].toLowerCase() : "";
}

/** Resolve the capture + its session, or the reason this link is not usable. */
async function loadUsableCapture(captureToken: string) {
  const capture = await getDocumentCaptureByToken(captureToken);
  if (!capture) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  if (capture.status !== "pending") {
    return {
      error: NextResponse.json(
        {
          success: false,
          code: "cancelled",
          error: "This link is no longer active. Please ask your agent for a new one.",
        },
        { status: 410 }
      ),
    };
  }

  const session = await getIntakeById(capture.sessionId);
  if (!session) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  // "Valid until the application is completed", enforced on the request rather than by a date.
  if (session.status === "completed") {
    return {
      error: NextResponse.json(
        {
          success: false,
          code: "completed",
          error: "This application is already finished — nothing more is needed.",
        },
        { status: 410 }
      ),
    };
  }
  return { capture, session };
}

/**
 * GET — what the phone needs to render: the language and a first name, so the client can see the
 * link is genuinely theirs. Deliberately not a list of what is already on file.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const loaded = await loadUsableCapture(captureToken);
    if (loaded.error) return loaded.error;

    const { capture, session } = loaded;
    // Stamped once so the agent's panel can distinguish "sent" from "they opened it".
    if (!capture!.openedAt) await markDocumentCaptureOpened(capture!.id);

    const firstName =
      typeof session!.data === "object" && session!.data
        ? String((session!.data as IntakeData).firstName ?? "").trim()
        : "";

    return NextResponse.json({
      success: true,
      locale: session!.locale === "es" ? "es" : "en",
      firstName,
      maxBytes: MAX_DOCUMENT_BYTES,
    });
  } catch (error) {
    console.error("[iul-intake/document-capture/:captureToken] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/**
 * POST — one document in.
 *
 * Order matters: Cloudinary first, the CRM second. If the CRM push fails the client still gets an
 * error and can retry, and the orphaned Cloudinary copy is harmless. Doing it the other way round
 * would mean a document sitting on the contact that our own records know nothing about.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const loaded = await loadUsableCapture(captureToken);
    if (loaded.error) return loaded.error;

    const { capture, session } = loaded;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, error: "That file is empty." }, { status: 400 });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { success: false, code: "too_large", error: "That file is larger than 15 MB." },
        { status: 400 }
      );
    }
    const ext = extensionOf(file.name);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: "That file type cannot be accepted." },
        { status: 400 }
      );
    }

    const decrypted = decryptIntakeData((session!.data ?? {}) as IntakeData);
    const contactId = await ensureIulCrmContactForSession(session!, decrypted);
    const creds = agentCrmGetBaseCredentials();
    const fieldId = ghlFieldIds.attachment_other;
    if (!creds || !contactId || !fieldId) {
      return NextResponse.json(
        { success: false, error: "This link is not set up to receive documents yet." },
        { status: 400 }
      );
    }

    const original = Buffer.from(await file.arrayBuffer());
    const filename = safeDocumentName(file.name, ext);

    const stored = await storeDocumentInCloudinary({
      bytes: original,
      sessionId: session!.id,
    });
    const deliverable = await deliverableFor({
      stored,
      original,
      filename,
      contentType: file.type || "application/octet-stream",
    });

    // The dedicated upload endpoint, not a contact update: GHL silently ignores field_value URLs
    // on a FILE_UPLOAD field, so the bytes have to go through this call.
    const fieldFiles = await agentCrmUploadCustomFieldFile(
      new Blob([new Uint8Array(deliverable.bytes)], { type: deliverable.contentType }),
      deliverable.filename,
      contactId,
      creds.locationId,
      fieldId,
      creds.token,
      "[IUL_INTAKE]"
    );
    if (!fieldFiles) {
      return NextResponse.json(
        { success: false, error: "That did not go through. Please try again." },
        { status: 502 }
      );
    }

    // Prefer the authoritative list GHL echoes back so the agent's Documents step matches the
    // contact exactly; fall back to appending when it returns none.
    const existing: FileRef[] = Array.isArray(decrypted[TARGET_FIELD_KEY])
      ? (decrypted[TARGET_FIELD_KEY] as FileRef[])
      : [];
    const next: FileRef[] =
      fieldFiles.length > 0
        ? fieldFiles.map((f) => ({ url: f.url, name: f.name }))
        : [...existing, { url: "", name: deliverable.filename }];

    decrypted[TARGET_FIELD_KEY] = next;
    await updateIntakeData(
      session!.token,
      encryptIntakeData(decrypted),
      session!.status === "completed" ? "completed" : "in_progress"
    );

    const isFirst = (capture!.uploadCount ?? 0) === 0;
    await recordDocumentUpload(capture!.id);

    // A note on the FIRST document only. The agent may not have the form open, and a document
    // they never hear about is the failure this exists to prevent — but one note per file turns
    // a client sending both sides of a card plus a passport into three notifications.
    if (isFirst) {
      try {
        await createContactNote({
          contactId,
          token: creds.token,
          title: "IUL — Documents Arriving",
          body:
            `The client started sending documents from their own device on ` +
            `${new Date().toLocaleString()}. They are on this contact's "Other documents" field, ` +
            `and the link stays open until you revoke it or the application is submitted.`,
        });
      } catch (noteError) {
        console.warn("[iul-document-capture] note failed:", noteError);
      }
    }

    // The name back, so the client sees their own file listed. Nothing about the application.
    return NextResponse.json({ success: true, name: deliverable.filename });
  } catch (error) {
    console.error("[iul-intake/document-capture/:captureToken] POST", error);
    return NextResponse.json({ success: false, error: "Failed to upload" }, { status: 500 });
  }
}
