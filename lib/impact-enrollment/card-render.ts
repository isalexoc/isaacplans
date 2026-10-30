/**
 * Turns the Impact member ID card PDF into one JPG, for the text message and WhatsApp.
 *
 * Browser-only. The card PDF is not a photo: Impact builds it from text and vector art (front and
 * back, 241×162 pt each), so there is no image inside to pull out. pdf.js draws each page onto a
 * canvas instead, and the two sides are stacked front over back. That way one image shows the
 * whole card, which is what a phone displays well. A PDF sent by text often doesn't open at all.
 *
 * Done in the agent's browser, so the card goes nowhere but the CRM.
 */

const SIDE_WIDTH_PX = 1200;
const GAP_PX = 32;
const MAX_PAGES = 2;
const JPEG_QUALITY = 0.88;

export type RenderedCard = {
  image: Blob;
  /** Object URL for the dialog's preview. Revoke it when the preview goes away. */
  previewUrl: string;
  pages: number;
};

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the card image."))), "image/jpeg", JPEG_QUALITY)
  );
}

export async function renderCardImage(pdf: File): Promise<RenderedCard> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
  try {
    const sides: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: SIDE_WIDTH_PX / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      sides.push(canvas);
    }

    const out = document.createElement("canvas");
    out.width = SIDE_WIDTH_PX;
    out.height = sides.reduce((h, c) => h + c.height, 0) + GAP_PX * (sides.length - 1);
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    let y = 0;
    for (const side of sides) {
      ctx.drawImage(side, 0, y);
      y += side.height + GAP_PX;
    }

    const image = await canvasToJpeg(out);
    return { image, previewUrl: URL.createObjectURL(image), pages: sides.length };
  } finally {
    await doc.destroy();
  }
}
