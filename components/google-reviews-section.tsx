import { getLocale } from "next-intl/server";
import { fetchGooglePlaceReviews } from "@/lib/google-place-reviews";
import GoogleReviewsDisplay from "@/components/google-reviews-display";

export default async function GoogleReviewsSection() {
  const locale = await getLocale();
  const lang = locale === "es" ? "es" : "en";

  const data = await fetchGooglePlaceReviews(lang);

  if (!data) {
    return null;
  }

  const hasReviews = data.reviews.length > 0;
  if (!hasReviews && data.userRatingCount === 0) {
    return null;
  }

  return (
    <section
      className="relative py-16 lg:py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
      aria-labelledby="google-reviews-heading"
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-10 right-0 w-80 h-80 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-0 w-80 h-80 bg-[hsl(var(--custom)/0.06)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto relative z-10 max-w-6xl">
        <GoogleReviewsDisplay
          reviews={data.reviews}
          placeName={data.placeName}
          rating={data.rating}
          userRatingCount={data.userRatingCount}
          googleMapsUri={data.googleMapsUri}
        />
      </div>
    </section>
  );
}
