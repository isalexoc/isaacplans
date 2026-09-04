"use client";

import { useState } from "react";
import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { urlFor } from "@/sanity/lib/image";
import ScriptImageLightbox from "./script-image-lightbox";
import type { ScriptLang } from "./script-portable-text";

export type ScriptImageSize = "small" | "standard" | "wide" | "full";

/**
 * The four author-facing sizes, and what each one costs.
 *
 * `cap` is the CSS width ceiling. `cdn` is what we ask Sanity for: 2x the cap, so
 * the image is still sharp on a Retina laptop, and no more than that so an
 * underwriting grid isn't a multi-megabyte download. fit('max') never upscales,
 * so a source narrower than `cdn` is simply served at its own size.
 *
 * `full` has no cap: it fills the column, which is ~1216px inside the script
 * accordion (max-w-7xl page - px-4 - the card's p-4) and ~728px inside the
 * objection answer dialog (max-w-3xl - px-5). 2400 covers the wider of the two
 * at 2x; over-supplying the narrower one just means it is extra sharp.
 */
const SIZES: Record<
  ScriptImageSize,
  { cap: number | null; cdn: number; className: string }
> = {
  small: { cap: 320, cdn: 640, className: "max-w-[220px] sm:max-w-[320px]" },
  standard: { cap: 560, cdn: 1200, className: "max-w-full sm:max-w-[560px]" },
  wide: { cap: 900, cdn: 1800, className: "max-w-full lg:max-w-[900px]" },
  full: { cap: null, cdn: 2400, className: "max-w-full" },
};

/**
 * Images authored before the size field existed have no value. They fall back to
 * `wide`, NOT to the old hardcoded 500px — 500px is the bug being fixed, and
 * every image already in a script is a screenshot or a chart that was too small
 * to read. Nothing crops, and `naturalCap` below means nothing is ever upscaled
 * past its own pixels, so this can only be an improvement.
 */
const DEFAULT_SIZE: ScriptImageSize = "wide";

/**
 * Sanity encodes the real pixel dimensions in the asset id
 * ("image-<hash>-2400x1600-png"), so we get them without dereferencing the asset
 * — which matters, because PRESENTATION_SCRIPT_QUERY and OBJECTIONS_QUERY both
 * project the block arrays raw and never expand `asset`.
 *
 * This replaces the fabricated width={500} height={600}: that 5:6 box is not the
 * aspect ratio of anything, so every image reserved the wrong space while loading.
 */
export function sanityImageDimensions(
  ref?: string
): { width: number; height: number } | null {
  const match = /-(\d+)x(\d+)-[a-z]+$/.exec(ref ?? "");
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export default function ScriptImage({
  value,
  language,
}: {
  value: any;
  language: ScriptLang;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!value?.asset) return null;

  const size = SIZES[(value.size as ScriptImageSize) ?? DEFAULT_SIZE] ?? SIZES[DEFAULT_SIZE];
  const dims = sanityImageDimensions(value.asset?._ref);
  const alt = value.alt || (language === "en" ? "Script image" : "Imagen del guión");

  // Sanity's CDN does the resizing, at 2x the CSS cap. auto('format') serves WebP
  // to Chrome and JPEG to anything that can't take it; quality 90 rather than the
  // usual 75 because ringing artefacts around 8px table text is the exact failure
  // mode this whole change exists to fix.
  const src = urlFor(value).width(size.cdn).fit("max").auto("format").quality(90).url();

  // Never display an image wider than its own pixels. This is what makes both the
  // legacy fallback and "Full width" safe: a 300px carrier logo stays 300px
  // instead of being stretched to the cap and going soft. Inline style beats the
  // Tailwind class, and is only set when the source is actually the narrower of
  // the two, so the two mechanisms never fight.
  const naturalCap =
    dims && (size.cap === null || dims.width < size.cap) ? dims.width : null;

  return (
    <figure className="my-4 flex flex-col items-center">
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        aria-label={
          language === "en"
            ? `Open image full screen: ${alt}`
            : `Abrir imagen en pantalla completa: ${alt}`
        }
        // A button, so Enter and Space work with no keydown handler of our own.
        className="group relative block w-full cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4D8] focus-visible:ring-offset-2"
        style={{
          ...(size.cap !== null ? {} : {}),
          ...(naturalCap ? { maxWidth: `${naturalCap}px` } : {}),
        }}
      >
        <span className={`block w-full ${naturalCap ? "" : size.className}`}>
          <Image
            src={src}
            alt={alt}
            width={dims?.width ?? size.cdn}
            height={dims?.height ?? Math.round(size.cdn * 0.625)}
            // Sanity already delivered exactly the pixels we asked for. Routing it
            // through /_next/image would re-encode at quality 75 and mush the small
            // text — and cost a per-image transform on an admin-only page.
            unoptimized
            className="h-auto w-full rounded-lg shadow-md ring-1 ring-black/5 transition group-hover:ring-2 group-hover:ring-[#00B4D8] dark:ring-white/10"
          />
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-slate-900/70 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>

      {value.caption && (
        <figcaption className="mt-2 text-center text-xs italic text-muted-foreground">
          {value.caption}
        </figcaption>
      )}

      <ScriptImageLightbox
        value={value}
        alt={alt}
        caption={value.caption}
        naturalWidth={dims?.width}
        language={language}
        open={zoomOpen}
        onOpenChange={setZoomOpen}
      />
    </figure>
  );
}
