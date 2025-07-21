"use client";

import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ContactFormIFrame from "@/components/contact-form-iframe";

interface QuoteModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export const QuoteModal = ({ open, setOpen }: QuoteModalProps) => (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent
      /* ✔ modal can scroll; capped to 90 vh */
      className="max-w-[95vw] sm:max-w-2xl w-full p-0 overflow-y-auto"
      style={{ maxHeight: "90vh", borderRadius: "1rem" }}
    >
      <ContactFormIFrame />
    </DialogContent>
  </Dialog>
);
