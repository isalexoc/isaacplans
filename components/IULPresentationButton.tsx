"use client";

import { motion } from "framer-motion";
import { Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function IULPresentationButton() {
  const t = useTranslations("iulPage.presentationButton");

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full flex justify-center mb-6 px-4"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full sm:w-auto"
      >
        <Link href="/iul/presentation" className="block">
          <Button
            size="lg"
            className="
              bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]
              hover:from-[#a78bfa] hover:to-[#8b5cf6]
              text-white py-3 text-lg sm:text-xl font-semibold
              w-full sm:w-auto h-full rounded-lg shadow-lg
              flex items-center justify-center gap-2
              transition-all duration-300 border-2 border-purple-300/20
            "
          >
            <Presentation className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>{t("title")}</span>
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}

