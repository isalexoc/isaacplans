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
  const requestStartTime = Date.now();
  console.log("[NEWSLETTER] Subscribe request received");
  
  try {
    const body = await request.json();
    const { email, locale = "en", source = "newsletter-page" } = body;

    console.log("[NEWSLETTER] Request data:", {
      email: email?.toLowerCase().trim(),
      locale,
      source,
    });

    // Validate email
    if (!email || typeof email !== "string") {
      console.log("[NEWSLETTER] Validation failed: Email is required");
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("[NEWSLETTER] Validation failed: Invalid email format");
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[NEWSLETTER] Checking for existing subscriber: ${normalizedEmail}`);

    // Check if email already exists
    const existing = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.email, normalizedEmail),
    });

    if (existing) {
      console.log(`[NEWSLETTER] Existing subscriber found with status: ${existing.status}`);
      
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
        console.log(`[NEWSLETTER] Resending confirmation email to ${normalizedEmail}`);
        // Resend confirmation email (fire-and-forget, like comment notifications)
        if (existing.confirmationToken) {
          sendNewsletterEmail({
            email: normalizedEmail,
            locale: existing.locale || locale,
            token: existing.confirmationToken,
            type: "confirmation",
          })
            .then(() => {
              console.log(`[NEWSLETTER] Confirmation email resent successfully to ${normalizedEmail}`);
            })
            .catch((error) => {
              console.error(`[NEWSLETTER] Error resending confirmation email to ${normalizedEmail}:`, error);
            });
        } else {
          console.warn(`[NEWSLETTER] No confirmation token found for pending subscriber: ${normalizedEmail}`);
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
        console.log(`[NEWSLETTER] Re-subscribing user: ${normalizedEmail}`);
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

        console.log(`[NEWSLETTER] Sending confirmation email for re-subscription to ${normalizedEmail}`);
        // Send confirmation email (fire-and-forget, like comment notifications)
        sendNewsletterEmail({
          email: normalizedEmail,
          locale,
          token: confirmationToken,
          type: "confirmation",
        })
          .then(() => {
            console.log(`[NEWSLETTER] Re-subscription confirmation email sent successfully to ${normalizedEmail}`);
          })
          .catch((error) => {
            console.error(`[NEWSLETTER] Error sending re-subscription confirmation email to ${normalizedEmail}:`, error);
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
    console.log(`[NEWSLETTER] Creating new subscriber record for: ${normalizedEmail}`);
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

    console.log(`[NEWSLETTER] Subscriber record created, sending confirmation email to ${normalizedEmail}`);
    // Send confirmation email (fire-and-forget, like comment notifications)
    sendNewsletterEmail({
      email: normalizedEmail,
      locale,
      token: confirmationToken,
      type: "confirmation",
    })
      .then(() => {
        console.log(`[NEWSLETTER] Confirmation email sent successfully to ${normalizedEmail}`);
      })
      .catch((error) => {
        console.error(`[NEWSLETTER] Error sending newsletter confirmation email to ${normalizedEmail}:`, error);
      });

    const duration = Date.now() - requestStartTime;
    console.log(`[NEWSLETTER] Subscribe request completed successfully in ${duration}ms`);

    return NextResponse.json({
      success: true,
      status: "pending",
      message:
        locale === "es"
          ? "Por favor revisa tu correo electrónico para confirmar tu suscripción."
          : "Please check your email to confirm your subscription.",
    });
  } catch (error: any) {
    const duration = Date.now() - requestStartTime;
    console.error(`[NEWSLETTER] Error subscribing to newsletter (duration: ${duration}ms):`, {
      message: error.message,
      stack: error.stack,
      error: error,
    });
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to subscribe to newsletter",
      },
      { status: 500 }
    );
  }
}

