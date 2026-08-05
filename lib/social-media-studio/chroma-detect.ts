import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Detects the actual background colour of a presenter clip so the renderer can chroma-key it.
 *
 * We can't assume pure #00FF00. HeyGen only honours the `background` parameter for stock /
 * instant avatars, which are rendered as a cutout composited over the colour we ask for. A
 * CUSTOM PHOTO avatar ("look") is a flat photograph with no alpha — whatever green was baked
 * into that photo when it was generated is what actually shows, and it is a muted screen green
 * (~#52BA5C), far enough from #00FF00 to fall outside the keyer's tolerance and render as a
 * visible green box. Sampling the clip itself is the only reliable source of truth.
 *
 * Soft-fails to null so a detection problem never blocks a render.
 */

// The presenter is centred/bottom-anchored in frame, so the top corners are background.
const SAMPLE_CROPS = ["crop=iw/8:ih/8:0:0", "crop=iw/8:ih/8:iw*7/8:0"];
const FFMPEG_TIMEOUT_MS = 20_000;

async function getFfmpegPath(): Promise<string> {
  const mod = await import("ffmpeg-static");
  const ffmpegPath = mod.default;
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not available for this platform");
  return ffmpegPath;
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Average RGB of one cropped region of the clip's first frame. */
async function samplePatch(ffmpegPath: string, url: string, crop: string): Promise<[number, number, number] | null> {
  const { stdout } = await execFileAsync(
    ffmpegPath,
    ["-v", "error", "-i", url, "-frames:v", "1", "-vf", `${crop},scale=1:1`,
     "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { encoding: "buffer", maxBuffer: 4096, timeout: FFMPEG_TIMEOUT_MS },
  );
  const buf = stdout as unknown as Buffer;
  return buf?.length >= 3 ? [buf[0], buf[1], buf[2]] : null;
}

/**
 * Returns the clip's background colour as a hex string, or null when it can't be determined.
 * Only greenish samples are trusted — if the corners aren't green the clip probably isn't a
 * green-screen render at all, and keying an arbitrary colour would punch holes in the avatar.
 */
export async function detectPresenterChromaColor(videoUrl: string): Promise<string | null> {
  try {
    const ffmpegPath = await getFfmpegPath();
    const samples: [number, number, number][] = [];
    for (const crop of SAMPLE_CROPS) {
      try {
        const px = await samplePatch(ffmpegPath, videoUrl, crop);
        if (px) samples.push(px);
      } catch { /* try the other corner */ }
    }
    if (samples.length === 0) return null;

    const avg = samples.reduce(
      (acc, [r, g, b]) => [acc[0] + r / samples.length, acc[1] + g / samples.length, acc[2] + b / samples.length],
      [0, 0, 0],
    );
    const [r, g, b] = avg;

    // Green screen sanity check: green must clearly dominate both other channels.
    const isGreenish = g > 60 && g > r * 1.25 && g > b * 1.25;
    if (!isGreenish) {
      console.warn(`[chroma-detect] corners are ${toHex(r, g, b)} — not a green screen, skipping`);
      return null;
    }
    const hex = toHex(r, g, b);
    console.log(`[chroma-detect] presenter background detected as ${hex}`);
    return hex;
  } catch (e) {
    console.warn("[chroma-detect] detection failed:", (e as Error).message);
    return null;
  }
}
