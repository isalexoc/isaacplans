"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import ContactFormIFrame from "@/components/contact-form-iframe-hi";
import ContactFormIFrameSpanish from "@/components/contact-form-iframe-hi-spanish";
import { useLocale } from "next-intl";

interface QuoteModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export const QuoteModal = ({ open, setOpen }: QuoteModalProps) => {
  const locale = useLocale(); // 'en', 'es', etc.
  const Form = locale.startsWith("es")
    ? ContactFormIFrameSpanish
    : ContactFormIFrame;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        /* ✔ modal can scroll; capped to 90 vh */
        className="max-w-[95vw] sm:max-w-2xl w-full p-0 overflow-y-auto"
        style={{ maxHeight: "90vh", borderRadius: "1rem" }}
      >
        <Form />
      </DialogContent>
    </Dialog>
  );
};
