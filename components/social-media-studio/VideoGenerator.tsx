"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Film, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  SocialPostSource,
  VideoScript,
  VideoImage,
  GeneratedVideo,
  SocialLocale,
} from "@/lib/social-media-studio/types";

interface Props {
  source: SocialPostSource;
  videoScript?: VideoScript;
  defaultLocale: SocialLocale;
  /** Lifts the finished video up so the publish step can auto-fill the YouTube URL. */
  onVideoReady: (video: GeneratedVideo) => void;
  /** Lifts the generated portrait images up so they persist on Save to Sanity. */
  onImagesReady: (images: VideoImage[]) => void;
  initialVideoUrl?: string;
}

type GenState = "idle" | "images" | "rendering" | "done" | "error";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90;

export function VideoGenerator({
  source,
  videoScript,
  defaultLocale,
  onVideoReady,
  onImagesReady,
  initialVideoUrl,
}: Props) {
  const [voiceLang, setVoiceLang] = useState<SocialLocale>(defaultLocale);
  const [state, setState]         = useState<GenState>(initialVideoUrl ? "done" : "idle");
  const [videoUrl, setVideoUrl]   = useState<string>(initialVideoUrl ?? "");
  const [images, setImages]       = useState<VideoImage[]>([]);
  const [error, setError]         = useState<string | undefined>();
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const canGenerate = Boolean(videoScript?.fullScript);

  async function poll(projectId: string, durationSeconds: number) {
    const category = source.category;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (!aliveRef.current) return;
      const url = `/api/admin/social-media-studio/generate-video/status?projectId=${encodeURIComponent(projectId)}${category ? `&category=${encodeURIComponent(category)}` : ""}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Render failed");
      if (data.data.status === "done" && data.data.videoUrl) {
        if (!aliveRef.current) return;
        setVideoUrl(data.data.videoUrl);
        setState("done");
        onVideoReady({ url: data.data.videoUrl, durationSeconds, projectId, voiceLanguage: voiceLang });
        return;
      }
    }
    throw new Error("Render timed out. Please try again.");
  }

  async function generate() {
    if (!videoScript) return;
    setError(undefined);
    setVideoUrl("");
    setImages([]);
    setState("images");
    try {
      // Phase A — generate the portrait scene images + storyboard.
      const imgRes = await fetch("/api/admin/social-media-studio/generate-video-images", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source, videoScript, locale: voiceLang }),
      });
      const imgData = await imgRes.json();
      if (!imgData.success) throw new Error(imgData.error ?? "Image generation failed");
      if (!aliveRef.current) return;
      setImages(imgData.data.images);
      onImagesReady(imgData.data.images);

      // Phase B — render the video from the storyboard.
      setState("rendering");
      const renderRes = await fetch("/api/admin/social-media-studio/generate-video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ storyboard: imgData.data.storyboard }),
      });
      const renderData = await renderRes.json();
      if (!renderData.success) throw new Error(renderData.error ?? "Could not start video render");
      await poll(renderData.data.projectId, renderData.data.durationSeconds);
    } catch (err) {
      if (!aliveRef.current) return;
      setState("error");
      setError(err instanceof Error ? err.message : "Video generation failed");
    }
  }

  const busy = state === "images" || state === "rendering";

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm">AI YouTube Short</h3>
        <span className="text-xs text-muted-foreground">— AI portrait images + voiceover + captions + music, 9:16</span>
      </div>

      {!canGenerate && (
        <p className="text-xs text-amber-600">Generate a video script first to enable AI video.</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Voiceover language:</span>
        <div className="flex gap-2">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              disabled={busy}
              onClick={() => setVoiceLang(l)}
              className={cn(
                "px-3 py-1 text-xs border rounded-md transition-colors disabled:opacity-50",
                voiceLang === l ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
              )}
            >
              {l === "en" ? "English" : "Español"}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={generate} disabled={!canGenerate || busy} className="w-fit">
        {state === "images" ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating images… (~60–90s)</>
        ) : state === "rendering" ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rendering video… (30–120s)</>
        ) : state === "done" ? (
          <><RotateCcw className="h-4 w-4 mr-2" /> Regenerate video</>
        ) : (
          <><Film className="h-4 w-4 mr-2" /> Generate AI Video</>
        )}
      </Button>

      {/* Thumbnail grid of the generated portrait images */}
      {images.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{images.length} portrait images generated for this video:</p>
          <div className="grid grid-cols-5 gap-1.5">
            {images.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={`Scene ${i + 1}`}
                className="w-full rounded border bg-muted object-cover"
                style={{ aspectRatio: "9 / 16" }}
              />
            ))}
          </div>
        </div>
      )}

      {state === "error" && error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <button onClick={generate} className="shrink-0 underline hover:no-underline">Retry</button>
        </div>
      )}

      {state === "done" && videoUrl && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Video ready — the YouTube URL below is auto-filled.
          </div>
          <video
            src={videoUrl}
            controls
            className="rounded-md border bg-black"
            style={{ aspectRatio: "9 / 16", maxHeight: 360, width: "auto" }}
          />
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline w-fit">
            Download / open video
          </a>
        </div>
      )}
    </div>
  );
}
