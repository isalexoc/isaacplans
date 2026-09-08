import cloudinary from "@/config/cloudinary";

// ─── A-roll ingest ────────────────────────────────────────────────────────────────
// "A-roll" is Isaac's own recorded clip — the presenter, the voice, and the clock for the
// whole video. Everything here is about getting that clip into a shape the renderer can
// use without surprises: hosted on Cloudinary, delivered 9:16, and with its audio split
// out as a standalone track.

/**
 * Where browser uploads land. Fixed rather than client-supplied because it is part of what
 * the upload signature covers — letting the browser choose would let it write anywhere in
 * the account. Same reasoning as CALL_STUDY_FOLDER.
 */
export const PRESENTER_FOLDER = "social-media/presenter";

/**
 * Length bounds. The floor exists because a clip with no room for a hook hold, one cutaway
 * and a CTA hold cannot be cut at all. The ceiling keeps the whole ingest — including a
 * synchronous transcription — inside one worker tick, and no social ad wants to be longer.
 */
export const MIN_AROLL_SEC = 8;
export const MAX_AROLL_SEC = 180;

// ─── Edit timing ──────────────────────────────────────────────────────────────────
// Shared by the cutaway director (which plans against them), the validator (which enforces
// them) and the renderer (which places the hook and CTA cards in the windows they guarantee
// are his face). One definition, so a change to the edit's rhythm cannot half-apply.

/** Open on his face. A cutaway before this and the viewer never meets the person selling. */
export const HOOK_HOLD_SEC = 2.5;
/** Close on his face. The direct-to-camera ask is the whole point of an ad. */
export const CTA_HOLD_SEC = 3.0;
/** Under this a cutaway reads as a glitch rather than a shot. */
export const MIN_CUTAWAY_SEC = 2.5;
/** Veo's ceiling, and about as long as one shot holds under someone else's voice. */
export const MAX_CUTAWAY_SEC = 8;
/** He has to come back for long enough to be a person again, not a bumper between clips. */
export const MIN_GAP_SEC = 1.5;
/** Past this it stops being his ad. */
export const MAX_COVERAGE = 0.65;
/** How far a boundary may move to land on a breath. */
const SNAP_WINDOW_SEC = 0.45;
/** A pause this long between words is a real gap, not just articulation. */
const MIN_SILENCE_SEC = 0.1;

/**
 * Pull the Cloudinary public id out of a delivery URL.
 *
 * The path between `/video/upload/` and the file can hold transformations, a version, folders,
 * or any mix of them, and only the folders are part of the public id. A version segment (`v123`)
 * is the reliable divider when present; otherwise leading segments that look like a
 * transformation (`c_fill,ar_9:16` — a comma, or a one-or-two-letter prefix and an underscore)
 * are dropped. Returns null for a URL that is not a Cloudinary video delivery URL.
 */
export function publicIdFromUrl(url: string): string | null {
  const after = url.split("/video/upload/")[1];
  if (!after) return null;

  const segments = after.split("?")[0].split("/").filter(Boolean);
  const versionAt = segments.findIndex((s) => /^v\d+$/.test(s));

  const rest =
    versionAt >= 0
      ? segments.slice(versionAt + 1)
      : segments.filter((s, i) => !(i === 0 && isTransformSegment(s)));

  if (!rest.length) return null;
  return rest.join("/").replace(/\.[a-z0-9]{2,5}$/i, "") || null;
}

/** `c_fill,ar_9:16,g_auto,w_1080` or a bare `ac_mp3` — never a folder name. */
function isTransformSegment(segment: string): boolean {
  return segment.includes(",") || /^[a-z]{1,2}_[a-z0-9:.\-]+$/i.test(segment);
}

/**
 * The master speech track, and the source Shotstack auto-transcribes for captions.
 *
 * Asking Cloudinary for the `.mp3` rendition makes it strip the video track on delivery, so a
 * 200 MB phone recording becomes a couple of megabytes. `ac_mp3` pins the audio codec so the
 * extension and the actual encoding cannot disagree. Same trick as lib/call-study/cloudinary.ts.
 */
export function arollAudioUrl(publicId: string, cloudName?: string): string {
  const cloud = cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/video/upload/ac_mp3/${publicId}.mp3`;
}

/**
 * The delivery URL handed to Scribe and the renderer.
 *
 * Two things happen here, and both matter.
 *
 * **It is capped at 1080 wide and pinned to h264.** A phone shoots 4K, and a 4K take is the
 * difference between a render that fetches 80 MB and one that fetches a gigabyte — paid for
 * twice, once by ElevenLabs and once by Shotstack. `q_auto:good` keeps that honest with no
 * visible cost at Reels size. Pinning `vc_h264` rather than letting the format be derived
 * per-client avoids the cold-transcode trap that has bitten video delivery here before.
 *
 * **A landscape take is cropped to 9:16 by Cloudinary, not by the renderer.** `g_auto` is
 * subject-aware; the renderer's `cover` is a blind centre crop that will happily cut Isaac's
 * head in half. A portrait take skips the crop entirely — it is already the right shape.
 */
export function arollDeliveryUrl(
  publicId: string,
  opts: { width?: number; height?: number; forceCrop?: boolean; cloudName?: string } = {}
): string {
  const cloud = opts.cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/video/upload/${arollTransform(opts)}/${publicId}.mp4`;
}

/** The transformation chain `arollDeliveryUrl` applies — shared with the warm-up so both agree. */
export function arollTransform(
  opts: { width?: number; height?: number; forceCrop?: boolean } = {}
): string {
  const size = opts.forceCrop || needsCrop(opts.width, opts.height)
    ? "c_fill,ar_9:16,g_auto,w_1080"
    : "c_limit,w_1080";
  return `${size},q_auto:good,vc_h264`;
}

/** True when the source is wider than it is tall, so reaching 9:16 means cropping. */
export function needsCrop(width?: number, height?: number): boolean {
  return typeof width === "number" && typeof height === "number" && width > height;
}

/**
 * Ask for one byte. A finished derived asset answers `Content-Range: bytes 0-0/<total>`
 * immediately; one still being transcoded answers without a total, or stalls. Lifted from
 * scripts/warm-cloudinary-media.ts, which learned this the hard way.
 */
async function isReady(url: string, timeoutMs = 20_000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const total = res.headers.get("content-range")?.split("/")[1];
    // Drain, so the connection is released rather than left hanging on a transcode.
    await res.arrayBuffer().catch(() => undefined);
    return res.ok && !!total && total !== "*" && Number(total) > 0;
  } catch {
    return false;
  }
}

/**
 * Start building the derived assets, and check whether they landed.
 *
 * A derived Cloudinary video is built on first request, and whoever asks first pays for the
 * transcode. Left alone that would be the renderer, so a cold transcode would surface as a
 * failed render rather than a slow ingest. Kicking it off here moves the cost to a moment where
 * waiting is free: transcription, story direction and image generation all still have to run
 * before anything asks for these URLs, which is minutes of cover.
 *
 * Best-effort throughout — a failure means the render pays for the transcode, not that the ad
 * is lost.
 */
export async function warmArollDerivations(
  publicId: string,
  opts: { width?: number; height?: number; forceCrop?: boolean } = {}
): Promise<void> {
  try {
    await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      resource_type: "video",
      eager: [
        { format: "mp3", audio_codec: "mp3" },
        { raw_transformation: arollTransform(opts), format: "mp4" },
      ],
      eager_async: true,
    });
  } catch (err) {
    console.warn(`[aroll] could not queue derivations for ${publicId}: ${(err as Error).message}`);
  }

  const ready = await Promise.all([
    isReady(arollAudioUrl(publicId)),
    isReady(arollDeliveryUrl(publicId, opts)),
  ]);
  if (!ready.every(Boolean)) {
    console.info(`[aroll] derivations for ${publicId} are still building; later steps will wait on them.`);
  }
}

/**
 * Copy a video that lives somewhere else into our Cloudinary account.
 *
 * Cloudinary fetches the URL itself, so nothing streams through this server — which matters
 * because Vercel caps a request body at 4.5 MB. Re-hosting rather than referencing is the same
 * choice made for Veo clips and Shotstack renders: a URL we own cannot expire underneath us.
 */
export async function uploadArollFromUrl(url: string): Promise<{
  publicId: string;
  videoUrl: string;
  durationSec: number;
  width?: number;
  height?: number;
  bytes?: number;
}> {
  const result = await cloudinary.uploader.upload(url, {
    resource_type: "video",
    folder: PRESENTER_FOLDER,
  });
  return {
    publicId:    result.public_id,
    videoUrl:    result.secure_url,
    durationSec: Math.round(((result as { duration?: number }).duration ?? 0) * 10) / 10,
    width:       result.width,
    height:      result.height,
    bytes:       result.bytes,
  };
}

/** Human-readable reason a clip cannot be used, or null when it is fine. */
export function arollLengthProblem(durationSec: number): string | null {
  if (!durationSec || !Number.isFinite(durationSec)) {
    return "Could not read the length of that video. Try re-uploading it as an mp4.";
  }
  if (durationSec < MIN_AROLL_SEC) {
    return `That clip is ${Math.round(durationSec)}s. It needs to be at least ${MIN_AROLL_SEC}s — there has to be room to open on your face, cut away, and come back for the CTA.`;
  }
  if (durationSec > MAX_AROLL_SEC) {
    return `That clip is ${Math.round(durationSec)}s. The limit is ${MAX_AROLL_SEC}s (${MAX_AROLL_SEC / 60} minutes) — trim it down before uploading.`;
  }
  return null;
}
