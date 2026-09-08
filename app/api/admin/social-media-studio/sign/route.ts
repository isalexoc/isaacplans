import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { PRESENTER_FOLDER } from "@/lib/social-media-studio/aroll";

/**
 * Mints a short-lived Cloudinary upload signature so the browser can send a recorded take straight
 * to Cloudinary, bypassing this server.
 *
 * Not a nicety: Vercel caps a serverless request body at 4.5 MB and a minute of phone video is
 * many times that, so proxying through an API route is simply not possible. Uploading direct also
 * gives a real progress bar on a file that takes a while.
 *
 * Signing rather than using an unsigned preset keeps the upload endpoint useless to anyone who is
 * not an authenticated admin. Middleware already enforces admin on /api/admin/*; the auth() check
 * here is defence in depth. Modelled on app/api/admin/call-study/sign/route.ts.
 */
export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  // The API key is not a secret — Cloudinary requires it in the browser's own upload request.
  // Only CLOUDINARY_API_SECRET is sensitive, and it never leaves this handler.
  const apiKey = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName && "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
      !apiKey && "CLOUDINARY_API_KEY (or NEXT_PUBLIC_CLOUDINARY_API_KEY)",
      !apiSecret && "CLOUDINARY_API_SECRET",
    ].filter(Boolean);
    console.error("[social-media-studio/sign] missing env:", missing.join(", "));
    return NextResponse.json(
      { success: false, error: `Cloudinary is not configured (missing ${missing.join(", ")}).` },
      { status: 500 }
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  // Every signed param must be sent by the client verbatim, and nothing else Cloudinary signs may
  // be added, or the signature check fails.
  const signature = cloudinary.utils.api_sign_request(
    { folder: PRESENTER_FOLDER, timestamp },
    apiSecret
  );

  return NextResponse.json({
    success: true,
    cloudName,
    apiKey,
    folder: PRESENTER_FOLDER,
    timestamp,
    signature,
  });
}
