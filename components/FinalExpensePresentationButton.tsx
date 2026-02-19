"use client";

import { motion } from "framer-motion";
import { Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/** Senior Life primary blue; use for presentation CTA */
const SENIOR_LIFE_BLUE = "#003366";
const SENIOR_LIFE_BLUE_HOVER = "#004080";
const SENIOR_LIFE_GOLD = "#d4a84b";

export default function FinalExpensePresentationButton() {
  const t = useTranslations("FEpage.presentationButton");

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
        <Link href="/final-expense/presentation" className="block">
          <Button
            size="lg"
            className="w-full sm:w-auto h-full rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all duration-300 border-2 text-white font-semibold py-3 text-lg sm:text-xl hover:opacity-95"
            style={{
              background: `linear-gradient(135deg, ${SENIOR_LIFE_BLUE} 0%, ${SENIOR_LIFE_BLUE_HOVER} 100%)`,
              borderColor: SENIOR_LIFE_GOLD,
            }}
          >
            <Presentation className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>{t("title")}</span>
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
