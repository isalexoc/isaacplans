/**
 * Cloudinary folder and delivery URLs for uploaded call recordings.
 */

/**
 * Where uploads land. Fixed rather than client-supplied, because it is part of what the upload
 * signature covers — letting the browser choose would let it write anywhere in the account.
 *
 * Lives here rather than in the sign route because a Next.js route module may only export handlers
 * and a fixed set of config keys; any other export fails the build.
 */
export const CALL_STUDY_FOLDER = "call-study";

/**
 * The audio-only URL handed to ElevenLabs.
 *
 * Audio and video both upload as Cloudinary `resource_type: "video"` — that is correct, not a bug —
 * and asking for the `.mp3` rendition makes Cloudinary strip the video track on delivery. For a
 * screen recording of a sales call that turns a multi-gigabyte download into tens of megabytes,
 * which is the difference between a transcription starting promptly and one that spends ten minutes
 * fetching. For a file that was already audio it is a cheap no-op.
 *
 * `ac_mp3` pins the audio codec so the extension and the actual encoding cannot disagree.
 */
export function cloudinaryAudioUrl(publicId: string, cloudName?: string): string | null {
  const cloud = cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/video/upload/ac_mp3/${publicId}.mp3`;
}

/** The original, untouched — used for playback and for re-running a transcription. */
export function cloudinaryOriginalUrl(publicId: string, cloudName?: string): string | null {
  const cloud = cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/video/upload/${publicId}`;
}
