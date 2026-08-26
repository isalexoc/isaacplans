/**
 * Whether a stored document can show a thumbnail. Shared by the server and the form UI.
 *
 * Deliberately NOT in `document-upload.ts`: that module is `server-only` because it holds
 * Cloudinary and CRM credentials, and the agent's file list is a client component. Importing the
 * server module from the browser is a build error, so the one predicate both sides need lives
 * here, with no imports of its own.
 */

import type { FileRef } from "./fields";

/**
 * Formats Cloudinary can render a still image of.
 *
 * PDFs are included, and the contrast with the conversion allow-list in `document-upload.ts` is
 * deliberate: a *thumbnail* of page one is exactly what belongs in a list, whereas *replacing* a
 * stored PDF with page one would destroy the document. Same transformation, opposite intent.
 */
const PREVIEWABLE = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "heic",
  "heif",
  "avif",
  "tif",
  "tiff",
  "pdf",
]);

/**
 * False for anything attached before previews existed, and for formats with no still image to
 * show. Both are ordinary states, not failures — the file is there and its link opens it — so
 * every caller renders an icon rather than a broken frame.
 */
export function canPreview(
  ref: Pick<FileRef, "cloudinaryId" | "format" | "resourceType">
): boolean {
  if (!ref.cloudinaryId) return false;
  if (ref.resourceType && ref.resourceType !== "image") return false;
  return PREVIEWABLE.has((ref.format ?? "").toLowerCase());
}
