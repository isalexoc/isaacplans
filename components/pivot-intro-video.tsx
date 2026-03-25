"use client";

import { useEffect, useRef } from "react";

const CLOUD = "https://res.cloudinary.com/isaacdev";

/** Pivot Health “What is … 3-Year STM Coverage” video (Cloudinary) */
export const PIVOT_STM_VIDEO_PUBLIC_ID =
  "v1774456622/YTDown.com_YouTube_What-is-Pivot-Health-3-Year-STM-Coverage_Media_awfnpEGCVIE_001_1080p_hwhhwf";

const VIDEO_SRC = `${CLOUD}/video/upload/f_auto,q_auto/${PIVOT_STM_VIDEO_PUBLIC_ID}.mp4`;
const POSTER_SRC = `${CLOUD}/video/upload/so_2,f_jpg,q_auto,w_1280,h_720,c_fill/${PIVOT_STM_VIDEO_PUBLIC_ID}.jpg`;

const SPANISH_VTT_SRC = "/api/pivot-subtitles-es";

export type PivotIntroVideoProps = {
  locale: string;
  heading: string;
  description: string;
  captionNote?: string;
};

export default function PivotIntroVideo({
  locale,
  heading,
  description,
  captionNote,
}: PivotIntroVideoProps) {
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
