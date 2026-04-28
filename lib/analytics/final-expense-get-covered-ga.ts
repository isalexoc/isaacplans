import { sendGAEvent } from "@next/third-parties/google";

export type FeGetCoveredPhase = "contact" | "address" | "done";
export type FeGetCoveredFieldId =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "dob"
  | "address_line1"
  | "city"
  | "state"
  | "zip";

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

export function trackFeGetCoveredFieldStarted(params: {
  field_id: FeGetCoveredFieldId;
  phase: Exclude<FeGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "fe_get_covered_field_started", {
    ...params,
    funnel: "final_expense_get_covered",
  });
}

export function trackFeGetCoveredFieldCompleted(params: {
  field_id: FeGetCoveredFieldId;
  phase: Exclude<FeGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "fe_get_covered_field_completed", {
    ...params,
    funnel: "final_expense_get_covered",
  });
}

export function trackFeGetCoveredSubmitAttempt(params: {
  phase: Exclude<FeGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "fe_get_covered_submit_attempt", {
    ...params,
    funnel: "final_expense_get_covered",
  });
}

export function trackFeGetCoveredSubmitSuccess(params: {
  phase: Exclude<FeGetCoveredPhase, "done">;
  locale: string;
}) {
  sendGAEvent("event", "fe_get_covered_submit_success", {
    ...params,
    funnel: "final_expense_get_covered",
  });
}

export function trackFeGetCoveredAbandon(params: {
  phase: Exclude<FeGetCoveredPhase, "done">;
  locale: string;
  time_on_page_seconds: number;
}) {
  sendGAEvent("event", "fe_get_covered_abandon", {
    ...params,
    funnel: "final_expense_get_covered",
  });
}
