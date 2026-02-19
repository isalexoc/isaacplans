"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import AnimatedCompletionSwitch from "@/components/animated-completion-switch";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function FinalExpenseReferralsContent() {
  const t = useTranslations("finalExpenseReferrals");

  return (
    <motion.div
      className="w-full max-w-4xl mx-auto space-y-10"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Part 1: Ask client for review */}
      <motion.div variants={item}>
        <h2 className="text-xl font-semibold text-[#003366] mb-4">
          {t("review.sectionTitle")}
        </h2>
        <AnimatedCompletionSwitch
          completedLabel={t("review.completedLabel")}
          incompleteLabel={t("review.incompleteLabel")}
          description={t("review.switchDescription")}
          completedText={t("review.completedText")}
          pendingText={t("review.pendingText")}
        />
      </motion.div>

      {/* Part 2: Referral capture */}
      <motion.div variants={item}>
        <h2 className="text-xl font-semibold text-[#003366] mb-4">
          {t("capture.sectionTitle")}
        </h2>
        <AnimatedCompletionSwitch
          completedLabel={t("capture.completedLabel")}
          incompleteLabel={t("capture.incompleteLabel")}
          description={t("capture.switchDescription")}
          completedText={t("capture.completedText")}
          pendingText={t("capture.pendingText")}
        />
      </motion.div>
    </motion.div>
  );
}
