// components/form-modal-general.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ContactFormIFrameGeneral from "@/components/contact-form-iframe-general";
import ContactFormIFrameGeneralSpanish from "@/components/contact-form-iframe-general-spanish";
import { useLocale } from "next-intl";
import { X } from "lucide-react";
import { trackInitiateCheckout } from "@/lib/facebook-pixel";

interface QuoteModalProps {
  open?: boolean;
  setOpen?: (v: boolean) => void;
}

/** Modal that chooses the proper form by locale (en ⇢ English, es ⇢ Spanish).
 * Uses a custom div-based modal instead of Radix Dialog to avoid RemoveScroll
 * blocking scroll inside the form. */
export const QuoteModalGeneral = ({ open, setOpen }: QuoteModalProps = {}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const actualOpen = open ?? internalOpen;
  const actualSetOpen = setOpen ?? setInternalOpen;

  const locale = useLocale();
  const isES = locale.startsWith("es");
  const Form = isES
    ? ContactFormIFrameGeneralSpanish
    : ContactFormIFrameGeneral;


  const handleClose = useCallback(() => {
    actualSetOpen(false);
  }, [actualSetOpen]);

  useEffect(() => {
    if (actualOpen) {
      trackInitiateCheckout({ contentName: "General Quote Request" });
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [actualOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (actualOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [actualOpen, handleClose]);

  if (!actualOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal panel - explicit h-[90svh] so scroll area gets bounded height */}
      <div
        className="relative z-10 flex flex-col w-full max-w-[720px] h-[90svh] rounded-xl bg-background shadow-xl overflow-y-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="form-modal-title"
          className="flex-shrink-0 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur"
        >
          <div className="font-semibold flex-1 text-center">
            {isES ? "Contáctanos" : "Get in touch"}
          </div>
          <button
            onClick={handleClose}
            aria-label={isES ? "Cerrar" : "Close"}
            className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Iframe container - iframe fills this and scrolls internally (avoids our div capturing scroll over iframe) */}
        <div className="flex-1 min-h-0 flex flex-col items-center w-full pb-4">
          <Form fillContainer />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
