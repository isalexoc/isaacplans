// components/form-modal.tsx
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrame from "@/components/contact-form-iframe";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-spanish";

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

  // Make the iframe tall so the MODAL scrolls (not the iframe).
  const IFRAME_HEIGHT = isES ? 1400 : 1200;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        // Keep Dialog centered; just remove animations and padding
        className="
          p-0 border-0
          data-[state=open]:!animate-none data-[state=closed]:!animate-none
        "
      >
        {/* Card wrapper: fixed max width/height; internal scroller */}
        <div className="w-[min(95vw,720px)] max-h-[90svh] overflow-hidden rounded-xl bg-background shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
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

          {/* Scroll area (hide scrollbars visually) */}
          <div className="max-h-[calc(90svh-52px)] overflow-y-auto overflow-x-hidden scrollbar-none">
            <Form heightPx={IFRAME_HEIGHT} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
