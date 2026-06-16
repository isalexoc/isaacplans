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

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    console.error("[google-business] Non-JSON response from GBP API:", res.status, text.slice(0, 300));
    if (res.status === 401 || res.status === 403) {
      return { success: false, error: "Google Business auth failed — reconnect your Google account in Connections." };
    }
    return { success: false, error: `GBP API error (HTTP ${res.status})` };
  }

  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error?.message ?? "GBP post failed" };
  return { success: true, platformPostId: data.name };
}
