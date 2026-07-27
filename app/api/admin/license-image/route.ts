import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAgentLicenseImage } from "@/lib/agent-license-image";
import { getLicensePublicId } from "@/lib/agent-licenses";

/**
 * Streams an agent license image from Cloudinary.
 *
 * Assets use the `authenticated` delivery type: the asset itself refuses any
 * unsigned request, and the signed URL is generated server-side here (with the
 * API secret) and never leaves the server.
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
    const width = parseInt(searchParams.get("w") || "1200");
    const height = parseInt(searchParams.get("h") || "800");

    if (!key) {
      return NextResponse.json({ error: "Missing license key" }, { status: 400 });
    }

    // Whitelist check up front so unknown keys 404 (vs. a generic 502).
    const publicId = await getLicensePublicId(key);
    if (!publicId) {
      return NextResponse.json({ error: "Unknown license" }, { status: 404 });
    }

    const image = await fetchAgentLicenseImage(key, { width, height });
    if (!image) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(image.buffer), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error fetching license image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
