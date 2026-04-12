"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Quote, Star } from "lucide-react";
import type { GoogleReviewItem } from "@/lib/google-place-reviews";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

function StarRow({
  rating,
  label,
  size = "sm",
}: {
  rating: number;
  label: string;
  size?: "sm" | "md";
}) {
  const starClass = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex gap-0.5" aria-label={label}>
      {Array.from({ length: 5 }).map((_, si) => (
        <Star
          key={si}
          className={cn(
            starClass,
            si < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function ReviewAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(photoUrl) && !failed;

  return (
    <div
      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-gray-900 bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.08)]"
      aria-hidden
    >
      {showImage ? (
        <Image
          src={photoUrl!}
          alt=""
          width={44}
          height={44}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[hsl(var(--custom))]">
          {initial}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  starsLabel,
}: {
  review: GoogleReviewItem;
  starsLabel: (n: number) => string;
}) {
  return (
    <Card
      className={cn(
        "h-full border border-gray-200/90 dark:border-gray-800",
        "rounded-2xl shadow-sm bg-white/95 dark:bg-gray-900/95",
        "backdrop-blur-sm transition-shadow duration-200 hover:shadow-md",
        "flex flex-col"
      )}
    >
      <CardContent className="pt-6 pb-6 px-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ReviewAvatar
              name={review.authorName}
              photoUrl={review.authorPhotoUrl}
            />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {review.authorName}
              </p>
              {review.relativeTime ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {review.relativeTime}
                </p>
              ) : null}
            </div>
          </div>
          <StarRow
            rating={review.rating}
            label={starsLabel(review.rating)}
          />
        </div>

        <div className="relative flex-1">
          <Quote
            className="absolute -left-1 -top-1 h-8 w-8 text-[hsl(var(--custom)/0.12)] dark:text-[hsl(var(--custom)/0.2)]"
            aria-hidden
          />
          <p className="text-gray-700 dark:text-gray-200 leading-relaxed text-sm pl-6 line-clamp-6">
            {review.text}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export type GoogleReviewsDisplayProps = {
  reviews: GoogleReviewItem[];
  placeName: string;
  rating: number;
  userRatingCount: number;
  googleMapsUri: string;
};

export default function GoogleReviewsDisplay({
  reviews,
  placeName,
  rating,
  userRatingCount,
  googleMapsUri,
}: GoogleReviewsDisplayProps) {
  const t = useTranslations("HomePage.googleReviews");

  const summary = t("summary", {
    count: userRatingCount,
    rating: rating.toFixed(1),
  });

  const starsLabel = (n: number) => t("starsLabel", { n });
  const roundedOverall = Math.min(5, Math.max(1, Math.round(rating)));

  return (
    <>
      <div className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-sm font-semibold text-[hsl(var(--custom))] mb-2">
          {t("label")}
        </p>
        <h2
          id="google-reviews-heading"
          className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white"
        >
          {t("title")}
        </h2>
        <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] mx-auto mt-6 rounded-full" />
      </div>

      {/* Aggregate trust block */}
      <div className="mx-auto mb-12 max-w-2xl">
        <div
          className={cn(
            "rounded-2xl border border-[hsl(var(--custom)/0.2)] bg-white/90 dark:bg-gray-900/90",
            "px-6 py-8 sm:px-10 shadow-sm",
            "backdrop-blur-sm"
          )}
        >
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
            <div className="flex flex-col items-center">
              <span className="text-5xl font-black tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                {rating.toFixed(1)}
              </span>
              <div className="mt-2 flex items-center gap-1 text-amber-500">
                <StarRow
                  rating={roundedOverall}
                  label={starsLabel(roundedOverall)}
                  size="md"
                />
              </div>
            </div>
            <div className="hidden h-20 w-px shrink-0 bg-gradient-to-b from-transparent via-gray-200 to-transparent dark:via-gray-700 sm:block" />
            <div className="text-center sm:text-left">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {placeName}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {summary}
              </p>
            </div>
          </div>
        </div>
      </div>

      {reviews.length > 0 ? (
        <>
          {/* Desktop / tablet: grid */}
          <ul className="hidden list-none gap-6 p-0 md:grid md:grid-cols-2 lg:grid-cols-3 m-0">
            {reviews.map((review, i) => (
              <li key={`${review.authorName}-${i}`}>
                <div className="relative h-full">
                  <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900/95 dark:text-gray-400 dark:ring-gray-700">
                    {t("sourceBadge")}
                  </span>
                  <ReviewCard review={review} starsLabel={starsLabel} />
                </div>
              </li>
            ))}
          </ul>

          {/* Mobile: carousel */}
          <div className="relative px-10 md:hidden">
            <Carousel
              opts={{ align: "start", loop: false }}
              className="w-full"
              aria-label={t("label")}
            >
              <CarouselContent className="-ml-3">
                {reviews.map((review, i) => (
                  <CarouselItem
                    key={`${review.authorName}-m-${i}`}
                    className="pl-3 basis-[88%] sm:basis-[75%]"
                  >
                    <div className="relative">
                      <span className="absolute -right-0.5 -top-1 z-10 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900/95 dark:text-gray-400 dark:ring-gray-700">
                        {t("sourceBadge")}
                      </span>
                      <ReviewCard review={review} starsLabel={starsLabel} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious
                className="left-0 border-gray-200 bg-white/95 shadow-sm dark:border-gray-700 dark:bg-gray-900/95"
                aria-label={t("carouselPrev")}
              />
              <CarouselNext
                className="right-0 border-gray-200 bg-white/95 shadow-sm dark:border-gray-700 dark:bg-gray-900/95"
                aria-label={t("carouselNext")}
              />
            </Carousel>
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
              {t("carouselHint")}
            </p>
          </div>
        </>
      ) : null}

      <div className="mt-10 flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:gap-6">
        <Button
          asChild
          className="rounded-md bg-[hsl(var(--custom))] px-6 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95 h-auto"
        >
          <Link href={googleMapsUri} target="_blank" rel="noopener noreferrer">
            {t("viewOnGoogle")}
          </Link>
        </Button>
        <p className="max-w-md text-xs text-gray-500 dark:text-gray-400">
          {t("attribution")}
        </p>
      </div>
    </>
  );
}
