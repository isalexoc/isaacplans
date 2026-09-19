import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import cloudinary from "@/config/cloudinary";
import { getIsAdmin } from "@/lib/auth/admin";
import { callPdfFilename } from "@/lib/call-study/pdf";
import { getRecording } from "@/lib/call-study/store";

/**
 * Download the beeped copy.
 *
 * The file is stored `type: "authenticated"`, so it has no working public URL; this mints a signed
 * one and redirects. The id is never accepted from the caller — it is read from the row the caller
 * has just been shown to own, so this cannot be turned into a signing oracle for other assets in
 * the Cloudinary account.
 */

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await getRecording(id);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!row.shareableAudioId) {
      return NextResponse.json(
        { success: false, error: "No shareable copy has been built for this call yet." },
        { status: 404 }
      );
    }

    /**
     * `?download=1` saves the file; without it the response streams.
     *
     * The distinction matters because this same URL is the `<audio>` source on the call page. The
     * attachment flag sets Content-Disposition, which makes a browser save the file instead of
     * playing it — so a player pointed at the download URL silently does nothing.
     */
    const asDownload = request.nextUrl.searchParams.get("download") === "1";
    const filename = callPdfFilename(row.title).replace(/-transcript\.pdf$/, "-shareable");

    const url = cloudinary.url(row.shareableAudioId, {
      resource_type: "video",
      type: "authenticated",
      sign_url: true,
      secure: true,
      ...(asDownload ? { flags: `attachment:${filename}` } : {}),
      format: "mp3",
    });

    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    console.error("[call-study/recordings/:id/shareable-audio] GET", error);
    return NextResponse.json({ success: false, error: "Could not build the link" }, { status: 500 });
  }
}
