import { createClient } from "next-sanity";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { portableTextToEmailHtml } from "./portable-text-to-html";

// ---------- Types ----------

export interface NewsletterPostData {
  subscriberEmail: string;
  unsubscribeToken: string;
  locale: "en" | "es";
  post: {
    title: string;
    slug: string;
    excerpt?: string;
    body: unknown[];
    imageUrl?: string;
    imageAlt?: string;
    publishedAt: string;
    category: string;
  };
}

export interface SendNewsletterPostResult {
  enSent: number;
  esSent: number;
  enFailed: number;
  esFailed: number;
  errors: Array<{ email: string; error: string }>;
}

interface SanityPostData {
  _id: string;
  locale: string;
  title: string;
  slug: { current: string };
  excerpt?: string;
  body: unknown[];
  image?: { asset?: { _ref: string }; alt?: string };
  publishedAt: string;
  category: string;
  status: string;
  newsletterSentAt?: string;
  relatedPost?: SanityPostData;
}

// ---------- Sanity write client ----------

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
}

// ---------- SMTP transporter ----------

function createTransporter() {
  const timeoutMs = parseInt(process.env.EMAIL_SMTP_TIMEOUT_MS || "25000", 10);
  const config: SMTPTransport.Options = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER_INFO,
      pass: process.env.EMAIL_PASS_INFO,
    },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    requireTLS: !(process.env.EMAIL_SECURE === "true"),
    tls: { rejectUnauthorized: false },
  };
  return nodemailer.createTransport(config);
}

// ---------- Sanity image URL helper ----------

function sanityImageUrl(ref: string): string {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet";
  const parts = ref.replace(/^image-/, "").split("-");
  const format = parts.pop();
  const id = parts.join("-");
  return `https://cdn.sanity.io/images/${projectId}/production/${id}.${format}`;
}

// ---------- Email builder ----------

export function buildNewsletterPostEmail(data: NewsletterPostData): {
  subject: string;
  html: string;
  text: string;
} {
  const { locale, post, subscriberEmail: _email, unsubscribeToken } = data;
  const isES = locale === "es";
  const baseUrl = "https://www.isaacplans.com";
  const postUrl = `${baseUrl}/${locale}/blog/${post.slug}`;
  const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;

  const subject = isES
    ? `[Boletín] ${post.title}`
    : `[Newsletter] ${post.title}`;

  const readMoreLabel = isES ? "Leer en isaacplans.com" : "Read on isaacplans.com";
  const unsubscribeLabel = isES ? "Cancelar suscripción" : "Unsubscribe";
  const privacyLabel = isES ? "Política de privacidad" : "Privacy policy";
  const publishedLabel = isES ? "Publicado el" : "Published";
  const categoryLabel = post.category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const publishedDate = new Date(post.publishedAt).toLocaleDateString(
    isES ? "es-US" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "isaacplans";
  const logoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_png,q_auto:best,h_88,c_fit/isaacplanslogo_tkraak`;

  const bodyHtml = portableTextToEmailHtml(post.body);

  const featuredImageHtml = post.imageUrl
    ? `<img src="${post.imageUrl}" alt="${post.imageAlt || post.title}" style="max-width:100%;height:auto;display:block;border-radius:6px;margin:0 0 24px 0;" />`
    : "";

  const excerptHtml = post.excerpt
    ? `<p style="margin:0 0 20px 0;font-size:18px;color:#4b5563;line-height:1.6;font-style:italic;">${post.excerpt}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${post.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#ffffff;padding:18px 32px;border-bottom:3px solid #0077B6;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:16px;">
                    <a href="${baseUrl}" style="text-decoration:none;display:block;">
                      <img src="${logoUrl}" alt="Isaac Plans" style="height:44px;width:auto;display:block;" />
                    </a>
                  </td>
                  <td style="vertical-align:middle;border-left:2px solid #e5e7eb;padding-left:16px;">
                    <a href="${baseUrl}" style="text-decoration:none;">
                      <span style="color:#0077B6;font-size:17px;font-weight:700;letter-spacing:-0.3px;display:block;line-height:1.2;">isaacplans.com</span>
                      <span style="color:#9ca3af;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;display:block;margin-top:3px;">Insurance Consultation</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              ${featuredImageHtml}

              <!-- Category + date -->
              <p style="margin:0 0 12px 0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0077B6;">${categoryLabel} &nbsp;·&nbsp; ${publishedLabel} ${publishedDate}</p>

              <!-- Title -->
              <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:700;color:#111827;line-height:1.3;">${post.title}</h1>

              ${excerptHtml}

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

              <!-- Post body -->
              <div>${bodyHtml}</div>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 24px 0;">
                    <a href="${postUrl}" style="display:inline-block;background-color:#0077B6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">${readMoreLabel}</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#9ca3af;">Isaac Plans Insurance</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">${unsubscribeLabel}</a>
                &nbsp;·&nbsp;
                <a href="${baseUrl}/en/privacy" style="color:#6b7280;text-decoration:underline;">${privacyLabel}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    post.title,
    `${publishedLabel} ${publishedDate} | ${categoryLabel}`,
    "",
    post.excerpt || "",
    "",
    postUrl,
    "",
    `${unsubscribeLabel}: ${unsubscribeUrl}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, html, text };
}

// ---------- Orchestrator ----------

export async function sendNewsletterPost(
  postId: string,
  force = false
): Promise<SendNewsletterPostResult> {
  const readClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  // 1. Fetch post + relatedPost from Sanity
  const post = await readClient.fetch<SanityPostData | null>(
    `*[_type == "post" && _id == $id][0]{
      _id,
      locale,
      title,
      slug,
      excerpt,
      body,
      image{ asset{ _ref }, alt },
      publishedAt,
      category,
      status,
      newsletterSentAt,
      relatedPost->{
        _id,
        locale,
        title,
        slug,
        excerpt,
        body,
        image{ asset{ _ref }, alt },
        publishedAt,
        category,
        status
      }
    }`,
    { id: postId }
  );

  if (!post) {
    throw new Error("Post not found in Sanity");
  }

  if (post.status !== "published") {
    throw new Error("Post must be published before sending");
  }

  if (post.newsletterSentAt && !force) {
    const err = new Error("already_sent") as Error & { sentAt: string };
    err.sentAt = post.newsletterSentAt;
    throw err;
  }

  // 2. Build locale → post map
  const postsByLocale: Record<string, SanityPostData> = {};
  postsByLocale[post.locale] = post;
  if (post.relatedPost) {
    postsByLocale[post.relatedPost.locale] = post.relatedPost;
  }

  // 3. Helper: resolve image URL for a post doc
  function resolveImageUrl(p: SanityPostData): string | undefined {
    const ref = p.image?.asset?._ref;
    return ref ? sanityImageUrl(ref) : undefined;
  }

  // 4. Fetch confirmed subscribers grouped by locale
  const enSubscribers = await db
    .select({
      email: newsletterSubscribers.email,
      unsubscribeToken: newsletterSubscribers.unsubscribeToken,
    })
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "confirmed"),
        eq(newsletterSubscribers.locale, "en")
      )
    );

  const esSubscribers = await db
    .select({
      email: newsletterSubscribers.email,
      unsubscribeToken: newsletterSubscribers.unsubscribeToken,
    })
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "confirmed"),
        eq(newsletterSubscribers.locale, "es")
      )
    );

  // 5. Send emails
  const result: SendNewsletterPostResult = {
    enSent: 0,
    esSent: 0,
    enFailed: 0,
    esFailed: 0,
    errors: [],
  };

  const sendBatch = async (
    subscribers: typeof enSubscribers,
    locale: "en" | "es"
  ) => {
    const postDoc = postsByLocale[locale];
    if (!postDoc || subscribers.length === 0) return;

    const transporter = createTransporter();

    for (const subscriber of subscribers) {
      if (!subscriber.unsubscribeToken) continue;
      try {
        const emailData = buildNewsletterPostEmail({
          subscriberEmail: subscriber.email,
          unsubscribeToken: subscriber.unsubscribeToken,
          locale,
          post: {
            title: postDoc.title,
            slug: postDoc.slug.current,
            excerpt: postDoc.excerpt,
            body: postDoc.body,
            imageUrl: resolveImageUrl(postDoc),
            imageAlt: postDoc.image?.alt,
            publishedAt: postDoc.publishedAt,
            category: postDoc.category,
          },
        });

        await Promise.race([
          transporter.sendMail({
            from: `"Isaac Plans Insurance" <${process.env.EMAIL_USER_INFO}>`,
            to: subscriber.email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Email send timeout")), 55000)
          ),
        ]);

        if (locale === "en") result.enSent++;
        else result.esSent++;
      } catch (err: any) {
        if (locale === "en") result.enFailed++;
        else result.esFailed++;
        result.errors.push({ email: subscriber.email, error: err.message });
        console.error(`[NEWSLETTER_POST] Failed to send to ${subscriber.email}:`, err.message);
      }
    }
  };

  await sendBatch(enSubscribers, "en");
  await sendBatch(esSubscribers, "es");

  // 6. Write newsletterSentAt back to Sanity
  try {
    const writeClient = getWriteClient();
    await writeClient
      .patch(postId)
      .set({ newsletterSentAt: new Date().toISOString() })
      .commit();
  } catch (err: any) {
    console.error("[NEWSLETTER_POST] Failed to update newsletterSentAt in Sanity:", err.message);
  }

  return result;
}
