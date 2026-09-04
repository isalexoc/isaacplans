"use client";

import { useState } from "react";
import { ChevronDown, Ear } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListenDiagnostics, ListenStatus } from "@/hooks/use-live-objection-listener";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

/**
 * "Show what it's hearing" — the debugging surface for live listening.
 *
 * Collapsed by default and never shown unless listening, because a live transcript next to a script
 * is a distraction on a real call. But without it the feature is a black box: when no card appears
 * there is no way to tell the three cases apart, and they need completely different fixes —
 *
 *   nothing heard        -> the wrong thing is shared, or the tab has no audio
 *   heard, no candidates -> no objections carry triggers for this product and language
 *   heard, low score     -> the words are right but the phrasing is not in any trigger list
 *
 * The nearest-match score is shown even when it is below the firing bar, because that near-miss is
 * exactly what tells you which phrasing to add in Sanity.
 */

const COPY = {
  en: {
    toggle: "Show what it's hearing",
    hide: "Hide",
    heard: "Last heard",
    nothing: "nothing yet — check you shared the call tab with its audio",
    committed: "segments",
    candidates: "objections in scope",
    noCandidates: "none — this product has no objections with trigger phrases in this language",
    nearest: "Closest match",
    noNearest: "no objection resembled that yet",
    connection: "Connection",
    fires: "A card appears when a phrase matches closely enough. If you see the right words here but no card, add that wording to the objection's triggers in Studio.",
  },
  es: {
    toggle: "Ver lo que está escuchando",
    hide: "Ocultar",
    heard: "Último audio",
    nothing: "nada todavía — verifica que compartiste la pestaña con su audio",
    committed: "segmentos",
    candidates: "objeciones en alcance",
    noCandidates: "ninguna — este producto no tiene objeciones con frases en este idioma",
    nearest: "Coincidencia más cercana",
    noNearest: "ninguna objeción se pareció aún",
    connection: "Conexión",
    fires: "Aparece una tarjeta cuando una frase coincide lo suficiente. Si ves las palabras correctas aquí pero no aparece tarjeta, agrega esa frase a los disparadores de la objeción en Studio.",
  },
} as const;

interface LiveListenPanelProps {
  language: ScriptLang;
  status: ListenStatus;
  diagnostics: ListenDiagnostics;
}

export default function LiveListenPanel({ language, status, diagnostics }: LiveListenPanelProps) {
  const [open, setOpen] = useState(false);
  const t = COPY[language];

  if (status !== "listening" && status !== "starting") return null;

  const { heard, committed, nearest, candidates, lastEvent } = diagnostics;

  return (
    <div className="mt-2 w-full sm:max-w-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Ear className="h-3.5 w-3.5" aria-hidden />
        {open ? t.hide : t.toggle}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
          <Row label={t.heard}>
            {heard ? (
              <span className="text-foreground">&ldquo;{heard}&rdquo;</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">{t.nothing}</span>
            )}
          </Row>

          <Row label={t.nearest}>
            {nearest ? (
              <span className="text-foreground">
                {nearest.title}{" "}
                <span className="font-mono tabular-nums text-muted-foreground">
                  {nearest.score.toFixed(2)}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">{t.noNearest}</span>
            )}
          </Row>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-2 text-muted-foreground dark:border-slate-700">
            <span className="font-mono tabular-nums">
              {committed} {t.committed}
            </span>
            <span
              className={cn(
                "font-mono tabular-nums",
                candidates === 0 && "text-amber-700 dark:text-amber-400"
              )}
            >
              {candidates} {t.candidates}
            </span>
            {lastEvent && <span className="font-mono">{lastEvent}</span>}
          </div>

          {candidates === 0 ? (
            <p className="text-amber-700 dark:text-amber-400">{t.noCandidates}</p>
          ) : (
            <p className="text-muted-foreground">{t.fires}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="leading-snug">{children}</div>
    </div>
  );
}
