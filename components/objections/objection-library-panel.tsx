"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircleQuestion, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { matchesObjection } from "@/lib/objections/search";
import {
  OBJECTION_TYPES,
  OBJECTION_TYPE_LABELS,
  type Objection,
  type ObjectionType,
} from "@/lib/objections/types";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";
import ObjectionCard from "./objection-card";

/**
 * The objection grid, always open, above the script accordion.
 *
 * Deliberately NOT inside the accordion: that accordion is one-section-at-a-time, so opening
 * objections there would close whatever the agent was reading — which is the problem this feature
 * exists to fix.
 */

interface ObjectionLibraryPanelProps {
  objections: Objection[];
  language: ScriptLang;
  onOpen: (id: string) => void;
  onOpenPalette: () => void;
  /** How many objections exist for this product in the OTHER language. */
  otherLanguageCount: number;
  onSwitchLanguage: () => void;
  /** Lets the dialog step through exactly what is on screen. */
  onVisibleChange?: (ids: string[]) => void;
}

export default function ObjectionLibraryPanel({
  objections,
  language,
  onOpen,
  onOpenPalette,
  otherLanguageCount,
  onSwitchLanguage,
  onVisibleChange,
}: ObjectionLibraryPanelProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ObjectionType | "all">("all");
  const reduceMotion = useReducedMotion();

  // Only offer chips for types that are actually present, so no chip ever yields an empty grid.
  const typeCounts = useMemo(() => {
    const counts = new Map<ObjectionType, number>();
    for (const objection of objections) {
      counts.set(objection.objectionType, (counts.get(objection.objectionType) ?? 0) + 1);
    }
    return OBJECTION_TYPES.filter((type) => counts.has(type)).map((type) => ({
      type,
      count: counts.get(type) ?? 0,
    }));
  }, [objections]);

  const filtered = useMemo(
    () =>
      objections.filter(
        (objection) =>
          (typeFilter === "all" || objection.objectionType === typeFilter) &&
          matchesObjection(objection, query)
      ),
    [objections, typeFilter, query]
  );

  // Reported in an effect, not during render: the dashboard sets state from this, and doing that
  // mid-render warns about updating another component while rendering.
  const visibleIds = useMemo(() => filtered.map((o) => o._id).join(","), [filtered]);
  useEffect(() => {
    onVisibleChange?.(visibleIds ? visibleIds.split(",") : []);
  }, [visibleIds, onVisibleChange]);

  if (objections.length === 0) return null;

  const container = {
    hidden: {},
    show: {
      transition: {
        // 0.03, not the 0.15 used elsewhere in the app: at 17 cards that would be 2.5 seconds
        // of entrance animation before the grid is usable.
        staggerChildren: reduceMotion ? 0 : 0.03,
      },
    },
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground md:text-xl">
          <MessageCircleQuestion className="h-5 w-5 text-[#0077B6] dark:text-[#4FC3E8]" />
          {language === "en" ? "Objections" : "Objeciones"}
          <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-semibold text-muted-foreground">
            {filtered.length}
          </span>
        </h3>

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={language === "en" ? "Search objections…" : "Buscar objeciones…"}
            aria-label={language === "en" ? "Search objections" : "Buscar objeciones"}
            // h-11 + text-base, not the shadcn h-10 + text-sm default: this is a mid-call target,
            // and text-base also stops iOS Safari zooming the viewport on focus.
            className="h-11 pl-9 pr-14 text-base"
          />
          <button
            type="button"
            onClick={onOpenPalette}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 select-none rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            aria-label={language === "en" ? "Open quick search" : "Abrir búsqueda rápida"}
          >
            Ctrl K
          </button>
        </div>
      </div>

      {typeCounts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
            label={language === "en" ? "All" : "Todas"}
            count={objections.length}
          />
          {typeCounts.map(({ type, count }) => (
            <Chip
              key={type}
              active={typeFilter === type}
              onClick={() => setTypeFilter(type)}
              label={OBJECTION_TYPE_LABELS[type][language]}
              count={count}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((objection) => (
              <ObjectionCard
                key={objection._id}
                objection={objection}
                language={language}
                onOpen={onOpen}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
          <p className="text-base text-muted-foreground">
            {language === "en"
              ? `Nothing matches “${query}”.`
              : `Nada coincide con “${query}”.`}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
            }}
            className="mt-2 text-base font-semibold text-[#0077B6] hover:underline dark:text-[#4FC3E8]"
          >
            {language === "en" ? "Clear search" : "Limpiar búsqueda"}
          </button>
        </div>
      )}

      {/*
        English and Spanish genuinely do not line up in the source content — the entire price
        category is English-only for Final Expense. Saying so out loud beats silently showing
        fewer cards in one language.
      */}
      {otherLanguageCount > objections.length && (
        <button
          type="button"
          onClick={onSwitchLanguage}
          className="mt-3 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {language === "en"
            ? `${otherLanguageCount - objections.length} more available in Spanish`
            : `${otherLanguageCount - objections.length} más disponibles en inglés`}
        </button>
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-[#0077B6] bg-[#0077B6] text-white dark:border-[#00B4D8] dark:bg-[#00B4D8] dark:text-slate-950"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}
