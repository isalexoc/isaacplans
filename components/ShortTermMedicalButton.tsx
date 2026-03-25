"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShortTermMedicalQuoteModal } from "@/components/form-modal-short-term-medical";
import { useTranslations } from "next-intl";
import { useShortTermMedicalCta } from "@/components/short-term-medical-cta-context";
import { cn } from "@/lib/utils";

type ShortTermMedicalButtonProps = {
  /** Stronger focus ring + shadow for inline enrollment prompts */
  emphasize?: boolean;
  /** Use inside a block that already provides spacing above the button */
  tightTop?: boolean;
};

export default function ShortTermMedicalButton({
  emphasize = false,
  tightTop = false,
}: ShortTermMedicalButtonProps) {
  const ctx = useShortTermMedicalCta();
  const [localOpen, setLocalOpen] = useState(false);
  const shared = ctx != null;

  const openModal = () => {
    if (shared) ctx.openQuoteModal();
    else setLocalOpen(true);
  };

  const trans = useTranslations(
    "uhone.shortterm.templateContent.uhone.shortterm.ctaButton"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      className={cn(
        "flex w-full justify-center px-4",
        tightTop ? "mt-0" : "mt-6"
      )}
    >
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "w-full sm:w-auto",
          emphasize &&
            "rounded-md ring-2 ring-[hsl(var(--custom)/0.45)] ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
        )}
      >
        <Button
          size="lg"
          onClick={openModal}
          className={cn(
            "h-full w-full rounded-md py-3 text-lg font-semibold text-white shadow-xl transition-all duration-300 sm:w-auto sm:text-xl",
            "flex flex-col items-center justify-center gap-1 text-center sm:flex-row sm:gap-2",
            "bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] hover:from-[#60a5fa] hover:to-[#2563eb]",
            emphasize && "shadow-[0_0_28px_-6px_rgba(37,99,235,0.55)]"
          )}
        >
          <div className="flex items-center gap-2">
            <ScanEye className="h-6 w-6 animate-pulse" />
            <span>{trans("title")}</span>
          </div>
          <span className="text-xs font-normal text-white/90 sm:ml-2 sm:text-sm">
            {trans("subtitle")}
          </span>
        </Button>

        {!shared && (
          <ShortTermMedicalQuoteModal open={localOpen} setOpen={setLocalOpen} />
        )}
      </motion.div>
    </motion.div>
  );
}
