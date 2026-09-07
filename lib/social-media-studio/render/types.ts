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
  /**
   * Dissolve this scene in and out. Set for A-roll cutaways, where the scene has to arrive over
   * a shot that is already on screen and hand it back afterwards; left unset for a contiguous
   * slideshow, where every scene is a hard cut into the next.
   */
  transition?:   boolean;
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

/**
 * The presenter's own recorded take: full frame, and the audio for the entire video.
 *
 * Distinct from RenderPlanPresenter, which is a chroma-keyed avatar in a corner. This one IS the
 * video — the scenes above it are cutaways that briefly cover it, and its audio never stops.
 */
export interface RenderPlanARoll {
  src:      string;   // the take, already delivered at 9:16
  audioSrc: string;   // its audio as a standalone track — the speech source captions transcribe
  start:    number;   // always 0
  length:   number;   // the whole take; identical to RenderPlan.durationSec
  offsetX?: number;   // framing nudge when a landscape source had to be cropped
}

/** A burned-in card: the opening headline, a mid-roll kicker, or the closing call to action. */
export interface RenderPlanTextCard {
  text:      string;
  start:     number;
  length:    number;
  style:     "hook" | "kicker" | "cta";
  placement: "top" | "middle" | "bottom";
}

export interface RenderPlan {
  width:          number;
  height:         number;
  fps:            number;
  /**
   * Total length of the finished video, in seconds — ALWAYS the length of the spoken
   * narration (which is the user's script, verbatim). Providers must not let any element
   * run past this: the video ends when the script ends.
   */
  durationSec:    number;
  scenes:         RenderPlanScene[];
  narrationAudio?: RenderPlanClip;  // single voiceover track (faceless) — also the caption source
  presenter?:     RenderPlanPresenter; // presenter clip (its audio + the caption source when present)
  musicUrl?:      string;
  musicVolume?:   number;           // default 0.12; lower under a real recorded voice
  captions:       boolean;          // add auto-transcribed karaoke captions over the audio source
  /**
   * Presenter-on-camera mode. When set, `scenes` are sparse CUTAWAYS over this take rather than a
   * contiguous slideshow, and the take supplies both the picture underneath them and the audio.
   */
  aRoll?:         RenderPlanARoll;
  textCards?:     RenderPlanTextCard[];
  /** Force the caption band somewhere specific; otherwise the provider derives it from the layout. */
  captionPlacement?: "top" | "middle" | "bottom";
  captionOffsetY?:   number;        // fraction of frame height, +up from centre
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
