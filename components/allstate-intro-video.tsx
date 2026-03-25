"use client";

import { useEffect, useRef } from "react";

const CLOUD = "https://res.cloudinary.com/isaacdev";

/** Allstate Health Solutions short-term medical training video (Cloudinary) */
export const ALLSTATE_STM_VIDEO_PUBLIC_ID =
  "v1774452418/YTDown.com_YouTube_Short-Term-Medical-insurance-from-Allsta_Media_wYmx-fWDEsI_003_360p_xcw03s";

const VIDEO_SRC = `${CLOUD}/video/upload/f_auto,q_auto/${ALLSTATE_STM_VIDEO_PUBLIC_ID}.mp4`;
const POSTER_SRC = `${CLOUD}/video/upload/so_1,f_jpg,q_auto,w_1280,h_720,c_fill/${ALLSTATE_STM_VIDEO_PUBLIC_ID}.jpg`;

/** Same-origin proxy — see app/api/allstate-subtitles-es/route.ts */
const SPANISH_VTT_SRC = "/api/allstate-subtitles-es";

export type AllstateIntroVideoProps = {
  locale: string;
  heading: string;
  description: string;
  captionNote?: string;
};

/**
 * Responsive HTML5 video. Spanish locale: WebVTT via same-origin API proxy
 * (avoids cross-origin <track> issues with Cloudinary raw URLs).
 */
export default function AllstateIntroVideo({
  locale,
  heading,
  description,
  captionNote,
}: AllstateIntroVideoProps) {
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
