import type { RenderPlan, RenderProviderStatus, VideoRenderProvider } from "./types";

// ─── Shotstack render provider ────────────────────────────────────────────────────
// Pay-as-you-go video render API (no monthly minute quota). Translates a provider-neutral
// RenderPlan into a Shotstack timeline and submits/polls a render.
//
// Endpoints (header: x-api-key):
//   POST https://api.shotstack.io/edit/{env}/render          → { response: { id } }
//   GET  https://api.shotstack.io/edit/{env}/render/{id}     → { response: { status, url } }
// env = "v1" (production) | "stage" (sandbox). Status terminal values: "done" | "failed".

// Captions use the "rich-caption" asset, which auto-transcribes the aliased audio source
// (auto-detecting the spoken language) and renders karaoke word-by-word captions. This both
// matches the brand style and guarantees captions are in the SAME language as the audio.
const CAPTION_FONT         = process.env.SHOTSTACK_CAPTION_FONT || "Montserrat";
const CAPTION_SIZE         = Number(process.env.SHOTSTACK_CAPTION_SIZE) || 64;          // px on the 1080-wide frame
const CAPTION_ACTIVE_COLOR = process.env.SHOTSTACK_CAPTION_ACTIVE || "#00B4D8";          // spoken-word highlight (brand cyan)
// offset.y: positive moves UP. Presenter videos put captions in the UPPER area (avatar is at
// the bottom) nudged slightly down; faceless videos put them in the lower-third lifted up.
const CAPTION_TOP_OFFSET    = Number(process.env.SHOTSTACK_CAPTION_TOP_OFFSET ?? "-0.08");
const CAPTION_BOTTOM_OFFSET = Number(process.env.SHOTSTACK_CAPTION_BOTTOM_OFFSET ?? "0.12");

// Ken Burns motion cycled per scene so a still image still feels alive.
const KEN_BURNS = ["zoomIn", "slideLeft", "zoomOut", "slideRight"] as const;

const SPEECH_ALIAS = "speech";

function shotstackEnv(): "v1" | "stage" {
  return (process.env.SHOTSTACK_ENV || "v1").toLowerCase() === "stage" ? "stage" : "v1";
}
function renderBase(): string {
  return `https://api.shotstack.io/edit/${shotstackEnv()}/render`;
}
function apiKey(): string {
  const key = process.env.SHOTSTACK_API_KEY;
  if (!key) throw new Error("SHOTSTACK_API_KEY is not configured");
  return key;
}
const round = (n: number) => Math.round(n * 1000) / 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function richCaptionClip(plan: RenderPlan): Record<string, any> {
  const onTop = Boolean(plan.presenter); // presenter occupies the bottom → captions go up top
  return {
    asset: {
      type:      "rich-caption",
      src:       `alias://${SPEECH_ALIAS}`,
      font:      { family: CAPTION_FONT, color: "#FFFFFF", size: CAPTION_SIZE, weight: 800 },
      style:     { textTransform: "uppercase" },
      stroke:    { width: 6, color: "#000000" },
      active:    { font: { color: CAPTION_ACTIVE_COLOR } },
      animation: { style: "karaoke" },
      align:     { horizontal: "center", vertical: onTop ? "top" : "bottom" },
    },
    start:  0,
    length: "end",
    width:  Math.round(plan.width * 0.9),
    offset: { x: 0, y: onTop ? CAPTION_TOP_OFFSET : CAPTION_BOTTOM_OFFSET },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function presenterClip(plan: RenderPlan): Record<string, any> {
  const p = plan.presenter!;
  // Anchor large in a bottom corner, hug the edge, and push down so the lower body runs off
  // the frame bottom (reads like a person standing in the corner). Tunable via env.
  const bleedX = Number.isFinite(Number(process.env.SHOTSTACK_PRESENTER_X))
    ? Number(process.env.SHOTSTACK_PRESENTER_X)
    : (p.placement === "bottom-right" ? 0.06 : -0.06);
  const pushY = Number.isFinite(Number(process.env.SHOTSTACK_PRESENTER_Y))
    ? Number(process.env.SHOTSTACK_PRESENTER_Y)
    : -0.10;
  return {
    alias: SPEECH_ALIAS,
    asset: {
      type:      "video",
      src:       p.src,
      volume:    1,
      chromaKey: { color: p.chromaColor, threshold: 130, halo: 80 },
    },
    start:      round(p.start),
    length:     round(p.length),
    position:   p.placement === "bottom-right" ? "bottomRight" : "bottomLeft",
    offset:     { x: bleedX, y: pushY },
    scale:      p.scale,
    transition: { in: "fade", out: "fade" },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTimeline(plan: RenderPlan): Record<string, any> {
  const sceneClips = plan.scenes.map((s, i) => ({
    asset: s.isVideo
      ? { type: "video", src: s.backgroundUrl, volume: 0 } // mute cinematic clips; the speech track is the audio
      : { type: "image", src: s.backgroundUrl },
    start:      round(s.start),
    length:     round(s.length),
    fit:        "cover",
    effect:     s.effect ?? KEN_BURNS[i % KEN_BURNS.length],
    transition: { in: "fade", out: "fade" },
  }));

  // The single "speech" source = the presenter clip (its audio) or the narration audio clip.
  // It carries the alias the rich-caption transcribes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechTrack: Record<string, any>[] = plan.presenter
    ? [presenterClip(plan)]
    : plan.narrationAudio
      ? [{
          alias:  SPEECH_ALIAS,
          asset:  { type: "audio", src: plan.narrationAudio.src, volume: 1 },
          start:  round(plan.narrationAudio.start),
          length: round(plan.narrationAudio.length),
        }]
      : [];

  const captionTrack = plan.captions && speechTrack.length ? [richCaptionClip(plan)] : [];

  // Tracks render top-first: captions on top, then the speech clip, then scene backgrounds.
  const tracks = [
    ...(captionTrack.length ? [{ clips: captionTrack }] : []),
    ...(speechTrack.length ? [{ clips: speechTrack }] : []),
    { clips: sceneClips },
  ].filter((t) => t.clips.length > 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeline: Record<string, any> = { background: "#000000", tracks };
  if (plan.musicUrl) {
    timeline.soundtrack = { src: plan.musicUrl, effect: "fadeInFadeOut", volume: 0.12 };
  }
  return timeline;
}

async function submit(plan: RenderPlan): Promise<{ jobId: string }> {
  const body = {
    timeline: buildTimeline(plan),
    output:   { format: "mp4", fps: plan.fps, size: { width: plan.width, height: plan.height } },
  };

  const res = await fetch(renderBase(), {
    method:  "POST",
    headers: { "x-api-key": apiKey(), "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.response?.id) {
    throw new Error(`Shotstack render submit failed (HTTP ${res.status}): ${data?.message ?? "unknown error"}`);
  }
  return { jobId: String(data.response.id) };
}

const PROGRESS: Record<string, number> = { queued: 10, fetching: 30, rendering: 60, saving: 90 };

async function status(jobId: string): Promise<RenderProviderStatus> {
  const res = await fetch(`${renderBase()}/${encodeURIComponent(jobId)}`, {
    headers: { "x-api-key": apiKey() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(`Shotstack status check failed (HTTP ${res.status}): ${data?.message ?? "unknown error"}`);
  }

  const s = String(data.response?.status ?? "queued");
  if (s === "failed") {
    return { status: "failed", message: String(data.response?.error ?? data?.message ?? "render failed") };
  }
  if (s === "done") {
    return { status: "done", videoUrl: String(data.response?.url ?? "") };
  }
  return { status: "running", progress: PROGRESS[s] ?? 50, message: s };
}

export const shotstackProvider: VideoRenderProvider = { submit, status };
