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
