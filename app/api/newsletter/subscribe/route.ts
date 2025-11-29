import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendNewsletterEmail } from "@/lib/email/notifications";

// Configure max duration for Vercel serverless functions
export const maxDuration = 30; // 30 seconds should be enough for email connection

// POST /api/newsletter/subscribe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, locale = "en", source = "newsletter-page" } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.email, normalizedEmail),
    });

    if (existing) {
      if (existing.status === "confirmed") {
        // Already subscribed - friendly message
        return NextResponse.json({
          success: true,
          status: "already_subscribed",
          message:
            locale === "es"
              ? "Ya estás suscrito. Revisa tu bandeja de entrada para nuestras últimas actualizaciones."
              : "You're already subscribed! Check your inbox for our latest updates.",
        });
      }

      if (existing.status === "pending") {
        // Resend confirmation email (fire-and-forget, like comment notifications)
        if (existing.confirmationToken) {
          sendNewsletterEmail({
            email: normalizedEmail,
            locale: existing.locale || locale,
            token: existing.confirmationToken,
            type: "confirmation",
          }).catch((error) => {
            console.error("Error resending confirmation email:", error);
          });
        }

        return NextResponse.json({
          success: true,
          status: "confirmation_resent",
          message:
            locale === "es"
              ? "Te hemos enviado un nuevo correo de confirmación. Por favor revisa tu bandeja de entrada."
              : "We've sent you a new confirmation email. Please check your inbox.",
        });
      }

      if (existing.status === "unsubscribed") {
        // Re-subscribe (treat as new, require confirmation)
        const confirmationToken = nanoid(32);
        await db
          .update(newsletterSubscribers)
          .set({
            status: "pending",
            confirmationToken,
            unsubscribeToken: nanoid(32), // New unsubscribe token
            locale,
            source,
            updatedAt: new Date(),
            unsubscribedAt: null,
          })
          .where(eq(newsletterSubscribers.id, existing.id));

        // Send confirmation email (fire-and-forget, like comment notifications)
        sendNewsletterEmail({
          email: normalizedEmail,
          locale,
          token: confirmationToken,
          type: "confirmation",
        }).catch((error) => {
          console.error("Error sending confirmation email:", error);
        });

        return NextResponse.json({
          success: true,
          status: "resubscribed",
          message:
            locale === "es"
              ? "¡Bienvenido de nuevo! Te hemos enviado un correo de confirmación para reactivar tu suscripción."
              : "Welcome back! We've sent you a confirmation email to reactivate your subscription.",
        });
      }
    }

    // New subscriber - create pending record
    const confirmationToken = nanoid(32);
    const unsubscribeToken = nanoid(32);

    await db.insert(newsletterSubscribers).values({
      id: nanoid(),
      email: normalizedEmail,
      status: "pending",
      confirmationToken,
      unsubscribeToken,
      source,
      locale,
    });

    // Send confirmation email (fire-and-forget, like comment notifications)
    sendNewsletterEmail({
      email: normalizedEmail,
      locale,
      token: confirmationToken,
      type: "confirmation",
    }).catch((error) => {
      console.error("Error sending newsletter confirmation email:", error);
    });

    return NextResponse.json({
      success: true,
      status: "pending",
      message:
        locale === "es"
          ? "Por favor revisa tu correo electrónico para confirmar tu suscripción."
          : "Please check your email to confirm your subscription.",
    });
  } catch (error: any) {
    console.error("Error subscribing to newsletter:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to subscribe to newsletter",
      },
      { status: 500 }
    );
  }
}

