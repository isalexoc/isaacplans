"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLeaveBehindAgentProfile } from "@/components/leave-behind/leave-behind-agent-profile-context";

const DISMISS_KEY = "leave-behind-onboarding-dismissed";

type Props = {
  onGoToProfile: () => void;
};

export function FinalExpenseLeaveBehindOnboardingDialog({ onGoToProfile }: Props) {
  const t = useTranslations("finalExpenseLeaveBehind");
  const { loading, isComplete } = useLeaveBehindAgentProfile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || isComplete) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY)) return;
    setOpen(true);
  }, [loading, isComplete]);

  const handleLater = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const handleSetup = () => {
    setOpen(false);
    onGoToProfile();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agentProfile.onboardingTitle")}</DialogTitle>
          <DialogDescription>{t("agentProfile.onboardingDescription")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("agentProfile.onboardingStep1")}</li>
          <li>{t("agentProfile.onboardingStep2")}</li>
          <li>{t("agentProfile.onboardingStep3")}</li>
          <li>{t("agentProfile.onboardingStep4")}</li>
        </ul>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full bg-[#003366] text-white hover:bg-[#004080] hover:text-white dark:bg-[#003366] dark:text-white"
            onClick={handleSetup}
          >
            {t("agentProfile.onboardingCta")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={handleLater}>
            {t("agentProfile.onboardingLater")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
