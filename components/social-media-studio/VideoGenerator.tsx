"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Film, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  SocialPostSource,
  SocialCreativeImages,
  VideoScript,
  GeneratedVideo,
  SocialLocale,
} from "@/lib/social-media-studio/types";

interface Props {
  source: SocialPostSource;
  videoScript?: VideoScript;
  images?: SocialCreativeImages;
  defaultLocale: SocialLocale;
  /** Lifts the finished video up so the publish step can auto-fill the YouTube URL. */
  onVideoReady: (video: GeneratedVideo) => void;
  initialVideoUrl?: string;
}

type GenState = "idle" | "submitting" | "rendering" | "done" | "error";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90; // ~6 minutes safety cap

export function VideoGenerator({
  source,
  videoScript,
  images,
  defaultLocale,
  onVideoReady,
  initialVideoUrl,
}: Props) {
  const [voiceLang, setVoiceLang] = useState<SocialLocale>(defaultLocale);
  const [state, setState]         = useState<GenState>(initialVideoUrl ? "done" : "idle");
  const [videoUrl, setVideoUrl]   = useState<string>(initialVideoUrl ?? "");
  const [error, setError]         = useState<string | undefined>();
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const hasScript = Boolean(videoScript?.fullScript);
  const hasImage  = Boolean(images?.sourceImageUrl || images?.vertical || images?.square);
  const canGenerate = hasScript && hasImage;

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
        onVideoReady({
          url:             data.data.videoUrl,
          durationSeconds,
          projectId,
          voiceLanguage:   voiceLang,
        });
        return;
      }
    }
    throw new Error("Render timed out. Please try again.");
  }

  async function generate() {
    if (!videoScript || !images) return;
    setState("submitting");
    setError(undefined);
    try {
      const res = await fetch("/api/admin/social-media-studio/generate-video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source, videoScript, images, locale: voiceLang }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Could not start video generation");
      setState("rendering");
      await poll(data.data.projectId, data.data.durationSeconds);
    } catch (err) {
      if (!aliveRef.current) return;
      setState("error");
      setError(err instanceof Error ? err.message : "Video generation failed");
    }
  }

  const busy = state === "submitting" || state === "rendering";

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm">AI YouTube Short</h3>
        <span className="text-xs text-muted-foreground">— images + voiceover + captions, 9:16</span>
      </div>

      {!canGenerate && (
        <p className="text-xs text-amber-600">
          {hasScript ? "Generate images first" : "Generate a video script first"} to enable AI video.
        </p>
      )}

      {/* Voice language */}
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

      {/* Generate button */}
      <Button onClick={generate} disabled={!canGenerate || busy} className="w-fit">
        {state === "submitting" ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting render…</>
        ) : state === "rendering" ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rendering video… (30–120s)</>
        ) : state === "done" ? (
          <><RotateCcw className="h-4 w-4 mr-2" /> Regenerate video</>
        ) : (
          <><Film className="h-4 w-4 mr-2" /> Generate AI Video</>
        )}
      </Button>

      {/* Error */}
      {state === "error" && error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <button onClick={generate} className="shrink-0 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Preview */}
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
