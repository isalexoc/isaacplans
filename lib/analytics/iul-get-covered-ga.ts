import { sendGAEvent } from "@next/third-parties/google";

export type IulGetCoveredPhase = "contact" | "quiz" | "done";
export type IulGetCoveredFieldId =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "retirement_timeline"
  | "investments"
  | "monthly_savings"
  | "age"
  | "state";

/**
 * Fires when the user enters a funnel phase (including initial `contact`).
 * Matches `source: iul_get_covered_ads` / Meta ads funnel — does not replace Pixel/CAPI.
 */
export function trackIulGetCoveredPhase(params: {
  phase: IulGetCoveredPhase;
  locale: string;
}) {
  sendGAEvent("event", "iul_get_covered_phase", {
    phase: params.phase,
    locale: params.locale,
    funnel: "iul_get_covered",
  });
}

export function trackIulGetCoveredFieldStarted(params: {
  field_id: IulGetCoveredFieldId;
  phase: Exclude<IulGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "iul_get_covered_field_started", {
    ...params,
    funnel: "iul_get_covered",
  });
}

export function trackIulGetCoveredFieldCompleted(params: {
  field_id: IulGetCoveredFieldId;
  phase: Exclude<IulGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "iul_get_covered_field_completed", {
    ...params,
    funnel: "iul_get_covered",
  });
}

export function trackIulGetCoveredSubmitAttempt(params: {
  phase: Exclude<IulGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "iul_get_covered_submit_attempt", {
    ...params,
    funnel: "iul_get_covered",
  });
}

export function trackIulGetCoveredSubmitSuccess(params: {
  phase: Exclude<IulGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "iul_get_covered_submit_success", {
    ...params,
    funnel: "iul_get_covered",
  });
}

export function trackIulGetCoveredAbandon(params: {
  phase: Exclude<IulGetCoveredPhase, "done">;
  locale: string;
  time_on_page_seconds: number;
}) {
  sendGAEvent("event", "iul_get_covered_abandon", {
    ...params,
    funnel: "iul_get_covered",
  });
}
