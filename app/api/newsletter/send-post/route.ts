import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { canSendNewsletterPost, sendNewsletterPost } from "@/lib/email/newsletter-post";

// POST /api/newsletter/send-post
// Validates the post synchronously, then fires the send in the background
// via waitUntil() so the response returns immediately instead of blocking
// for the full send duration. Results are written to Sanity and emailed
// to the admin when the background job finishes.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let postId: string;
  let force = false;

  try {
    const body = await request.json();
    postId = body?.postId;
    force = body?.force === true;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!postId || typeof postId !== "string") {
    return NextResponse.json(
      { success: false, error: "postId is required" },
      { status: 400 }
    );
  }

  console.log(`[NEWSLETTER_POST] Send request for postId=${postId} force=${force} userId=${userId}`);

  // Validate synchronously so the caller gets a proper error response immediately
  try {
    await canSendNewsletterPost(postId, force);
  } catch (err: any) {
    if (err.message === "already_sent") {
      return NextResponse.json(
        { success: false, error: "already_sent", sentAt: err.sentAt },
        { status: 409 }
      );
    }
    if (err.message === "Post not found in Sanity") {
      return NextResponse.json(
        { success: false, error: "Post not found in Sanity" },
        { status: 404 }
      );
    }
    if (err.message === "Post must be published before sending") {
      return NextResponse.json(
        { success: false, error: "Post must be published before sending" },
        { status: 400 }
      );
    }
    console.error("[NEWSLETTER_POST] Unexpected validation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Validation failed" },
      { status: 500 }
    );
  }

  // Validation passed — run the send in the background and return immediately
  waitUntil(
    sendNewsletterPost(postId, force).catch((err) => {
      console.error("[NEWSLETTER_POST] Background send failed:", err);
    })
  );

  return NextResponse.json({ success: true, status: "sending" });
}