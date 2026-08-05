"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Film, RotateCcw, CheckCircle2, RefreshCw, Pencil, X, Clapperboard, Video as VideoIcon, Undo2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PresenterPicker, type PresenterSelection } from "./PresenterPicker";
import { VideoJobProgress } from "./VideoJobProgress";
import type { VideoStoryboard, SocialLocale } from "@/lib/social-media-studio/types";
import type { SocialVideoJobView } from "@/lib/social-media-studio/video-job-types";

type VeoTier = "lite" | "fast" | "standard";

export interface VideoImageStudioProps {
  defaultLocale: SocialLocale;
  initialStoryboard?: VideoStoryboard;
  initialVideoUrl?: string;
  canGenerate: boolean;            // false → show a hint (e.g. no script yet)
  disabledHint?: string;
  /** Phase A — start a durable image-build job; returns its jobId. */
  startImages: (
    locale: SocialLocale,
    opts?: { reuseAssets?: boolean; preferClipAssets?: boolean },
  ) => Promise<{ jobId: string }>;
  /** Regenerate one scene's image from a concept (fast, synchronous); returns the new URL. */
  regenerateImage: (concept: string, sceneIndex: number, locale: SocialLocale) => Promise<string>;
  /** Phase B — start a durable render job (presenter → compose → render → finalize). */
  startRender: (storyboard: VideoStoryboard) => Promise<{ jobId: string }>;
  onVideoReady: (videoUrl: string, jobId: string, durationSeconds: number, voiceLanguage: SocialLocale) => void;
  /** Fired whenever the active storyboard changes (so the caller can persist it on Save). */
  onStoryboardChange?: (storyboard: VideoStoryboard) => void;
  /** Cinematic (Veo) — start a durable scene-clip job; returns its jobId. */
  startClip?: (imageUrl: string, imageConcept: string, sceneIndex: number, tier: VeoTier, durationSec: 4 | 6 | 8) => Promise<{ jobId: string }>;
  /** AI background music — start a durable music job; returns its jobId. */
  startMusic?: (durationSeconds: number) => Promise<{ jobId: string }>;
  /** Poll one durable job's DB-backed status. */
  pollJob: (jobId: string) => Promise<SocialVideoJobView>;
  /** Cancel an in-progress job. */
  cancelJob: (jobId: string) => Promise<void>;
  /** Active jobs for this post — used to reattach progress after a refresh. */
  findActiveJobs?: () => Promise<SocialVideoJobView[]>;
}

type Phase = "idle" | "images" | "rendering" | "done";

// DB-job polling cadence + ceiling (covers long presenter renders + Veo clips).
const JOB_POLL_MS = 3000;
const MAX_JOB_POLLS = 600; // ~30 min
const MAX_POLL_ERRORS = 6; // tolerate brief network blips before giving up

// $/sec by Veo tier (client-side copy for the cost estimate; the server is the source of truth).
const VEO_RATE: Record<VeoTier, number> = { lite: 0.05, fast: 0.15, standard: 0.40 };
const VEO_TIER_LABEL: Record<VeoTier, string> = { lite: "Lite", fast: "Fast", standard: "Standard" };

// Sentinels for silent (non-error) poll-loop exits.
const CANCELLED = "__job_cancelled__";
const UNMOUNTED = "__unmounted__";
const isSilent = (err: unknown) => err instanceof Error && (err.message === CANCELLED || err.message === UNMOUNTED);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function VideoImageStudio({
  defaultLocale,
  initialStoryboard,
  initialVideoUrl,
  canGenerate,
  disabledHint,
  startImages,
  regenerateImage,
  startRender,
  onVideoReady,
  onStoryboardChange,
  startClip,
  startMusic,
  pollJob,
  cancelJob,
  findActiveJobs,
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

  // Durable-job progress views
  const [renderView, setRenderView] = useState<SocialVideoJobView | null>(null);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStartedAt, setRenderStartedAt] = useState<number | undefined>();
  const [imagesView, setImagesView] = useState<SocialVideoJobView | null>(null);

  // Cross-post asset library reuse — defaults ON (undefined → true) so existing posts and new
  // ones both save money by default; explicitly saved `false` sticks.
  const [reuseAssets, setReuseAssets] = useState<boolean>(initialStoryboard?.reuseAssets ?? true);

  // Cinematic motion (Veo 3.1)
  const cinematicSupported = Boolean(startClip);
  const [cinematic, setCinematic]     = useState<boolean>(Boolean(initialStoryboard?.cinematic));
  const [veoTier, setVeoTier]         = useState<VeoTier>((initialStoryboard?.veoTier as VeoTier) ?? "lite");
  const [veoDuration, setVeoDuration] = useState<4 | 6 | 8>((initialStoryboard?.veoDurationSec as 4 | 6 | 8) ?? 6);
  const [clipIdx, setClipIdx]         = useState<Set<number>>(new Set());

  // AI background music (ElevenLabs) — always generated once images exist, regenerable.
  const musicSupported = Boolean(startMusic);
  const [musicBusy, setMusicBusy]     = useState(false);
  const [musicError, setMusicError]   = useState<string | undefined>();
  const musicTriedRef = useRef(false);

  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);
  // Synchronous source of truth for the storyboard so concurrent clip jobs don't clobber each other.
  const sbRef = useRef<VideoStoryboard | undefined>(initialStoryboard);

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

  // Stamp the reuse-library toggle onto a storyboard (so it round-trips through Sanity).
  function withReuseAssets(sb: VideoStoryboard, r: boolean = reuseAssets): VideoStoryboard {
    return { ...sb, reuseAssets: r };
  }

  // Apply presenter + cinematic + reuse settings onto a (possibly fresh) storyboard.
  function decorate(sb: VideoStoryboard): VideoStoryboard {
    return withReuseAssets(withCinematic(withPresenter(sb)));
  }

  function toggleCinematic(value: boolean) {
    setCinematic(value);
    if (storyboard) commitStoryboard(withCinematic(storyboard, value));
  }
  function toggleReuseAssets(value: boolean) {
    setReuseAssets(value);
    if (storyboard) commitStoryboard(withReuseAssets(storyboard, value));
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

  // ── Generic durable-job poll loop ─────────────────────────────────────────
  // Polls the DB job until it's done (returns the final view), fails, is cancelled,
  // or the component unmounts (the server job keeps running and is reattached later).
  async function runJob(jobId: string, onView?: (v: SocialVideoJobView) => void): Promise<SocialVideoJobView> {
    let errors = 0;
    for (let i = 0; i < MAX_JOB_POLLS; i++) {
      if (!aliveRef.current) throw new Error(UNMOUNTED);
      let view: SocialVideoJobView;
      try {
        view = await pollJob(jobId);
        errors = 0;
      } catch {
        if (++errors >= MAX_POLL_ERRORS) throw new Error("Lost connection to the generation job.");
        await sleep(JOB_POLL_MS);
        continue;
      }
      if (!aliveRef.current) throw new Error(UNMOUNTED);
      onView?.(view);
      if (view.status === "done") return view;
      if (view.status === "failed") throw new Error(view.errorMessage ?? "Generation failed");
      if (view.status === "cancelled") throw new Error(CANCELLED);
      await sleep(JOB_POLL_MS);
    }
    throw new Error("Generation timed out. Please try again.");
  }

  // ── Attach helpers (used by both new starts and resume-on-mount) ──────────
  async function attachImagesJob(jobId: string, initial?: SocialVideoJobView) {
    setError(undefined);
    setBusyImages(true);
    if (initial) setImagesView(initial);
    const prevMusic = sbRef.current?.musicUrl;
    try {
      const view = await runJob(jobId, setImagesView);
      if (!aliveRef.current) return;
      const sb = view.resultData?.storyboard;
      if (!sb) throw new Error("Image build returned no storyboard.");
      commitStoryboard({ ...decorate(sb), musicUrl: prevMusic ?? sb.musicUrl ?? undefined });
    } catch (err) {
      if (aliveRef.current && !isSilent(err)) setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      if (aliveRef.current) { setBusyImages(false); setImagesView(null); }
    }
  }

  async function attachRenderJob(jobId: string, initial?: SocialVideoJobView) {
    setError(undefined);
    setNotice(initial?.jobState?.notice ?? undefined);
    setPhase("rendering");
    setRenderJobId(jobId);
    setRenderStartedAt(Date.now());
    if (initial) setRenderView(initial);
    try {
      const view = await runJob(jobId, (v) => {
        setRenderView(v);
        if (v.jobState?.notice) setNotice(v.jobState.notice);
      });
      if (!aliveRef.current) return;
      const url = view.resultUrl;
      if (!url) throw new Error("Render finished without a video.");
      setVideoUrl(url);
      setPhase("done");
      onVideoReady(url, jobId, sbRef.current?.durationSeconds ?? 30, voiceLang);
    } catch (err) {
      if (!aliveRef.current) return;
      setPhase(sbRef.current ? "images" : "idle");
      if (!isSilent(err)) setError(err instanceof Error ? err.message : "Video render failed");
    } finally {
      if (aliveRef.current) { setRenderJobId(null); setRenderView(null); }
    }
  }

  async function attachClipJob(jobId: string, idx: number) {
    setError(undefined);
    setClipBusy(idx, true);
    try {
      const view = await runJob(jobId);
      if (!aliveRef.current) return;
      if (view.resultUrl) {
        const latest = sbRef.current!;
        commitStoryboard({
          ...latest,
          scenes: latest.scenes.map((s, i) => (i === idx ? { ...s, videoClipUrl: view.resultUrl! } : s)),
        });
      }
    } catch (err) {
      if (aliveRef.current && !isSilent(err)) setError(err instanceof Error ? err.message : "Cinematic motion failed");
    } finally {
      if (aliveRef.current) setClipBusy(idx, false);
    }
  }

  async function attachMusicJob(jobId: string) {
    setMusicError(undefined);
    setMusicBusy(true);
    try {
      const view = await runJob(jobId);
      if (!aliveRef.current) return;
      if (view.resultUrl) commitStoryboard({ ...sbRef.current!, musicUrl: view.resultUrl });
    } catch (err) {
      if (aliveRef.current && !isSilent(err)) setMusicError(err instanceof Error ? err.message : "Music generation failed");
    } finally {
      if (aliveRef.current) setMusicBusy(false);
    }
  }

  // ── Resume any jobs still running from a previous window/tab ───────────────
  useEffect(() => {
    let active = true;
    (async () => {
      if (!findActiveJobs) return;
      try {
        const jobs = await findActiveJobs();
        if (!active || !aliveRef.current) return;
        for (const job of jobs) {
          if (job.status !== "pending" && job.status !== "processing") continue;
          if (job.kind === "render") void attachRenderJob(job.id, job);
          else if (job.kind === "images") void attachImagesJob(job.id, job);
          else if (job.kind === "clip" && job.sceneIndex != null) void attachClipJob(job.id, job.sceneIndex);
          else if (job.kind === "music") void attachMusicJob(job.id);
        }
      } catch { /* no active jobs / endpoint unavailable */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cinematic: animate one scene image into a Veo clip ─────────────────────
  async function animateScene(idx: number) {
    const cur = sbRef.current;
    const scene = cur?.scenes[idx];
    if (!cur || !scene?.imageUrl || !startClip) return;
    setError(undefined);
    setClipBusy(idx, true);
    let jobId: string;
    try {
      ({ jobId } = await startClip(scene.imageUrl, scene.imageConcept, idx, veoTier, veoDuration));
    } catch (err) {
      if (aliveRef.current) { setError(err instanceof Error ? err.message : "Could not start the animation."); setClipBusy(idx, false); }
      return;
    }
    await attachClipJob(jobId, idx);
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
    if (!cur || !startMusic) return;
    setMusicError(undefined);
    setMusicBusy(true);
    let jobId: string;
    try {
      ({ jobId } = await startMusic(cur.durationSeconds));
    } catch (err) {
      if (aliveRef.current) { setMusicError(err instanceof Error ? err.message : "Could not start music."); setMusicBusy(false); }
      return;
    }
    await attachMusicJob(jobId);
  }

  // Auto-generate the track once images exist and none is set yet (no toggle).
  const hasImagesForMusic = Boolean(storyboard?.scenes.length);
  useEffect(() => {
    if (!startMusic || !hasImagesForMusic || musicTriedRef.current) return;
    if (storyboard?.musicUrl) return;        // restored from Sanity → keep it
    musicTriedRef.current = true;
    void generateMusicTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasImagesForMusic, storyboard?.musicUrl]);

  // ── Phase A: build storyboard + all images ────────────────────────────────
  async function buildImages() {
    setError(undefined);
    setBusyImages(true);
    let jobId: string;
    try {
      ({ jobId } = await startImages(voiceLang, { reuseAssets, preferClipAssets: cinematic }));
    } catch (err) {
      if (aliveRef.current) { setError(err instanceof Error ? err.message : "Could not start image generation."); setBusyImages(false); }
      return;
    }
    await attachImagesJob(jobId);
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
    const cur = sbRef.current;
    if (!cur) return;
    setVideoUrl("");
    setError(undefined);
    setNotice(undefined);
    setPhase("rendering");
    setRenderStartedAt(Date.now());
    let jobId: string;
    try {
      ({ jobId } = await startRender(decorate(cur)));
    } catch (err) {
      if (aliveRef.current) { setPhase("images"); setError(err instanceof Error ? err.message : "Could not start the render."); }
      return;
    }
    await attachRenderJob(jobId);
  }

  async function cancelRender() {
    if (!renderJobId) return;
    try { await cancelJob(renderJobId); } catch { /* the poll loop will also stop on status change */ }
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

      {/* Reuse cross-post asset library toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Reuse asset library:</span>
        <button
          type="button"
          role="switch"
          aria-checked={reuseAssets}
          disabled={anyBusy}
          onClick={() => toggleReuseAssets(!reuseAssets)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
            reuseAssets ? "bg-blue-600" : "bg-muted-foreground/30"
          )}
        >
          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", reuseAssets ? "translate-x-4" : "translate-x-0.5")} />
        </button>
        <span className="text-xs text-muted-foreground">
          {cinematic
            ? "Reuse a similar image or clip from past posts before generating a new one — prefers a clip when one matches"
            : "Reuse a similar image from past posts before generating a new one"}
        </span>
      </div>

      {/* Phase A trigger / image controls */}
      {!hasImages ? (
        busyImages ? (
          <VideoJobProgress view={imagesView} title="Generating video images" />
        ) : (
          <Button onClick={buildImages} disabled={!canGenerate} className="w-fit">
            <Film className="h-4 w-4 mr-2" /> Generate Video Images
          </Button>
        )
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

          {busyImages && imagesView && <VideoJobProgress view={imagesView} title="Rebuilding video images" />}

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

          {/* Phase B trigger / live render progress */}
          {phase === "rendering" ? (
            <VideoJobProgress
              view={renderView}
              title={presenter ? "Rendering presenter + video" : "Rendering video"}
              onCancel={cancelRender}
              startedAt={renderStartedAt}
            />
          ) : (
            <Button onClick={createVideo} disabled={anyBusy} className="w-fit">
              {phase === "done"
                ? <><RotateCcw className="h-4 w-4 mr-2" /> Regenerate video</>
                : <><Film className="h-4 w-4 mr-2" /> Create Video</>}
            </Button>
          )}
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
