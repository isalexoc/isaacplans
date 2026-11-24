import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { count, eq, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendNewsletterEmail } from "@/lib/email/notifications";

/**
 * Form-bombing bots push victims' addresses into any form that sends an email. Two limits, neither
 * felt by a real subscriber: a pending address gets a confirmation at most every 15 minutes, and the
 * whole site sends at most 20 first-time confirmations an hour (real sign-ups are a few a week).
 */
const RESEND_COOLDOWN_MS = 15 * 60 * 1000;
const NEW_CONFIRMATIONS_PER_HOUR = 20;

/** "jo***@gmail.com": enough to follow a log line, not enough to identify the person. */
function maskEmail(value: string): string {
  const at = value.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${value.slice(0, Math.min(2, at))}***${value.slice(at)}`;
}

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
      email: typeof email === "string" ? maskEmail(email.toLowerCase().trim()) : undefined,
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
    console.log(`[NEWSLETTER] Checking for existing subscriber: ${maskEmail(normalizedEmail)}`);

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
        const lastSentAt = existing.updatedAt ?? existing.createdAt;
        const coolingDown = lastSentAt ? Date.now() - new Date(lastSentAt).getTime() < RESEND_COOLDOWN_MS : false;
        if (coolingDown) {
          // The inbox gets nothing new; the visitor is pointed at the earlier email (and spam folder).
          console.log(`[NEWSLETTER] Pending subscriber within resend cooldown: ${maskEmail(normalizedEmail)}`);
        } else if (existing.confirmationToken) {
          console.log(`[NEWSLETTER] Resending confirmation email to ${maskEmail(normalizedEmail)}`);
          await db
            .update(newsletterSubscribers)
            .set({ updatedAt: new Date() })
            .where(eq(newsletterSubscribers.id, existing.id));
        }
        // Resend confirmation email using after() to prevent Vercel timeouts
        if (!coolingDown && existing.confirmationToken) {
          after(async () => {
            try {
              await sendNewsletterEmail({
                email: normalizedEmail,
                locale: existing.locale || locale,
                token: existing.confirmationToken!,
                type: "confirmation",
              });
              console.log(`[NEWSLETTER] Confirmation email resent successfully to ${maskEmail(normalizedEmail)}`);
            } catch (error) {
              console.error(`[NEWSLETTER] Error resending confirmation email to ${maskEmail(normalizedEmail)}:`, error);
            }
          });
        } else if (!existing.confirmationToken) {
          console.warn(`[NEWSLETTER] No confirmation token found for pending subscriber: ${maskEmail(normalizedEmail)}`);
        }

        return NextResponse.json({
          success: true,
          status: "confirmation_resent",
          message: coolingDown
            ? locale === "es"
              ? "Ya te enviamos un correo de confirmación. Revisa tu bandeja de entrada y la carpeta de spam."
              : "We already sent you a confirmation email. Please check your inbox and spam folder."
            : locale === "es"
              ? "Te hemos enviado un nuevo correo de confirmación. Por favor revisa tu bandeja de entrada."
              : "We've sent you a new confirmation email. Please check your inbox.",
        });
      }

      if (existing.status === "unsubscribed") {
        console.log(`[NEWSLETTER] Re-subscribing user: ${maskEmail(normalizedEmail)}`);
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

        console.log(`[NEWSLETTER] Sending confirmation email for re-subscription to ${maskEmail(normalizedEmail)}`);
        // Send confirmation email using after() to prevent Vercel timeouts
        after(async () => {
          try {
            await sendNewsletterEmail({
              email: normalizedEmail,
              locale,
              token: confirmationToken,
              type: "confirmation",
            });
            console.log(`[NEWSLETTER] Re-subscription confirmation email sent successfully to ${maskEmail(normalizedEmail)}`);
          } catch (error) {
            console.error(`[NEWSLETTER] Error sending re-subscription confirmation email to ${maskEmail(normalizedEmail)}:`, error);
          }
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

    // Site-wide cap on first-time confirmation emails (counted from rows created this hour).
    const [recent] = await db
      .select({ n: count() })
      .from(newsletterSubscribers)
      .where(gte(newsletterSubscribers.createdAt, new Date(Date.now() - 60 * 60 * 1000)));
    const overHourlyCap = Number(recent?.n ?? 0) >= NEW_CONFIRMATIONS_PER_HOUR;

    // New subscriber - create pending record
    console.log(`[NEWSLETTER] Creating new subscriber record for: ${maskEmail(normalizedEmail)}`);
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

    if (overHourlyCap) {
      // Same answer to the visitor; the row stays pending, and a later sign-up resends.
      console.warn(`[NEWSLETTER] Hourly confirmation cap reached; not emailing ${maskEmail(normalizedEmail)}`);
    }
    console.log(`[NEWSLETTER] Subscriber record created for ${maskEmail(normalizedEmail)}`);
    // Send confirmation email using after() to prevent Vercel timeouts
    if (!overHourlyCap) after(async () => {
      try {
        await sendNewsletterEmail({
          email: normalizedEmail,
          locale,
          token: confirmationToken,
          type: "confirmation",
        });
        console.log(`[NEWSLETTER] Confirmation email sent successfully to ${maskEmail(normalizedEmail)}`);
      } catch (error) {
        console.error(`[NEWSLETTER] Error sending newsletter confirmation email to ${maskEmail(normalizedEmail)}:`, error);
      }
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

