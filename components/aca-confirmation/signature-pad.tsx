"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Dancing_Script } from "next/font/google";
import { Eraser, PenLine, Type } from "lucide-react";
import { MIN_DRAWN_POINTS, cleanPersonName } from "@/lib/aca-confirmation/format";
import { PAGE_UI, tr } from "@/lib/aca-confirmation/page-strings";
import type { AcaConfirmationLanguage, SignatureStroke } from "@/lib/aca-confirmation/types";

/**
 * The signature input on the client's signing page: draw (default) or type.
 *
 * Both modes end as ONE transparent PNG, so the server and the PDF treat them the same and the
 * PDF needs no cursive font of its own. A drawn signature also keeps its strokes (points with
 * timestamps): a hand-drawn mark is the stronger evidence, and from plan year 2028 CMS won't
 * accept a typed one at all (the Type tab is hidden when the form version disallows it).
 */

const script = Dancing_Script({ subsets: ["latin", "latin-ext"], weight: "600", display: "swap" });

export type SignatureValue =
  | { method: "drawn"; png: string; strokes: SignatureStroke[] }
  | { method: "typed"; png: string; typedName: string };

const PAD_HEIGHT = 180;
const MAX_PIXEL_RATIO = 2;
const INK = "#0f172a";

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export default function SignatureInput({
  language,
  allowTyped,
  defaultTypedName,
  disabled = false,
  onChange,
}: {
  language: AcaConfirmationLanguage;
  allowTyped: boolean;
  defaultTypedName: string;
  disabled?: boolean;
  onChange: (value: SignatureValue | null) => void;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");

  function switchTo(next: "draw" | "type") {
    if (next === mode) return;
    setMode(next);
    onChange(null); // the other mode's value never carries over
  }

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
      active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div>
      {allowTyped && (
        <div role="tablist" aria-label={tr(PAGE_UI.signatureHeading, language)} className="mb-3 flex gap-1 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "draw"}
            className={tabClass(mode === "draw")}
            onClick={() => switchTo("draw")}
            disabled={disabled}
          >
            <PenLine className="h-4 w-4" /> {tr(PAGE_UI.tabDraw, language)}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "type"}
            className={tabClass(mode === "type")}
            onClick={() => switchTo("type")}
            disabled={disabled}
          >
            <Type className="h-4 w-4" /> {tr(PAGE_UI.tabType, language)}
          </button>
        </div>
      )}
      {mode === "draw" || !allowTyped ? (
        <DrawPad language={language} disabled={disabled} onChange={onChange} />
      ) : (
        <TypePad language={language} disabled={disabled} defaultTypedName={defaultTypedName} onChange={onChange} />
      )}
    </div>
  );
}

// ─── Draw ────────────────────────────────────────────────────────────────────

/** Crop the canvas to the ink (plus a margin), so the PDF prints the signature, not empty space. */
function croppedPng(canvas: HTMLCanvasElement, strokes: SignatureStroke[], ratio: number): string {
  const points = strokes.flatMap((s) => s.points);
  const margin = 10;
  const cssWidth = canvas.width / ratio;
  const cssHeight = canvas.height / ratio;
  const minX = Math.max(0, Math.min(...points.map((p) => p.x)) - margin);
  const minY = Math.max(0, Math.min(...points.map((p) => p.y)) - margin);
  const maxX = Math.min(cssWidth, Math.max(...points.map((p) => p.x)) + margin);
  const maxY = Math.min(cssHeight, Math.max(...points.map((p) => p.y)) + margin);
  // The server rejects images under 50×20 px; a tiny signature keeps the full pad instead.
  if ((maxX - minX) * ratio < 60 || (maxY - minY) * ratio < 30) return canvas.toDataURL("image/png");
  const out = document.createElement("canvas");
  out.width = Math.round((maxX - minX) * ratio);
  out.height = Math.round((maxY - minY) * ratio);
  out.getContext("2d")?.drawImage(canvas, minX * ratio, minY * ratio, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function DrawPad({
  language,
  disabled,
  onChange,
}: {
  language: AcaConfirmationLanguage;
  disabled: boolean;
  onChange: (value: SignatureValue | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const ratioRef = useRef(1);
  const onChangeRef = useRef(onChange);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const report = useCallback(() => {
    const pad = padRef.current;
    const canvas = canvasRef.current;
    if (!pad || !canvas) return;
    const strokes: SignatureStroke[] = pad.toData().map((group) => ({
      points: group.points.map((p) => ({
        x: round(p.x, 1),
        y: round(p.y, 1),
        time: Math.round(p.time),
        pressure: round(p.pressure, 3),
      })),
    }));
    const total = strokes.reduce((sum, s) => sum + s.points.length, 0);
    setHasInk(total > 0);
    if (total < MIN_DRAWN_POINTS) {
      onChangeRef.current(null);
      return;
    }
    onChangeRef.current({ method: "drawn", png: croppedPng(canvas, strokes, ratioRef.current), strokes });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const pad = new SignaturePad(canvas, {
      penColor: INK,
      minWidth: 0.9,
      maxWidth: 2.8,
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;
    let lastWidth = 0;

    // The signature_pad README way: size the bitmap for the device's pixel ratio, then redraw the
    // strokes from data. Without it the ink is blurry on phones, and a rotate wipes it.
    const resize = () => {
      const width = Math.round(wrap.clientWidth);
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_PIXEL_RATIO);
      if (!width || (width === lastWidth && ratio === ratioRef.current)) return;
      lastWidth = width;
      ratioRef.current = ratio;
      const data = pad.toData();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(PAD_HEIGHT * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${PAD_HEIGHT}px`;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.fromData(data); // clears, then redraws at the new size
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    pad.addEventListener("endStroke", report);

    return () => {
      observer.disconnect();
      pad.removeEventListener("endStroke", report);
      pad.off();
      padRef.current = null;
    };
  }, [report]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) pad.off();
    else pad.on();
  }, [disabled]);

  function clear() {
    padRef.current?.clear();
    report();
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-white"
        style={{ height: PAD_HEIGHT }}
      >
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-gray-400">
            {tr(PAGE_UI.drawHint, language)}
          </span>
        )}
        {/* The signing line: printed under the ink, so it never ends up in the PNG. */}
        <span className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-gray-300" />
        <canvas
          ref={canvasRef}
          aria-label={tr(PAGE_UI.drawAria, language)}
          className="relative block touch-none select-none"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          <Eraser className="h-4 w-4" /> {tr(PAGE_UI.clear, language)}
        </button>
      </div>
    </div>
  );
}

// ─── Type ────────────────────────────────────────────────────────────────────

const TYPED_WIDTH = 900;
const TYPED_HEIGHT = 220;

/** Draw the typed name in the cursive font onto a canvas sized to the text. */
async function renderTypedSignature(text: string): Promise<string> {
  const family = script.style.fontFamily;
  try {
    await document.fonts.load(`600 96px ${family}`, text);
  } catch {
    /* the fallback cursive in `family` still draws */
  }
  const measure = document.createElement("canvas").getContext("2d");
  let size = 110;
  if (measure) {
    measure.font = `600 ${size}px ${family}`;
    while (size > 36 && measure.measureText(text).width > TYPED_WIDTH - 60) {
      size -= 4;
      measure.font = `600 ${size}px ${family}`;
    }
  }
  const textWidth = measure ? measure.measureText(text).width : TYPED_WIDTH - 60;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(200, Math.min(TYPED_WIDTH, Math.ceil(textWidth) + 60));
  canvas.height = TYPED_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.font = `600 ${size}px ${family}`;
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 30, TYPED_HEIGHT / 2 + 6);
  return canvas.toDataURL("image/png");
}

function TypePad({
  language,
  disabled,
  defaultTypedName,
  onChange,
}: {
  language: AcaConfirmationLanguage;
  disabled: boolean;
  defaultTypedName: string;
  onChange: (value: SignatureValue | null) => void;
}) {
  // Starts empty on purpose: the client types their own name (CMS FAQ Q14 wants evidence that the
  // consumer typed it). The legal name is only the placeholder.
  const [name, setName] = useState("");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const typedName = cleanPersonName(name);
    if (typedName.length < 2) {
      onChangeRef.current(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderTypedSignature(typedName)
        .then((png) => !cancelled && onChangeRef.current({ method: "typed", png, typedName }))
        .catch(() => !cancelled && onChangeRef.current(null));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [name]);

  return (
    <div>
      <label htmlFor="aca-typed-name" className="mb-1.5 block text-sm font-semibold text-gray-900">
        {tr(PAGE_UI.typeLabel, language)}
      </label>
      <input
        id="aca-typed-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
        placeholder={defaultTypedName}
        autoComplete="off"
        maxLength={120}
        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-lg text-gray-900 focus:border-brand focus:outline-none"
      />
      <p className="mb-1 mt-3 text-xs text-gray-500">{tr(PAGE_UI.typePreview, language)}</p>
      <div className="flex min-h-[96px] items-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-white px-5">
        <span className={`${script.className} block truncate text-4xl text-slate-900`}>{cleanPersonName(name)}</span>
      </div>
    </div>
  );
}
