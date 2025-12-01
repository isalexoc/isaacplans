import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendNewsletterEmail } from "@/lib/email/notifications";

// Configure max duration for Vercel serverless functions
export const maxDuration = 30; // 30 seconds should be enough for email connection

// GET /api/newsletter/unsubscribe?token=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unsubscribe token is required" },
        { status: 400 }
      );
    }

    // Find subscriber by unsubscribe token
    const subscriber = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.unsubscribeToken, token),
    });

    if (!subscriber) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired unsubscribe token",
        },
        { status: 404 }
      );
    }

    if (subscriber.status === "unsubscribed") {
      // Already unsubscribed - redirect to confirmation page
      return NextResponse.redirect(
        new URL(
          `/${subscriber.locale || "en"}/newsletter?status=already_unsubscribed`,
          request.url
        )
      );
    }

    // Unsubscribe
    await db
      .update(newsletterSubscribers)
      .set({
        status: "unsubscribed",
        unsubscribedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletterSubscribers.id, subscriber.id));

    // Send unsubscribe confirmation email using after() to prevent Vercel timeouts
    after(async () => {
      try {
        await sendNewsletterEmail({
          email: subscriber.email,
          locale: subscriber.locale || "en",
          token: subscriber.unsubscribeToken || "",
          type: "unsubscribe_confirmation",
        });
        console.log(`[NEWSLETTER] Unsubscribe confirmation email sent successfully to ${subscriber.email}`);
      } catch (error) {
        console.error(`[NEWSLETTER] Error sending unsubscribe confirmation email to ${subscriber.email}:`, error);
      }
    });

    // Redirect to confirmation page
    return NextResponse.redirect(
      new URL(
        `/${subscriber.locale || "en"}/newsletter?status=unsubscribed`,
        request.url
      )
    );
  } catch (error: any) {
    console.error("Error unsubscribing from newsletter:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to unsubscribe",
      },
      { status: 500 }
    );
  }
}

