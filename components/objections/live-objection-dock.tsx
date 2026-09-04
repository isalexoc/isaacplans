"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircleQuestion, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OBJECTION_TYPE_BADGE,
  OBJECTION_TYPE_LABELS,
  objectionTitle,
  type Objection,
} from "@/lib/objections/types";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

/**
 * Where a live suggestion appears, and the proof that audio is being captured.
 *
 * Bottom-right, fixed, ~22rem: out of the reading column entirely, so it can never cover the
 * sentence being read aloud. It is a polite live region, NOT a dialog — no focus trap, no
 * autofocus, nothing that steals the caret. A wrong suggestion therefore costs exactly one glance:
 * it is small, in a corner, silent, and it removes itself after twelve seconds.
 *
 * z-40 keeps it under ObjectionAnswerDialog (z-50), so opening the answer covers the dock.
 *
 * The pill is mounted for the whole session, which is the point: the header control scrolls away,
 * this does not, so it is never ambiguous whether audio is live. Chrome's own "Stop sharing" bar
 * is the second, OS-level indicator.
 */

export const SUGGESTION_TTL_MS = 12_000;

interface LiveObjectionDockProps {
  listening: boolean;
  startedAt: number | null;
  objection: Objection | null;
  suggestionKey: number | null;
  language: ScriptLang;
  onOpen: (id: string) => void;
  onDismiss: () => void;
  onStop: () => void;
}

function useElapsed(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "0:00";
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function LiveObjectionDock({
  listening,
  startedAt,
  objection,
  suggestionKey,
  language,
  onOpen,
  onDismiss,
  onStop,
}: LiveObjectionDockProps) {
  const reduceMotion = useReducedMotion();
  const elapsed = useElapsed(startedAt);

  useEffect(() => {
    if (!objection) return;
    const id = setTimeout(onDismiss, SUGGESTION_TTL_MS);
    return () => clearTimeout(id);
  }, [objection, suggestionKey, onDismiss]);

  if (!listening) return null;

  const title = objection ? objectionTitle(objection, language) : "";
  const typeLabel = objection
    ? (OBJECTION_TYPE_LABELS[objection.objectionType]?.[language] ?? "")
    : "";

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[22rem]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {objection && (
          <motion.div
            key={suggestionKey ?? "suggestion"}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "pointer-events-auto w-full overflow-hidden rounded-xl border-2 shadow-lg",
              "border-[#0077B6] bg-white",
              "dark:border-[#00B4D8] dark:bg-slate-900"
            )}
          >
            <div className="flex items-start gap-2 px-4 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#0077B6] dark:text-[#4FC3E8]">
                {language === "en" ? "Sounds like an objection" : "Suena a una objeción"}
              </span>
              <button
                type="button"
                onClick={onDismiss}
                aria-label={language === "en" ? "Dismiss" : "Descartar"}
                className="-mr-1 -mt-1 ml-auto rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpen(objection._id)}
              className="flex w-full flex-col items-start gap-2 px-4 pb-3 pt-1 text-left transition-colors hover:bg-[#0077B6]/[0.04] dark:hover:bg-[#00B4D8]/[0.08]"
            >
              <span className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-50">
                &ldquo;{title}&rdquo;
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    OBJECTION_TYPE_BADGE[objection.objectionType]
                  )}
                >
                  {typeLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0077B6] dark:text-[#4FC3E8]">
                  <MessageCircleQuestion className="h-3.5 w-3.5" />
                  {language === "en" ? "Open the rebuttal" : "Abrir la respuesta"}
                </span>
              </span>
            </button>

            {/* Time left, drawn rather than counted: he should never have to read a number. */}
            <motion.div
              key={`bar-${suggestionKey ?? 0}`}
              className="h-1 origin-left bg-[#00B4D8]"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: SUGGESTION_TTL_MS / 1000, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 shadow-sm dark:border-rose-500/50 dark:bg-rose-950/60">
        <motion.span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600 dark:bg-rose-400"
          animate={reduceMotion ? undefined : { opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="text-xs font-bold uppercase tracking-wide text-rose-800 dark:text-rose-200">
          {language === "en" ? "Listening" : "Escuchando"}
        </span>
        <span className="text-xs tabular-nums text-rose-700/80 dark:text-rose-300/80">{elapsed}</span>
        <button
          type="button"
          onClick={onStop}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-rose-700 dark:bg-rose-500 dark:text-rose-950 dark:hover:bg-rose-400"
        >
          <Square className="h-3 w-3 fill-current" />
          {language === "en" ? "Stop" : "Parar"}
        </button>
      </div>
    </div>
  );
}
