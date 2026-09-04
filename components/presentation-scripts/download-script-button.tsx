"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ObjectionLob } from "@/lib/objections/types";
import { downloadScriptPdf } from "@/lib/presentation-scripts/api";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

/**
 * Downloads the "Complete Script (All-in-One)" for the product currently on screen.
 *
 * One button, one output. The per-section script and the objection cards are for reading on
 * screen, where they are searchable and collapsible; on paper the all-in-one is the thing an agent
 * wants in front of them. Language follows the dashboard's own EN/ES toggle rather than adding a
 * second language control — the toggle is a few inches away.
 */

const COPY = {
  en: {
    download: "Download PDF",
    building: "Building PDF…",
    empty: "No Complete Script published for this product yet.",
  },
  es: {
    download: "Descargar PDF",
    building: "Creando PDF…",
    empty: "Todavía no hay Guión Completo publicado para este producto.",
  },
} as const;

export interface DownloadScriptButtonProps {
  lineOfBusiness: ObjectionLob;
  language: ScriptLang;
  /** No Complete Script in this language: the button would only ever produce an empty file. */
  hasCompleteScript?: boolean;
}

export default function DownloadScriptButton({
  lineOfBusiness,
  language,
  hasCompleteScript = false,
}: DownloadScriptButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[language];

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await downloadScriptPdf({ lineOfBusiness, language });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.empty);
    } finally {
      setBusy(false);
    }
  };

  if (!hasCompleteScript) return null;

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <Button size="sm" onClick={() => void run()} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="mr-2 h-4 w-4" aria-hidden />
        )}
        <span className="whitespace-nowrap">{busy ? t.building : t.download}</span>
      </Button>

      {error ? (
        <p aria-live="polite" className="max-w-[240px] text-xs text-destructive sm:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
