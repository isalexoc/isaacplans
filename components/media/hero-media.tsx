import Image from "next/image";
import HeroVideoPlayer from "@/components/media/hero-video-player";
import type { HeroMedia as HeroMediaValue } from "@/lib/page-media/shared";

/**
 * Renders whatever the admin set for a page's hero — a still image, an autoplaying background
 * loop, or a click-to-play video with sound.
 *
 * **A server component on purpose: this ships no JavaScript.** The obvious alternative,
 * `next-cloudinary`'s `CldVideoPlayer`, is video.js under the hood — a large client bundle plus a
 * stylesheet import on pages whose LCP directly costs ad money. A plain `<video>` does everything
 * needed here: `autoPlay muted loop playsInline` is a background loop, `controls` is a player, and
 * `poster` covers the gap before the first frame decodes.
 *
 * `preload="metadata"` means the browser fetches only headers until playback starts, so a hero
 * video costs roughly a still image on first paint.
 *
 * Reduced motion is handled with Tailwind's `motion-reduce:` variant rather than JS: the looping
 * video and its poster are both rendered, and CSS picks one. Someone who has asked their OS to
 * stop animations gets the still.
 *
 * Every variant fills its positioned parent (`fill` / `absolute inset-0`), matching what the
 * `<Image fill>` it replaces already required.
 */
export default function HeroMedia({
  media,
  alt,
  className = "object-cover",
  sizes,
  priority,
}: {
  media: HeroMediaValue;
  /** Describe the image for screen readers. Decorative background loops are hidden instead. */
  alt: string;
  /** Object-fit / rounding classes for the visual itself. */
  className?: string;
  /** `next/image` sizes hint — ignored for video. */
  sizes?: string;
  priority?: boolean;
}) {
  if (media.type === "image") {
    return (
      <Image src={media.url} alt={alt} fill className={className} sizes={sizes} priority={priority} />
    );
  }

  const videoBase = `absolute inset-0 h-full w-full ${className}`;

  if (media.playback === "click") {
    return (
      <HeroVideoPlayer
        src={media.url}
        posterUrl={media.posterUrl}
        alt={alt}
        className={className}
        sizes={sizes}
        priority={priority}
      />
    );
  }

  return (
    <>
      <video
        className={`${videoBase} motion-reduce:hidden`}
        poster={media.posterUrl || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        // Decorative: the headline beside it carries the meaning, and a muted silent loop has
        // nothing to announce.
        aria-hidden="true"
      >
        <source src={media.url} type="video/mp4" />
      </video>
      {media.posterUrl && (
        <Image
          src={media.posterUrl}
          alt={alt}
          fill
          className={`hidden motion-reduce:block ${className}`}
          sizes={sizes}
          priority={priority}
        />
      )}
    </>
  );
}
