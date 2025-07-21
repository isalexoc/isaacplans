"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import ContactFormIFrame from "@/components/contact-form-iframe";

interface QuoteModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export const QuoteModal = ({ open, setOpen }: QuoteModalProps) => (
  <Dialog open={open} onOpenChange={setOpen}>
    {/* 1️⃣ 90 vh tall, NO overflow — modal never scrolls */}
    <DialogContent
      className="max-w-[95vw] sm:max-w-2xl w-full p-0 overflow-hidden"
      style={{ height: "90vh", borderRadius: "1rem" }}
    >
      <ContactFormIFrame />
    </DialogContent>
  </Dialog>
);
