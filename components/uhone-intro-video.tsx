"use client";

import { useEffect, useRef } from "react";

const CLOUD = "https://res.cloudinary.com/isaacdev";
/** Public ID (path + filename without extension) for the UHOne / Golden Rule intro video */
export const UHONE_INTRO_VIDEO_PUBLIC_ID =
  "v1774442281/An_Intro_to_UnitedHealthcare_Golden_Rule_Insurance_Company__Source_wha7i9";

/** Trimmed to first 27 seconds via Cloudinary `du_27`. */
const VIDEO_SRC = `${CLOUD}/video/upload/du_27,f_auto,q_auto/${UHONE_INTRO_VIDEO_PUBLIC_ID}.mp4`;
const POSTER_SRC = `${CLOUD}/video/upload/so_2,f_jpg,q_auto,w_1280,h_720,c_fill/${UHONE_INTRO_VIDEO_PUBLIC_ID}.jpg`;

/** Same-origin proxy — see app/api/uhone-subtitles-es/route.ts */
const SPANISH_VTT_SRC = "/api/uhone-subtitles-es";

export type UhoneIntroVideoProps = {
  locale: string;
  heading: string;
  description: string;
  /** Shown under the player when Spanish subtitles are used */
  captionNote?: string;
};

/**
 * Responsive HTML5 video from Cloudinary. Spanish locale: WebVTT via same-origin API
 * proxy (avoids cross-origin <track> / CORS issues with Cloudinary raw URLs).
 */
export default function UhoneIntroVideo({
  locale,
  heading,
  description,
  captionNote,
}: UhoneIntroVideoProps) {
  const isEs = locale.startsWith("es");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isEs) return;
    const el = videoRef.current;
    if (!el) return;

    const showFirstSubtitles = () => {
      const { textTracks } = el;
      for (let i = 0; i < textTracks.length; i++) {
        if (
          textTracks[i].kind === "subtitles" ||
          textTracks[i].kind === "captions"
        ) {
          textTracks[i].mode = "showing";
          return;
        }
      }
    };

    el.addEventListener("loadedmetadata", showFirstSubtitles);
    el.addEventListener("canplay", showFirstSubtitles);
    showFirstSubtitles();

    return () => {
      el.removeEventListener("loadedmetadata", showFirstSubtitles);
      el.removeEventListener("canplay", showFirstSubtitles);
    };
  }, [isEs]);

  return (
    <div className="mt-8 w-full max-w-4xl">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {heading}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-black shadow-md ring-1 ring-black/5">
        <div className="aspect-video w-full">
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            controls
            playsInline
            preload="metadata"
            poster={POSTER_SRC}
            aria-label={heading}
          >
            <source src={VIDEO_SRC} type="video/mp4" />
            {isEs ? (
              <track
                kind="subtitles"
                srcLang="es"
                label="Español"
                src={SPANISH_VTT_SRC}
                default
              />
            ) : null}
          </video>
        </div>
      </div>

      {isEs && captionNote ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {captionNote}
        </p>
      ) : null}
    </div>
  );
}
