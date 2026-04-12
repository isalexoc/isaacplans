import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { fetchGooglePlaceReviews } from "@/lib/google-place-reviews";
import { Card, CardContent } from "@/components/ui/card";

export default async function GoogleReviewsSection() {
  const t = await getTranslations("HomePage.googleReviews");
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

  const summary = t("summary", {
    count: data.userRatingCount,
    rating: data.rating.toFixed(1),
  });

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
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-[hsl(var(--custom))] mb-2">
            {t("label")}
          </p>
          <h2
            id="google-reviews-heading"
            className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white"
          >
            {t("title")}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {data.placeName}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-lg text-gray-700 dark:text-gray-300">
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Star
                className="h-6 w-6 fill-current"
                aria-hidden
              />
              {data.rating.toFixed(1)}
            </span>
            <span className="text-gray-400">·</span>
            <span>{summary}</span>
          </div>
          <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] mx-auto mt-6 rounded-full" />
        </div>

        {hasReviews ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
            {data.reviews.map((review, i) => (
              <li key={`${review.authorName}-${i}`}>
                <Card className="h-full border border-gray-200/80 dark:border-gray-800 shadow-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
                  <CardContent className="pt-6 pb-6 flex flex-col gap-3">
                    <div
                      className="flex gap-0.5"
                      aria-label={t("starsLabel", { n: review.rating })}
                    >
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star
                          key={si}
                          className={`h-4 w-4 ${
                            si < review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm flex-1">
                      &ldquo;{review.text}&rdquo;
                    </p>
                    <div className="flex flex-col gap-0.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {review.authorName}
                      </span>
                      {review.relativeTime ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {review.relativeTime}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
          <Link
            href={data.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-[hsl(var(--custom))] px-6 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity"
          >
            {t("viewOnGoogle")}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
            {t("attribution")}
          </p>
        </div>
      </div>
    </section>
  );
}
