import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendNewsletterEmail } from "@/lib/email/notifications";

// Configure max duration for Vercel serverless functions
export const maxDuration = 30; // 30 seconds should be enough for email connection

// GET /api/newsletter/confirm?token=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Confirmation token is required" },
        { status: 400 }
      );
    }

    // Find subscriber by confirmation token
    const subscriber = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.confirmationToken, token),
    });

    if (!subscriber) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired confirmation token",
        },
        { status: 404 }
      );
    }

    if (subscriber.status === "confirmed") {
      // Already confirmed - redirect to success page
      return NextResponse.redirect(
        new URL(
          `/${subscriber.locale || "en"}/newsletter?status=already_confirmed`,
          request.url
        )
      );
    }

    // Confirm subscription
    await db
      .update(newsletterSubscribers)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
        confirmationToken: null, // Clear token after confirmation
      })
      .where(eq(newsletterSubscribers.id, subscriber.id));

    // Send welcome email (fire-and-forget, like comment notifications)
    sendNewsletterEmail({
      email: subscriber.email,
      locale: subscriber.locale || "en",
      token: subscriber.unsubscribeToken || "",
      type: "welcome",
    }).catch((error) => {
      console.error("Error sending welcome email:", error);
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/${subscriber.locale || "en"}/newsletter?status=confirmed`,
        request.url
      )
    );
  } catch (error: any) {
    console.error("Error confirming newsletter subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to confirm subscription",
      },
      { status: 500 }
    );
  }
}

