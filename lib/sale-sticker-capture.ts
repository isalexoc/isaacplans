/**
 * Client-side capture helpers for the sale sticker.
 * Nodes use natural block flow, so we measure and capture their real size
 * (html2canvas renders block flow reliably). The WhatsApp sticker is then
 * fit onto a 512×512 square (WhatsApp requires exactly 512²).
 * html2canvas is dynamically imported so this module stays import-safe on the server.
 */
import { SALE_STICKER_RENDER_SIZE, WHATSAPP_STICKER_SIZE } from "@/lib/sale-sticker-assets";

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

function measureNode(el: HTMLElement): { width: number; height: number } {
  const width = Math.ceil(el.offsetWidth || SALE_STICKER_RENDER_SIZE);
  const height = Math.ceil(el.scrollHeight || el.offsetHeight) + 2;
  return { width, height };
}

async function renderNatural(
  el: HTMLElement,
  opts: { backgroundColor: string | null; scale: number }
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  const { width, height } = measureNode(el);
  return html2canvas(el, {
    backgroundColor: opts.backgroundColor,
    scale: opts.scale,
    logging: false,
    useCORS: true,
    imageTimeout: 15000,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  });
}

/** Draw a rendered canvas onto a transparent size×size square, scaled to fit + centered. */
function fitToSquare(source: HTMLCanvasElement, size: number): HTMLCanvasElement | null {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.min(size / source.width, size / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
  return out;
}

/** Rich, natural-aspect opaque PNG for sending as a WhatsApp photo. */
export async function captureRichStickerPng(
  el: HTMLElement,
  fallbackBackground: string
): Promise<Blob | null> {
  await prepareStickerNode(el);
  const canvas = await renderNatural(el, { backgroundColor: fallbackBackground, scale: 2 });
  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1.0));
}

/** True WhatsApp tray sticker: 512×512 transparent WebP, tuned toward ≤100 KB. */
export async function captureWhatsAppStickerWebp(el: HTMLElement): Promise<Blob | null> {
  await prepareStickerNode(el);
  const source = await renderNatural(el, { backgroundColor: null, scale: 2 });
  const out = fitToSquare(source, WHATSAPP_STICKER_SIZE);
  if (!out) return null;

  const qualities = [0.92, 0.85, 0.75, 0.6, 0.45];
  let best: Blob | null = null;
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), "image/webp", q));
    if (!blob) continue;
    best = blob;
    if (blob.size <= WHATSAPP_MAX_BYTES) break;
  }
  return best;
}

/**
 * One animated-sticker frame: 512×512 transparent PNG (for animated WebP).
 * Call prepareStickerNode(el) once before looping.
 */
export async function captureStickerFramePng(el: HTMLElement): Promise<Blob | null> {
  const source = await renderNatural(el, { backgroundColor: null, scale: 2 });
  const out = fitToSquare(source, WHATSAPP_STICKER_SIZE);
  if (!out) return null;
  return new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), "image/png"));
}

/**
 * One GIF frame: natural-aspect OPAQUE PNG. Layout is constant across phases,
 * so all frames share the same dimensions. Call prepareStickerNode(el) once first.
 */
export async function captureImageFramePng(el: HTMLElement, background: string): Promise<Blob | null> {
  const canvas = await renderNatural(el, { backgroundColor: background, scale: 1 });
  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
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
