"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { fetchPdfObjectUrl } from "@/lib/illustration-studio/api";

/**
 * The two pages exactly as they'll print — rendered by the same server route as Download, so the
 * preview can't drift from the real PDF. Re-fetched whenever `version` ticks (after each completed
 * save); the previous render stays up until the new one arrives.
 */
export default function PdfPreview({ id, version }: { id: string; version: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPdfObjectUrl(id)
      .then((next) => {
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        const previous = urlRef.current;
        urlRef.current = next;
        setUrl(next);
        setError(null);
        if (previous) URL.revokeObjectURL(previous);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return (
    <div className="relative h-full overflow-hidden rounded-lg border bg-muted/40">
      {url && <iframe title="Summary preview" src={`${url}#view=FitH`} className="h-full w-full" />}
      {loading && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering…
        </div>
      )}
      {error && (
        <div className="absolute inset-x-3 bottom-3 flex items-start gap-1.5 rounded-md bg-red-50 p-3 text-sm text-red-700 shadow dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
