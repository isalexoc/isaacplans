/**
 * Server-only: fetches Google Business reviews via Places API (New).
 * Requires GOOGLE_MAPS_API_KEY and GOOGLE_PLACE_ID.
 */

export type GoogleReviewItem = {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  authorUri?: string;
  /** Profile photo URL from Places API `authorAttribution.photoUri` when present */
  authorPhotoUrl?: string;
};

export type GoogleReviewsData = {
  placeName: string;
  rating: number;
  userRatingCount: number;
  reviews: GoogleReviewItem[];
  googleMapsUri: string;
};

type PlacesReview = {
  rating?: number;
  text?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
};

type PlaceDetailsResponse = {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: PlacesReview[];
  googleMapsUri?: string;
};

const FIELD_MASK =
  "displayName,googleMapsUri,rating,userRatingCount,reviews";

export async function fetchGooglePlaceReviews(
  languageCode: string
): Promise<GoogleReviewsData | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey?.trim() || !placeId?.trim()) {
    return null;
  }

  const id = encodeURIComponent(placeId.trim());
  const url = new URL(`https://places.googleapis.com/v1/places/${id}`);
  url.searchParams.set("languageCode", languageCode === "es" ? "es" : "en");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(
        "[google-place-reviews] Places API error",
        res.status,
        await res.text().catch(() => "")
      );
      return null;
    }

    const data = (await res.json()) as PlaceDetailsResponse;
    const reviews = (data.reviews ?? [])
      .map((r): GoogleReviewItem | null => {
        const text = r.text?.text?.trim();
        if (!text) return null;
        const photoUri = r.authorAttribution?.photoUri?.trim();
        return {
          authorName: r.authorAttribution?.displayName?.trim() || "Google user",
          rating: Math.min(5, Math.max(1, Number(r.rating) || 0)) || 5,
          text,
          relativeTime: r.relativePublishTimeDescription?.trim() || "",
          authorUri: r.authorAttribution?.uri,
          authorPhotoUrl: photoUri || undefined,
        };
      })
      .filter((x): x is GoogleReviewItem => x !== null);

    const googleMapsUri = data.googleMapsUri?.trim();
    if (!googleMapsUri) {
      return null;
    }

    return {
      placeName: data.displayName?.text?.trim() || "Isaac Plans Insurance",
      rating: Number(data.rating) || 0,
      userRatingCount: Number(data.userRatingCount) || 0,
      reviews,
      googleMapsUri,
    };
  } catch (e) {
    console.error("[google-place-reviews]", e);
    return null;
  }
}
