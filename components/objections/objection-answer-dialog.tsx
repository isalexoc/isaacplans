"use client";

import { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  OBJECTION_TYPE_BADGE,
  OBJECTION_TYPE_LABELS,
  objectionAnswer,
  objectionTitle,
  type Objection,
} from "@/lib/objections/types";
import {
  PortableText,
  buildScriptComponents,
  type ScriptLang,
} from "@/components/presentation-scripts/script-portable-text";

/**
 * The answer, as an overlay.
 *
 * An overlay rather than an inline expansion because the page underneath keeps its scroll position
 * and its open accordion section — close it and the agent is exactly where he was when the client
 * interrupted. That is the whole point of the feature.
 *
 * One Dialog sized with Tailwind, not a Dialog/Drawer branch on useIsMobile: that hook returns
 * false on the first client render, so branching the component tree on it means the Dialog mounts,
 * unmounts on hydration, and the Drawer mounts — a visible flash and a lost focus trap.
 */

interface ObjectionAnswerDialogProps {
  objection: Objection | null;
  language: ScriptLang;
  onClose: () => void;
  /** Step through the list currently on screen, in the order it is shown. */
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}

export default function ObjectionAnswerDialog({
  objection,
  language,
  onClose,
  onPrev,
  onNext,
  position,
}: ObjectionAnswerDialogProps) {
  // Big body text: this is read out loud, off a screen at arm's length, while someone waits.
  const components = useMemo(() => buildScriptComponents(language, "large"), [language]);

  const title = objection ? objectionTitle(objection, language) : "";
  const answer = objection ? objectionAnswer(objection, language) : undefined;
  const typeLabel = objection
    ? OBJECTION_TYPE_LABELS[objection.objectionType]?.[language] ?? ""
    : "";

  return (
    <Dialog open={Boolean(objection)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0",
          "w-[calc(100vw-1.5rem)] max-w-none sm:w-full sm:max-w-2xl lg:max-w-3xl"
        )}
      >
        <header className="shrink-0 border-b border-slate-200 px-5 py-4 pr-14 dark:border-slate-700">
          {objection && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                OBJECTION_TYPE_BADGE[objection.objectionType]
              )}
            >
              {typeLabel}
            </span>
          )}
          <DialogTitle className="mt-2 text-xl font-bold leading-snug text-slate-900 md:text-2xl dark:text-slate-50">
            &ldquo;{title}&rdquo;
          </DialogTitle>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {Array.isArray(answer) && answer.length > 0 ? (
            <PortableText value={answer} components={components} />
          ) : (
            <p className="text-base italic text-muted-foreground">
              {language === "en"
                ? "No answer written yet for this objection."
                : "Todavía no hay respuesta escrita para esta objeción."}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-5 py-2.5 dark:border-slate-700">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === "en" ? "Previous" : "Anterior"}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {language === "en" ? "Next" : "Siguiente"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {position && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {position.index} / {position.total}
            </span>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
