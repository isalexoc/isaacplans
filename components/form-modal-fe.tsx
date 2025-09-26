"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrameFE from "@/components/contact-form-iframe-fe";
import ContactFormIFrameFESpanish from "@/components/contact-form-iframe-fe-spanish";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const FEQuoteModal = ({ open, setOpen }: Props) => {
  const isES = useLocale().startsWith("es");
  const Form = (
    isES ? ContactFormIFrameFESpanish : ContactFormIFrameFE
  ) as ComponentType<{ heightPx?: number }>;

  // tuned heights for comfortable scroll inside modal
  const IFRAME_HEIGHT = isES ? 950 : 900;

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
              {isES ? "Cotización Gastos Finales" : "Final Expense Quote"}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* body */}
          <div className="max-h[calc(90svh-52px)] max-h-[calc(90svh-52px)] overflow-y-auto overflow-x-hidden scrollbar-none">
            <Form heightPx={IFRAME_HEIGHT} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
