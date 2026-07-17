import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import cloudinary from "@/config/cloudinary";
import { getStateIdByCode, upsertAgentLicense } from "@/lib/agent-licenses-admin";

/**
 * Uploads an agent license image to Cloudinary with `authenticated` delivery
 * (the asset refuses any unsigned request) and upserts the matching Sanity
 * `agentLicense` document.
 *
 * Middleware already enforces admin on /api/admin/* (401/403); the auth()
 * check below is defense-in-depth. The Cloudinary public ID is unique per
 * upload (never reused), so a replaced image can never serve stale from the
 * CDN — and it is deliberately not returned to the browser.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const rawKey = formData.get("key");

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
      { success: false, error: "Image must be 4 MB or smaller" },
      { status: 400 }
    );
  }

  const key = String(rawKey ?? "").toLowerCase();
  if (key !== "drivers" && !/^[a-z]{2}$/.test(key)) {
    return NextResponse.json({ success: false, error: "Invalid license key" }, { status: 400 });
  }

  try {
    let stateId: string | null = null;
    if (key !== "drivers") {
      stateId = await getStateIdByCode(key);
      if (!stateId) {
        return NextResponse.json(
          { success: false, error: `Unknown state code "${key.toUpperCase()}"` },
          { status: 400 }
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: `licenses/${key}-${Date.now()}`,
          type: "authenticated",
          resource_type: "image",
          overwrite: false,
        },
        (error, result) => {
          if (error || !result?.public_id) {
            reject(error ?? new Error("Upload failed"));
            return;
          }
          resolve({ public_id: result.public_id });
        }
      );
      stream.end(buffer);
    });

    await upsertAgentLicense({ key, stateId, publicId: uploadResult.public_id });
    revalidateTag("agent-licenses");

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("[agent-licenses/upload]", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload license" },
      { status: 500 }
    );
  }
}
