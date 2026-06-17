"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Film, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SocialLocale } from "@/lib/social-media-studio/types";

/** Sanity-shaped video script (uses `onScreenText`, optional fields). */
export interface SanityVideoScript {
  duration?: number;
  hookScript?: string;
  fullScript?: string;
  onScreenText?: string[];
  suggestedCaption?: string;
}

interface Props {
  postId: string;
  sourceTitle: string;
  sourceCategory?: string;
  sourceLocale: SocialLocale;
  sourcePublicUrl?: string;
  videoScript?: SanityVideoScript;
  sourceImageUrl?: string;
  verticalImageUrl?: string;
  squareImageUrl?: string;
  imageHeadline?: string;
  initialVideoUrl?: string;
  /** Lifts the finished video URL up so the publish section can auto-fill YouTube. */
  onVideoReady: (url: string) => void;
}

type GenState = "idle" | "submitting" | "rendering" | "done" | "error";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90;

export function HistoryVideoGenerator({
  postId,
  sourceTitle,
  sourceCategory,
  sourceLocale,
  sourcePublicUrl,
  videoScript,
  sourceImageUrl,
  verticalImageUrl,
  squareImageUrl,
  imageHeadline,
  initialVideoUrl,
  onVideoReady,
}: Props) {
  const [voiceLang, setVoiceLang] = useState<SocialLocale>(sourceLocale);
  const [state, setState]         = useState<GenState>(initialVideoUrl ? "done" : "idle");
  const [videoUrl, setVideoUrl]   = useState<string>(initialVideoUrl ?? "");
  const [error, setError]         = useState<string | undefined>();
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const hasScript = Boolean(videoScript?.fullScript);
  const hasImage  = Boolean(sourceImageUrl || verticalImageUrl || squareImageUrl);
  const canGenerate = hasScript && hasImage;

  function buildBody() {
    const duration: 30 | 60 = videoScript?.duration === 60 ? 60 : 30;
    return {
      source: {
        type:      "direct_topic" as const,
        title:     sourceTitle,
        category:  sourceCategory,
        locale:    sourceLocale,
        publicUrl: sourcePublicUrl,
      },
      videoScript: {
        duration,
        hookScript:              videoScript?.hookScript ?? "",
        fullScript:              videoScript?.fullScript ?? "",
        onScreenTextSuggestions: videoScript?.onScreenText ?? [],
        brollSuggestions:        [],
        voiceoverTips:           "",
        suggestedCaption:        videoScript?.suggestedCaption ?? "",
      },
      images: {
        square:         squareImageUrl ?? "",
        vertical:       verticalImageUrl ?? "",
        sourceImageUrl: sourceImageUrl ?? "",
        headline:       imageHeadline ?? "",
        generatedByAI:  false,
      },
      locale: voiceLang,
    };
  }

  async function poll(projectId: string) {
    const cat = sourceCategory;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (!aliveRef.current) return;
      const url = `/api/admin/social-media-studio/history/${postId}/generate-video/status?projectId=${encodeURIComponent(projectId)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Render failed");
      if (data.data.status === "done" && data.data.videoUrl) {
        if (!aliveRef.current) return;
        setVideoUrl(data.data.videoUrl);
        setState("done");
        onVideoReady(data.data.videoUrl);
        return;
      }
    }
    throw new Error("Render timed out. Please try again.");
  }

  async function generate() {
    setState("submitting");
    setError(undefined);
    try {
      const res = await fetch(`/api/admin/social-media-studio/history/${postId}/generate-video`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Could not start video generation");
      setState("rendering");
      await poll(data.data.projectId);
    } catch (err) {
      if (!aliveRef.current) return;
      setState("error");
      setError(err instanceof Error ? err.message : "Video generation failed");
    }
  }

  const busy = state === "submitting" || state === "rendering";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm">AI YouTube Short</h3>
        <span className="text-xs text-muted-foreground">— images + voiceover + captions, 9:16</span>
      </div>

      {!canGenerate && (
        <p className="text-xs text-amber-600">
          {hasScript ? "This post has no image to build a video from." : "This post has no video script yet."}
        </p>
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

      {state === "error" && error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <button onClick={generate} className="shrink-0 underline hover:no-underline">Retry</button>
        </div>
      )}

      {state === "done" && videoUrl && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Saved to this post — YouTube URL auto-filled below.
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
