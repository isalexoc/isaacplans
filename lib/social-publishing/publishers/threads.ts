import type { PublishResult } from "../types";

const GRAPH = "https://graph.threads.net/v1.0";

export async function publishToThreads(
  threadsUserId: string,
  accessToken: string,
  text: string,
  imageUrl?: string
): Promise<PublishResult> {
  // Step 1: Create container
  const body: Record<string, string> = {
    media_type:   imageUrl ? "IMAGE" : "TEXT",
    text,
    access_token: accessToken,
  };
  if (imageUrl) body.image_url = imageUrl;

  const containerRes = await fetch(`${GRAPH}/${threadsUserId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const containerData = await containerRes.json();
  if (containerData.error) return { success: false, error: containerData.error.message };

  // Step 2: Publish
  const publishRes = await fetch(`${GRAPH}/${threadsUserId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) return { success: false, error: publishData.error.message };
  return { success: true, platformPostId: publishData.id };
}
