import type { PublishResult } from "../types";

export async function publishToTikTok(
  _openId: string,
  accessToken: string,
  caption: string,
  imageUrl: string,
  videoUrl?: string
): Promise<PublishResult> {
  // Sandbox requires SELF_ONLY; production can use PUBLIC_TO_EVERYONE
  const privacyLevel = process.env.TIKTOK_PRIVACY_LEVEL ?? "SELF_ONLY";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";

  const proxy = (u: string) =>
    u.includes("res.cloudinary.com") ? `${siteUrl}/api/media-proxy?url=${encodeURIComponent(u)}` : u;

  // If a generated video is available, post it as a TikTok VIDEO (its native format).
  if (videoUrl) {
    return publishTikTokVideo(accessToken, caption, proxy(videoUrl), privacyLevel);
  }

  // TikTok requires URL ownership verification — proxy Cloudinary images through our domain
  const proxiedImageUrl = proxy(imageUrl);

  const requestBody = {
    post_info: {
      description:     caption.slice(0, 2200),
      privacy_level:   privacyLevel,
      disable_duet:    false,
      disable_stitch:  false,
      disable_comment: false,
    },
    source_info: {
      source:            "PULL_FROM_URL",
      photo_images:      [proxiedImageUrl],
      photo_cover_index: 0,
    },
    media_type: "PHOTO",
    post_mode:  "DIRECT_POST",
  };

  console.log("[TikTok] POST /v2/post/publish/content/init/ body:", JSON.stringify(requestBody, null, 2));

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(requestBody),
  });

  const initData = await initRes.json();
  console.log("[TikTok] Response status:", initRes.status, "body:", JSON.stringify(initData, null, 2));

  if (initData.error?.code && initData.error.code !== "ok") {
    const msg = initData.error.message ?? "TikTok post failed";
    if (initData.error.code === "access_token_invalid" || initData.error.code === "scope_not_authorized") {
      return { success: false, error: "TikTok: app not yet approved for publishing. Submit an audit in the TikTok developer portal." };
    }
    if (initData.error.code === "unaudited_client_can_only_post_to_private_accounts") {
      return { success: false, error: "TikTok: your app is unaudited — set your TikTok account to Private in the TikTok app, or submit an audit at developers.tiktok.com to enable public posting." };
    }
    return { success: false, error: `TikTok error [${initData.error.code}]: ${msg}` };
  }

  const publishId = initData.data?.publish_id;

  // Poll status — PULL_FROM_URL is async; TikTok fetches and processes the image
  const finalStatus = await pollTikTokStatus(publishId, accessToken);
  console.log("[TikTok] Final publish status:", JSON.stringify(finalStatus, null, 2));

  if (finalStatus.status === "FAILED") {
    return { success: false, error: `TikTok processing failed: ${finalStatus.failReason ?? "unknown reason"}` };
  }

  return { success: true, platformPostId: publishId };
}

async function publishTikTokVideo(
  accessToken: string,
  caption: string,
  videoUrl: string,
  privacyLevel: string
): Promise<PublishResult> {
  const requestBody = {
    post_info: {
      title:           caption.slice(0, 2200),
      privacy_level:   privacyLevel,
      disable_duet:    false,
      disable_stitch:  false,
      disable_comment: false,
    },
    source_info: {
      source:    "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };

  console.log("[TikTok] POST /v2/post/publish/video/init/ body:", JSON.stringify(requestBody, null, 2));

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(requestBody),
  });

  const initData = await initRes.json();
  console.log("[TikTok] Video response status:", initRes.status, "body:", JSON.stringify(initData, null, 2));

  if (initData.error?.code && initData.error.code !== "ok") {
    const msg = initData.error.message ?? "TikTok video post failed";
    if (initData.error.code === "access_token_invalid" || initData.error.code === "scope_not_authorized") {
      return { success: false, error: "TikTok: app not yet approved for publishing. Submit an audit in the TikTok developer portal." };
    }
    if (initData.error.code === "unaudited_client_can_only_post_to_private_accounts") {
      return { success: false, error: "TikTok: your app is unaudited — set your TikTok account to Private, or submit an audit at developers.tiktok.com to enable public posting." };
    }
    return { success: false, error: `TikTok error [${initData.error.code}]: ${msg}` };
  }

  const publishId = initData.data?.publish_id;
  const finalStatus = await pollTikTokStatus(publishId, accessToken);
  console.log("[TikTok] Final video publish status:", JSON.stringify(finalStatus, null, 2));

  if (finalStatus.status === "FAILED") {
    return { success: false, error: `TikTok processing failed: ${finalStatus.failReason ?? "unknown reason"}` };
  }
  return { success: true, platformPostId: publishId };
}

async function pollTikTokStatus(
  publishId: string,
  accessToken: string,
  maxAttempts = 10
): Promise<{ status: string; failReason?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json();
    console.log(`[TikTok] Status poll ${i + 1}:`, JSON.stringify(data, null, 2));

    const status = data.data?.status;
    if (status === "PUBLISH_COMPLETE") return { status: "PUBLISHED" };
    if (status === "FAILED")           return { status: "FAILED", failReason: data.data?.fail_reason };
    // PROCESSING_DOWNLOAD / PROCESSING_UPLOAD / SENDING_TO_USER_INBOX — keep polling
  }
  // Timed out but not failed — treat as success since init was accepted
  return { status: "UNKNOWN" };
}
