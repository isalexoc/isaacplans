"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Film, RotateCcw, CheckCircle2, RefreshCw, Pencil, X, Clapperboard, Video as VideoIcon, Undo2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PresenterPicker, type PresenterSelection } from "./PresenterPicker";
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
  /** Phase B — render the video; returns the JSON2Video project id + duration. `notice` carries a
   *  non-fatal warning (e.g. the presenter failed and we fell back to a faceless render). */
  renderVideo: (storyboard: VideoStoryboard) => Promise<{ projectId: string; durationSeconds: number; notice?: string }>;
  /** Poll render status; returns the finished Cloudinary URL when done. */
  pollStatus: (projectId: string) => Promise<{ status: string; videoUrl?: string }>;
  onVideoReady: (videoUrl: string, projectId: string, durationSeconds: number, voiceLanguage: SocialLocale) => void;
  /** Fired whenever the active storyboard changes (so the wizard can persist it on Save). */
  onStoryboardChange?: (storyboard: VideoStoryboard) => void;
  /** Cinematic (Veo) — submit a scene-clip render; returns the long-running operation name. */
  submitClip?: (imageUrl: string, imageConcept: string, sceneIndex: number, tier: VeoTier, durationSec: 4 | 6 | 8) => Promise<{ operationName: string }>;
  /** Cinematic (Veo) — poll a clip operation; returns the Cloudinary URL when done. */
  pollClip?: (operationName: string, sceneIndex: number) => Promise<{ status: string; videoUrl?: string }>;
  /** AI background music (ElevenLabs) — generate a category-matched track; returns its URL. */
  generateMusic?: (durationSeconds: number) => Promise<string>;
}

type Phase = "idle" | "images" | "rendering" | "done";
type VeoTier = "lite" | "fast" | "standard";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90;

// $/sec by Veo tier (client-side copy for the cost estimate; the server is the source of truth).
const VEO_RATE: Record<VeoTier, number> = { lite: 0.05, fast: 0.15, standard: 0.40 };
const VEO_TIER_LABEL: Record<VeoTier, string> = { lite: "Lite", fast: "Fast", standard: "Standard" };
const CLIP_POLL_MS  = 8000;
const MAX_CLIP_POLLS = 60; // ~8 min per clip

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
  submitClip,
  pollClip,
  generateMusic,
}: VideoImageStudioProps) {
  const [voiceLang, setVoiceLang]   = useState<SocialLocale>(defaultLocale);
  const [presenter, setPresenter]   = useState<boolean>(Boolean(initialStoryboard?.presenter));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presenterSel, setPresenterSel] = useState<PresenterSelection>({
    avatarId:   initialStoryboard?.presenterAvatarId,
    avatarName: initialStoryboard?.presenterAvatarName,
    voiceId:    initialStoryboard?.presenterVoiceId,
    voiceName:  initialStoryboard?.presenterVoiceName,
  });
  const [storyboard, setStoryboard] = useState<VideoStoryboard | undefined>(initialStoryboard);
  const [phase, setPhase]           = useState<Phase>(initialVideoUrl ? "done" : "idle");
  const [videoUrl, setVideoUrl]     = useState<string>(initialVideoUrl ?? "");
  const [busyImages, setBusyImages] = useState(false);   // batch (generate/rebuild/regen-all)
  const [regenIdx, setRegenIdx]     = useState<Set<number>>(new Set());
  const [editIdx, setEditIdx]       = useState<number | null>(null);
  const [editText, setEditText]     = useState("");
  const [error, setError]           = useState<string | undefined>();
  const [notice, setNotice]         = useState<string | undefined>(); // non-fatal warning (e.g. faceless fallback)

  // Cinematic motion (Veo 3.1)
  const cinematicSupported = Boolean(submitClip && pollClip);
  const [cinematic, setCinematic]     = useState<boolean>(Boolean(initialStoryboard?.cinematic));
  const [veoTier, setVeoTier]         = useState<VeoTier>((initialStoryboard?.veoTier as VeoTier) ?? "lite");
  const [veoDuration, setVeoDuration] = useState<4 | 6 | 8>((initialStoryboard?.veoDurationSec as 4 | 6 | 8) ?? 6);
  const [clipIdx, setClipIdx]         = useState<Set<number>>(new Set());

  // AI background music (ElevenLabs) — always generated once images exist, regenerable.
  const musicSupported = Boolean(generateMusic);
  const [musicBusy, setMusicBusy]     = useState(false);
  const [musicError, setMusicError]   = useState<string | undefined>();
  const musicTriedRef = useRef(false);

  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);
  // Synchronous source of truth for the storyboard so concurrent clip jobs don't clobber each other.
  const sbRef = useRef<VideoStoryboard | undefined>(initialStoryboard);

  const category = storyboard?.category;

  function commitStoryboard(next: VideoStoryboard) {
    sbRef.current = next;
    setStoryboard(next);
    onStoryboardChange?.(next);
  }

  // Stamp the current presenter toggle + avatar/voice selection onto a storyboard.
  function withPresenter(
    sb: VideoStoryboard,
    p: boolean = presenter,
    s: PresenterSelection = presenterSel
  ): VideoStoryboard {
    return {
      ...sb,
      presenter:           p,
      presenterAvatarId:   s.avatarId,
      presenterAvatarName: s.avatarName,
      presenterVoiceId:    s.voiceId,
      presenterVoiceName:  s.voiceName,
    };
  }

  // Toggle the HeyGen presenter; persist onto the storyboard when one already exists.
  function togglePresenter(value: boolean) {
    setPresenter(value);
    if (storyboard) commitStoryboard(withPresenter(storyboard, value));
  }

  // Switching language resets the presenter pick so EN/ES stay matched to the right voice.
  function changeVoiceLang(l: SocialLocale) {
    setVoiceLang(l);
    setPresenterSel({});
    if (storyboard) commitStoryboard(withPresenter(storyboard, presenter, {}));
  }

  // Apply a fresh avatar/voice pick from the modal.
  function applyPresenterSelection(sel: PresenterSelection) {
    setPresenterSel(sel);
    if (storyboard) commitStoryboard(withPresenter(storyboard, presenter, sel));
  }

  // Stamp the cinematic toggle + Veo settings onto a storyboard.
  function withCinematic(
    sb: VideoStoryboard,
    c: boolean = cinematic,
    t: VeoTier = veoTier,
    d: 4 | 6 | 8 = veoDuration
  ): VideoStoryboard {
    return { ...sb, cinematic: c, veoTier: t, veoDurationSec: d };
  }

  // Apply both presenter + cinematic settings onto a (possibly fresh) storyboard.
  function decorate(sb: VideoStoryboard): VideoStoryboard {
    return withCinematic(withPresenter(sb));
  }

  function toggleCinematic(value: boolean) {
    setCinematic(value);
    if (storyboard) commitStoryboard(withCinematic(storyboard, value));
  }
  function changeTier(t: VeoTier) {
    setVeoTier(t);
    if (storyboard) commitStoryboard(withCinematic(storyboard, cinematic, t));
  }
  function changeDuration(d: 4 | 6 | 8) {
    setVeoDuration(d);
    if (storyboard) commitStoryboard(withCinematic(storyboard, cinematic, veoTier, d));
  }

  function setSceneBusy(idx: number, busy: boolean) {
    setRegenIdx((prev) => {
      const n = new Set(prev);
      if (busy) n.add(idx); else n.delete(idx);
      return n;
    });
  }

  function setClipBusy(idx: number, busy: boolean) {
    setClipIdx((prev) => {
      const n = new Set(prev);
      if (busy) n.add(idx); else n.delete(idx);
      return n;
    });
  }

  // ── Cinematic: animate one scene image into a Veo clip ─────────────────────
  async function animateScene(idx: number) {
    const cur = sbRef.current;
    const scene = cur?.scenes[idx];
    if (!cur || !scene?.imageUrl || !submitClip || !pollClip) return;
    setError(undefined);
    setClipBusy(idx, true);
    try {
      const { operationName } = await submitClip(scene.imageUrl, scene.imageConcept, idx, veoTier, veoDuration);
      for (let p = 0; p < MAX_CLIP_POLLS; p++) {
        await new Promise((r) => setTimeout(r, CLIP_POLL_MS));
        if (!aliveRef.current) return;
        const st = await pollClip(operationName, idx);
        if (st.status === "done" && st.videoUrl) {
          const latest = sbRef.current!;
          commitStoryboard({
            ...latest,
            scenes: latest.scenes.map((s, i) => (i === idx ? { ...s, videoClipUrl: st.videoUrl } : s)),
          });
          return;
        }
      }
      throw new Error("Veo clip timed out. Please try again.");
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : "Cinematic motion failed");
    } finally {
      if (aliveRef.current) setClipBusy(idx, false);
    }
  }

  async function animateAll() {
    const cur = sbRef.current;
    if (!cur) return;
    const CONCURRENCY = 2;
    for (let start = 0; start < cur.scenes.length; start += CONCURRENCY) {
      const idxs = cur.scenes.map((_, i) => i).slice(start, start + CONCURRENCY);
      await Promise.all(idxs.map((i) => animateScene(i)));
      if (!aliveRef.current) return;
    }
  }

  // Drop a scene's clip → it renders as the static Ken Burns image again.
  function revertScene(idx: number) {
    const cur = sbRef.current;
    if (!cur) return;
    commitStoryboard({
      ...cur,
      scenes: cur.scenes.map((s, i) => (i === idx ? { ...s, videoClipUrl: undefined } : s)),
    });
  }

  // ── AI background music: generate a category-matched track ─────────────────
  async function generateMusicTrack() {
    const cur = sbRef.current;
    if (!cur || !generateMusic) return;
    setMusicError(undefined);
    setMusicBusy(true);
    try {
      const url = await generateMusic(cur.durationSeconds);
      if (!aliveRef.current) return;
      commitStoryboard({ ...sbRef.current!, musicUrl: url });
    } catch (err) {
      if (aliveRef.current) setMusicError(err instanceof Error ? err.message : "Music generation failed");
    } finally {
      if (aliveRef.current) setMusicBusy(false);
    }
  }

  // Auto-generate the track once images exist and none is set yet (no toggle).
  const hasImagesForMusic = Boolean(storyboard?.scenes.length);
  useEffect(() => {
    if (!generateMusic || !hasImagesForMusic || musicTriedRef.current) return;
    if (storyboard?.musicUrl) return;        // restored from Sanity → keep it
    musicTriedRef.current = true;
    void generateMusicTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasImagesForMusic, storyboard?.musicUrl]);

  // ── Phase A: build storyboard + all images ────────────────────────────────
  async function buildImages() {
    setError(undefined);
    setBusyImages(true);
    try {
      const prevMusic = sbRef.current?.musicUrl;
      const sb = await generateImages(voiceLang);
      if (!aliveRef.current) return;
      // carry presenter + cinematic settings AND the existing music track onto the new storyboard
      commitStoryboard({ ...decorate(sb), musicUrl: prevMusic });
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
    setNotice(undefined);
    setVideoUrl("");
    setPhase("rendering");
    try {
      const renderStoryboard = decorate(storyboard);
      const { projectId, durationSeconds, notice: renderNotice } = await renderVideo(renderStoryboard);
      if (renderNotice && aliveRef.current) setNotice(renderNotice);
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

  const anyBusy = busyImages || regenIdx.size > 0 || clipIdx.size > 0 || musicBusy || phase === "rendering";
  const hasImages = Boolean(storyboard?.scenes.length);
  const sceneCount = storyboard?.scenes.length ?? 0;
  const animatedCount = storyboard?.scenes.filter((s) => s.videoClipUrl).length ?? 0;
  const animateAllCost = (sceneCount * veoDuration * VEO_RATE[veoTier]).toFixed(2);

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
              onClick={() => changeVoiceLang(l)}
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

      {/* Avatar & voice selection — only when the presenter is on */}
      {presenter && (
        <div className="flex items-center gap-3 flex-wrap rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-xs flex-1 min-w-0">
            <span className="text-muted-foreground">Presenter: </span>
            <span className="font-medium">{presenterSel.avatarName ?? "Default avatar"}</span>
            <span className="text-muted-foreground"> · voice </span>
            <span className="font-medium">{presenterSel.voiceName ?? "Default"}</span>
          </div>
          <Button variant="outline" size="sm" disabled={anyBusy} onClick={() => setPickerOpen(true)}>
            Choose avatar & voice
          </Button>
        </div>
      )}

      <PresenterPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        locale={voiceLang}
        current={presenterSel}
        onConfirm={applyPresenterSelection}
      />

      {/* Cinematic motion (Veo 3.1) toggle */}
      {cinematicSupported && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Cinematic motion:</span>
          <button
            type="button"
            role="switch"
            aria-checked={cinematic}
            disabled={anyBusy}
            onClick={() => toggleCinematic(!cinematic)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
              cinematic ? "bg-blue-600" : "bg-muted-foreground/30"
            )}
          >
            <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", cinematic ? "translate-x-4" : "translate-x-0.5")} />
          </button>
          <span className="text-xs text-muted-foreground">Animate scene images into real video with Google Veo 3.1 (pay-per-use)</span>
        </div>
      )}

      {cinematicSupported && cinematic && (
        <div className="flex items-center gap-3 flex-wrap rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">Quality</span>
          <select
            value={veoTier}
            onChange={(e) => changeTier(e.target.value as VeoTier)}
            disabled={anyBusy}
            className="border rounded-md px-2 py-1 text-xs bg-background"
          >
            {(["lite", "fast", "standard"] as const).map((t) => (
              <option key={t} value={t}>{VEO_TIER_LABEL[t]} (${VEO_RATE[t].toFixed(2)}/s)</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">Clip length</span>
          <select
            value={veoDuration}
            onChange={(e) => changeDuration(Number(e.target.value) as 4 | 6 | 8)}
            disabled={anyBusy}
            className="border rounded-md px-2 py-1 text-xs bg-background"
          >
            {([4, 6, 8] as const).map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            {animatedCount}/{sceneCount} animated · Animate all ≈ <span className="font-medium">${animateAllCost}</span>
          </span>
        </div>
      )}

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
            {cinematicSupported && cinematic && (
              <Button variant="outline" size="sm" onClick={animateAll} disabled={anyBusy} title={`≈ $${animateAllCost}`}>
                {clipIdx.size > 0 ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Clapperboard className="h-3 w-3 mr-1" />}
                Animate all
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={buildImages} disabled={anyBusy}>
              Rebuild from script
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {storyboard!.scenes.map((scene, i) => {
              const busy = regenIdx.has(i);
              const clipBusy = clipIdx.has(i);
              const hasClip = Boolean(scene.videoClipUrl);
              return (
                <div key={i} className="group relative rounded border bg-muted overflow-hidden" style={{ aspectRatio: "9 / 16" }}>
                  {cinematic && hasClip ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={scene.videoClipUrl} muted loop autoPlay playsInline className="w-full h-full object-cover" />
                  ) : scene.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                  ) : null}

                  {cinematic && hasClip && !clipBusy && (
                    <span className="absolute top-1 left-1 bg-blue-600 text-white text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5">
                      <VideoIcon className="h-2.5 w-2.5" /> motion
                    </span>
                  )}

                  {(busy || clipBusy) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {clipBusy && <span className="text-[9px]">animating…</span>}
                    </div>
                  )}

                  {!busy && !clipBusy && !anyBusy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 group-hover:bg-black/45 opacity-0 group-hover:opacity-100 transition">
                      {cinematic && (
                        hasClip ? (
                          <>
                            <button
                              onClick={() => animateScene(i)}
                              title="Re-animate this scene"
                              className="flex items-center gap-1 text-[11px] text-white bg-blue-600/90 hover:bg-blue-600 px-2 py-1 rounded"
                            >
                              <Clapperboard className="h-3 w-3" /> Re-animate
                            </button>
                            <button
                              onClick={() => revertScene(i)}
                              title="Use the still image instead"
                              className="flex items-center gap-1 text-[11px] text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                            >
                              <Undo2 className="h-3 w-3" /> Revert
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => animateScene(i)}
                            title={`Animate this scene (≈ $${(veoDuration * VEO_RATE[veoTier]).toFixed(2)})`}
                            className="flex items-center gap-1 text-[11px] text-white bg-blue-600/90 hover:bg-blue-600 px-2 py-1 rounded"
                          >
                            <Clapperboard className="h-3 w-3" /> Animate
                          </button>
                        )
                      )}
                      <button
                        onClick={() => regenOne(i, scene.imageConcept)}
                        title="Regenerate this image"
                        className="flex items-center gap-1 text-[11px] text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                      >
                        <RotateCcw className="h-3 w-3" /> Image
                      </button>
                      <button
                        onClick={() => { setEditIdx(i); setEditText(scene.imageConcept); }}
                        title="Edit the prompt"
                        className="flex items-center gap-1 text-[11px] text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                      >
                        <Pencil className="h-3 w-3" /> Prompt
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

          {/* AI background music (ElevenLabs) — always generated, regenerable */}
          {musicSupported && (
            <div className="flex items-center gap-3 flex-wrap rounded-md border bg-muted/30 px-3 py-2">
              <Music className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Background music</span>
              {musicBusy ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generating music… (~10–30s)
                </span>
              ) : storyboard!.musicUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={storyboard!.musicUrl} controls className="h-8 flex-1 min-w-[180px]" />
                  <Button variant="outline" size="sm" onClick={() => generateMusicTrack()} disabled={anyBusy}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    {musicError ? "Music generation failed — the video will use the default track." : "Mood-matched track for this category."}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => generateMusicTrack()} disabled={anyBusy} className="ml-auto">
                    <Music className="h-3 w-3 mr-1" /> Generate music
                  </Button>
                </>
              )}
            </div>
          )}
          {musicError && !musicBusy && (
            <p className="text-xs text-amber-600">{musicError}</p>
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

      {notice && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex-1">{notice}</span>
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
