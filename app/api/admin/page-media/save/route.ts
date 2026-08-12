import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { setPageMedia } from "@/lib/page-media/settings";
import {
  isAllowedCloudinaryUrl,
  isVideoUrl,
  publicIdFromUrl,
  videoPosterUrl,
  videoUrl,
} from "@/lib/page-media/cloudinary-urls";
import { LOB_SLUGS, MEDIA_KINDS, MEDIA_LOCALES, MEDIA_SURFACES } from "@/lib/page-media/shared";
import type {
  HeroMedia,
  LobSlug,
  MediaKind,
  MediaLocale,
  MediaSurface,
  VideoPlayback,
} from "@/lib/page-media/shared";

/**
 * Persists a media override that did not come through the image upload route: a video the browser
 * just sent straight to Cloudinary, a playback-mode change on an existing video, or a Cloudinary
 * URL Isaac pasted from the console.
 *
 * Middleware already enforces admin on /api/admin/*; the auth() check is defense-in-depth.
 */
export const runtime = "nodejs";

type Body = {
  lob?: string;
  surface?: string;
  kind?: string;
  locale?: string;
  /** Cloudinary public id from a direct browser upload — preferred, gives us a poster frame. */
  publicId?: string;
  /** Or a full delivery URL pasted by hand. */
  url?: string;
  playback?: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const lob = String(body.lob ?? "") as LobSlug;
  const surface = String(body.surface ?? "") as MediaSurface;
  const kind = String(body.kind ?? "") as MediaKind;
  const locale = String(body.locale ?? "") as MediaLocale;
  const playback: VideoPlayback = body.playback === "click" ? "click" : "loop";

  if (!(LOB_SLUGS as string[]).includes(lob)) {
    return NextResponse.json({ success: false, error: "Invalid line of business" }, { status: 400 });
  }
  if (!(MEDIA_SURFACES as string[]).includes(surface)) {
    return NextResponse.json({ success: false, error: "Invalid page" }, { status: 400 });
  }
  if (!(MEDIA_KINDS as string[]).includes(kind)) {
    return NextResponse.json({ success: false, error: "Invalid media kind" }, { status: 400 });
  }
  if (!(MEDIA_LOCALES as string[]).includes(locale)) {
    return NextResponse.json({ success: false, error: "Invalid locale" }, { status: 400 });
  }

  let media: HeroMedia;

  if (body.publicId?.trim()) {
    // Direct browser → Cloudinary video upload. We know the public id, so we can derive both the
    // delivery URL and a poster frame from it.
    if (kind !== "hero") {
      return NextResponse.json(
        { success: false, error: "Video can only be used for the hero, not the social card." },
        { status: 400 }
      );
    }
    const publicId = body.publicId.trim();
    media = {
      type: "video",
      url: videoUrl(publicId),
      posterUrl: videoPosterUrl(publicId),
      playback,
    };
  } else if (body.url?.trim()) {
    const url = body.url.trim();
    if (!isAllowedCloudinaryUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: "Paste a Cloudinary URL on res.cloudinary.com/isaacdev/… — that is the only host the page can display.",
        },
        { status: 400 }
      );
    }
    if (isVideoUrl(url)) {
      if (kind !== "hero") {
        return NextResponse.json(
          { success: false, error: "A social share image has to be an image — link previews can't play video." },
          { status: 400 }
        );
      }
      // Recover the public id so a pasted URL still gets a poster frame; without one the video
      // shows a black rectangle until the first frame decodes.
      const publicId = publicIdFromUrl(url);
      media = {
        type: "video",
        url,
        posterUrl: publicId ? videoPosterUrl(publicId) : "",
        playback,
      };
    } else {
      media = { type: "image", url };
    }
  } else {
    return NextResponse.json({ success: false, error: "Nothing to save" }, { status: 400 });
  }

  const saved = await setPageMedia(lob, surface, kind, locale, media);
  if (!saved.ok) {
    return NextResponse.json({ success: false, error: saved.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, media });
}
