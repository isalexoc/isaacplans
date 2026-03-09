/* components/form-modal-dental.tsx */
"use client";

import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrame from "@/components/contact-form-iframe-dental";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-dental-spanish";
import { trackInitiateCheckout } from "@/lib/facebook-pixel";

interface QuoteModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export const QuoteModal = ({ open, setOpen }: QuoteModalProps) => {
  const locale = useLocale();
  const isES = locale.startsWith("es");

  const Form = (
    isES ? ContactFormIFrameSpanish : ContactFormIFrame
  ) as ComponentType<{ heightPx?: number }>;
  const IFRAME_HEIGHT = isES ? 1600 : 1400; // tall enough to scroll and submit

  // Track when modal opens
  useEffect(() => {
    if (open) {
      trackInitiateCheckout({
        contentName: "Dental & Vision Quote Request",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        className="max-w-[min(95vw,720px)] w-full max-h-[90svh] p-0 border-0 overflow-hidden flex flex-col data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="flex flex-col min-h-0 flex-1 w-full rounded-xl bg-background shadow-xl">
          {/* Header */}
          <div className="flex-shrink-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold flex-1 text-center">
              {isES ? "Cotiza Dental y Visión" : "Dental & Vision Quote"}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body - flex-1 min-h-0 allows scroll; pb-12 ensures submit button is reachable */}
          <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-y-contain scrollbar-none pb-12 flex flex-col items-center">
            <Form heightPx={IFRAME_HEIGHT} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
