"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

/**
 * Click-to-play hero video: the poster fills the slot with an animated play button over it, and
 * the video takes over on click, with sound.
 *
 * The native `<video controls poster>` already does this, but its play button is the browser's —
 * small, unbranded, and different in every browser, which reads as "a file someone embedded"
 * rather than "a video worth watching". Hence the custom overlay.
 *
 * This is the only part of the hero media system that ships JavaScript, and it only loads on pages
 * where a click-to-play video is actually set. Background loops stay a pure server-rendered
 * `<video autoplay muted loop>` with no client bundle at all.
 *
 * The poster goes through `next/image` and the `<video>` deliberately has no `poster` attribute —
 * setting both would download the same still twice.
 */
export default function HeroVideoPlayer({
  src,
  posterUrl,
  alt,
  playLabel,
  className = "object-cover",
  sizes,
  priority,
}: {
  src: string;
  posterUrl: string;
  alt: string;
  /** Localized accessible name for the play button. Pass one on a non-English page. */
  playLabel?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function start() {
    setStarted(true);
    // The element is already mounted; play on the next frame so the overlay has cleared and the
    // gesture is still attributed to this click (autoplay policies allow sound after a real tap).
    requestAnimationFrame(() => {
      void videoRef.current?.play();
    });
  }

  return (
    <>
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full ${className}`}
        controls={started}
        playsInline
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
      </video>

      {!started && (
        <button
          type="button"
          onClick={start}
          aria-label={playLabel || (alt ? `Play video: ${alt}` : "Play video")}
          className="group absolute inset-0 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        >
          {posterUrl && (
            <Image src={posterUrl} alt={alt} fill className={className} sizes={sizes} priority={priority} />
          )}
          {/* Slight scrim so a white play button stays legible over a bright poster. */}
          <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/25" aria-hidden />
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
    </>
  );
}
