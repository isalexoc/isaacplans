/**
 * The 10-year archive of signed confirmations: one PDF per signed request, in Cloudinary.
 *
 * - `resource_type: "raw"`: stored byte for byte. With "auto", Cloudinary classifies a PDF as an
 *   image and serves derived versions, and this file is legal evidence: its hash is on the row.
 * - `type: "authenticated"`: refuses any unsigned request, the same footing as the agent's licence
 *   images and the IUL client documents (lib/iul-intake/document-upload.ts). Signed URLs are built
 *   and used here, on the server, and never handed to a browser.
 * - `overwrite: false` + a deterministic public id: a retried finalize can't replace or duplicate
 *   the archived file; it gets the existing asset back.
 *
 * Server-only: Cloudinary credentials.
 */

import "server-only";
import cloudinary from "@/config/cloudinary";
import { sha256Hex } from "./evidence";

const FOLDER = "aca-confirmations";
const FETCH_TIMEOUT_MS = 20_000;
const SIGNED_URL_TTL_SECONDS = 300;

type UploadResult = { public_id: string; bytes?: number; existing?: boolean };

/**
 * Archive the PDF and return the bytes that are ACTUALLY archived. Normally those are the bytes
 * passed in. On a retry after an upload that was never recorded, Cloudinary keeps the earlier file
 * (overwrite: false) and that earlier file is what's returned: every later copy (the CRM Documents
 * file) and the recorded hash must be of the archived file, not of a fresh render, because react-pdf
 * output isn't byte-identical between renders. If the existing file can't be read back, this throws
 * rather than record a hash that doesn't match the archive.
 */
export async function storeConfirmationPdf(p: {
  id: string;
  pdf: Buffer;
}): Promise<{ publicId: string; bytes: number; sha256: string; pdf: Buffer }> {
  const result = await new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        // Raw public ids keep their extension; one per confirmation, so a retry finds the same asset.
        public_id: `${p.id}.pdf`,
        resource_type: "raw",
        type: "authenticated",
        overwrite: false,
      },
      (error, uploaded) => {
        if (error || !uploaded?.public_id) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(uploaded as UploadResult);
      }
    );
    stream.end(p.pdf);
  });

  if (result.existing) {
    // A previous attempt got the file up but never recorded it. The archived copy is the one the
    // row will point to, so hash and hand on what is actually stored, not what this attempt rendered.
    const stored = await fetchStoredConfirmationPdf(result.public_id);
    if (!stored) throw new Error(`Archived PDF ${result.public_id} exists but could not be read back`);
    return { publicId: result.public_id, bytes: stored.length, sha256: sha256Hex(stored), pdf: stored };
  }
  return { publicId: result.public_id, bytes: result.bytes ?? p.pdf.length, sha256: sha256Hex(p.pdf), pdf: p.pdf };
}

/**
 * Two signed URLs, tried in order:
 *  1. a signed delivery URL (res.cloudinary.com/…/raw/authenticated/s--sig--/…), the same scheme
 *     the licence images and the shareable call audio use;
 *  2. the Admin API's private download URL (signed with the API secret, expires in 5 minutes),
 *     which works even if the account restricts delivery of PDF files.
 */
function signedUrls(publicId: string): string[] {
  return [
    cloudinary.url(publicId, { resource_type: "raw", type: "authenticated", sign_url: true, secure: true }),
    cloudinary.utils.private_download_url(publicId, "", {
      resource_type: "raw",
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
    }),
  ];
}

/** The archived PDF's bytes, or null. Only ever called with a public id read from our own row. */
export async function fetchStoredConfirmationPdf(publicId: string): Promise<Buffer | null> {
  for (const url of signedUrls(publicId)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return bytes;
    } catch (error) {
      console.warn("[aca-confirmation] stored PDF fetch failed:", error);
    }
  }
  console.warn("[aca-confirmation] stored PDF unavailable:", publicId);
  return null;
}
