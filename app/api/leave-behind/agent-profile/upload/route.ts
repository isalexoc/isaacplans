import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import cloudinary from "@/config/cloudinary";
import {
  leaveBehindAgentUploadFolder,
  leaveBehindDeliveryUrl,
  type LeaveBehindImageKind,
} from "@/lib/leave-behind-cloudinary";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function parseKind(value: FormDataEntryValue | null): LeaveBehindImageKind | null {
  if (value === "profile_photo" || value === "company_logo") return value;
  return null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = parseKind(formData.get("kind"));
  const removeBackground = formData.get("removeBackground") !== "false";

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  if (!kind) {
    return NextResponse.json(
      { success: false, error: "Invalid upload kind (profile_photo or company_logo)" },
      { status: 400 }
    );
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
    const uploadResult = await new Promise<{
      public_id: string;
      secure_url: string;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: leaveBehindAgentUploadFolder(userId, kind),
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
    });

    const url = leaveBehindDeliveryUrl(uploadResult.public_id, kind, {
      removeLogoBackground: removeBackground,
    });

    return NextResponse.json({
      success: true,
      url,
      publicId: uploadResult.public_id,
    });
  } catch (error) {
    console.error("[leave-behind/agent-profile/upload]", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
