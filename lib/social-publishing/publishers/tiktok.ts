import type { PublishResult } from "../types";

export async function publishToTikTok(
  _openId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<PublishResult> {
  // Photo post via Content Posting API (requires app approval)
  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title:        caption.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet:  false,
        disable_stitch: false,
        disable_comment: false,
      },
      source_info: {
        source:    "PULL_FROM_URL",
        photo_images: [imageUrl],
        photo_cover_index: 0,
      },
      media_type: "PHOTO",
      post_mode:  "DIRECT_POST",
    }),
  });

  const initData = await initRes.json();

  if (initData.error?.code && initData.error.code !== "ok") {
    const msg = initData.error.message ?? "TikTok post failed";
    if (initData.error.code === "access_token_invalid" || initData.error.code === "scope_not_authorized") {
      return {
        success: false,
        error: "TikTok publishing is pending developer app approval. The app needs to be approved by TikTok before publishing is enabled.",
      };
    }
    return { success: false, error: msg };
  }

  return { success: true, platformPostId: initData.data?.publish_id };
}
