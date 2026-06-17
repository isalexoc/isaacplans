"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Film, RotateCcw, CheckCircle2, RefreshCw, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VideoStoryboard, SocialLocale } from "@/lib/social-media-studio/types";

export interface VideoImageStudioProps {
  defaultLocale: SocialLocale;
  initialStoryboard?: VideoStoryboard;
  initialVideoUrl?: string;
  canGenerate: boolean;            // false → show a hint (e.g. no script yet)
  disabledHint?: string;
  /** Phase A — build storyboard + portrait images from the latest script. */
  generateImages: (locale: SocialLocale) => Promise<VideoStoryboard>;
  /** Regenerate one scene's image from a concept; returns the new image URL. */
  regenerateImage: (concept: string, sceneIndex: number, locale: SocialLocale) => Promise<string>;
  /** Phase B — render the video; returns the JSON2Video project id + duration. */
  renderVideo: (storyboard: VideoStoryboard) => Promise<{ projectId: string; durationSeconds: number }>;
  /** Poll render status; returns the finished Cloudinary URL when done. */
  pollStatus: (projectId: string) => Promise<{ status: string; videoUrl?: string }>;
  onVideoReady: (videoUrl: string, projectId: string, durationSeconds: number, voiceLanguage: SocialLocale) => void;
  /** Fired whenever the active storyboard changes (so the wizard can persist it on Save). */
  onStoryboardChange?: (storyboard: VideoStoryboard) => void;
}

type Phase = "idle" | "images" | "rendering" | "done";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90;

export function VideoImageStudio({
  defaultLocale,
  initialStoryboard,
  initialVideoUrl,
  canGenerate,
  disabledHint,
  generateImages,
  regenerateImage,
  renderVideo,
  pollStatus,
  onVideoReady,
  onStoryboardChange,
}: VideoImageStudioProps) {
  const [voiceLang, setVoiceLang]   = useState<SocialLocale>(defaultLocale);
  const [presenter, setPresenter]   = useState<boolean>(Boolean(initialStoryboard?.presenter));
  const [storyboard, setStoryboard] = useState<VideoStoryboard | undefined>(initialStoryboard);
  const [phase, setPhase]           = useState<Phase>(initialVideoUrl ? "done" : "idle");
  const [videoUrl, setVideoUrl]     = useState<string>(initialVideoUrl ?? "");
  const [busyImages, setBusyImages] = useState(false);   // batch (generate/rebuild/regen-all)
  const [regenIdx, setRegenIdx]     = useState<Set<number>>(new Set());
  const [editIdx, setEditIdx]       = useState<number | null>(null);
  const [editText, setEditText]     = useState("");
  const [error, setError]           = useState<string | undefined>();
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const category = storyboard?.category;

  function commitStoryboard(next: VideoStoryboard) {
    setStoryboard(next);
    onStoryboardChange?.(next);
  }

  // Toggle the HeyGen presenter; persist onto the storyboard when one already exists.
  function togglePresenter(value: boolean) {
    setPresenter(value);
    if (storyboard) commitStoryboard({ ...storyboard, presenter: value });
  }

  function setSceneBusy(idx: number, busy: boolean) {
    setRegenIdx((prev) => {
      const n = new Set(prev);
      if (busy) n.add(idx); else n.delete(idx);
      return n;
    });
  }

  // ── Phase A: build storyboard + all images ────────────────────────────────
  async function buildImages() {
    setError(undefined);
    setBusyImages(true);
    try {
      const sb = await generateImages(voiceLang);
      if (!aliveRef.current) return;
      commitStoryboard({ ...sb, presenter }); // carry the current presenter choice onto the new storyboard
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      if (aliveRef.current) setBusyImages(false);
    }
  }

  // ── Regenerate one scene image (quick re-roll or edited concept) ───────────
  async function regenOne(idx: number, concept: string) {
    if (!storyboard) return;
    setError(undefined);
    setEditIdx(null);
    setSceneBusy(idx, true);
    try {
      const url = await regenerateImage(concept, idx, voiceLang);
      if (!aliveRef.current) return;
      const scenes = storyboard.scenes.map((s, i) =>
        i === idx ? { ...s, imageConcept: concept, imageUrl: url } : s
      );
      commitStoryboard({ ...storyboard, scenes });
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : "Image regeneration failed");
    } finally {
      if (aliveRef.current) setSceneBusy(idx, false);
    }
  }

  // ── Regenerate ALL images, keeping the narration ──────────────────────────
  async function regenAll() {
    if (!storyboard) return;
    setError(undefined);
    setBusyImages(true);
    const scenes = [...storyboard.scenes];
    try {
      const CONCURRENCY = 3;
      for (let start = 0; start < scenes.length; start += CONCURRENCY) {
        const slice = scenes.slice(start, start + CONCURRENCY);
        await Promise.all(
          slice.map(async (scene, j) => {
            const idx = start + j;
            setSceneBusy(idx, true);
            try {
              const url = await regenerateImage(scene.imageConcept, idx, voiceLang);
              scenes[idx] = { ...scenes[idx], imageUrl: url };
            } finally {
              setSceneBusy(idx, false);
            }
          })
        );
        if (aliveRef.current) commitStoryboard({ ...storyboard, scenes: [...scenes] });
      }
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      if (aliveRef.current) setBusyImages(false);
    }
  }

  // ── Phase B: render the video ─────────────────────────────────────────────
  async function createVideo() {
    if (!storyboard) return;
    setError(undefined);
    setVideoUrl("");
    setPhase("rendering");
    try {
      const renderStoryboard = { ...storyboard, presenter };
      const { projectId, durationSeconds } = await renderVideo(renderStoryboard);
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (!aliveRef.current) return;
        const st = await pollStatus(projectId);
        if (st.status === "done" && st.videoUrl) {
          setVideoUrl(st.videoUrl);
          setPhase("done");
          onVideoReady(st.videoUrl, projectId, durationSeconds, voiceLang);
          return;
        }
      }
      throw new Error("Render timed out. Please try again.");
    } catch (err) {
      if (aliveRef.current) {
        setPhase(storyboard ? "images" : "idle");
        setError(err instanceof Error ? err.message : "Video render failed");
      }
    }
  }

  const anyBusy = busyImages || regenIdx.size > 0 || phase === "rendering";
  const hasImages = Boolean(storyboard?.scenes.length);

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm">AI YouTube Short</h3>
        <span className="text-xs text-muted-foreground">— AI portrait images + voiceover + captions + music, 9:16</span>
      </div>

      {!canGenerate && <p className="text-xs text-amber-600">{disabledHint ?? "Generate a video script first."}</p>}

      {/* Voice language */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Voiceover language:</span>
        <div className="flex gap-2">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              disabled={anyBusy}
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

      {/* Human presenter (HeyGen) toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Human presenter:</span>
        <button
          type="button"
          role="switch"
          aria-checked={presenter}
          disabled={anyBusy}
          onClick={() => togglePresenter(!presenter)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
            presenter ? "bg-blue-600" : "bg-muted-foreground/30"
          )}
        >
          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", presenter ? "translate-x-4" : "translate-x-0.5")} />
        </button>
        <span className="text-xs text-muted-foreground">
          {presenter ? "AI spokesperson in the corner (uses HeyGen credits)" : "Adds an AI spokesperson in the corner (uses HeyGen credits)"}
        </span>
      </div>

      {/* Phase A trigger / image controls */}
      {!hasImages ? (
        <Button onClick={buildImages} disabled={!canGenerate || busyImages} className="w-fit">
          {busyImages
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating images… (~60–90s)</>
            : <><Film className="h-4 w-4 mr-2" /> Generate Video Images</>}
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-auto">{storyboard!.scenes.length} scenes — hover an image to regenerate it</span>
            <Button variant="outline" size="sm" onClick={regenAll} disabled={anyBusy}>
              {busyImages ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Regenerate all
            </Button>
            <Button variant="ghost" size="sm" onClick={buildImages} disabled={anyBusy}>
              Rebuild from script
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {storyboard!.scenes.map((scene, i) => {
              const busy = regenIdx.has(i);
              return (
                <div key={i} className="group relative rounded border bg-muted overflow-hidden" style={{ aspectRatio: "9 / 16" }}>
                  {scene.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                  )}
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                  {!busy && !anyBusy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 group-hover:bg-black/45 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => regenOne(i, scene.imageConcept)}
                        title="Regenerate this image"
                        className="flex items-center gap-1 text-[11px] text-white bg-blue-600/90 hover:bg-blue-600 px-2 py-1 rounded"
                      >
                        <RotateCcw className="h-3 w-3" /> Regenerate
                      </button>
                      <button
                        onClick={() => { setEditIdx(i); setEditText(scene.imageConcept); }}
                        title="Edit the prompt"
                        className="flex items-center gap-1 text-[11px] text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                      >
                        <Pencil className="h-3 w-3" /> Edit prompt
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edit-prompt panel */}
          {editIdx !== null && (
            <div className="rounded-md border bg-muted/30 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Edit prompt for scene {editIdx + 1}</span>
                <button onClick={() => setEditIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} className="text-sm" />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => regenOne(editIdx, editText.trim())} disabled={!editText.trim()}>
                  Generate from this prompt
                </Button>
              </div>
            </div>
          )}

          {/* Phase B trigger */}
          <Button onClick={createVideo} disabled={anyBusy} className="w-fit">
            {phase === "rendering"
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {presenter ? "Rendering presenter + video… (1–5 min)" : "Rendering video… (30–120s)"}</>
              : phase === "done"
                ? <><RotateCcw className="h-4 w-4 mr-2" /> Regenerate video</>
                : <><Film className="h-4 w-4 mr-2" /> Create Video</>}
          </Button>
        </>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
        </div>
      )}

      {phase === "done" && videoUrl && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Video ready — the YouTube URL below is auto-filled.
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoUrl} controls className="rounded-md border bg-black" style={{ aspectRatio: "9 / 16", maxHeight: 360, width: "auto" }} />
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline w-fit">
            Download / open video
          </a>
        </div>
      )}
    </div>
  );
}
