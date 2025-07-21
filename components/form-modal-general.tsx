"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import ContactFormIFrameGeneral from "@/components/contact-form-iframe-general";

interface QuoteModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const QuoteModalGeneral = ({ open, setOpen }: QuoteModalProps) => (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent
      /* 90 vh tall, modal scrolls if the form is longer */
      className="max-w-[95vw] sm:max-w-2xl w-full p-0 overflow-y-auto"
      style={{ height: "90vh", borderRadius: "1rem" }}
    >
      <ContactFormIFrameGeneral />
    </DialogContent>
  </Dialog>
);
