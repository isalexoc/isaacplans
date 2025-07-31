"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ContactFormIFrameGeneral from "@/components/contact-form-iframe-general";
import ContactFormIFrameGeneralSpanish from "@/components/contact-form-iframe-general-spanish";
import { useLocale } from "next-intl";

interface QuoteModalProps {
  open?: boolean;
  setOpen?: (v: boolean) => void;
}

/** Modal that chooses the proper form by locale (en ⇢ English, es ⇢ Spanish) */
export const QuoteModalGeneral = ({ open, setOpen }: QuoteModalProps = {}) => {
  /* fallback to uncontrolled mode */
  const [internalOpen, setInternalOpen] = useState(false);
  const actualOpen = open ?? internalOpen;
  const actualSetOpen = setOpen ?? setInternalOpen;

  /* Which form to show? */
  const locale = useLocale(); // 'en', 'es', etc.
  const Form = locale.startsWith("es")
    ? ContactFormIFrameGeneralSpanish
    : ContactFormIFrameGeneral;

  return (
    <Dialog open={actualOpen} onOpenChange={actualSetOpen}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-2xl w-full p-0 overflow-y-auto"
        style={{ height: "90vh", borderRadius: "1rem" }}
      >
        <Form />
      </DialogContent>
    </Dialog>
  );
};
