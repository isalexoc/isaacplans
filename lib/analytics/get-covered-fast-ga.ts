import { sendGAEvent } from "@next/third-parties/google";
import type { GcfCarrierConversionHub } from "@/lib/get-covered-fast/gcf-attribution";
import type { RecommendationPath } from "@/lib/get-covered-fast/recommendations";

export type GcfAnalyticsSurface =
  | "get_covered_fast"
  | "get_health_coverage_fast_ads";

/** User finished a quiz step. `choice` is state code on zip step, or option keys on other steps (no raw ZIP). */
export function trackGcfStepComplete(
  surface: GcfAnalyticsSurface,
  params: {
    step_index: number;
    step_id: "zip" | "intent" | "who" | "timing" | "preference";
    choice: string;
  }
) {
  sendGAEvent("event", "gcf_step_complete", {
    ...params,
    surface,
    funnel: "get_covered_fast",
  });
}

/** User reached the personalized result screen. */
export function trackGcfResultViewed(
  surface: GcfAnalyticsSurface,
  params: {
    primary_path: string;
    secondary_path: string;
    rationale_id: string;
    intent: string;
    preference: string;
    lead_form_path: string;
  }
) {
  sendGAEvent("event", "gcf_result_viewed", {
    ...params,
    surface,
    funnel: "get_covered_fast",
  });
}

export function trackGcfFunnelBack(
  surface: GcfAnalyticsSurface,
  params: { from_step_index: number; from_step_id: string }
) {
  sendGAEvent("event", "gcf_funnel_back", {
    ...params,
    surface,
    funnel: "get_covered_fast",
  });
}

export function trackGcfFunnelRestart(surface: GcfAnalyticsSurface) {
  sendGAEvent("event", "gcf_funnel_restart", {
    surface,
    funnel: "get_covered_fast",
  });
}

/**
 * Primary ACA result: user clicked “View plans & enroll” to open HealthSherpa.
 * Use as the dedicated GA4 conversion for ACA enrollment intent (not `gcf_post_result_click`).
 */
export function trackGcfAcaHealthsherpaEnrollClick(surface: GcfAnalyticsSurface) {
  sendGAEvent("event", "gcf_aca_healthsherpa_enroll_click", {
    surface,
    funnel: "get_covered_fast",
  });
}

/** Paid ads funnel only: carrier card “View plans & enroll” on a GCF ads hub page. Mark as conversion in GA4. */
export function trackGcfAdsCarrierEnrollClick(
  carrierId: string,
  hub: GcfCarrierConversionHub
) {
  sendGAEvent("event", "gcf_ads_carrier_enroll_click", {
    carrier_id: carrierId,
    hub,
    funnel: "get_covered_fast",
    surface: "get_health_coverage_fast_ads",
  });
}

/** Where the primary CTA on the result screen sends the user (matches `primaryResultHref` / HealthSherpa hero). */
export type GcfPostResultDestination =
  | "healthsherpa"
  | "carriers"
  | "dental_self_enroll"
  | "hospital_self_enroll"
  | "temporary"
  | "contact";

export function getGcfPrimaryDestination(
  showPrimaryAcaHero: boolean,
  primaryPath: RecommendationPath
): GcfPostResultDestination {
  if (showPrimaryAcaHero) return "healthsherpa";
  switch (primaryPath) {
    case "temporary":
      return "carriers";
    case "dentalVision":
      return "dental_self_enroll";
    case "hospitalIndemnity":
      return "hospital_self_enroll";
    case "aca":
      return "healthsherpa";
    case "carriers":
      return "carriers";
    case "contact":
      return "contact";
    default:
      return "carriers";
  }
}

/** User clicked a primary or secondary CTA after `gcf_result_viewed` (enroll intent / next step). */
export function trackGcfPostResultClick(
  surface: GcfAnalyticsSurface,
  params: {
    primary_path: string;
    secondary_path: string;
    rationale_id: string;
    intent: string;
    cta_role: "primary" | "secondary";
    destination: GcfPostResultDestination;
    /** e.g. block id: `aca_temp_alternative`, `temporary_aca_secondary` */
    destination_detail?: string;
  }
) {
  sendGAEvent("event", "gcf_post_result_click", {
    ...params,
    surface,
    funnel: "get_covered_fast",
  });
}
