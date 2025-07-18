import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import ContactFormIFrame from "@/components/contact-form-iframe";

export const QuoteModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent
      className="max-w-[95vw] sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0 sm:p-6"
      style={{ borderRadius: "1rem" }}
    >
      <DialogHeader className="p-4">
        <DialogTitle className="text-lg sm:text-xl">
          Get Your Free Quote
        </DialogTitle>
        <DialogDescription className="text-sm sm:text-base">
          Please fill out the form and we’ll get back to you shortly.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <ContactFormIFrame />
      </div>

      <DialogFooter className="mt-4">
        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
