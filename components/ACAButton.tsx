/* components/ACAButton.tsx */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuoteModal } from "@/components/form-modal";
import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-aca"; // <-- uses ACA page strings

export default function ACAButton() {
  const [openModal, setOpenModal] = useState(false);
  const { language } = useLanguage();
  const copy = t[language].ctaButton; // new block (see below)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      className="w-full flex justify-center mt-6 px-4"
    >
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="w-full sm:w-auto"
      >
        <Button
          size="lg"
          onClick={() => setOpenModal(true)}
          className="
            bg-gradient-to-r from-[#0ea5e9] to-[#2563eb]
            hover:from-[#3b82f6] hover:to-[#1d4ed8]
            text-white py-3 text-lg sm:text-xl font-semibold
            w-full sm:w-auto h-full rounded-md shadow-xl
            flex flex-col sm:flex-row items-center justify-center
            gap-1 sm:gap-2 text-center transition-all duration-300
          "
        >
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 animate-pulse" />
            <span>{copy.title}</span>
          </div>
          <span className="text-xs sm:text-sm font-normal text-white/90 sm:ml-2">
            {copy.subtitle}
          </span>
        </Button>

        <QuoteModal open={openModal} setOpen={setOpenModal} />
      </motion.div>
    </motion.div>
  );
}
