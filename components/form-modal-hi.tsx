/* components/form-modal-hi.tsx */
"use client";

import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrame from "@/components/contact-form-iframe-hi";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-hi-spanish";
import { trackInitiateCheckout } from "@/lib/facebook-pixel";

interface QuoteModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const QuoteModal = ({ open, setOpen }: QuoteModalProps) => {
  const isES = useLocale().startsWith("es");
  const Form = (
    isES ? ContactFormIFrameSpanish : ContactFormIFrame
  ) as ComponentType<{ heightPx?: number }>;

  // make the MODAL (not the iframe) scroll vertically
  const IFRAME_HEIGHT = isES ? 1250 : 1100;

  // Track when modal opens
  useEffect(() => {
    if (open) {
      trackInitiateCheckout({
        contentName: "Hospital Indemnity Quote Request",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        className="p-0 border-0 data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="w-[min(95vw,720px)] max-h-[90svh] overflow-hidden rounded-xl bg-background shadow-xl">
          {/* header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold flex-1 text-center">
              {isES
                ? "Cotiza Indemnización Hospitalaria"
                : "Hospital Indemnity Quote"}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* body (scrolls; hide scrollbars) */}
          <div className="max-h-[calc(90svh-52px)] overflow-y-auto overflow-x-hidden scrollbar-none">
            <Form heightPx={IFRAME_HEIGHT} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
