// ─── Provider-neutral render plan ─────────────────────────────────────────────────
// A render engine receives this fully-resolved plan — every asset is already hosted and
// every clip already timed (seconds). It contains NO vendor-specific shapes, so a new
// render provider only needs to translate this into its own timeline format.
//
// Captions are NOT pre-computed here: the provider auto-transcribes the single audio
// source (the presenter clip, else the narration track) so subtitles always match the
// real audio language.

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

export interface RenderPlanPresenter {
  src:        string;
  start:      number;
  length:     number;
  chromaColor: string;                       // green-screen key color
  placement:  "bottom-left" | "bottom-right";
  scale:      number;                        // fraction of the frame
}

export interface RenderPlan {
  width:          number;
  height:         number;
  fps:            number;
  scenes:         RenderPlanScene[];
  narrationAudio?: RenderPlanClip;  // single voiceover track (faceless) — also the caption source
  presenter?:     RenderPlanPresenter; // presenter clip (its audio + the caption source when present)
  musicUrl?:      string;
  captions:       boolean;          // add auto-transcribed karaoke captions over the audio source
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
