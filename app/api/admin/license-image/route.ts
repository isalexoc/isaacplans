import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import cloudinary from "@/config/cloudinary";
import { getLicensePublicId } from "@/lib/agent-licenses";

/**
 * Streams an agent license image from Cloudinary (authenticated delivery,
 * signed 1-hour URL generated server-side).
 *
 * Security: /api/admin/* is enforced by middleware (401 signed-out, 403
 * non-admin) — the auth() check below is defense-in-depth. The image is keyed
 * by state code (or "drivers"), resolved to a Cloudinary public ID via the
 * agentLicense documents in Sanity, so public IDs never reach the browser.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");
    const width = searchParams.get("w") || "1200";
    const height = searchParams.get("h") || "800";

    if (!key) {
      return NextResponse.json({ error: "Missing license key" }, { status: 400 });
    }

    const publicId = await getLicensePublicId(key);
    if (!publicId) {
      return NextResponse.json({ error: "Unknown license" }, { status: 404 });
    }

    // Signed URL with 1-hour expiration
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const url = cloudinary.url(publicId, {
      resource_type: "image",
      format: "png",
      sign_url: true,
      expires_at: expiresAt,
      transformation: [
        {
          width: parseInt(width),
          height: parseInt(height),
          crop: "fit",
          quality: "auto",
          fetch_format: "auto",
        },
      ],
    });

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error fetching license image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
