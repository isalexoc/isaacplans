"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react";
import { extractIllustrationRequest } from "@/lib/illustration-studio/api";
import { extractPdfPages, PdfTextError } from "@/lib/illustration-studio/pdf-text";

/** Mirrors `extractRequestSchema`: past this the server would reject the page list. */
const MAX_PAGES = 150;

type Stage = "idle" | "reading" | "extracting" | "opening";

const STAGE_LABEL: Record<Exclude<Stage, "idle">, string> = {
  reading: "Reading the PDF…",
  extracting: "Pulling out the premium, cash values and living benefits…",
  opening: "Opening the editor…",
};

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/**
 * Takes an illustration PDF and opens its draft summary.
 *
 * The PDF never leaves the browser: its text is read here (see lib/illustration-studio/pdf-text.ts)
 * and only that text is sent, so Vercel's 4.5 MB request cap can't reject an illustration with
 * photos in it.
 */
export default function IllustrationUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const busy = stage !== "idle";

  // The AI step takes 10–30 s; a running count shows it hasn't hung.
  useEffect(() => {
    if (stage !== "extracting") return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  async function process(file: File) {
    if (busy) return;
    setError(null);
    if (!isPdf(file)) {
      setError("That isn't a PDF. Download the illustration as a PDF from the carrier's quoting software.");
      return;
    }
    setFileName(file.name);
    try {
      setStage("reading");
      const pages = await extractPdfPages(new Uint8Array(await file.arrayBuffer()));
      if (pages.length > MAX_PAGES) {
        throw new PdfTextError(`This PDF has ${pages.length} pages; illustrations are rarely over 60. Is it the right file?`);
      }
      setStage("extracting");
      const id = await extractIllustrationRequest({ fileName: file.name, pages });
      setStage("opening");
      router.push(`/en/admin/illustration-studio/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this illustration.");
      setStage("idle");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void process(file);
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Upload className="h-5 w-5" /> New summary
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Americo, American Amicable, F&amp;G, Mutual of Omaha, Transamerica or National Life — any IUL
        illustration PDF with selectable text. The PDF stays on this computer; only its text is read.
      </p>

      <label
        htmlFor="is-file"
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragging ? "border-brand bg-brand/5" : "border-muted-foreground/25 hover:border-brand/60"
        } ${busy ? "pointer-events-none opacity-90" : ""}`}
      >
        {busy ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-brand" />
            <span className="text-sm font-medium">{STAGE_LABEL[stage]}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {fileName}
              {stage === "extracting" ? ` · ${seconds}s` : null}
            </span>
          </>
        ) : (
          <>
            <FileText className="h-7 w-7 text-muted-foreground" />
            <span className="text-sm font-medium">Drop the illustration PDF here, or click to choose it</span>
            <span className="text-xs text-muted-foreground">Takes 10–30 seconds</span>
          </>
        )}
      </label>
      <input
        id="is-file"
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void process(file);
        }}
      />

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
