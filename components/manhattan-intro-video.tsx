"use client";

import { useEffect, useRef } from "react";

const CLOUD = "https://res.cloudinary.com/isaacdev";

/** Manhattan Life “Our New Brand” video (Cloudinary) */
export const MANHATTAN_BRAND_VIDEO_PUBLIC_ID =
  "v1774453895/YTDown.com_YouTube_Our-New-Brand-ManhattanLife_Media_YVhoadtg2ic_002_720p_ia5gsq";

const VIDEO_SRC = `${CLOUD}/video/upload/f_auto,q_auto/${MANHATTAN_BRAND_VIDEO_PUBLIC_ID}.mp4`;
const POSTER_SRC = `${CLOUD}/video/upload/so_1,f_jpg,q_auto,w_1280,h_720,c_fill/${MANHATTAN_BRAND_VIDEO_PUBLIC_ID}.jpg`;

const SPANISH_VTT_SRC = "/api/manhattan-subtitles-es";

export type ManhattanIntroVideoProps = {
  locale: string;
  heading: string;
  description: string;
  captionNote?: string;
};

export default function ManhattanIntroVideo({
  locale,
  heading,
  description,
  captionNote,
}: ManhattanIntroVideoProps) {
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
    <div className="motion-safe:animate-fadeUp-d4 mt-10 w-full max-w-4xl">
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
