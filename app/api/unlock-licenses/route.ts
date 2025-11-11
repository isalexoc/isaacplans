import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const PRESENTATION_PASSWORD = process.env.PRESENTATION_PASSWORD || "isaac2024";
const SESSION_DURATION = 2 * 60 * 60; // 2 hours in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Validate password
    if (password !== PRESENTATION_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Set secure session cookie
    const cookieStore = await cookies();
    cookieStore.set("licenses_unlocked", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION,
      path: "/",
    });

    return NextResponse.json({ success: true, message: "Licenses unlocked" });
  } catch (error) {
    console.error("Error unlocking licenses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Check if licenses are unlocked
  const cookieStore = await cookies();
  const isUnlocked = cookieStore.get("licenses_unlocked")?.value === "true";

  return NextResponse.json({ unlocked: isUnlocked });
}

