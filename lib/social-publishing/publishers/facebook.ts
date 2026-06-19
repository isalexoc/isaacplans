import type { PublishResult } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  imageUrl: string
): Promise<PublishResult> {
  const res = await fetch(`${GRAPH}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url:          imageUrl,
      caption,
      access_token: pageAccessToken,
    }),
  });
  const data = await res.json();
  if (data.error) return { success: false, error: data.error.message };
  return { success: true, platformPostId: data.id };
}

// Poll a Reel's processing/publishing status until it goes live (or fails/times out).
async function pollReelStatus(
  videoId: string,
  pageAccessToken: string,
  maxAttempts = 40
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(
      `${GRAPH}/${videoId}?fields=status&access_token=${pageAccessToken}`
    );
    const data = await res.json();
    const phase   = data?.status?.video_status ?? data?.status?.processing_phase?.status;
    const publish = data?.status?.publishing_phase?.status;
    if (publish === "complete" || phase === "ready") return;
    if (publish === "error" || phase === "error" || data?.status?.processing_phase?.status === "error") {
      throw new Error(`Facebook reel processing failed: ${JSON.stringify(data.status ?? data)}`);
    }
  }
  throw new Error("Facebook reel processing timed out");
}

export async function publishFacebookReel(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  videoUrl: string
): Promise<PublishResult> {
  // Phase 1 — start an upload session for the Reel.
  const startRes = await fetch(`${GRAPH}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: pageAccessToken }),
  });
  const startData = await startRes.json();
  if (startData.error) return { success: false, error: startData.error.message };
  const videoId   = startData.video_id as string;
  const uploadUrl = startData.upload_url as string;
  if (!videoId || !uploadUrl) {
    return { success: false, error: "Facebook did not return a reel upload session" };
  }

  // Phase 2 — hand Facebook the hosted mp4 URL; it fetches the bytes itself (no streaming).
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      file_url:      videoUrl,
    },
  });
  const uploadData = await uploadRes.json().catch(() => ({}));
  if (uploadData.error || uploadData.success === false) {
    return { success: false, error: uploadData.error?.message ?? "Facebook reel upload failed" };
  }

  // Phase 3 — finish + publish.
  const finishRes = await fetch(
    `${GRAPH}/${pageId}/video_reels?` +
      new URLSearchParams({
        upload_phase: "finish",
        video_id:     videoId,
        video_state:  "PUBLISHED",
        description:  caption,
        access_token: pageAccessToken,
      }),
    { method: "POST" }
  );
  const finishData = await finishRes.json();
  if (finishData.error) return { success: false, error: finishData.error.message };

  // Best-effort wait for the reel to go live; surface a clear error if it fails.
  try {
    await pollReelStatus(videoId, pageAccessToken);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Reel did not finish publishing" };
  }

  return { success: true, platformPostId: videoId };
}
