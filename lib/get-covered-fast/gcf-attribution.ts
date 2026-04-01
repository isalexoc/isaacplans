/**
 * Query param on internal links from the paid ads landing only (`/get-health-coverage-fast`).
 * Organic `/get-covered-fast` does not set `gcf_channel`, so GA conversion events can be scoped to ads.
 */
export const GCF_CHANNEL_HEALTH_COVERAGE_FAST_ADS = "health_coverage_fast_ads";

export type GcfCarrierConversionHub =
  | "carriers_index"
  | "dental_self_enrollment"
  | "hospital_self_enrollment";

export function isGcfHealthCoverageFastAdsCarrierPage(
  query: {
    from?: string;
    path?: string;
    gcf_channel?: string;
  },
  expectedPath: "carriers" | "dentalVision" | "hospitalIndemnity"
): boolean {
  return (
    query.from === "gcf" &&
    query.path === expectedPath &&
    query.gcf_channel === GCF_CHANNEL_HEALTH_COVERAGE_FAST_ADS
  );
}
