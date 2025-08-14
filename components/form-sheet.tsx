/* components/form-sheet.tsx */
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentType } from "react";
import ContactFormIFrame from "@/components/contact-form-iframe";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-spanish";

type Props = { open: boolean; setOpen: (v: boolean) => void };

export const QuoteSheet = ({ open, setOpen }: Props) => {
  const locale = useLocale();
  const isES = locale.startsWith("es");

  const Form = (
    isES ? ContactFormIFrameSpanish : ContactFormIFrame
  ) as ComponentType<{ heightPx?: number }>;
  const FORM_HEIGHT = isES ? 1400 : 1200; // tall enough so the SHEET scrolls, not the iframe

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        // Right-side sheet; no animations (iframes + fades = flicker)
        className="fixed right-0 top-0 m-0 h-svh w-full sm:w-[640px] max-w-[640px] rounded-none p-0 border-0
                   data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="font-semibold">Get Your ACA Quote</div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content: scrollable container with hidden scrollbars */}
        <div className="h-[calc(100svh-56px)] overflow-y-auto overflow-x-hidden scrollbar-none px-0">
          {/* Wrapper to prevent any horizontal bleed */}
          <div className="w-full max-w-full">
            <Form heightPx={FORM_HEIGHT} />
          </div>

          {/* Fallback link */}
          <div className="px-4 py-3 text-center text-sm text-muted-foreground">
            Having trouble?{" "}
            <a
              href={
                isES
                  ? "https://link.agent-crm.com/widget/form/mPN7YcIHFwUOipERfwfH"
                  : "https://link.agent-crm.com/widget/form/z3BuLLWvo2JRqrtkElq8"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Open the form in a new tab
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
