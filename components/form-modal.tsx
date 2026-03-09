// components/form-modal.tsx
"use client";

import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrame from "@/components/contact-form-iframe";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-spanish";
import { trackInitiateCheckout } from "@/lib/facebook-pixel";

interface QuoteModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const QuoteModal = ({ open, setOpen }: QuoteModalProps) => {
  const locale = useLocale();
  const isES = locale.startsWith("es");

  // Chosen component accepts heightPx
  const Form = (
    isES ? ContactFormIFrameSpanish : ContactFormIFrame
  ) as ComponentType<{ heightPx?: number }>;

  // Tall enough so users can scroll to see and submit the entire form
  const IFRAME_HEIGHT = isES ? 1700 : 1500;

  // Track when modal opens
  useEffect(() => {
    if (open) {
      trackInitiateCheckout({
        contentName: "ACA Quote Request",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        className="
          max-w-[min(95vw,720px)] w-full max-h-[90svh] p-0 border-0 overflow-hidden
          flex flex-col
          data-[state=open]:!animate-none data-[state=closed]:!animate-none
        "
      >
        {/* Card wrapper: flex column so scroll area gets remaining space */}
        <div className="flex flex-col min-h-0 flex-1 w-full rounded-xl bg-background shadow-xl">
          {/* Header - flex-shrink-0 keeps it fixed */}
          <div className="flex-shrink-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold flex-1 text-center">
              {isES ? "Cotiza tu plan ACA" : "Get Your ACA Quote"}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scroll area - flex-1 min-h-0 allows it to shrink and scroll */}
          <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-y-contain scrollbar-none pb-12 flex flex-col items-center">
            <Form heightPx={IFRAME_HEIGHT} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
