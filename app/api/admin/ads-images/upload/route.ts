import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import cloudinary from "@/config/cloudinary";
import { setAdsImageOverride } from "@/lib/ads-images/settings";
import {
  ADS_LOBS,
  ADS_IMAGE_KINDS,
  ADS_LOCALES,
  type AdsLob,
  type AdsImageKind,
  type AdsLocale,
} from "@/lib/ads-images/shared";

/**
 * Uploads a hero/OG image for a get-covered ads page straight to Cloudinary (rather than
 * requiring Isaac to upload elsewhere and paste a delivery URL), builds an optimized delivery
 * URL, and saves it as the override in one round trip — middleware already enforces admin on
 * /api/admin/* (401/403); the auth() check below is defense-in-depth, matching
 * /api/admin/agent-licenses/upload and /api/leave-behind/agent-profile/upload.
 *
 * The client pre-compresses large photos (lib/image-compress.ts) before sending, but this cap
 * is the server-side backstop — Vercel's serverless request body limit is 4.5 MB.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Hero: cap width only, no forced crop — the panel's `object-cover` frames it. */
const HERO_TRANSFORM = "f_auto,q_auto,w_1200,c_limit";
/** OG / Twitter card: smart-cropped to the standard 1200×630 social card ratio. */
const OG_TRANSFORM = "f_auto,q_auto,w_1200,h_630,c_fill,g_auto";

function withTransform(secureUrl: string, transform: string): string {
  return secureUrl.replace("/image/upload/", `/image/upload/${transform}/`);
}

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
  const lob = String(formData.get("lob") ?? "") as AdsLob;
  const kind = String(formData.get("kind") ?? "") as AdsImageKind;
  const locale = String(formData.get("locale") ?? "") as AdsLocale;

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
  if (!(ADS_LOBS as string[]).includes(lob)) {
    return NextResponse.json({ success: false, error: "Invalid line of business" }, { status: 400 });
  }
  if (!(ADS_IMAGE_KINDS as string[]).includes(kind)) {
    return NextResponse.json({ success: false, error: "Invalid image kind" }, { status: 400 });
  }
  if (!(ADS_LOCALES as string[]).includes(locale)) {
    return NextResponse.json({ success: false, error: "Invalid locale" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `ads-images/${lob}/${kind}/${locale}`,
          resource_type: "image",
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

    const url = withTransform(uploadResult.secure_url, kind === "hero" ? HERO_TRANSFORM : OG_TRANSFORM);

    const saveResult = await setAdsImageOverride(lob, kind, locale, url);
    if (!saveResult.ok) {
      return NextResponse.json({ success: false, error: saveResult.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[ads-images/upload]", error);
    return NextResponse.json({ success: false, error: "Failed to upload image" }, { status: 500 });
  }
}
