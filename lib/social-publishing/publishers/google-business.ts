import type { PublishResult } from "../types";

export async function publishToGoogleBusiness(
  locationId: string,
  accessToken: string,
  summary: string,
  imageUrl?: string
): Promise<PublishResult> {
  const body: Record<string, unknown> = {
    languageCode: "en-US",
    summary,
    topicType: "STANDARD",
  };

  if (imageUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }];
  }

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error?.message ?? "GBP post failed" };
  return { success: true, platformPostId: data.name };
}
