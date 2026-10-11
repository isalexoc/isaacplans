import { sendGAEvent } from "@next/third-parties/google";

/**
 * GA4 events for the IUL lead-magnet opt-in. Parallel to Meta Pixel/CAPI, not a replacement.
 *
 * Copied from `legal-shield-optin-ga.ts` rather than extracted into a shared factory, for the
 * reason that file already gives: each funnel's `Phase` and `FieldId` unions ARE the substance,
 * and a generic factory would erase exactly the part worth having.
 *
 * Two events carry this funnel's whole reason for existing:
 *
 * - `iul_guia_guide_download` answers "did they actually get the guide", which nothing else
 *   observes — the download is an anchor click.
 * - `iul_guia_field_started` / `_field_completed` on the email field is the first-party evidence
 *   for whether asking for an email in Step 1 costs conversion. `/iul/get-covered` asks for it
 *   last and emits the same pair, so the two pages are directly comparable without touching
 *   either experiment.
 */

const FUNNEL = "iul_guia";

export type IulGuiaPhase = "contact" | "quiz" | "done";
export type IulGuiaFieldId = "first_name" | "last_name" | "email" | "phone";
export type IulGuiaQuizStep = "age" | "state" | "savings" | "retirement" | "callTime";

export function trackIulGuiaPhase(params: { phase: IulGuiaPhase; locale: string }) {
  sendGAEvent("event", "iul_guia_phase", { ...params, funnel: FUNNEL });
}

export function trackIulGuiaFieldStarted(params: { field_id: IulGuiaFieldId; locale: string }) {
  sendGAEvent("event", "iul_guia_field_started", { ...params, funnel: FUNNEL });
}

export function trackIulGuiaFieldCompleted(params: { field_id: IulGuiaFieldId; locale: string }) {
  sendGAEvent("event", "iul_guia_field_completed", { ...params, funnel: FUNNEL });
}

export function trackIulGuiaSubmitAttempt(params: { locale: string }) {
  sendGAEvent("event", "iul_guia_submit_attempt", { ...params, funnel: FUNNEL });
}

export function trackIulGuiaSubmitSuccess(params: { locale: string }) {
  sendGAEvent("event", "iul_guia_submit_success", { ...params, funnel: FUNNEL });
}

/** Per-question progress through the quiz, so drop-off is readable question by question. */
export function trackIulGuiaQuizStep(params: { step: IulGuiaQuizStep; locale: string }) {
  sendGAEvent("event", "iul_guia_quiz_step", { ...params, funnel: FUNNEL });
}

export function trackIulGuiaAbandon(params: {
  locale: string;
  phase: IulGuiaPhase;
  time_on_page_seconds: number;
}) {
  sendGAEvent("event", "iul_guia_abandon", { ...params, funnel: FUNNEL });
}

export function trackIulGuiaGuideDownload(params: { locale: string }) {
  sendGAEvent("event", "iul_guia_guide_download", { ...params, funnel: FUNNEL });
}
