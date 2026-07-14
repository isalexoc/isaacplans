/**
 * Client-side capture helpers for the sale sticker.
 * html2canvas is dynamically imported so this module stays import-safe on the server.
 */
import {
  SALE_STICKER_RENDER_SIZE,
  SALE_STICKER_OUTPUT_SIZE,
  WHATSAPP_STICKER_SIZE,
} from "@/lib/sale-sticker-assets";

const WHATSAPP_MAX_BYTES = 100 * 1024;

/** Wait for layout to settle and all images (Cloudinary photo/logo/extra) to finish loading. */
export async function prepareStickerNode(el: HTMLElement): Promise<void> {
  el.scrollIntoView({ behavior: "auto", block: "center" });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 50));

  const images = el.querySelectorAll<HTMLImageElement>("img");
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          // Background-removal derivatives can take several seconds on first generation.
          setTimeout(resolve, 12000);
        })
    )
  );
}

async function renderCanvas(
  el: HTMLElement,
  opts: { backgroundColor: string | null; scale: number }
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(el, {
    backgroundColor: opts.backgroundColor,
    scale: opts.scale,
    logging: false,
    useCORS: true,
    imageTimeout: 15000,
    width: SALE_STICKER_RENDER_SIZE,
    height: SALE_STICKER_RENDER_SIZE,
    windowWidth: SALE_STICKER_RENDER_SIZE,
    windowHeight: SALE_STICKER_RENDER_SIZE,
  });
}

/** Downscale a rendered canvas onto a fresh 512×512 transparent canvas. */
function downscaleToSticker(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const out = document.createElement("canvas");
  out.width = WHATSAPP_STICKER_SIZE;
  out.height = WHATSAPP_STICKER_SIZE;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/** Rich 1080×1080 opaque PNG for sending as a WhatsApp photo. */
export async function captureRichStickerPng(
  el: HTMLElement,
  fallbackBackground: string
): Promise<Blob | null> {
  await prepareStickerNode(el);
  const scale = SALE_STICKER_OUTPUT_SIZE / SALE_STICKER_RENDER_SIZE;
  const canvas = await renderCanvas(el, { backgroundColor: fallbackBackground, scale });
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
  });
}

/**
 * True WhatsApp tray sticker: 512×512 transparent WebP, tuned toward ≤100 KB.
 */
export async function captureWhatsAppStickerWebp(el: HTMLElement): Promise<Blob | null> {
  await prepareStickerNode(el);
  const source = await renderCanvas(el, { backgroundColor: null, scale: 2 });
  const out = downscaleToSticker(source);
  if (!out) return null;

  const qualities = [0.92, 0.85, 0.75, 0.6, 0.45];
  let best: Blob | null = null;
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob((b) => resolve(b), "image/webp", q)
    );
    if (!blob) continue;
    best = blob;
    if (blob.size <= WHATSAPP_MAX_BYTES) break;
  }
  return best;
}

/**
 * Capture a single animation frame as a 512×512 transparent PNG.
 * Call prepareStickerNode(el) once before looping so images are already loaded.
 */
export async function captureStickerFramePng(el: HTMLElement): Promise<Blob | null> {
  const source = await renderCanvas(el, { backgroundColor: null, scale: 2 });
  const out = downscaleToSticker(source);
  if (!out) return null;
  return new Promise<Blob | null>((resolve) => {
    out.toBlob((b) => resolve(b), "image/png");
  });
}

/** Trigger a browser download for a captured blob. */
export function downloadStickerBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
