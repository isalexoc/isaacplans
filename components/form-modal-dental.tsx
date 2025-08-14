/* components/form-modal-dental.tsx */
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrame from "@/components/contact-form-iframe-dental";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-dental-spanish";

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
  const IFRAME_HEIGHT = isES ? 1300 : 1100; // sheet scrolls, iframe stays fixed height

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        className="p-0 border-0 data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="w-[min(95vw,720px)] max-h-[90svh] overflow-hidden rounded-xl bg-background shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold">
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

          {/* Body (scrolls; hide scrollbars visually) */}
          <div className="max-h-[calc(90svh-52px)] overflow-y-auto overflow-x-hidden scrollbar-none">
            <Form heightPx={IFRAME_HEIGHT} />

            <div className="px-4 py-3 text-center text-sm text-muted-foreground">
              {isES ? "¿Problemas para ver el formulario?" : "Having trouble?"}{" "}
              <a
                href={
                  isES
                    ? "https://link.agent-crm.com/widget/form/MwmNPpL00pP6SzDz58Eu"
                    : "https://link.agent-crm.com/widget/form/0YWpgL7LJqEK7sp84O3z"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {isES
                  ? "Ábrelo en una nueva pestaña"
                  : "Open the form in a new tab"}
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
