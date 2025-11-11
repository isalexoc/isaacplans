import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import cloudinary from "@/config/cloudinary";

// Whitelist of allowed license image public IDs
const ALLOWED_LICENSE_IDS = [
  "license_py9vgu", // Driver's license
  "arizona_seh3e1",
  "colorado_ieaqys",
  "dc_dlypyq",
  "florida_fkx9g8",
  "georgia_v2jqcl",
  "maryland_fhwufq",
  "new_mexico_ulco2i",
  "north_carolina_myol58",
  "ohio_s958a4",
  "texas_ycnpwx",
  "utah_mgw2tw",
  "virginia_woehci",
];

export async function GET(request: NextRequest) {
  try {
    // Check if licenses are unlocked
    const cookieStore = await cookies();
    const isUnlocked = cookieStore.get("licenses_unlocked")?.value === "true";

    if (!isUnlocked) {
      // Return a placeholder image or error
      return NextResponse.json(
        { error: "Licenses are locked. Please unlock to view." },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const publicId = searchParams.get("id");
    const width = searchParams.get("w") || "1200";
    const height = searchParams.get("h") || "800";

    // Validate public ID
    if (!publicId || !ALLOWED_LICENSE_IDS.includes(publicId)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid license image ID" },
        { status: 403 }
      );
    }

    // Generate signed URL with expiration (1 hour)
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    
    // Generate signed URL
    const url = cloudinary.url(publicId, {
      resource_type: "image",
      format: "png",
      sign_url: true,
      expires_at: expiresAt,
      transformation: [
        { width: parseInt(width), height: parseInt(height), crop: "fit", quality: "auto", fetch_format: "auto" }
      ],
    });

    // Fetch the image from Cloudinary
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    // Get the image buffer
    const imageBuffer = await response.arrayBuffer();
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error fetching license image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

