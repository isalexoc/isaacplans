import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import cloudinary from "@/config/cloudinary";
import { getPageMediaForAdmin, setPageMedia } from "@/lib/page-media/settings";
import {
  HERO_IMAGE_TRANSFORM,
  OG_IMAGE_TRANSFORM,
  POSTER_IMAGE_TRANSFORM,
  withTransform,
} from "@/lib/page-media/cloudinary-urls";
import { LOB_SLUGS, MEDIA_KINDS, MEDIA_LOCALES, MEDIA_SURFACES } from "@/lib/page-media/shared";
import type { LobSlug, MediaKind, MediaLocale, MediaSurface } from "@/lib/page-media/shared";

/**
 * Uploads a hero or social-share IMAGE straight to Cloudinary and saves it as the override in one
 * round trip, so Isaac never has to upload somewhere else and paste a URL back.
 *
 * Video does not come through here — Vercel's serverless request body limit is 4.5 MB, which no
 * real video clears. Video goes browser → Cloudinary directly, signed by
 * /api/admin/page-media/sign and persisted by /api/admin/page-media/save.
 *
 * Middleware already enforces admin on /api/admin/* (401/403); the auth() check below is
 * defense-in-depth, matching the other admin upload routes.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const lob = String(formData.get("lob") ?? "") as LobSlug;
  const surface = String(formData.get("surface") ?? "") as MediaSurface;
  const kind = String(formData.get("kind") ?? "") as MediaKind;
  const locale = String(formData.get("locale") ?? "") as MediaLocale;
  // "poster" means: keep the video that is already set, just replace the still shown before play.
  const asPoster = String(formData.get("target") ?? "") === "poster";

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: "Use a JPEG, PNG, or WebP image" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: `Image must be 4 MB or smaller (got ${formatBytes(file.size)})` },
      { status: 400 }
    );
  }
  if (!(LOB_SLUGS as string[]).includes(lob)) {
    return NextResponse.json({ success: false, error: "Invalid line of business" }, { status: 400 });
  }
  if (!(MEDIA_SURFACES as string[]).includes(surface)) {
    return NextResponse.json({ success: false, error: "Invalid page" }, { status: 400 });
  }
  if (!(MEDIA_KINDS as string[]).includes(kind)) {
    return NextResponse.json({ success: false, error: "Invalid image kind" }, { status: 400 });
  }
  if (!(MEDIA_LOCALES as string[]).includes(locale)) {
    return NextResponse.json({ success: false, error: "Invalid locale" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `page-media/${lob}/${surface}/${kind}/${locale}`,
          resource_type: "image",
          // `unique_filename` rather than overwriting a fixed public id: reusing an id leaves the
          // old bytes on the CDN edge and Isaac sees the previous image for hours.
          overwrite: false,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(error ?? new Error("Upload failed"));
            return;
          }
          resolve({ secure_url: result.secure_url });
        }
      );
      stream.end(buffer);
    });

    const transform = asPoster
      ? POSTER_IMAGE_TRANSFORM
      : kind === "hero"
        ? HERO_IMAGE_TRANSFORM
        : OG_IMAGE_TRANSFORM;
    const url = withTransform(uploadResult.secure_url, transform, "image");

    if (asPoster) {
      // Attach to the existing video rather than replacing it. If there is no video set, there is
      // nothing for a poster to introduce — say so instead of silently discarding the upload.
      const rows = await getPageMediaForAdmin();
      const current = rows.find(
        (r) => r.lob === lob && r.surface === surface && r.kind === kind && r.locale === locale
      )?.override;
      if (current?.type !== "video") {
        return NextResponse.json(
          { success: false, error: "Upload a video first — a poster is the still shown before it plays." },
          { status: 400 }
        );
      }
      const media = { ...current, posterUrl: url, posterCustom: true } as const;
      const savedPoster = await setPageMedia(lob, surface, kind, locale, media);
      if (!savedPoster.ok) {
        return NextResponse.json({ success: false, error: savedPoster.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, url, media });
    }

    const saved = await setPageMedia(lob, surface, kind, locale, { type: "image", url });
    if (!saved.ok) {
      return NextResponse.json({ success: false, error: saved.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, url, media: { type: "image", url } });
  } catch (error) {
    console.error("[page-media/upload]", error);
    return NextResponse.json({ success: false, error: "Failed to upload image" }, { status: 500 });
  }
}
