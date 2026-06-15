import type { PublishResult } from "../types";

export async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  imageUrl: string
): Promise<PublishResult> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
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
