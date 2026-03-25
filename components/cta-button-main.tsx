"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { QuoteModalGeneral } from "@/components/form-modal-general";
import { AcaQuoteModal } from "@/components/form-modal-aca";
import { IULQuoteModal } from "@/components/form-modal-iul";
import { ShortTermMedicalQuoteModal } from "@/components/form-modal-short-term-medical";
import { QuoteModal as DentalQuoteModal } from "@/components/form-modal-dental";
import { QuoteModal as HospitalIndemnityQuoteModal } from "@/components/form-modal-hi";
import { FEQuoteModal } from "@/components/form-modal-fe";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { getHeaderQuoteModalKind } from "@/lib/header-quote-modal";

const CTAButtonMain = () => {
  const [openModal, setOpenModal] = useState(false);
  const nav = useTranslations("header.nav");
  const pathname = usePathname() ?? "/";
  const quoteKind = getHeaderQuoteModalKind(pathname);

  useEffect(() => {
    setOpenModal(false);
  }, [pathname]);

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

        {quoteKind === "aca" && (
          <AcaQuoteModal open={openModal} setOpen={setOpenModal} />
        )}
        {quoteKind === "iul" && (
          <IULQuoteModal open={openModal} setOpen={setOpenModal} />
        )}
        {quoteKind === "stm" && (
          <ShortTermMedicalQuoteModal
            open={openModal}
            setOpen={setOpenModal}
          />
        )}
        {quoteKind === "dental" && (
          <DentalQuoteModal open={openModal} setOpen={setOpenModal} />
        )}
        {quoteKind === "hi" && (
          <HospitalIndemnityQuoteModal
            open={openModal}
            setOpen={setOpenModal}
          />
        )}
        {quoteKind === "fe" && (
          <FEQuoteModal open={openModal} setOpen={setOpenModal} />
        )}
        {quoteKind === "general" && (
          <QuoteModalGeneral open={openModal} setOpen={setOpenModal} />
        )}
      </motion.div>
    </motion.div>
  );
};

export default CTAButtonMain;
