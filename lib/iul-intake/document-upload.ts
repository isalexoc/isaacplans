/**
 * Ingest a document a client sent from their phone: store it, then make it openable.
 *
 * Two destinations on purpose, and they are not redundant:
 *
 *  - **Cloudinary**, with `authenticated` delivery — the asset refuses any unsigned request, the
 *    same footing the agent's own licence images are on. This is the copy the app can render
 *    thumbnails from without handing anyone a URL that works on its own.
 *  - **The CRM contact**, through the identical helper the agent's own Documents step uses, so a
 *    document that arrived by link sits beside one the agent dropped in themselves. Isaac submits
 *    applications out of the CRM; a document that is only in our database is a document he has to
 *    remember to go and find.
 *
 * ─── The iPhone problem this exists to solve ───
 *
 * A client photographing a green card on an iPhone produces HEIC. Plenty of software still cannot
 * open it, and "the client sent it and I cannot read it" is the same dead end as not sending it.
 * So HEIC is converted to JPEG on the way through, by Cloudinary, which is most of the reason the
 * file goes there first.
 *
 * ─── The trap in doing that naively ───
 *
 * Cloudinary classifies a **PDF as an image**, so a blanket `f_jpg` would silently flatten a
 * multi-page PDF into a picture of page one — losing pages of a document somebody needs. The
 * conversion is therefore narrowed to the formats that actually need it, and everything else is
 * passed through byte-for-byte exactly as the client sent it.
 *
 * Server-only: Cloudinary and CRM credentials.
 */

import "server-only";
import { nanoid } from "nanoid";
import cloudinary from "@/config/cloudinary";
import { agentCrmUploadCustomFieldFile } from "@/lib/agent-crm-contacts";
import type { FileRef } from "./fields";

// Re-exported so server callers have one import for the whole document story.
export { canPreview } from "./document-preview";

/** Matches the agent's own upload route, and comfortably above a phone photo or a scanned PDF. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

/**
 * Formats no ordinary viewer opens, which are exactly what a modern phone camera produces.
 *
 * Kept as a narrow allow-list rather than "convert every image": converting a JPEG to a JPEG is
 * pointless re-encoding, and converting a PDF destroys it (see the header note).
 */
const NEEDS_CONVERSION = new Set(["heic", "heif", "avif", "tif", "tiff"]);

export type StoredDocument = {
  /** Cloudinary public id, with `authenticated` delivery. Never rendered to a browser unsigned. */
  cloudinaryId: string;
  resourceType: string;
  /** Format as Cloudinary understood it, lowercase — "pdf", "jpg", "heic", "" for raw files. */
  format: string;
  bytes: number;
};

/** Upload the client's file exactly as sent. No transformation is applied at rest. */
export async function storeDocumentInCloudinary(params: {
  bytes: Buffer;
  sessionId: string;
}): Promise<StoredDocument> {
  const result = await new Promise<{
    public_id: string;
    resource_type?: string;
    format?: string;
    bytes?: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        // Scoped per session so a session's documents can be found — and purged — together.
        folder: `iul-documents/${params.sessionId}`,
        public_id: nanoid(),
        // "auto" so a PDF, a Word file and a photo all land without the caller guessing.
        resource_type: "auto",
        // Refuses unsigned delivery. A driver's licence must never sit on a guessable URL.
        type: "authenticated",
        // Unique id per upload, so nothing can overwrite an earlier document.
        overwrite: false,
      },
      (error, uploaded) => {
        if (error || !uploaded?.public_id) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(uploaded);
      }
    );
    stream.end(params.bytes);
  });

  return {
    cloudinaryId: result.public_id,
    resourceType: result.resource_type ?? "raw",
    format: (result.format ?? "").toLowerCase(),
    bytes: result.bytes ?? params.bytes.length,
  };
}

/** A signed, time-limited URL for a stored document. The only way to read one back. */
export function signedDocumentUrl(stored: Pick<StoredDocument, "cloudinaryId" | "resourceType">) {
  return cloudinary.url(stored.cloudinaryId, {
    resource_type: stored.resourceType || "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

export type DeliverableDocument = { bytes: Buffer; filename: string; contentType: string };

/**
 * The copy that goes to the CRM: the original, unless the original is something nobody can open.
 *
 * Returning the caller's own buffer in the common case is deliberate — it avoids a download round
 * trip for the JPEG and PDF that most uploads actually are, and it guarantees those arrive
 * byte-identical to what the client sent.
 */
export async function deliverableFor(params: {
  stored: StoredDocument;
  original: Buffer;
  filename: string;
  contentType: string;
}): Promise<DeliverableDocument> {
  const { stored, original, filename, contentType } = params;

  const needsConversion =
    stored.resourceType === "image" && NEEDS_CONVERSION.has(stored.format);
  if (!needsConversion) return { bytes: original, filename, contentType };

  const jpegUrl = cloudinary.url(stored.cloudinaryId, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    format: "jpg",
    transformation: [{ quality: "auto:good", fetch_format: "jpg" }],
  });

  try {
    const res = await fetch(jpegUrl);
    if (!res.ok) throw new Error(`convert failed: ${res.status}`);
    const converted = Buffer.from(await res.arrayBuffer());
    return {
      bytes: converted,
      filename: filename.replace(/\.[^.]+$/, "") + ".jpg",
      contentType: "image/jpeg",
    };
  } catch (error) {
    // Send the original rather than nothing. An unopenable file the agent can still download and
    // convert by hand beats a document that never reached them at all.
    console.warn("[iul-document-upload] HEIC conversion failed, sending original:", error);
    return { bytes: original, filename, contentType };
  }
}

/**
 * A filename safe to hand to a CRM and to a filesystem, keeping the client's own name where it is
 * usable so the agent sees "green-card-front.jpg" rather than an opaque id.
 */
export function safeDocumentName(raw: string, fallbackExt: string): string {
  const trimmed = (raw ?? "").trim().replace(/[/\\]/g, "-");
  const cleaned = trimmed
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  if (cleaned && /\.[A-Za-z0-9]{1,8}$/.test(cleaned)) return cleaned;
  if (cleaned) return `${cleaned}.${fallbackExt || "bin"}`;
  return `document-${nanoid(6)}.${fallbackExt || "bin"}`;
}

/**
 * A signed, short-lived thumbnail URL. Minted per request — never stored, never sent to a client
 * page, and only ever produced for an id the caller has already been shown to own.
 */
export function signedThumbnailUrl(cloudinaryId: string, size = 320): string {
  return cloudinary.url(cloudinaryId, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    format: "jpg",
    transformation: [
      // `pg_1` takes page one of a PDF; harmless on a single-image asset.
      { page: 1, width: size, height: size, crop: "fill", gravity: "auto", quality: "auto:good" },
    ],
  });
}

/**
 * The one path every intake file takes, whoever uploaded it.
 *
 * Both the agent's own uploader and the client's upload link call this, which is the point: before
 * it existed the two routes stored different things, so a document's preview depended on who had
 * attached it. Cloudinary first, CRM second — if the CRM push fails the caller can retry and the
 * spare Cloudinary copy is harmless, whereas the reverse leaves a file on the contact that our own
 * records know nothing about.
 *
 * Returns the merged list to store, or null if the CRM refused the upload.
 */
export async function ingestIntakeFile(params: {
  bytes: Buffer;
  filename: string;
  contentType: string;
  sessionId: string;
  contactId: string;
  locationId: string;
  fieldId: string;
  crmToken: string;
  /** What is already on this field, so Cloudinary metadata survives the merge below. */
  existing: FileRef[];
}): Promise<FileRef[] | null> {
  const stored = await storeDocumentInCloudinary({
    bytes: params.bytes,
    sessionId: params.sessionId,
  });
  const deliverable = await deliverableFor({
    stored,
    original: params.bytes,
    filename: params.filename,
    contentType: params.contentType,
  });

  const fieldFiles = await agentCrmUploadCustomFieldFile(
    new Blob([new Uint8Array(deliverable.bytes)], { type: deliverable.contentType }),
    deliverable.filename,
    params.contactId,
    params.locationId,
    params.fieldId,
    params.crmToken,
    "[IUL_INTAKE]"
  );
  if (!fieldFiles) return null;

  return mergeCloudinaryMetadata({
    authoritative: fieldFiles,
    existing: params.existing,
    justAdded: {
      cloudinaryId: stored.cloudinaryId,
      resourceType: stored.resourceType,
      format: stored.format,
    },
    fallbackName: deliverable.filename,
  });
}

/**
 * Reconcile the CRM's authoritative file list with the Cloudinary metadata we hold locally.
 *
 * The CRM is the authority on *which files exist* — it echoes back the whole field after every
 * upload, which is what makes several documents accumulate correctly. But it knows nothing about
 * Cloudinary, so naively storing its list would erase the `cloudinaryId` of every file already
 * attached and silently kill their thumbnails on the next upload. Existing entries are therefore
 * matched back by URL, and the newly uploaded id is attached to whichever entry is new.
 */
export function mergeCloudinaryMetadata(params: {
  authoritative: { url: string; name: string }[];
  existing: FileRef[];
  justAdded?: { cloudinaryId: string; resourceType: string; format: string };
  fallbackName?: string;
}): FileRef[] {
  const known = new Map(params.existing.map((f) => [f.url, f]));

  const merged: FileRef[] = params.authoritative.map((f) => {
    const prior = known.get(f.url);
    return prior
      ? { ...prior, url: f.url, name: f.name || prior.name }
      : { url: f.url, name: f.name };
  });

  if (params.justAdded) {
    // The new file is the entry the previous list did not have. If the CRM returned nothing new
    // (a name collision, or a list it chose not to grow), fall back to the last entry rather than
    // dropping the metadata — a wrong thumbnail is recoverable, a lost asset reference is not.
    const fresh = merged.filter((f) => !known.has(f.url));
    const target = fresh.length > 0 ? fresh[fresh.length - 1] : merged[merged.length - 1];
    if (target) {
      target.cloudinaryId = params.justAdded.cloudinaryId;
      target.resourceType = params.justAdded.resourceType;
      target.format = params.justAdded.format;
      if (!target.name && params.fallbackName) target.name = params.fallbackName;
    }
  }

  return merged;
}

/** Best-effort removal of the Cloudinary copy when a file is detached from the intake. */
export async function destroyStoredDocument(ref: FileRef): Promise<void> {
  if (!ref.cloudinaryId) return;
  try {
    await cloudinary.uploader.destroy(ref.cloudinaryId, {
      type: "authenticated",
      resource_type: ref.resourceType || "image",
    });
  } catch (error) {
    // Never block a delete on this. The CRM copy is the one the agent sees; an orphaned
    // Cloudinary asset is waste, not a correctness problem.
    console.warn("[iul-document-upload] could not destroy", ref.cloudinaryId, error);
  }
}
