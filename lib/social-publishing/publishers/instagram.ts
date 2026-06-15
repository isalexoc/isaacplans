import type { PublishResult } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  maxAttempts = 20
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Instagram container status: ${data.status_code}`);
    }
  }
  throw new Error("Instagram container processing timed out");
}

export async function publishToInstagram(
  igUserId: string,
  pageAccessToken: string,
  caption: string,
  imageUrl: string
): Promise<PublishResult> {
  // Step 1: Create media container
  const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url:    imageUrl,
      caption,
      access_token: pageAccessToken,
    }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) return { success: false, error: containerData.error.message };
  const containerId = containerData.id;

  // Step 2: Wait for processing
  try {
    await pollContainerStatus(containerId, pageAccessToken);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Container polling failed" };
  }

  // Step 3: Publish
  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: pageAccessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) return { success: false, error: publishData.error.message };
  return { success: true, platformPostId: publishData.id };
}
