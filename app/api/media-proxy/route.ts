import { NextRequest, NextResponse } from "next/server";

const ALLOWED_CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "isaacdev";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // Only proxy our own Cloudinary assets
  const allowed = `https://res.cloudinary.com/${ALLOWED_CLOUDINARY_CLOUD}/`;
  if (!url.startsWith(allowed)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  // Video assets (e.g. TikTok PULL_FROM_URL needs the file served from our verified domain).
  const isVideo = url.includes("/video/upload/");
  if (isVideo) {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":   res.headers.get("content-type") ?? "video/mp4",
        "Content-Length": String(buffer.byteLength),
        "Accept-Ranges":  "bytes",
        "Cache-Control":  "public, max-age=31536000, immutable",
      },
    });
  }

  // TikTok only accepts JPEG or WebP — force JPEG via Cloudinary's f_jpg transformation.
  // Insert transformation after /upload/ in the Cloudinary URL.
  const fetchUrl = url.replace(
    /\/image\/upload\//,
    "/image/upload/f_jpg,q_90/"
  );

  const res = await fetch(fetchUrl);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  }

  const contentType = "image/jpeg";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":  contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}