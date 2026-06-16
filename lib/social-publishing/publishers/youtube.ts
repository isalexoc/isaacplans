import type { PublishResult } from "../types";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status";

export async function publishToYouTube(
  channelId: string,
  accessToken: string,
  caption: string,
  videoUrl: string
): Promise<PublishResult> {
  void channelId; // channel is implicit from the authenticated user; kept for signature consistency

  if (!videoUrl) {
    return { success: false, error: "YouTube publish requires a video URL. Add one to this post before publishing." };
  }

  // Fetch video bytes from the source URL
  let videoBuffer: ArrayBuffer;
  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to fetch video: HTTP ${videoRes.status}`);
    videoBuffer = await videoRes.arrayBuffer();
  } catch (err) {
    return { success: false, error: `Could not download video for upload: ${(err as Error).message}` };
  }

  // Detect content type from URL; default to mp4
  const ext = videoUrl.split("?")[0].split(".").pop()?.toLowerCase();
  const mimeType = ext === "mov" ? "video/quicktime"
    : ext === "webm" ? "video/webm"
    : "video/mp4";

  // Build multipart body: metadata part + video binary part
  const boundary = `yt_boundary_${Date.now()}`;

  const description = caption.includes("#Shorts") ? caption : `${caption}\n\n#Shorts`;

  const metadata = JSON.stringify({
    snippet: {
      title:      description.split("\n")[0].slice(0, 100) || "YouTube Short",
      description,
      categoryId: "22",
      tags:       ["Shorts"],
    },
    status: {
      privacyStatus: "public",
    },
  });

  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n`;

  const videoPart =
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const closing = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const metaBytes  = encoder.encode(metaPart);
  const videoBytes  = encoder.encode(videoPart);
  const closingBytes = encoder.encode(closing);
  const videoData   = new Uint8Array(videoBuffer);

  const body = new Uint8Array(
    metaBytes.length + videoBytes.length + videoData.length + closingBytes.length
  );
  let offset = 0;
  body.set(metaBytes,   offset); offset += metaBytes.length;
  body.set(videoBytes,  offset); offset += videoBytes.length;
  body.set(videoData,   offset); offset += videoData.length;
  body.set(closingBytes, offset);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message ?? data.error ?? `YouTube API error (HTTP ${res.status})`;
    return { success: false, error: msg };
  }

  return { success: true, platformPostId: data.id };
}
