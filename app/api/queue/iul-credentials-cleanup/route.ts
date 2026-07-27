import { NextResponse, type NextRequest } from "next/server";
import cloudinary from "@/config/cloudinary";
import { verifyQStashRequest } from "@/lib/qstash/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * QStash delivery endpoint that deletes a generated IUL credentials card after
 * its TTL (published with a delay from lib/iul-credentials-share.tsx), so the
 * shared ID documents are not left permanently public.
 *
 * Authenticated by the Upstash-Signature header. 200 = handled/no-retry,
 * 500 = transient → QStash retries with backoff.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQStashRequest(req, rawBody))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let publicId: string | undefined;
  try {
    publicId = (JSON.parse(rawBody) as { publicId?: string }).publicId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!publicId) {
    return NextResponse.json({ error: "publicId required" }, { status: 400 });
  }

  // Only ever touch our own generated cards — never source license assets.
  if (!publicId.startsWith("iul-credentials/")) {
    return NextResponse.json({ error: "Refusing to delete non-credentials asset" }, { status: 400 });
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
    // "ok" = deleted, "not found" = already gone; both are terminal (no retry).
    return NextResponse.json({ ok: true, result: result.result });
  } catch (err) {
    console.error("[iul-credentials-cleanup] destroy failed", { publicId, err });
    return NextResponse.json({ ok: false, retry: true }, { status: 500 });
  }
}
