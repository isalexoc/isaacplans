/**
 * Browser-side image downscaling for intake uploads.
 *
 * Why this exists: the ACA intake asks clients to photograph a green card or work permit on
 * their phone. Modern phone cameras produce 4–12 MB JPEGs, and Vercel's serverless request
 * body cap is 4.5 MB — so an untouched photo is rejected before it ever reaches the route
 * handler. Downscaling in the browser turns a typical 8 MB photo into ~400 KB, which also
 * makes the upload finish in a couple of seconds on cell data.
 *
 * Everything here degrades safely: any failure returns the original file and lets the server
 * size check produce the error message.
 */

/** Matches MAX_FILE_BYTES in app/api/aca-intake/[token]/files/route.ts. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type CompressOptions = {
  /** Longest edge of the output, in pixels. 1600 keeps card text comfortably readable. */
  maxEdge?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
  /** Skip compression for images already under this size. */
  skipBelowBytes?: number;
};

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 1600,
  quality: 0.8,
  skipBelowBytes: 400 * 1024,
};

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

/** HEIC/HEIF cannot be drawn to a canvas in most browsers — leave those to the server check. */
function isCanvasDecodable(file: File): boolean {
  return !/hei[cf]/i.test(file.type);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    // `from-image` applies EXIF orientation, so portrait phone photos are not rotated.
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    // Revoke on the next tick so the decode has definitely read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Downscale an image file so it fits comfortably under the upload cap.
 * Non-images, tiny images, and anything that fails to decode are returned untouched.
 */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxEdge, quality, skipBelowBytes } = { ...DEFAULTS, ...options };

  if (!isImage(file) || !isCanvasDecodable(file)) return file;
  if (file.size <= skipBelowBytes) return file;

  try {
    const bitmap = await loadBitmap(file);
    const width = "width" in bitmap ? bitmap.width : 0;
    const height = "height" in bitmap ? bitmap.height : 0;
    if (!width || !height) return file;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    let blob = await canvasToBlob(canvas, quality);
    // One more pass at lower quality if a very large photo is still over the cap.
    if (blob && blob.size > MAX_UPLOAD_BYTES) {
      blob = await canvasToBlob(canvas, 0.6);
    }
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Any decode/encode problem → upload the original and let the server size check speak.
    return file;
  }
}

/** Human-readable size for error messages ("6.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
