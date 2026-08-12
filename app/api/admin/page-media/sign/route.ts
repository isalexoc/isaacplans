import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { LOB_SLUGS, MEDIA_LOCALES, MEDIA_SURFACES } from "@/lib/page-media/shared";

/**
 * Mints a short-lived Cloudinary upload signature so the browser can send a hero VIDEO straight to
 * Cloudinary, bypassing this server entirely.
 *
 * That detour is not a nicety: Vercel caps a serverless request body at 4.5 MB, so a video can
 * never be proxied through an API route the way images are. Uploading direct also gives a real
 * progress bar on a file that may take a minute.
 *
 * Signing (rather than an unsigned preset) keeps the upload endpoint useless to anyone who isn't
 * an authenticated admin — the signature covers the folder and a timestamp, and Cloudinary rejects
 * anything that doesn't match. Middleware already enforces admin on /api/admin/*; the auth() check
 * here is defense-in-depth.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  // This project names the key NEXT_PUBLIC_CLOUDINARY_API_KEY; accept both, the same way
  // config/cloudinary.js and lib/lead-magnet-generator/image-generator.ts already do.
  // The key is not a secret — Cloudinary requires it in the browser's upload request, which is
  // why it is public here. Only CLOUDINARY_API_SECRET is sensitive, and it never leaves this
  // handler: it signs the params and the signature is what goes back to the client.
  const apiKey = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName && "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
      !apiKey && "CLOUDINARY_API_KEY (or NEXT_PUBLIC_CLOUDINARY_API_KEY)",
      !apiSecret && "CLOUDINARY_API_SECRET",
    ].filter(Boolean);
    console.error("[page-media/sign] missing env:", missing.join(", "));
    return NextResponse.json(
      { success: false, error: `Cloudinary is not configured on the server (missing ${missing.join(", ")}).` },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const lob = String(body?.lob ?? "");
  const surface = String(body?.surface ?? "");
  const locale = String(body?.locale ?? "");

  if (
    !(LOB_SLUGS as string[]).includes(lob) ||
    !(MEDIA_SURFACES as string[]).includes(surface) ||
    !(MEDIA_LOCALES as string[]).includes(locale)
  ) {
    return NextResponse.json({ success: false, error: "Invalid target" }, { status: 400 });
  }

  // Only `hero` accepts video, so the folder is fixed here rather than taken from the request.
  const folder = `page-media/${lob}/${surface}/hero/${locale}`;
  const timestamp = Math.round(Date.now() / 1000);

  // Every param signed here must be sent by the client verbatim, and nothing else that Cloudinary
  // signs may be added — otherwise the signature check fails.
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return NextResponse.json({
    success: true,
    cloudName,
    apiKey,
    folder,
    timestamp,
    signature,
  });
}
