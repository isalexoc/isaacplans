import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER_INFO,
    pass: process.env.EMAIL_PASS_INFO,
  },
});

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

