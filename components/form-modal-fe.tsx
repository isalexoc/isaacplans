/* components/form-modal-fe.tsx — Final Expense CTA: lead capture + Agent CRM */
"use client";

import Image from "next/image";
import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Shield, Clock, CheckCircle2 } from "lucide-react";
import { useLocale } from "next-intl";
import FinalExpenseLeadForm from "@/components/final-expense-lead-form";
import { trackInitiateCheckout } from "@/lib/facebook-pixel";

const ISAAC_IMAGE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_280,h_280,c_fill,g_face/isaacpic_c8kca5.png";
const LOGO_URL =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_120,h_40,c_fit/isaacplanslogo_tkraak.png";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const FEQuoteModal = ({ open, setOpen }: Props) => {
  const isES = useLocale().startsWith("es");

  useEffect(() => {
    if (open) {
      trackInitiateCheckout({
        contentName: "Final Expense Quote Request",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        hideCloseButton
        className="max-w-[min(95vw,800px)] w-full max-h-[90svh] p-0 border-0 overflow-hidden flex flex-col data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="flex flex-col min-h-0 flex-1 w-full rounded-xl bg-background shadow-2xl overflow-hidden">
          <div className="flex-shrink-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-sky-500/12 to-blue-600/10 dark:from-sky-500/20 dark:to-blue-600/12 border-b border-sky-200/40 dark:border-sky-800/50">
            <div className="flex-shrink-0 w-20 sm:w-24 h-8 relative">
              <Image
                src={LOGO_URL}
                alt="Isaac Plans Insurance"
                fill
                sizes="96px"
                className="object-contain object-left"
              />
            </div>
            <div className="font-semibold flex-1 text-center text-gray-900 dark:text-white text-sm sm:text-base">
              {isES
                ? "Cotización Gastos Finales"
                : "Final Expense Quote"}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="flex-shrink-0 rounded-md p-2 hover:bg-white/20 focus:outline-none focus-visible:ring transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-y-contain scrollbar-none">
            <div className="flex flex-col sm:flex-row min-h-0">
              <div className="hidden md:flex flex-col w-full sm:w-[220px] lg:w-[260px] flex-shrink-0 items-center justify-start gap-0 pt-8 pb-6 px-6 bg-gradient-to-b from-sky-500/06 to-transparent dark:from-sky-500/12 dark:to-transparent border-r border-gray-100 dark:border-gray-800">
                <div className="relative w-14 h-14 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden ring-2 sm:ring-4 ring-white dark:ring-gray-800 shadow-lg shrink-0">
                  <Image
                    src={ISAAC_IMAGE}
                    alt="Isaac Orraiz - Insurance Agent"
                    fill
                    sizes="(max-width: 640px) 56px, 112px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 sm:flex-none sm:w-full sm:text-center">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    Isaac Orraiz
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {isES ? "Agente de Seguros" : "Licensed Agent"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 sm:flex-col sm:gap-y-2 sm:mt-4 sm:items-center">
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-500 shrink-0" />
                      <span>{isES ? "Gratis" : "Free"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Shield className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{isES ? "Sin compromiso" : "No obligation"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{isES ? "3,000+ pólizas" : "3,000+ policies"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
                <div className="max-w-[400px] mx-auto">
                  <FinalExpenseLeadForm onCloseModal={() => setOpen(false)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
