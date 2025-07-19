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
      className="max-w-[95vw] sm:max-w-2xl w-full p-0"
      style={{
        height: "auto",
        maxHeight: "unset",
        borderRadius: "1rem",
        overflow: "hidden",
      }}
    >
      <ContactFormIFrame />

      <DialogFooter className="mb-4 px-4">
        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
