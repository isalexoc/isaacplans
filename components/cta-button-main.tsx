"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { QuoteModalGeneral } from "@/components/form-modal-general";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const CTAButton = () => {
  const [openModal, setOpenModal] = useState(false);
  const trans = useTranslations("HomePage");
  const nav = useTranslations("header.nav");

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      className="w-full flex justify-center px-4"
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
            w-full sm:w-auto h-full
            flex flex-col sm:flex-row items-center justify-center
            gap-1 sm:gap-2 text-center
            rounded-md shadow-xl transition-all duration-300
          "
        >
          <div className="flex items-center justify-center">
            <span>{nav("cta")}</span>
          </div>
        </Button>

        <QuoteModalGeneral open={openModal} setOpen={setOpenModal} />
      </motion.div>
    </motion.div>
  );
};

export default CTAButton;
