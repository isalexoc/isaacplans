"use client";

import { useRef, useState } from "react";
import { FileText, Crop, Languages } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VideoStoryboard } from "@/lib/social-media-studio/types";

/**
 * The recorded take, and the shape of the edit built around it.
 *
 * The timeline strip is the point of this panel: it shows, before a penny is spent on images or
 * Veo clips, exactly where the ad cuts away from his face and how long it stays away. Clicking a
 * segment seeks the preview to that second, so he can watch his own delivery at the cut and judge
 * whether it lands — which is the one thing no amount of generated preview art can tell him.
 */
export function ARollPanel({
  storyboard,
  hookText,
  ctaText,
  onHookChange,
  onCtaChange,
  onCommit,
  disabled,
}: {
  storyboard: VideoStoryboard;
  hookText: string;
  ctaText: string;
  onHookChange: (value: string) => void;
  onCtaChange: (value: string) => void;
  /** Fired on blur — the cards are persisted then, not on every keystroke. */
  onCommit: (patch: { hookText?: string; ctaText?: string }) => void;
  disabled?: boolean;
}) {
  const aRoll = storyboard.aRoll;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  if (!aRoll) return null;

  const duration = aRoll.durationSec || 1;
  const cutaways = storyboard.scenes
    .map((s, index) => ({ index, start: s.startSec ?? 0, length: s.lengthSec ?? 0, scene: s }))
    .filter((c) => c.length > 0)
    .sort((a, b) => a.start - b.start);

  const brollSeconds = cutaways.reduce((n, c) => n + c.length, 0);
  const isLandscape =
    typeof aRoll.width === "number" && typeof aRoll.height === "number" && aRoll.width > aRoll.height;

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(seconds, duration - 0.1));
    void video.play().catch(() => undefined);
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start gap-4">
        {/* The take itself, at the shape it will be delivered in. */}
        <video
          ref={videoRef}
          src={aRoll.videoUrl}
          controls
          playsInline
          onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
          className="h-56 w-auto rounded-md border bg-black object-contain"
        />

        <div className="min-w-[14rem] flex-1 space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {duration.toFixed(1)}s
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Languages className="h-3 w-3" />
              {aRoll.language === "es" ? "Español" : "English"} — detected from your voice
            </span>
          </div>

          <p className="text-muted-foreground">
            {cutaways.length
              ? `${cutaways.length} cutaway${cutaways.length === 1 ? "" : "s"} · ${brollSeconds.toFixed(
                  1
                )}s of story over ${duration.toFixed(1)}s of you (${Math.round(
                  (brollSeconds / duration) * 100
                )}%)`
              : "No cutaways yet — this will render as you, with captions and music."}
          </p>

          {isLandscape && (
            <p className="flex items-start gap-1.5 text-amber-600">
              <Crop className="mt-0.5 h-3 w-3 shrink-0" />
              This was shot landscape ({aRoll.width}×{aRoll.height}). It will be cropped to 9:16
              around you — record vertically next time for the full frame.
            </p>
          )}

          <button
            type="button"
            onClick={() => setTranscriptOpen((v) => !v)}
            className="flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            <FileText className="h-3 w-3" />
            {transcriptOpen ? "Hide" : "Show"} what you said
          </button>
        </div>
      </div>

      {transcriptOpen && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs">
          {aRoll.segments.length ? (
            aRoll.segments.map((segment, i) => (
              <button
                key={`${segment.start}-${i}`}
                type="button"
                onClick={() => seekTo(segment.start)}
                className="block w-full text-left hover:text-blue-600"
              >
                <span className="mr-2 font-mono text-muted-foreground">
                  {segment.start.toFixed(1)}s
                </span>
                {segment.text}
              </button>
            ))
          ) : (
            <p className="whitespace-pre-wrap">{aRoll.transcript}</p>
          )}
        </div>
      )}

      {/* The edit, at a glance. Blue is him; amber is the story covering him. */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>The edit</span>
          <span>
            <span className="mr-2 inline-flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-blue-600" /> you
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> story
            </span>
          </span>
        </div>
        <div className="relative h-7 w-full overflow-hidden rounded-md bg-blue-600/80">
          {cutaways.map((c) => (
            <button
              key={c.index}
              type="button"
              title={`Cutaway ${c.index + 1}: ${c.start.toFixed(1)}s → ${(c.start + c.length).toFixed(1)}s${
                c.scene.narration ? ` — "${c.scene.narration}"` : ""
              }`}
              onClick={() => seekTo(c.start)}
              className="absolute inset-y-0 border-x border-white/40 bg-amber-500 transition-opacity hover:opacity-80"
              style={{
                left:  `${(c.start / duration) * 100}%`,
                width: `${(c.length / duration) * 100}%`,
              }}
            />
          ))}
          {/* Where the preview is now, so the strip and the video read as one thing. */}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
            style={{ left: `${Math.min(100, (playhead / duration) * 100)}%` }}
          />
        </div>
      </div>

      {/* The two burned-in cards. Both are optional — an empty field simply renders nothing. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="aroll-hook" className="text-xs font-medium text-muted-foreground">
            Hook card <span className="font-normal">— over your opening seconds</span>
          </label>
          <Input
            id="aroll-hook"
            value={hookText}
            disabled={disabled}
            onChange={(e) => onHookChange(e.target.value)}
            onBlur={(e) => onCommit({ hookText: e.target.value })}
            placeholder="La pregunta más incómoda…"
            className={cn("mt-1 text-sm", !hookText && "text-muted-foreground")}
          />
        </div>
        <div>
          <label htmlFor="aroll-cta" className="text-xs font-medium text-muted-foreground">
            CTA card <span className="font-normal">— over your closing seconds</span>
          </label>
          <Input
            id="aroll-cta"
            value={ctaText}
            disabled={disabled}
            onChange={(e) => onCtaChange(e.target.value)}
            onBlur={(e) => onCommit({ ctaText: e.target.value })}
            placeholder="Asesoría gratuita"
            className={cn("mt-1 text-sm", !ctaText && "text-muted-foreground")}
          />
        </div>
      </div>
    </div>
  );
}
