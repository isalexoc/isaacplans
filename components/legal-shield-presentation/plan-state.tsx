"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchIntake } from "@/lib/intake-core/api-client";
import { savePatchAndAnnounce, subscribeIntakeSaved } from "@/hooks/use-intake-autosave";
import { asBilling, asPackage, type LsBilling, type LsPackage } from "@/lib/legal-shield/plans";

/**
 * What the deck's price slide shows: the package (full, or Preferred alone after a budget
 * objection) and the payment schedule. It is the intake's own answers, not deck-only state:
 *
 * - a change here (the Mensual/Anual switch, or Shift+I) is saved straight to the intake, so
 *   "Confirmar mis datos" opens a form that already says it, and the agent's other tab reloads;
 * - a change there (the "IDShield en el precio" switch in the agent's unshared form tab) reaches
 *   this tab through the same "intake saved" broadcast, and the slide re-reads the intake.
 *
 * A save is optimistic and put back if it fails (an expired session, say). Nothing about a failure
 * is drawn on the slide: the client is watching it.
 */

type PlanState = {
  pkg: LsPackage;
  billing: LsBilling;
  setBilling: (billing: LsBilling) => void;
  togglePackage: () => void;
};

const LsPlanContext = createContext<PlanState | null>(null);

const LOB = "legal-shield";

export function LsPlanProvider({
  token,
  initialPackage,
  initialBilling,
  children,
}: {
  token: string;
  initialPackage: LsPackage;
  initialBilling: LsBilling;
  children: ReactNode;
}) {
  const [pkg, setPkg] = useState<LsPackage>(initialPackage);
  const [billing, setBillingState] = useState<LsBilling>(initialBilling);
  const latest = useRef({ pkg, billing });
  latest.current = { pkg, billing };

  // Another tab (the agent's form) saved: read the intake again.
  useEffect(
    () =>
      subscribeIntakeSaved(token, () => {
        fetchIntake(LOB, token)
          .then((session) => {
            setPkg(asPackage(session.data?.lsPackage));
            setBillingState(asBilling(session.data?.lsBilling));
          })
          .catch(() => {
            /* keep what the slide shows */
          });
      }),
    [token]
  );

  const setBilling = useCallback(
    (next: LsBilling) => {
      const previous = latest.current.billing;
      if (next === previous) return;
      setBillingState(next);
      savePatchAndAnnounce(LOB, token, { lsBilling: next }).catch((error) => {
        console.warn("[legal-shield deck] billing not saved:", error);
        setBillingState(previous);
      });
    },
    [token]
  );

  const togglePackage = useCallback(() => {
    const previous = latest.current.pkg;
    const next: LsPackage = previous === "solo_preferido" ? "preferido_idshield" : "solo_preferido";
    setPkg(next);
    savePatchAndAnnounce(LOB, token, { lsPackage: next }).catch((error) => {
      console.warn("[legal-shield deck] package not saved:", error);
      setPkg(previous);
    });
  }, [token]);

  const value = useMemo(() => ({ pkg, billing, setBilling, togglePackage }), [pkg, billing, setBilling, togglePackage]);
  return <LsPlanContext.Provider value={value}>{children}</LsPlanContext.Provider>;
}

export function useLsPlan(): PlanState {
  const state = useContext(LsPlanContext);
  if (!state) throw new Error("useLsPlan outside LsPlanProvider");
  return state;
}
