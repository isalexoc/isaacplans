"use client";

import { useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ObjectionLob } from "@/lib/objections/types";
import { downloadScriptPdf } from "@/lib/presentation-scripts/api";
import {
  LANGUAGE_LABEL,
  type ScriptPdfLanguage,
  type ScriptPdfVariant,
} from "@/lib/presentation-scripts/format";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

/**
 * "Download PDF" for the product currently on screen.
 *
 * A split button: the left half does the obvious thing in one click (everything, in the language
 * the dashboard is already set to), and the caret holds the narrower cuts. Language deliberately
 * follows the dashboard's own EN/ES toggle rather than adding a second language control — with one
 * exception, the explicit "Both languages" item, which is the bilingual binder case.
 */

const COPY = {
  en: {
    download: "Download PDF",
    building: "Building PDF…",
    full: "Script + objections",
    script: "Script only",
    objections: "Objection cards only",
    complete: "Complete script (all-in-one)",
    both: "Both languages (EN + ES)",
    empty: "Nothing published to print for this product yet.",
  },
  es: {
    download: "Descargar PDF",
    building: "Creando PDF…",
    full: "Guión + objeciones",
    script: "Solo el guión",
    objections: "Solo las objeciones",
    complete: "Guión completo (todo en uno)",
    both: "Ambos idiomas (EN + ES)",
    empty: "Todavía no hay nada publicado para este producto.",
  },
} as const;

export interface DownloadScriptButtonProps {
  lineOfBusiness: ObjectionLob;
  /** The product name, shown in the menu so it is obvious what is about to be exported. */
  productName: string;
  language: ScriptLang;
  /** Disables the two menu items that would produce an empty file. */
  hasCompleteScript?: boolean;
  objectionCount?: number;
  /** No script document and no objection cards: there is nothing to export at all. */
  hasAnything?: boolean;
}

export default function DownloadScriptButton({
  lineOfBusiness,
  productName,
  language,
  hasCompleteScript = false,
  objectionCount = 0,
  hasAnything = true,
}: DownloadScriptButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[language];

  const run = async (variant: ScriptPdfVariant, pdfLanguage: ScriptPdfLanguage = language) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await downloadScriptPdf({ lineOfBusiness, language: pdfLanguage, variant });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.empty);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <div className="flex">
        <Button
          size="sm"
          onClick={() => void run("full")}
          disabled={busy || !hasAnything}
          className="rounded-r-none"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden />
          )}
          <span className="whitespace-nowrap">{busy ? t.building : t.download}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              disabled={busy || !hasAnything}
              className="rounded-l-none border-l border-primary-foreground/25 px-2"
              aria-label={`${t.download} — more options`}
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {productName} · {LANGUAGE_LABEL[language]}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void run("full")}>{t.full}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void run("script")}>{t.script}</DropdownMenuItem>
            <DropdownMenuItem
              disabled={objectionCount === 0}
              onSelect={() => void run("objections")}
            >
              {t.objections}
              {objectionCount > 0 ? (
                <span className="ml-auto pl-3 text-xs text-muted-foreground">
                  {objectionCount}
                </span>
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasCompleteScript} onSelect={() => void run("complete")}>
              {t.complete}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void run("full", "both")}>{t.both}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* aria-live so the failure is announced, not just coloured. */}
      <p aria-live="polite" className="min-h-0 text-xs text-destructive sm:text-right">
        {error}
      </p>
    </div>
  );
}
