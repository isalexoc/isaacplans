import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// Create transporter function (better for serverless - creates fresh connection each time)
function createTransporter() {
  // Log email configuration (without sensitive data)
  console.log("[EMAIL] Creating transporter with config:", {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    hasUser: !!process.env.EMAIL_USER_INFO,
    hasPass: !!process.env.EMAIL_PASS_INFO,
    userLength: process.env.EMAIL_USER_INFO?.length || 0,
    passLength: process.env.EMAIL_PASS_INFO?.length || 0,
  });

  const config: SMTPTransport.Options = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER_INFO,
      pass: process.env.EMAIL_PASS_INFO,
    },
    // Serverless-optimized settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Note: pool, maxConnections, and maxMessages are not valid for SMTPTransport.Options
    // Creating a fresh transporter per request already handles serverless isolation
  };
  
  const transporter = nodemailer.createTransport(config);
  console.log("[EMAIL] Transporter created successfully");
  return transporter;
}

interface CommentNotificationData {
  postTitle: string;
  postSlug: string;
  postLocale: string;
  commentBody: string;
  commenterName?: string;
  commenterEmail?: string;
  commentId: string;
}

export async function sendCommentNotification(
  data: CommentNotificationData
): Promise<void> {
  try {
    if (!process.env.EMAIL_USER_INFO) {
      console.warn("EMAIL_USER_INFO not set, skipping email notification");
      return;
    }

    const transporter = createTransporter(); // Create fresh transporter for serverless
    const postUrl = `https://www.isaacplans.com/${data.postLocale}/blog/${data.postSlug}`;
    const commentUrl = `${postUrl}#comment-${data.commentId}`;
    const commenterDisplay = data.commenterName || data.commenterEmail || "A user";

    await transporter.sendMail({
      from: `"Isaac Plans Blog" <${process.env.EMAIL_USER_INFO}>`,
      to: process.env.EMAIL_USER_INFO,
      subject: `New Comment on: ${data.postTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">
                New Comment on Blog Post
              </h1>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                ${new Date().toLocaleString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #111827;">
                ${data.postTitle}
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
                <strong>Commenter:</strong> ${commenterDisplay}
              </p>
              <div style="background: #f9fafb; border-left: 3px solid #3b82f6; padding: 16px; border-radius: 4px; margin: 16px 0;">
                <p style="margin: 0; white-space: pre-wrap; color: #374151;">
                  ${data.commentBody}
                </p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${commentUrl}" 
                 style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
                View Comment on Post
              </a>
            </div>

            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">
                This is an automated notification from Isaac Plans Blog.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
New Comment on Blog Post

Post: ${data.postTitle}
Commenter: ${commenterDisplay}
Date: ${new Date().toLocaleString()}

Comment:
${data.commentBody}

View comment: ${commentUrl}
      `.trim(),
    });

    console.log(`Comment notification email sent for post: ${data.postTitle}`);
  } catch (error) {
    // Log error but don't throw - we don't want to fail comment creation if email fails
    console.error("Error sending comment notification email:", error);
  }
}

interface NewsletterEmailData {
  email: string;
  locale: string;
  token: string;
  type: "confirmation" | "welcome" | "unsubscribe_confirmation";
}

export async function sendNewsletterEmail(
  data: NewsletterEmailData
): Promise<void> {
  const startTime = Date.now();
  console.log(`[EMAIL] Starting to send newsletter ${data.type} email to: ${data.email}`);
  
  try {
    if (!process.env.EMAIL_USER_INFO) {
      console.warn("[EMAIL] EMAIL_USER_INFO not set, skipping newsletter email");
      return;
    }

    // Validate all required env vars
    if (!process.env.EMAIL_HOST) {
      throw new Error("EMAIL_HOST environment variable is not set");
    }
    if (!process.env.EMAIL_PASS_INFO) {
      throw new Error("EMAIL_PASS_INFO environment variable is not set");
    }

    console.log(`[EMAIL] Environment variables validated for ${data.type} email`);

    const baseUrl = "https://www.isaacplans.com";
    const isES = data.locale === "es";

    let subject: string;
    let html: string;
    let text: string;

    if (data.type === "confirmation") {
      const confirmUrl = `${baseUrl}/${data.locale}/newsletter/confirm?token=${data.token}`;
      subject = isES
        ? "Confirma tu suscripción al boletín"
        : "Confirm your newsletter subscription";
      
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">
                ${isES ? "Confirma tu suscripción" : "Confirm Your Subscription"}
              </h1>
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">
                ${isES
                  ? "Gracias por suscribirte a nuestro boletín. Para completar tu suscripción, por favor haz clic en el botón de abajo:"
                  : "Thank you for subscribing to our newsletter. To complete your subscription, please click the button below:"}
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${confirmUrl}" 
                   style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                  ${isES ? "Confirmar Suscripción" : "Confirm Subscription"}
                </a>
              </div>
              <p style="margin: 16px 0 0 0; font-size: 14px; color: #6b7280;">
                ${isES
                  ? "O copia y pega este enlace en tu navegador:"
                  : "Or copy and paste this link into your browser:"}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af; word-break: break-all;">
                ${confirmUrl}
              </p>
            </div>

            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">
                ${isES
                  ? "Si no solicitaste esta suscripción, puedes ignorar este correo."
                  : "If you didn't request this subscription, you can safely ignore this email."}
              </p>
            </div>
          </body>
        </html>
      `;
      
      text = isES
        ? `Gracias por suscribirte a nuestro boletín. Para completar tu suscripción, visita: ${confirmUrl}`
        : `Thank you for subscribing to our newsletter. To complete your subscription, visit: ${confirmUrl}`;
    } else if (data.type === "welcome") {
      subject = isES
        ? "¡Bienvenido a nuestro boletín!"
        : "Welcome to our newsletter!";
      
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">
                ${isES ? "¡Bienvenido!" : "Welcome!"}
              </h1>
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">
                ${isES
                  ? "Gracias por confirmar tu suscripción. Estamos emocionados de compartir contigo nuestros últimos artículos sobre seguros, guías útiles e información de la industria."
                  : "Thank you for confirming your subscription. We're excited to share our latest articles on insurance, helpful guides, and industry insights with you."}
              </p>
              <p style="margin: 16px 0 0 0; font-size: 16px; color: #374151;">
                ${isES
                  ? "Mantente atento a tu bandeja de entrada para recibir contenido valioso que te ayudará a tomar decisiones informadas sobre tus seguros."
                  : "Stay tuned to your inbox for valuable content that will help you make informed decisions about your insurance."}
              </p>
            </div>

            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0 0 8px 0;">
                ${isES
                  ? "¿Ya no quieres recibir nuestros correos?"
                  : "Don't want to receive our emails anymore?"}
              </p>
              <a href="${baseUrl}/${data.locale}/newsletter/unsubscribe?token=${data.token}" 
                 style="color: #6b7280; text-decoration: underline;">
                ${isES ? "Cancelar suscripción" : "Unsubscribe"}
              </a>
            </div>
          </body>
        </html>
      `;
      
      text = isES
        ? "Gracias por confirmar tu suscripción. Estamos emocionados de compartir contigo nuestros últimos artículos sobre seguros, guías útiles e información de la industria."
        : "Thank you for confirming your subscription. We're excited to share our latest articles on insurance, helpful guides, and industry insights with you.";
    } else {
      // unsubscribe_confirmation
      subject = isES
        ? "Has cancelado tu suscripción"
        : "You've been unsubscribed";
      
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">
                ${isES ? "Suscripción cancelada" : "Subscription Cancelled"}
              </h1>
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">
                ${isES
                  ? "Has cancelado tu suscripción a nuestro boletín. Ya no recibirás más correos de nuestra parte."
                  : "You've been unsubscribed from our newsletter. You will no longer receive emails from us."}
              </p>
              <p style="margin: 16px 0 0 0; font-size: 16px; color: #374151;">
                ${isES
                  ? "Si esto fue un error o cambias de opinión, siempre puedes volver a suscribirte en nuestro sitio web."
                  : "If this was a mistake or you change your mind, you can always resubscribe on our website."}
              </p>
            </div>

            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">
                ${isES
                  ? "Gracias por haber sido parte de nuestra comunidad."
                  : "Thank you for being part of our community."}
              </p>
            </div>
          </body>
        </html>
      `;
      
      text = isES
        ? "Has cancelado tu suscripción a nuestro boletín. Ya no recibirás más correos de nuestra parte."
        : "You've been unsubscribed from our newsletter. You will no longer receive emails from us.";
    }

    console.log(`[EMAIL] Email content prepared for ${data.type}, creating transporter...`);
    const transporter = createTransporter(); // Create fresh transporter for serverless
    
    const mailOptions = {
      from: `"Isaac Plans Insurance" <${process.env.EMAIL_USER_INFO}>`,
      to: data.email,
      subject,
      html,
      text,
    };
    
    console.log(`[EMAIL] Attempting to send email to ${data.email}...`, {
      from: mailOptions.from,
      subject: mailOptions.subject,
      type: data.type,
    });

    const result = await transporter.sendMail(mailOptions);
    const duration = Date.now() - startTime;
    
    console.log(`[EMAIL] Newsletter ${data.type} email sent successfully to: ${data.email}`, {
      messageId: result.messageId,
      response: result.response,
      duration: `${duration}ms`,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    // More detailed error logging for production debugging
    console.error(`[EMAIL] Error sending newsletter ${data.type} email to ${data.email}:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      port: error.port,
      email: data.email,
      type: data.type,
      duration: `${duration}ms`,
      stack: error.stack,
    });
    throw error; // Re-throw for API routes to handle
  }
}

