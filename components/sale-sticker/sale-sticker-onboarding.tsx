"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, PartyPopper, Send, UserCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** localStorage flag — the welcome dialog only ever shows once per device. */
export const SALE_STICKER_ONBOARDING_KEY = "sale-sticker-onboarding-seen";

const STEPS = [
  { n: "1", icon: UserCircle },
  { n: "2", icon: PartyPopper },
  { n: "3", icon: Send },
] as const;

type SaleStickerOnboardingProps = {
  open: boolean;
  onClose: () => void;
  onGetStarted: () => void;
};

export function SaleStickerOnboarding({ open, onClose, onGetStarted }: SaleStickerOnboardingProps) {
  const t = useTranslations("saleSticker.onboarding");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#003366]/10 text-[#003366] dark:bg-sky-500/15 dark:text-sky-300">
            <PartyPopper className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl">{t("title")}</DialogTitle>
          <DialogDescription className="text-center">{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <ol className="mt-2 space-y-4">
          {STEPS.map(({ n, icon: Icon }) => (
            <li key={n} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-sky-700 text-white shadow">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div>
                <p className="font-semibold leading-snug text-foreground">
                  {t(`step${n}Title` as "step1Title")}
                </p>
                <p className="text-sm leading-snug text-muted-foreground">
                  {t(`step${n}Body` as "step1Body")}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
            onClick={onGetStarted}
          >
            {t("cta")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {t("skip")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
