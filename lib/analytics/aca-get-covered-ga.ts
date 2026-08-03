import { sendGAEvent } from "@next/third-parties/google";

export type AcaGetCoveredPhase = "contact" | "done";
export type AcaGetCoveredFieldId = "first_name" | "last_name" | "email" | "phone";

/**
 * Fires when the user enters a funnel phase (including initial `contact`).
 * Matches `source: aca_get_covered_ads` / Meta ads funnel — does not replace Pixel/CAPI.
 */
export function trackAcaGetCoveredPhase(params: {
  phase: AcaGetCoveredPhase;
  locale: string;
}) {
  sendGAEvent("event", "aca_get_covered_phase", {
    phase: params.phase,
    locale: params.locale,
    funnel: "aca_get_covered",
  });
}

export function trackAcaGetCoveredFieldStarted(params: {
  field_id: AcaGetCoveredFieldId;
  locale: string;
}) {
  sendGAEvent("event", "aca_get_covered_field_started", {
    ...params,
    funnel: "aca_get_covered",
  });
}

export function trackAcaGetCoveredFieldCompleted(params: {
  field_id: AcaGetCoveredFieldId;
  locale: string;
}) {
  sendGAEvent("event", "aca_get_covered_field_completed", {
    ...params,
    funnel: "aca_get_covered",
  });
}

export function trackAcaGetCoveredSubmitAttempt(params: { locale: string }) {
  sendGAEvent("event", "aca_get_covered_submit_attempt", {
    ...params,
    funnel: "aca_get_covered",
  });
}

export function trackAcaGetCoveredSubmitSuccess(params: { locale: string }) {
  sendGAEvent("event", "aca_get_covered_submit_success", {
    ...params,
    funnel: "aca_get_covered",
  });
}

export function trackAcaGetCoveredAbandon(params: {
  locale: string;
  time_on_page_seconds: number;
}) {
  sendGAEvent("event", "aca_get_covered_abandon", {
    ...params,
    funnel: "aca_get_covered",
  });
}
