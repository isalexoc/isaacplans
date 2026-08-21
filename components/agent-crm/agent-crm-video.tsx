"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play, Video } from "lucide-react";
import { parseAgentCrmVideoUrl, type AgentCrmHeroMedia } from "@/lib/agent-crm-affiliate";

/**
 * The media slot on /agent-crm.
 *
 * Four states, in the order they actually happen for a given language:
 *
 * 1. No video and no image — a designed "coming soon" frame. Deliberately NOT a play button that
 *    does nothing: the page gets shared before the clip exists, and a dead control reads as a
 *    broken site, which costs more trust than an honest placeholder.
 * 2. No video but an image — a plain still, no play affordance at all. This is English today.
 *    It must not look like a video, or the first click is a disappointment; the section's English
 *    copy is written for a picture to match.
 * 3. Video set, not clicked — the poster with a play button over it. Nothing else mounts. An
 *    embed on load pulls several hundred KB of third-party JavaScript into the critical path of
 *    the page's largest element for the majority of visitors who never press play, and a native
 *    file would start fetching tens of MB. Same click-to-play facade the blog and LOB heroes use.
 * 4. Clicked — the real player, autoplaying.
 *
 * A video URL that doesn't parse degrades to state 2 or 1 rather than rendering a blank box, so a
 * mistyped link can weaken the section but never empty it.
 */
export default function AgentCrmWalkthrough({
  media,
  playLabel,
  imageAlt,
  placeholderTitle,
  placeholderBody,
}: {
  media: AgentCrmHeroMedia;
  playLabel: string;
  /** Alt text for the still shown when a language has no clip yet. */
  imageAlt: string;
  placeholderTitle: string;
  placeholderBody: string;
}) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const parsed = parseAgentCrmVideoUrl(media.videoUrl);

  function start() {
    setStarted(true);
    // The <video> carries `autoPlay` and only mounts as the direct result of this click, so the
    // page still holds transient user activation and the browser lets it play with sound — that
    // is what actually guarantees playback. This is a belt-and-braces second nudge for the case
    // where the autoplay attempt is refused but a direct play() inside the activation window is
    // honoured; the ref is null at this instant and is populated by the time the frame callback
    // runs. A rejected promise is harmless. Embeds autoplay via their own URL params instead.
    if (parsed?.kind === "file") {
      requestAnimationFrame(() => {
        void videoRef.current?.play().catch(() => {
          /* the viewer can still press the native control */
        });
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
      <div className="relative aspect-video w-full">
        {!parsed && media.imageUrl ? (
          /* Still only — no play button, no scrim, nothing that hints at a video. */
          <Image
            src={media.imageUrl}
            alt={imageAlt}
            fill
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 960px"
            priority
          />
        ) : !parsed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 via-slate-800 to-brand/40 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Video className="h-8 w-8 text-white/80" />
            </span>
            <p className="text-lg font-bold text-white sm:text-xl">{placeholderTitle}</p>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">{placeholderBody}</p>
          </div>
        ) : started ? (
          parsed.kind === "embed" ? (
            <iframe
              src={parsed.src}
              title={playLabel}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={parsed.src}
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
            {media.posterUrl ? (
              <Image
                src={media.posterUrl}
                alt={playLabel}
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 960px"
                priority
              />
            ) : (
              <span
                className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-brand/40"
                aria-hidden
              />
            )}
            {/* Slight scrim so the white play button stays legible over a bright poster. */}
            <span
              className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30"
              aria-hidden
            />
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
                {/* Pure-CSS pulse; `motion-reduce` stops it for anyone who asked it to. */}
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
    </div>
  );
}
