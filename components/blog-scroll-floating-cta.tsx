"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { X } from "lucide-react";
import { AcaQuoteModal } from "@/components/form-modal-aca";
import { ShortTermMedicalQuoteModal } from "@/components/form-modal-short-term-medical";
import { QuoteModal as DentalQuoteModal } from "@/components/form-modal-dental";
import { QuoteModal as HIQuoteModal } from "@/components/form-modal-hi";
import { IULQuoteModal } from "@/components/form-modal-iul";
import { FEQuoteModal } from "@/components/form-modal-fe";
import { QuoteModalGeneral } from "@/components/form-modal-general";

interface Props {
  category: string;
}

export function BlogScrollFloatingCTA({ category }: Props) {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && window.scrollY / total >= 0.5) {
        setVisible(true);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  // Stay mounted while the modal is open so it can animate in.
  // Unmount only when both the button is gone AND the modal is closed.
  if ((!visible || dismissed) && !modalOpen) return null;

  const label = locale === "en" ? "Get a Free Quote" : "Obtener Cotización";

  const handleClick = () => {
    setModalOpen(true);
    setDismissed(true);
  };

  const modal = (() => {
    if (category === "aca")
      return <AcaQuoteModal open={modalOpen} setOpen={setModalOpen} />;
    if (category === "temporary-health-insurance" || category === "short-term-medical")
      return <ShortTermMedicalQuoteModal open={modalOpen} setOpen={setModalOpen} />;
    if (category === "dental-vision")
      return <DentalQuoteModal open={modalOpen} setOpen={setModalOpen} />;
    if (category === "hospital-indemnity")
      return <HIQuoteModal open={modalOpen} setOpen={setModalOpen} />;
    if (category === "iul")
      return <IULQuoteModal open={modalOpen} setOpen={setModalOpen} />;
    if (category === "final-expense")
      return <FEQuoteModal open={modalOpen} setOpen={setModalOpen} />;
    return <QuoteModalGeneral open={modalOpen} setOpen={setModalOpen} />;
  })();

  return (
    <>
      {!dismissed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={handleClick}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 shadow-xl text-sm transition-all whitespace-nowrap"
          >
            <span aria-hidden>💬</span>
            {label}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label={locale === "en" ? "Dismiss" : "Cerrar"}
            className="rounded-full bg-gray-800/80 hover:bg-gray-700 text-white p-2 shadow-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {modal}
    </>
  );
}
