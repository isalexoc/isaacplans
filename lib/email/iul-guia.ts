import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import {
  IUL_GUIA_AGENT_NAME,
  IUL_GUIA_AGENT_TITLE,
  IUL_GUIA_DISCLAIMER_ES,
  IUL_GUIA_PHONE_DISPLAY,
  IUL_GUIA_PHONE_TEL,
  IUL_GUIA_TITLE,
  IUL_GUIA_WHATSAPP_HREF,
} from "@/lib/iul-guia/constants";

/**
 * Emails the free IUL guide.
 *
 * The page promises the guide by email, and a GoHighLevel workflow nobody has built yet cannot
 * keep that promise — so delivery lives here. `IUL_GUIA_EMAIL_VIA_CRM=1` turns it off the day GHL
 * takes over, which makes that handover an env var rather than a deploy.
 *
 * Same transporter shape as `lib/email/legal-shield-guide.ts` and `lib/email/notifications.ts`:
 * a fresh connection per call, because serverless functions do not get to keep a pool.
 */

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

export interface IulGuiaEmailInput {
  to: string;
  firstName: string;
  pdfUrl: string;
}

export async function sendIulGuiaEmail({
  to,
  firstName,
  pdfUrl,
}: IulGuiaEmailInput): Promise<boolean> {
  const from = process.env.EMAIL_USER_INFO;
  if (!from) {
    console.warn("[iul/guia-email] EMAIL_USER_INFO not set — skipping send.");
    return false;
  }

  const greeting = firstName?.trim() ? `Hola ${firstName.trim()},` : "Hola,";
  const subject = `Tu reporte gratis: ${IUL_GUIA_TITLE}`;

  const text = [
    greeting,
    "",
    "Aqui esta el reporte que pediste. Descargalo desde este enlace:",
    pdfUrl,
    "",
    `Cualquier duda, escribeme o llamame directamente al ${IUL_GUIA_PHONE_DISPLAY}.`,
    "",
    IUL_GUIA_AGENT_NAME,
    IUL_GUIA_AGENT_TITLE,
    "",
    "---",
    ...IUL_GUIA_DISCLAIMER_ES,
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">${escapeHtml(greeting)}</p>
  <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">
    Aquí está tu reporte <strong>&ldquo;${escapeHtml(IUL_GUIA_TITLE)}&rdquo;</strong>. Guárdalo y léelo
    con calma antes de hablar con nadie — incluido yo.
  </p>
  <p style="margin:0 0 28px;">
    <a href="${escapeHtml(pdfUrl)}"
       style="display:inline-block;background:#0077B6;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;">
      Descargar mi reporte gratis
    </a>
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">
    Si tienes una duda o quieres que revisemos tu caso, escríbeme o llámame:
  </p>
  <p style="font-size:15px;line-height:1.8;margin:0 0 28px;">
    <a href="${escapeHtml(IUL_GUIA_PHONE_TEL)}" style="color:#0077B6;font-weight:600;">${escapeHtml(IUL_GUIA_PHONE_DISPLAY)}</a>
    &nbsp;·&nbsp;
    <a href="${escapeHtml(IUL_GUIA_WHATSAPP_HREF)}" style="color:#0077B6;font-weight:600;">WhatsApp</a>
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 4px;font-weight:600;">${escapeHtml(IUL_GUIA_AGENT_NAME)}</p>
  <p style="font-size:13px;line-height:1.6;margin:0 0 28px;color:#475569;">${escapeHtml(IUL_GUIA_AGENT_TITLE)}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;" />
  ${IUL_GUIA_DISCLAIMER_ES.map(
    (p) =>
      `<p style="font-size:11px;line-height:1.6;color:#64748b;margin:0 0 8px;">${escapeHtml(p)}</p>`
  ).join("")}
  <p style="font-size:11px;line-height:1.6;color:#64748b;margin:8px 0 0;">
    Recibiste este correo porque pediste el reporte en nuestra página. Para dejar de recibir
    correos, responde a este mensaje con la palabra BAJA.
  </p>
</div>`.trim();

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${IUL_GUIA_AGENT_NAME}" <${from}>`,
      to,
      replyTo: from,
      subject,
      text,
      html,
    });
    console.log("[iul/guia-email] Sent to", `${to.slice(0, 3)}***`);
    return true;
  } catch (e) {
    console.error("[iul/guia-email] Send failed:", e);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
