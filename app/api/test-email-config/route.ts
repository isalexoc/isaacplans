import { NextResponse } from "next/server";

// Configure max duration for Vercel serverless functions
export const maxDuration = 10;

export async function GET() {
  return NextResponse.json({
    success: true,
    config: {
      hasHost: !!process.env.EMAIL_HOST,
      hasUser: !!process.env.EMAIL_USER_INFO,
      hasPass: !!process.env.EMAIL_PASS_INFO,
      port: process.env.EMAIL_PORT || "587",
      secure: process.env.EMAIL_SECURE || "false",
      // Don't expose actual values, just check if they exist
    },
    message: "Check if all email environment variables are set in Vercel",
  });
}

