"use client";

import { useCallback, type ReactNode } from "react";
import { Montserrat } from "next/font/google";
import ImpactPresentation from "@/components/impact-presentation/impact-presentation";
import type { LsBilling, LsPackage } from "@/lib/legal-shield/plans";
import { LsPlanProvider, useLsPlan } from "./plan-state";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600", "700", "800", "900"], display: "swap" });

/**
 * Ysmael's 9:16 deck in the shared deck shell (the Impact deck's, with Legal Shield's font, navy and
 * gold, its own saved-position key, no language switch, and "Confirmar mis datos" opening the Legal
 * Shield form).
 *
 * Shift+I takes IDShield off the price (or puts it back) with nothing drawn on screen: the backup
 * for when the whole screen is shared and the agent can't switch to his form tab.
 */
export default function LegalShieldPresentation({
  token,
  slides,
  initialPackage,
  initialBilling,
}: {
  token: string;
  slides: ReactNode[];
  initialPackage: LsPackage;
  initialBilling: LsBilling;
}) {
  return (
    <LsPlanProvider token={token} initialPackage={initialPackage} initialBilling={initialBilling}>
      <Deck token={token} slides={slides} />
    </LsPlanProvider>
  );
}

function Deck({ token, slides }: { token: string; slides: ReactNode[] }) {
  const { togglePackage } = useLsPlan();
  const onDeckKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "i") {
        togglePackage();
        return true;
      }
      return false;
    },
    [togglePackage]
  );

  return (
    <ImpactPresentation
      token={token}
      locale="es"
      slides={slides}
      lob="legal-shield"
      storageKeyPrefix="legal-shield-presentation:"
      languageSwitchPathname={null}
      fontClassName={montserrat.className}
      frameClass="bg-[#041a2d]"
      stageClass="bg-[#07233b]"
      navClass="bg-[#041a2d]/70"
      activeDotClass="bg-[#e2bf6a]"
      onDeckKey={onDeckKey}
    />
  );
}
