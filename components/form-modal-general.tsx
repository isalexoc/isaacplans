// components/form-modal-general.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ContactFormIFrameGeneral from "@/components/contact-form-iframe-general";
import ContactFormIFrameGeneralSpanish from "@/components/contact-form-iframe-general-spanish";
import { useLocale } from "next-intl";
import { X } from "lucide-react";

interface QuoteModalProps {
  open?: boolean;
  setOpen?: (v: boolean) => void;
}

/** Modal that chooses the proper form by locale (en ⇢ English, es ⇢ Spanish) */
export const QuoteModalGeneral = ({ open, setOpen }: QuoteModalProps = {}) => {
  // fallback to uncontrolled mode
  const [internalOpen, setInternalOpen] = useState(false);
  const actualOpen = open ?? internalOpen;
  const actualSetOpen = setOpen ?? setInternalOpen;

  const locale = useLocale();
  const isES = locale.startsWith("es");
  const Form = isES
    ? ContactFormIFrameGeneralSpanish
    : ContactFormIFrameGeneral;

  // Reasonable heights; modal will scroll (not the iframe)
  const IFRAME_HEIGHT = isES ? 950 : 760;

  return (
    <Dialog open={actualOpen} onOpenChange={actualSetOpen}>
      <DialogContent
        forceMount
        className="
          p-0 border-0 
          data-[state=open]:!animate-none data-[state=closed]:!animate-none
        "
      >
        {/* Card wrapper: centered, with its own scroll area */}
        <div className="w-[min(95vw,720px)] max-h-[90svh] overflow-hidden rounded-xl bg-background shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold flex-1 text-center">
              {isES ? "Contáctanos" : "Get in touch"}
            </div>
            <button
              onClick={() => actualSetOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scroll area (hide scrollbars visually) */}
          <div className="max-h-[calc(90svh-52px)] overflow-y-auto overflow-x-hidden scrollbar-none">
            <Form heightPx={IFRAME_HEIGHT} />

            {/* <div className="px-4 py-3 text-center text-sm text-muted-foreground">
              {isES ? "¿Problemas?" : "Having trouble?"}{" "}
              <a
                href={
                  isES
                    ? "https://link.agent-crm.com/widget/form/B3YtFv2qtHRnDmdCiQvj"
                    : "https://link.agent-crm.com/widget/form/R7X4k5dTsAORoIyMq6Kz"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {isES
                  ? "Abrir en una nueva pestaña"
                  : "Open the form in a new tab"}
              </a>
            </div> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
