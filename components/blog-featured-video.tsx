"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { BlogVideoOrientation, ParsedBlogVideo } from "@/lib/blog-featured-video";

/**
 * Aspect-ratio class per orientation. These live here rather than beside the rest of the video
 * config in `lib/` because Tailwind only scans `app/`, `components/`, and `pages/` — a class
 * string written in `lib/` never gets generated, and the player silently collapses to zero height.
 */
const ASPECT_CLASS: Record<BlogVideoOrientation, string> = {
  landscape: "aspect-video",
  vertical: "aspect-[9/16]",
  square: "aspect-square",
};

/**
 * The blog post hero when the post has a featured video: the featured image fills the slot with a
 * play button over it, and the video takes over on click.
 *
 * The click-to-play facade is the whole point, not decoration. Mounting a YouTube iframe on load
 * pulls ~800 KB of third-party JavaScript into the critical path of a page whose LCP is the hero
 * itself — it would cost real Core Web Vitals on every post with a video, including for the
 * majority of readers who never press play. Rendering the poster the page was already going to
 * render and mounting the embed on click keeps a video post exactly as fast as an image post.
 *
 * Mirrors `components/media/hero-video-player.tsx`, which does the same thing for LOB page heroes;
 * this one additionally handles iframe embeds and non-landscape aspect ratios.
 */
export default function BlogFeaturedVideo({
  video,
  posterUrl,
  alt,
  locale,
}: {
  video: ParsedBlogVideo;
  /** Featured image, pre-cropped to the player's aspect ratio. Null when the post has no image. */
  posterUrl: string | null;
  alt: string;
  locale: string;
}) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isSpanish = locale === "es";
  const playLabel = isSpanish ? `Reproducir video: ${alt}` : `Play video: ${alt}`;

  function start() {
    setStarted(true);
    // Belt and braces for a native file. The element carries `autoPlay` and only ever mounts as
    // the direct result of this click, so the page still holds transient user activation and the
    // browser lets it play with sound — that alone is enough. This second nudge covers the case
    // where the autoplay attempt is refused but a direct `play()` inside the activation window is
    // still honoured; a rejected promise is harmless either way.
    //
    // Note this ref is null right now: unlike `components/media/hero-video-player.tsx`, whose
    // <video> is always mounted with `controls={started}`, this one lives behind `started`. React
    // commits before the frame callback runs, so by then it is populated — but `autoPlay` is what
    // actually guarantees playback, not this timing.
    if (video.kind === "file") {
      requestAnimationFrame(() => {
        void videoRef.current?.play().catch(() => {
          /* the user can still press the native control */
        });
      });
    }
  }

  const isVertical = video.orientation === "vertical";

  return (
    <figure
      className={`mb-8 w-full overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-black/5 dark:ring-white/10 ${
        // A 9:16 player at full column width would push the article text off the first screen.
        isVertical ? "mx-auto max-w-[420px]" : ""
      }`}
    >
      <div className={`relative w-full ${ASPECT_CLASS[video.orientation]}`}>
        {started ? (
          video.kind === "embed" ? (
            <iframe
              src={video.src}
              title={alt}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={video.src}
              className="absolute inset-0 h-full w-full object-contain"
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          )
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={playLabel}
            className="group absolute inset-0 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
          >
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={alt}
                fill
                className="object-cover object-center"
                sizes={
                  isVertical
                    ? "(max-width: 480px) 100vw, 420px"
                    : "(max-width: 768px) 100vw, (max-width: 1200px) min(90vw, 896px), 896px"
                }
                priority
              />
            ) : (
              <span
                className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"
                aria-hidden
              />
            )}
            {/* Slight scrim so the white play button stays legible over a bright poster. */}
            <span
              className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/25"
              aria-hidden
            />
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
                {/* Pulsing ring — pure CSS, and `motion-reduce` stops it for anyone who asked. */}
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50 motion-reduce:hidden" />
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-2xl transition-transform duration-200 group-hover:scale-110 sm:h-20 sm:w-20">
                  {/* Nudged right: a triangle centred on its bounding box looks left-heavy. */}
                  <Play className="ml-1 h-7 w-7 fill-brand text-brand sm:h-9 sm:w-9" />
                </span>
              </span>
            </span>
          </button>
        )}
      </div>
    </figure>
  );
}
