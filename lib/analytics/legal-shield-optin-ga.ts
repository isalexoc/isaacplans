import { sendGAEvent } from "@next/third-parties/google";

/**
 * GA4 events for the LegalShield opt-in funnel. Parallel to Meta Pixel/CAPI, not a replacement.
 *
 * Copied from `aca-get-covered-ga.ts` rather than extracted into a shared factory: the four
 * existing funnel GA files each declare their own `Phase` and `FieldId` unions (ACA is
 * "contact" | "done", IUL is "contact" | "quiz" | "done"), so the types are the substance and a
 * generic factory would erase exactly the part worth having.
 *
 * `legal_shield_guide_download` is the one event with no counterpart elsewhere — it is how the
 * "did they actually get the report" question gets answered, since the download is an anchor
 * click and nothing else observes it.
 */

const FUNNEL = "legal_shield_optin";

export type LegalShieldPhase = "contact" | "areas" | "urgencia" | "done";
export type LegalShieldFieldId = "first_name" | "last_name" | "email" | "phone";

export function trackLegalShieldPhase(params: {
  phase: LegalShieldPhase;
  locale: string;
}) {
  sendGAEvent("event", "legal_shield_phase", { ...params, funnel: FUNNEL });
}

export function trackLegalShieldFieldStarted(params: {
  field_id: LegalShieldFieldId;
  locale: string;
}) {
  sendGAEvent("event", "legal_shield_field_started", { ...params, funnel: FUNNEL });
}

export function trackLegalShieldFieldCompleted(params: {
  field_id: LegalShieldFieldId;
  locale: string;
}) {
  sendGAEvent("event", "legal_shield_field_completed", { ...params, funnel: FUNNEL });
}

export function trackLegalShieldSubmitAttempt(params: { locale: string }) {
  sendGAEvent("event", "legal_shield_submit_attempt", { ...params, funnel: FUNNEL });
}

export function trackLegalShieldSubmitSuccess(params: { locale: string }) {
  sendGAEvent("event", "legal_shield_submit_success", { ...params, funnel: FUNNEL });
}

export function trackLegalShieldAbandon(params: {
  locale: string;
  phase: LegalShieldPhase;
  time_on_page_seconds: number;
}) {
  sendGAEvent("event", "legal_shield_abandon", { ...params, funnel: FUNNEL });
}

export function trackLegalShieldGuideDownload(params: { locale: string }) {
  sendGAEvent("event", "legal_shield_guide_download", { ...params, funnel: FUNNEL });
}
