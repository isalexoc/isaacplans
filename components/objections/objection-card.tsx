"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  OBJECTION_TYPE_BADGE,
  OBJECTION_TYPE_LABELS,
  objectionTitle,
  type Objection,
} from "@/lib/objections/types";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

/**
 * One objection, face down: only what the client says, plus its type.
 *
 * Sized for a glance rather than a read. `border-2` because a 1px border is invisible at arm's
 * length, and a fixed minimum height so rows stay even when one title wraps to three lines and
 * its neighbour is four words.
 */

export const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

interface ObjectionCardProps {
  objection: Objection;
  language: ScriptLang;
  onOpen: (id: string) => void;
}

export default function ObjectionCard({ objection, language, onOpen }: ObjectionCardProps) {
  const title = objectionTitle(objection, language);
  const typeLabel = OBJECTION_TYPE_LABELS[objection.objectionType]?.[language] ?? "";

  return (
    <motion.button
      type="button"
      layout="position"
      variants={cardVariants}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      onClick={() => onOpen(objection._id)}
      className={cn(
        "group flex min-h-[112px] w-full flex-col justify-between gap-3 rounded-xl border-2 p-4 text-left shadow-sm",
        "border-slate-200 bg-white transition-colors hover:border-[#0077B6] hover:bg-[#0077B6]/[0.04]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4D8] focus-visible:ring-offset-2",
        "active:scale-[0.99]",
        "dark:border-slate-700 dark:bg-slate-900 dark:hover:border-[#00B4D8] dark:hover:bg-[#00B4D8]/[0.08]",
        "dark:focus-visible:ring-offset-slate-950"
      )}
    >
      <span className="text-base font-semibold leading-snug text-slate-900 md:text-lg dark:text-slate-50">
        &ldquo;{title}&rdquo;
      </span>
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
          OBJECTION_TYPE_BADGE[objection.objectionType]
        )}
      >
        {typeLabel}
      </span>
    </motion.button>
  );
}
