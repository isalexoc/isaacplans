/**
 * Debug + event helpers for Final Expense get-covered Places (PlaceAutocompleteElement).
 * Set NEXT_PUBLIC_LOG_FE_GET_COVERED_PLACES=true to log full client-side diagnostics in the browser console.
 */

export const FE_GET_COVERED_PLACES_DEBUG =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_LOG_FE_GET_COVERED_PLACES === "true";

export function logFePlaces(
  stage: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  const payload = { ...data, t: Date.now() };
  if (stage === "error") {
    console.warn("[fe-get-covered/places]", stage, payload);
    return;
  }
  if (!FE_GET_COVERED_PLACES_DEBUG) return;
  console.info("[fe-get-covered/places]", stage, payload);
}

export type PlacePredictionLike = { toPlace: () => unknown };

/** Google dispatches `gmp-select` with `placePrediction` on the event or under `detail`. */
export function readPlacePredictionFromGmpSelectEvent(
  event: Event
): PlacePredictionLike | null {
  const withProp = event as Event & { placePrediction?: PlacePredictionLike };
  if (
    withProp.placePrediction &&
    typeof withProp.placePrediction.toPlace === "function"
  ) {
    logFePlaces("gmp-select:prediction-path", { path: "event.placePrediction" });
    return withProp.placePrediction;
  }

  const ce = event as CustomEvent<{ placePrediction?: PlacePredictionLike }>;
  const fromDetail = ce.detail?.placePrediction;
  if (fromDetail && typeof fromDetail.toPlace === "function") {
    logFePlaces("gmp-select:prediction-path", { path: "event.detail.placePrediction" });
    return fromDetail;
  }

  const detailKeys =
    ce.detail && typeof ce.detail === "object"
      ? Object.keys(ce.detail as object)
      : [];
  logFePlaces("error", {
    message: "gmp-select missing placePrediction",
    eventType: event.type,
    detailKeys,
    eventKeys:
      event && typeof event === "object" ? Object.keys(event as object) : [],
  });
  return null;
}

export function inspectGmpSelectEvent(event: Event): void {
  if (!FE_GET_COVERED_PLACES_DEBUG) return;
  const ce = event as CustomEvent<unknown>;
  const eventRec = event as unknown as Record<string, unknown>;
  logFePlaces("gmp-select:raw-inspect", {
    type: event.type,
    hasDetail: "detail" in event,
    detailType: ce.detail === null ? "null" : typeof ce.detail,
    detailKeys:
      ce.detail && typeof ce.detail === "object"
        ? Object.keys(ce.detail as object)
        : [],
    hasPlacePredictionProp: "placePrediction" in event,
    placePredictionType: typeof eventRec["placePrediction"],
  });
}
