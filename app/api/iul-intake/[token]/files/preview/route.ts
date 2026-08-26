import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIntakeByToken, canAccessIntake } from "@/lib/iul-intake/server";
import { readIulDeviceId } from "@/lib/iul-intake/device";
import { allFileFields, type FileRef } from "@/lib/iul-intake/fields";
import { decryptIntakeData } from "@/lib/crypto/field-encryption";
import type { IntakeData } from "@/lib/iul-intake/schema";
import { signedThumbnailUrl } from "@/lib/iul-intake/document-upload";

/**
 * GET /api/iul-intake/[token]/files/preview?id=<cloudinaryId> — redirect to a signed thumbnail.
 *
 * Documents are stored with Cloudinary `authenticated` delivery, which means no URL works on its
 * own. Something has to mint a signed one, and this is it.
 *
 * ─── The check that makes this safe ───
 *
 * Signing whatever id it is handed would make this an oracle: anyone with a session token could
 * read *any* asset in the Cloudinary account, including the agent's own licence images, simply by
 * guessing public ids. So the requested id must appear on THIS session's own file list. The list
 * is the authority, not the caller.
 *
 * A 302 to the signed URL rather than proxying the bytes: the browser fetches Cloudinary directly,
 * which keeps a serverless function out of the path of every thumbnail in a list.
 */

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const { userId } = await auth();
    const deviceId = await readIulDeviceId();
    const access = canAccessIntake(row, { userId, deviceId });
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    // Only ids attached to this session may be signed — see the header note.
    const decrypted = decryptIntakeData((row.data ?? {}) as IntakeData);
    const owned = new Set<string>();
    for (const field of allFileFields()) {
      const list = decrypted[field.key];
      if (!Array.isArray(list)) continue;
      for (const ref of list as FileRef[]) {
        if (ref?.cloudinaryId) owned.add(ref.cloudinaryId);
      }
    }
    if (!owned.has(id)) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const size = Number(request.nextUrl.searchParams.get("size") ?? "320");
    const url = signedThumbnailUrl(id, Number.isFinite(size) ? Math.min(Math.max(size, 64), 1600) : 320);

    // No caching by shared proxies: the signature is short-lived and the image is a client's
    // identity document, which should not sit in an intermediary's cache.
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("[iul-intake/:token/files/preview] GET", error);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
