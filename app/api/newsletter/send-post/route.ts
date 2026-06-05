import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendNewsletterPost } from "@/lib/email/newsletter-post";

export const maxDuration = 300; // bulk email sends can take several minutes

// POST /api/newsletter/send-post
// Sends a Sanity blog post as a newsletter to all confirmed subscribers.
// Segments by locale: EN post → EN subscribers, ES post → ES subscribers.
// Requires Clerk authentication.
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

  try {
    const result = await sendNewsletterPost(postId, force);

    console.log(`[NEWSLETTER_POST] Send complete:`, result);

    return NextResponse.json({ success: true, result });
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

    console.error("[NEWSLETTER_POST] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send newsletter" },
      { status: 500 }
    );
  }
}
