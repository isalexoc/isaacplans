/**
 * The email that asks a client to review and sign their ACA application review confirmation.
 * Sent by the app through the CRM Conversations API (lib/agent-crm-email.ts), so it lands in the
 * contact's conversation.
 *
 * Same frame as the Impact welcome (lib/impact-enrollment/email.ts): table layout and inline
 * styles because Gmail and Outlook ignore most CSS, and every interpolated value escaped. Short on
 * purpose: the client is usually still on the phone with the agent, so it says what to do and
 * gets out of the way.
 *
 * Isaac Plans branding only. A 2027 CMS rule bars anything that could pass for HealthCare.gov, so
 * no government seals and no "official" wording.
 *
 * Not `server-only`: scripts/test-aca-confirmation.ts renders it offline.
 */

import type { AcaConfirmationAgent, AcaConfirmationLanguage } from "./types";

const BLUE = "#0077B6";
const LOGO_URL = "https://res.cloudinary.com/isaacdev/image/upload/f_png,q_auto:best,h_88,c_fit/isaacplanslogo_tkraak";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COPY = {
  es: {
    subject: "Acción requerida: confirme su solicitud de seguro médico",
    subjectResend: "Recordatorio: confirme su solicitud de seguro médico",
    preheader: "Confirme que revisó la información de su solicitud. Toma menos de un minuto.",
    heroTitle: "Revise y firme su confirmación",
    hello: "Hola",
    intro:
      "Como lo revisamos juntos, antes de enviar su solicitud al Mercado de Seguros Médicos, las reglas federales (CMS) " +
      "requieren que usted confirme que revisó la información de su solicitud y que es correcta.",
    minute: "Toma menos de un minuto: lea el documento y fírmelo desde su celular o computadora.",
    button: "Revisar y firmar",
    personal: (expires: string) =>
      `Este enlace es personal; por favor no lo reenvíe. Vence el ${expires}.`,
    questions: (phone: string) =>
      `¿Preguntas? Responda a este correo o llámeme al ${phone}.`,
    regards: "Saludos,",
    licensed: (npn: string) => `Agente de seguros de salud con licencia · NPN ${npn}`,
  },
  en: {
    subject: "Action needed: confirm your health insurance application",
    subjectResend: "Reminder: confirm your health insurance application",
    preheader: "Confirm that you reviewed your application information. It takes less than a minute.",
    heroTitle: "Review and sign your confirmation",
    hello: "Hi",
    intro:
      "As we reviewed together, before your application is submitted to the Health Insurance Marketplace, federal " +
      "rules (CMS) require you to confirm that you reviewed your application information and that it is accurate.",
    minute: "It takes less than a minute: read the document and sign it from your phone or computer.",
    button: "Review and sign",
    personal: (expires: string) => `This link is personal; please don't forward it. It expires on ${expires}.`,
    questions: (phone: string) => `Questions? Reply to this email or call me at ${phone}.`,
    regards: "Best regards,",
    licensed: (npn: string) => `Licensed health insurance agent · NPN ${npn}`,
  },
} satisfies Record<AcaConfirmationLanguage, unknown>;

export function renderAcaConfirmationRequestEmail(input: {
  language: AcaConfirmationLanguage;
  firstName: string;
  url: string;
  expiresAtLocal: string;
  agent: AcaConfirmationAgent;
  isResend?: boolean;
}): { subject: string; html: string } {
  const { language, agent } = input;
  const c = COPY[language];
  const first = esc(input.firstName.trim());
  const href = esc(input.url);
  const site = `https://isaacplans.com/${language}`;

  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${c.heroTitle}</title>
<style type="text/css">
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; height:auto; outline:none; text-decoration:none; }
  @media only screen and (max-width:620px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:23px !important; }
    .btn a { display:block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f4f6;">${c.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;">
  <tr><td class="px" style="padding:18px 32px;border-bottom:3px solid ${BLUE};background-color:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:16px;"><a href="${site}" style="text-decoration:none;display:block;"><img src="${LOGO_URL}" alt="Isaac Plans" height="44" style="height:44px;width:auto;display:block;"></a></td>
      <td style="vertical-align:middle;border-left:2px solid #e5e7eb;padding-left:16px;"><a href="${site}" style="text-decoration:none;color:${BLUE};font-size:17px;font-weight:700;">isaacplans.com</a></td>
    </tr></table>
  </td></tr>
  <tr><td class="px" style="padding:30px 32px 6px 32px;">
    <h1 class="h1" style="margin:0 0 18px 0;font-size:25px;line-height:1.25;font-weight:800;color:#111827;">${c.heroTitle}</h1>
    <p style="margin:0 0 14px 0;font-size:17px;line-height:1.6;color:#111827;">${c.hello}${first ? ` <strong>${first}</strong>` : ""},</p>
    <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#1f2937;">${c.intro}</p>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#1f2937;">${c.minute}</p>
  </td></tr>
  <tr><td class="px" style="padding:22px 32px 6px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" align="center" style="padding:4px 0;"><a href="${href}" style="display:inline-block;background-color:${BLUE};color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:15px 34px;border-radius:8px;">${c.button}</a></td></tr></table>
  </td></tr>
  <tr><td class="px" style="padding:18px 32px 0 32px;">
    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#6b7280;">${esc(c.personal(input.expiresAtLocal))}</p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#1f2937;">${esc(c.questions(agent.phone))}</p>
  </td></tr>
  <tr><td class="px" style="padding:26px 32px 30px 32px;">
    <p style="margin:0 0 4px 0;font-size:16px;line-height:1.5;color:#1f2937;">${c.regards}</p>
    <p style="margin:0;font-size:17px;line-height:1.5;font-weight:700;color:#111827;">${esc(agent.name)}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">${esc(c.licensed(agent.npn))}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">${esc(agent.agency)}</p>
  </td></tr>
  <tr><td class="px" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${esc(agent.agency)} · <a href="${site}" style="color:#6b7280;text-decoration:underline;">isaacplans.com</a></p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  return { subject: input.isResend ? c.subjectResend : c.subject, html };
}
