import { sendGAEvent } from "@next/third-parties/google";

export type FeGetCoveredPhase = "contact" | "address" | "done";

/**
 * Fires when the user enters a funnel phase (including initial `contact`).
 * Matches `source: final_expense_get_covered_ads` / Meta ads funnel — does not replace Pixel/CAPI.
 */
export function trackFeGetCoveredPhase(params: {
  phase: FeGetCoveredPhase;
  locale: string;
}) {
  sendGAEvent("event", "fe_get_covered_phase", {
    phase: params.phase,
    locale: params.locale,
    funnel: "final_expense_get_covered",
  });
}
