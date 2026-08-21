"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play, Video } from "lucide-react";
import { parseAgentCrmVideoUrl, type AgentCrmVideo } from "@/lib/agent-crm-affiliate";

/**
 * The walkthrough slot on /agent-crm.
 *
 * Three states, in the order they'll actually happen:
 *
 * 1. No URL yet — a designed "coming soon" frame. Deliberately NOT a play button that does
 *    nothing: the page is being shared before the clip exists, and a dead control reads as a
 *    broken site, which costs more trust than an honest placeholder.
 * 2. URL set, not clicked — the poster with a play button over it. The embed does not mount.
 *    A YouTube iframe on load pulls several hundred KB of third-party JavaScript into the
 *    critical path of the page's largest element, for the majority of visitors who never press
 *    play. Same click-to-play facade the blog and LOB heroes use, for the same reason.
 * 3. Clicked — the real player, autoplaying.
 *
 * A URL that doesn't parse falls back to state 1 rather than rendering a blank box, so a mistyped
 * link can degrade the section but never blank it.
 */
export default function AgentCrmWalkthrough({
  video,
  playLabel,
  placeholderTitle,
  placeholderBody,
}: {
  video: AgentCrmVideo;
  playLabel: string;
  placeholderTitle: string;
  placeholderBody: string;
}) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const parsed = parseAgentCrmVideoUrl(video.url);

  function start() {
    setStarted(true);
    // A native file element is already mounted, so play on the next frame while the click still
    // counts as the gesture that lets it play with sound. Embeds autoplay via their own URL
    // params instead — that iframe doesn't exist until this state flips.
    if (parsed?.kind === "file") {
      requestAnimationFrame(() => {
        void videoRef.current?.play();
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
      <div className="relative aspect-video w-full">
        {!parsed ? (
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
            {video.posterUrl ? (
              <Image
                src={video.posterUrl}
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
