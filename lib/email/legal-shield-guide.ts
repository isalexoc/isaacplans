import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import {
  LEGAL_SHIELD_DISCLAIMER_ES,
  LEGAL_SHIELD_GUIDE_TITLE,
  LS_ADVISOR_NAME,
  LS_PHONE_DISPLAY,
  LS_PHONE_TEL,
  LS_WHATSAPP_HREF,
} from "@/lib/legal-shield/constants";

/**
 * Emails the free guide.
 *
 * The page promises "te lo enviamos a tu correo", and a workflow nobody has built yet cannot keep
 * that promise — so delivery lives here rather than in GoHighLevel. `LEGAL_SHIELD_GUIDE_EMAIL_VIA_CRM=1`
 * turns it off the day GHL takes over, which makes that handover an env var rather than a deploy.
 *
 * Same transporter shape as lib/email/notifications.ts: a fresh connection per call, because
 * serverless functions do not get to keep a pool.
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

export interface LegalShieldGuideEmailInput {
  to: string;
  firstName: string;
  pdfUrl: string;
}

export async function sendLegalShieldGuideEmail({
  to,
  firstName,
  pdfUrl,
}: LegalShieldGuideEmailInput): Promise<boolean> {
  const from = process.env.EMAIL_USER_INFO;
  if (!from) {
    console.warn("[legal-shield/guide-email] EMAIL_USER_INFO not set — skipping send.");
    return false;
  }

  const greeting = firstName?.trim() ? `Hola ${firstName.trim()},` : "Hola,";
  const subject = `Tu guia gratis: ${LEGAL_SHIELD_GUIDE_TITLE}`;

  const text = [
    greeting,
    "",
    "Aqui esta la guia que pediste. Descargala desde este enlace:",
    pdfUrl,
    "",
    `Cualquier duda, escribeme o llamame directamente al ${LS_PHONE_DISPLAY}.`,
    "",
    LS_ADVISOR_NAME,
    "Asociado Independiente de LegalShield",
    "",
    "---",
    ...LEGAL_SHIELD_DISCLAIMER_ES,
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">${escapeHtml(greeting)}</p>
  <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">
    Aquí está la <strong>${escapeHtml(LEGAL_SHIELD_GUIDE_TITLE)}</strong> que pediste. Dentro vas
    a encontrar orientación en español sobre documentos, vivienda y contratos, tránsito y
    licencias, protección familiar, estafas e inmigración.
  </p>
  <p style="margin:0 0 28px;">
    <a href="${escapeHtml(pdfUrl)}"
       style="display:inline-block;background:#8124BC;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;">
      Descargar mi guía gratis
    </a>
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">
    Si tienes una duda o quieres que revisemos tu caso, escríbeme o llámame:
  </p>
  <p style="font-size:15px;line-height:1.8;margin:0 0 28px;">
    <a href="${escapeHtml(LS_PHONE_TEL)}" style="color:#8124BC;font-weight:600;">${escapeHtml(LS_PHONE_DISPLAY)}</a>
    &nbsp;·&nbsp;
    <a href="${escapeHtml(LS_WHATSAPP_HREF)}" style="color:#8124BC;font-weight:600;">WhatsApp</a>
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 4px;font-weight:600;">${escapeHtml(LS_ADVISOR_NAME)}</p>
  <p style="font-size:13px;line-height:1.6;margin:0 0 28px;color:#475569;">Asociado Independiente de LegalShield</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;" />
  ${LEGAL_SHIELD_DISCLAIMER_ES.map(
    (p) =>
      `<p style="font-size:11px;line-height:1.6;color:#64748b;margin:0 0 8px;">${escapeHtml(p)}</p>`
  ).join("")}
  <p style="font-size:11px;line-height:1.6;color:#64748b;margin:8px 0 0;">
    Recibiste este correo porque pediste la guía en nuestra página. Para dejar de recibir
    correos, responde a este mensaje con la palabra BAJA.
  </p>
</div>`.trim();

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${LS_ADVISOR_NAME}" <${from}>`,
      to,
      replyTo: from,
      subject,
      text,
      html,
    });
    console.log("[legal-shield/guide-email] Sent to", `${to.slice(0, 3)}***`);
    return true;
  } catch (e) {
    console.error("[legal-shield/guide-email] Send failed:", e);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
