"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { urlFor } from "@/sanity/lib/image";
import type { ScriptLang } from "./script-portable-text";

/**
 * A carrier underwriting grid, big enough to actually read.
 *
 * Two modes. "Fit" shows the whole thing so the agent can orient — that is the
 * default, because arriving at 1:1 in the top-left corner of a rate chart is
 * disorienting mid-call. "Actual size" renders at the served pixel width and lets
 * the container scroll, which is the mode that makes 8px table text legible.
 * Clicking the image toggles between them, the way every OS image viewer works,
 * so there is no button to hunt for while a client is waiting.
 */

// A hard ceiling on what we will ever download. fit('max') never upscales, so a
// smaller source is served untouched; this only stops an accidental 8000px
// upload from shipping 15 MB.
const MAX_ZOOM_WIDTH = 3000;

interface ScriptImageLightboxProps {
  value: any;
  alt: string;
  caption?: string;
  naturalWidth?: number;
  language: ScriptLang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ScriptImageLightbox({
  value,
  alt,
  caption,
  naturalWidth,
  language,
  open,
  onOpenChange,
}: ScriptImageLightboxProps) {
  const [actualSize, setActualSize] = useState(false);

  // Always reopen in fit mode. Reopening scrolled into the corner of the last
  // image you looked at is never what you want.
  useEffect(() => {
    if (open) setActualSize(false);
  }, [open]);

  /**
   * presentations-dashboard.tsx registers a bubble-phase keydown listener on
   * `document` for Ctrl/Cmd+K and "/" that opens the command palette. It clears
   * openObjectionId first so two focus traps can never stack — but it knows
   * nothing about this overlay, and isTypingTarget() returns false for the
   * <button> that has focus here, so "/" would mount the palette on top of us.
   *
   * Capture phase on `document` runs strictly before any bubble-phase listener on
   * `document`, and stopPropagation() there ends the dispatch before the bubble
   * phase is ever reached. Self-contained: the dashboard needs no change.
   *
   * Escape is deliberately NOT swallowed — Radix's layer stack owns it, and it is
   * the documented way out of this overlay.
   */
  useEffect(() => {
    if (!open) return;
    const swallow = (event: KeyboardEvent) => {
      const isPaletteKey =
        event.key === "/" ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");
      if (isPaletteKey) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", swallow, true);
    return () => document.removeEventListener("keydown", swallow, true);
  }, [open]);

  const servedWidth = Math.min(naturalWidth || 2400, MAX_ZOOM_WIDTH);
  // Radix unmounts content when closed, so this <img> only ever mounts — and only
  // ever fetches — on click. Nothing full-resolution loads with the page.
  const src = urlFor(value)
    .width(servedWidth)
    .fit("max")
    .auto("format")
    .quality(92)
    .url();

  const t = (en: string, es: string) => (language === "en" ? en : es);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        // z-[60] rather than the shared z-50: a script image can be opened from
        // inside the objection answer dialog, and that nesting is intentional —
        // Escape closes this one first and focus returns to the image button, so
        // the agent never loses the answer he was reading. Explicit beats relying
        // on DOM order at equal z. Still under z-[100] toasts.
        className="z-[60] flex h-[95vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden border-slate-700 bg-slate-900 p-0"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
            {caption || alt}
          </DialogTitle>

          <button
            type="button"
            onClick={() => setActualSize((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {actualSize ? (
              <>
                <Minimize2 className="h-4 w-4" />
                {t("Fit to screen", "Ajustar a la pantalla")}
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                {t("Actual size", "Tamaño real")}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("Close", "Cerrar")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Esc</span>
          </button>
        </header>

        <div
          className={cn(
            "min-h-0 flex-1 bg-slate-950",
            actualSize ? "overflow-auto overscroll-contain" : "overflow-hidden"
          )}
        >
          <div className="flex min-h-full min-w-full items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- Sanity's CDN
                already served exactly these pixels. In actual-size mode the
                rendered width is the intrinsic width, which next/image's `sizes`
                cannot express, and a 2400-3000px source would trigger an
                expensive per-image /_next/image transform plus a second lossy
                pass on the small text this view exists to make readable. */}
            <img
              src={src}
              alt={alt}
              draggable={false}
              onClick={() => setActualSize((v) => !v)}
              className={cn(
                "rounded",
                actualSize
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-full max-w-full cursor-zoom-in object-contain"
              )}
              // servedWidth, not naturalWidth: if the source is wider than
              // MAX_ZOOM_WIDTH we served less, and painting it at the original
              // width would upscale it back into blur.
              style={actualSize ? { width: `${servedWidth}px` } : undefined}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
