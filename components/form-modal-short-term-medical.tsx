/* components/form-modal-short-term-medical.tsx */
"use client";

import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Shield, Clock, CheckCircle2 } from "lucide-react";
import { useLocale } from "next-intl";
import ShortTermMedicalLeadForm from "@/components/short-term-medical-lead-form";

const ISAAC_IMAGE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_280,h_280,c_fill,g_face/isaacpic_c8kca5.png";
const LOGO_URL =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_120,h_40,c_fit/isaacplanslogo_tkraak.png";

interface ShortTermMedicalQuoteModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const ShortTermMedicalQuoteModal = ({
  open,
  setOpen,
}: ShortTermMedicalQuoteModalProps) => {
  const isES = useLocale().startsWith("es");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        hideCloseButton
        className="max-w-[min(95vw,800px)] w-full max-h-[90svh] p-0 border-0 overflow-hidden flex flex-col data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="flex flex-col min-h-0 flex-1 w-full rounded-xl bg-background shadow-2xl overflow-hidden">
          {/* header */}
          <div className="flex-shrink-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-[hsl(var(--custom)/0.12)] to-[hsl(var(--custom)/0.06)] dark:from-[hsl(var(--custom)/0.2)] dark:to-[hsl(var(--custom)/0.1)] border-b border-[hsl(var(--custom)/0.15)]">
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
                ? "Cotización de seguro médico temporal"
                : "Temporary health insurance quote"}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="flex-shrink-0 rounded-md p-2 hover:bg-white/20 focus:outline-none focus-visible:ring transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* body - two-column on larger screens */}
          <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-y-contain scrollbar-none">
            <div className="flex flex-col sm:flex-row min-h-0">
              {/* left: image + trust signals - hidden on mobile, shown from md+ */}
              <div className="hidden md:flex flex-col w-full sm:w-[220px] lg:w-[260px] flex-shrink-0 items-center justify-start gap-0 pt-8 pb-6 px-6 bg-gradient-to-b from-[hsl(var(--custom)/0.06)] to-transparent dark:from-[hsl(var(--custom)/0.12)] dark:to-transparent border-r border-gray-100 dark:border-gray-800">
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
                      <Shield className="w-3.5 h-3.5 text-[hsl(var(--custom))] shrink-0" />
                      <span>{isES ? "Sin compromiso" : "No obligation"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5 text-[hsl(var(--custom))] shrink-0" />
                      <span>3,000+ {isES ? "clientes" : "clients"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* right: form */}
              <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
                <div className="max-w-[400px] mx-auto">
                  <ShortTermMedicalLeadForm
                    onCloseModal={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
