// ─── Provider-neutral render plan ─────────────────────────────────────────────────
// A render engine receives this fully-resolved plan — every asset is already hosted,
// every clip already timed (seconds). It contains NO vendor-specific shapes, so a new
// render provider only needs to translate this into its own timeline format. Voiceover
// and captions are pre-generated (see voiceover.ts), keeping the engine swappable.

export interface RenderPlanScene {
  backgroundUrl: string;   // hosted image or video URL
  isVideo:       boolean;  // true → cinematic clip background; false → still image
  start:         number;   // seconds from the start of the video
  length:        number;   // seconds
  effect?:       string;   // optional Ken Burns hint (provider maps to its own effect names)
}

export interface RenderPlanClip {
  src:    string;
  start:  number;
  length: number;
}

export interface RenderPlanCaption {
  text:   string;
  start:  number;  // absolute seconds on the timeline
  length: number;
}

export interface RenderPlanPresenter {
  src:        string;
  start:      number;
  length:     number;
  chromaColor: string;                       // green-screen key color
  placement:  "bottom-left" | "bottom-right";
  scale:      number;                        // fraction of the frame width
}

export interface RenderPlan {
  width:      number;
  height:     number;
  fps:        number;
  scenes:     RenderPlanScene[];
  voiceover:  RenderPlanClip[];   // empty in presenter mode (the presenter clip carries audio)
  captions:   RenderPlanCaption[];
  musicUrl?:  string;
  presenter?: RenderPlanPresenter;
}

export interface RenderProviderStatus {
  status:    "running" | "done" | "failed";
  videoUrl?: string;   // the engine's raw output URL (re-hosted to Cloudinary by the caller)
  progress?: number;
  message?:  string;
}

export interface VideoRenderProvider {
  /** Submit a render; returns an opaque job id to poll. */
  submit(plan: RenderPlan): Promise<{ jobId: string }>;
  /** Poll a render job by id. */
  status(jobId: string): Promise<RenderProviderStatus>;
}
