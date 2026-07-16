import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import cloudinary from "@/config/cloudinary";
import {
  saleStickerUploadFolder,
  saleStickerExtraImageUrl,
} from "@/lib/sale-sticker-cloudinary";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: "Use a JPEG, PNG, WebP, or GIF image" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "Image must be 4 MB or smaller" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const uploadResult = await new Promise<{ public_id: string; secure_url: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: saleStickerUploadFolder(userId),
            resource_type: "image",
            overwrite: false,
            unique_filename: true,
          },
          (error, result) => {
            if (error || !result?.public_id) {
              reject(error ?? new Error("Upload failed"));
              return;
            }
            resolve({ public_id: result.public_id, secure_url: result.secure_url });
          }
        );
        stream.end(buffer);
      }
    );

    const url = saleStickerExtraImageUrl(uploadResult.public_id);

    return NextResponse.json({
      success: true,
      url,
      publicId: uploadResult.public_id,
    });
  } catch (error) {
    console.error("[sale-sticker/upload]", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
