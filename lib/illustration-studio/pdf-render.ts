/**
 * Renders a presentation to the two-page PDF.
 *
 * Images are fetched up front as Buffers in a format react-pdf can decode (it reads only PNG and
 * JPEG, and Cloudinary's f_auto would hand it WebP), then cached for the life of the server
 * instance — the same handful of logos and photos serve every summary. A failed fetch is not
 * cached and never fails the render: the pages fall back to a text wordmark or a tinted panel.
 *
 * Not `server-only`: scripts/test-illustration-studio.ts renders fixtures with it.
 */

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { carrierLogoUrl, getCarrier } from "./carriers";
import { coverPhotoUrl } from "./cover-photos";
import { IllustrationSummaryDocument } from "./pdf/document";
import type { SummaryAssets } from "./pdf/theme";
import type { PresentationData } from "./types";

const IMAGE_TIMEOUT_MS = 8000;
/** Requested at twice the size they print, so they stay sharp when zoomed on a screen share. */
const LOGO_HEIGHT_PX = 240;
const COVER_PHOTO_PX = { width: 1224, height: 910 };

const imageCache = new Map<string, Promise<Buffer | null>>();

function fetchImage(url: string): Promise<Buffer | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const pending = (async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      console.warn(`[illustration-studio] image unavailable (${url}):`, error);
      imageCache.delete(url);
      return null;
    }
  })();
  imageCache.set(url, pending);
  return pending;
}

export async function loadSummaryAssets(presentation: PresentationData): Promise<SummaryAssets> {
  const carrier = getCarrier(presentation.carrierKey);
  const [coverPhoto, logo, coverLogo] = await Promise.all([
    fetchImage(coverPhotoUrl(presentation.coverPhoto, COVER_PHOTO_PX.width, COVER_PHOTO_PX.height)),
    carrier.logo ? fetchImage(carrierLogoUrl(carrier.logo, LOGO_HEIGHT_PX)) : Promise.resolve(null),
    carrier.coverLogo ? fetchImage(carrierLogoUrl(carrier.coverLogo, LOGO_HEIGHT_PX)) : Promise.resolve(null),
  ]);
  return { coverPhoto, logo, coverLogo };
}

export async function renderSummaryPdf(presentation: PresentationData): Promise<Buffer> {
  const assets = await loadSummaryAssets(presentation);
  const document = createElement(IllustrationSummaryDocument, { presentation, assets });
  return renderToBuffer(document as unknown as ReactElement<DocumentProps>);
}
