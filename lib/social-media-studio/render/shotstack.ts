import type { RenderPlan, RenderProviderStatus, VideoRenderProvider } from "./types";

// ─── Shotstack render provider ────────────────────────────────────────────────────
// Pay-as-you-go video render API (no monthly minute quota). Translates a provider-neutral
// RenderPlan into a Shotstack timeline and submits/polls a render.
//
// Endpoints (header: x-api-key):
//   POST https://api.shotstack.io/edit/{env}/render          → { response: { id } }
//   GET  https://api.shotstack.io/edit/{env}/render/{id}     → { response: { status, url } }
// env = "v1" (production) | "stage" (sandbox). Status terminal values: "done" | "failed".

// Built-in Shotstack font (no custom-font import needed). Override via SHOTSTACK_CAPTION_FONT.
const CAPTION_FONT = process.env.SHOTSTACK_CAPTION_FONT || "Montserrat";
const CAPTION_SIZE = Number(process.env.SHOTSTACK_CAPTION_SIZE) || 70; // px on the 1080-wide frame
// Fraction of frame height to raise captions off the bottom edge into the lower-third
// (positive offset.y moves up). Tunable via SHOTSTACK_CAPTION_LIFT.
const CAPTION_LIFT = Number(process.env.SHOTSTACK_CAPTION_LIFT) || 0.12;

// Ken Burns motion cycled per scene so a still image still feels alive.
const KEN_BURNS = ["zoomIn", "slideLeft", "zoomOut", "slideRight"] as const;

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
function buildTimeline(plan: RenderPlan): Record<string, any> {
  // Tracks render top-first: captions on top, then presenter, then voiceover audio, then backgrounds.
  const captionClips = plan.captions.map((c) => ({
    asset: {
      type: "text",
      text: c.text,
      font:      { family: CAPTION_FONT, color: "#FFFFFF", size: CAPTION_SIZE, weight: 800, lineHeight: 1 },
      alignment: { horizontal: "center", vertical: "center" },
      stroke:    { color: "#000000", width: 5 },
    },
    start:      round(c.start),
    length:     round(Math.max(0.3, c.length)),
    // Anchor to the bottom, then lift into the lower-third (positive offset.y moves UP) so
    // captions sit clear of the platform's bottom UI. Box is sized for ~2 lines and the text
    // is centred within it (vertical "bottom" would push it below the frame edge).
    position:   "bottom",
    offset:     { x: 0, y: CAPTION_LIFT },
    width:      Math.round(plan.width * 0.86),
    height:     Math.round(plan.height * 0.16),
    transition: { in: "fade", out: "fade" },
  }));

  const presenterClips = plan.presenter
    ? [{
        asset: {
          type:      "video",
          src:       plan.presenter.src,
          volume:    1,
          chromaKey: { color: plan.presenter.chromaColor, threshold: 130, halo: 80 },
        },
        start:      round(plan.presenter.start),
        length:     round(plan.presenter.length),
        position:   plan.presenter.placement === "bottom-right" ? "bottomRight" : "bottomLeft",
        offset:     { x: plan.presenter.placement === "bottom-right" ? 0.04 : -0.04, y: 0 },
        scale:      plan.presenter.scale,
        transition: { in: "fade", out: "fade" },
      }]
    : [];

  const voiceClips = plan.voiceover.map((v) => ({
    asset:  { type: "audio", src: v.src, volume: 1 },
    start:  round(v.start),
    length: round(v.length),
  }));

  const sceneClips = plan.scenes.map((s, i) => ({
    asset: s.isVideo
      ? { type: "video", src: s.backgroundUrl, volume: 0 } // mute cinematic clips; voiceover is the audio
      : { type: "image", src: s.backgroundUrl },
    start:      round(s.start),
    length:     round(s.length),
    fit:        "cover",
    effect:     s.effect ?? KEN_BURNS[i % KEN_BURNS.length],
    transition: { in: "fade", out: "fade" },
  }));

  const tracks = [
    { clips: captionClips },
    ...(presenterClips.length ? [{ clips: presenterClips }] : []),
    ...(voiceClips.length ? [{ clips: voiceClips }] : []),
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
