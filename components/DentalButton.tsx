"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuoteModal } from "@/components/form-modal-dental";
import { useTranslations } from "next-intl";

export default function DentalButton() {
  const [openModal, setOpenModal] = useState(false);
  const trans = useTranslations("dentalVisionPage.ctaButton");

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
            bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8]
            hover:from-[#60a5fa] hover:to-[#2563eb]
            text-white py-3 text-lg sm:text-xl font-semibold
            w-full sm:w-auto h-full rounded-md shadow-xl
            flex flex-col sm:flex-row items-center justify-center
            gap-1 sm:gap-2 text-center transition-all duration-300
          "
        >
          <div className="flex items-center gap-2">
            <ScanEye className="w-6 h-6 animate-pulse" />
            <span>{trans("title")}</span>
          </div>
          <span className="text-xs sm:text-sm font-normal text-white/90 sm:ml-2">
            {trans("subtitle")}
          </span>
        </Button>

        <QuoteModal open={openModal} setOpen={setOpenModal} />
      </motion.div>
    </motion.div>
  );
}
