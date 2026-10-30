/**
 * The Impact welcome email, sent by the app (not the GHL workflow) so the client's own ID card PDF
 * can ride along as a real attachment. A workflow's Send Email action can only attach the same
 * fixed file to everyone.
 *
 * Table layout with inline styles, because Gmail and Outlook ignore most CSS. Every value from the
 * payload is escaped. The shared temporary portal password is passed in from the
 * IMPACT_TEMP_PASSWORD env var and never written here, because this repo is public.
 */

import type { ImpactLanguage, ImpactWelcomePayload } from "./format";

const BLUE = "#0077B6";
const LOGO_URL = "https://res.cloudinary.com/isaacdev/image/upload/f_png,q_auto:best,h_88,c_fit/isaacplanslogo_tkraak";
const PORTAL_URL = "https://impact.mysharable.com/signin/v1/en";
const PROVIDER_FORM_URL = "https://app.impacthealthsharing.com/forms/provider-assistance";
const CARE_NAVIGATOR = "CareNavigator@AMPS.com";
const IMPACT_PHONE = "(855) 378-6777";
const IMPACT_TEL = "tel:+18553786777";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const phoneLink = (color: string) =>
  `<a href="${IMPACT_TEL}" style="white-space:nowrap;color:${color};font-weight:700;text-decoration:none;">${IMPACT_PHONE}</a>`;

const COPY = {
  es: {
    subject: (first: string) => `¡Bienvenido a Impact Health${first ? `, ${first}` : ""}! Información importante de tu plan`,
    preheader: "Tu tarjeta de miembro, tu portal y cómo empezar a usar tu plan. Guarda este correo.",
    heroTitle: "¡Bienvenido a Impact Health Sharing!",
    heroSub: "Ya eres parte de la comunidad.",
    hello: "Hola",
    intro: "¡Felicidades por obtener tu plan médico con <strong>Impact Health Sharing</strong>! Aquí tienes toda la información importante.",
    save: "📌 Te recomiendo guardar este correo.",
    cardTitle: "📎 Tu tarjeta de miembro va adjunta",
    cardBody: "Encontrarás tu <strong>tarjeta de miembro (PDF)</strong> adjunta a este correo. Guárdala en tu celular y muéstrala en el consultorio, la farmacia o el hospital en cada visita.",
    planTitle: "📋 Datos de tu plan",
    planName: "Nombre del plan",
    memberId: "Tu ID de miembro",
    startDate: "Fecha de inicio",
    monthly: "Tu pago mensual",
    paymentDay: "Fecha de pago",
    support: "Atención al cliente",
    portalTitle: "🔐 Tu portal de miembro",
    username: "Usuario:",
    password: "Contraseña temporal:",
    portalButton: "Entrar a mi portal",
    changePassword: "Por tu seguridad, cambia esta contraseña la primera vez que entres.",
    portalBody: "En el portal puedes ver y descargar tu <strong>tarjeta de miembro</strong>, revisar tus pagos, subir recibos de medicinas y usar la <strong>telemedicina gratuita</strong>.",
    dentalTitle: "🦷 Tu beneficio dental",
    dentalBody: "Tu plan también incluye beneficio dental. Tu <strong>ID dental estará disponible 48 horas hábiles</strong> después de tu inscripción. En ese momento podrás descargarlo, y yo también te lo enviaré por este medio.",
    pcpTitle: "👨‍⚕️ Cómo iniciar con tu médico primario",
    steps: [
      "Agenda una cita con el doctor que quieres como tu médico primario. Te recomendamos hacerla con <strong>al menos una semana de anticipación</strong>.",
      `Entra a este enlace y llena la información de tu cita:<br><a href="${PROVIDER_FORM_URL}" style="color:${BLUE};font-weight:600;word-break:break-all;">app.impacthealthsharing.com/forms/provider-assistance</a>`,
      "Impact se comunica con el consultorio del doctor y hace los trámites por ti. Esto toma de <strong>3 a 5 días hábiles</strong> (sin contar sábados ni domingos).",
      "Impact te enviará un mensaje de texto o un correo cuando todo esté listo. <strong>¡Después de eso ya puedes ir a tu cita!</strong>",
    ],
    formButton: "Llenar los datos de mi cita",
    noCall: "No necesitas llamar a Impact antes de la cita; el formulario es suficiente.",
    noDoctor: `<strong>¿No tienes doctor?</strong> Escribe a <a href="mailto:${CARE_NAVIGATOR}" style="color:${BLUE};font-weight:600;">${CARE_NAVIGATOR}</a> con el tipo de doctor y tu código postal, y te dan opciones.`,
    usageTitle: "🏥 Cómo usar tu plan",
    anyDoctor: "Puedes ir al doctor que tú elijas. <strong>No hay red cerrada.</strong>",
    feesIntro: "En cada visita pagas solo la tarifa del proveedor:",
    fees: [
      ["Telemedicina (desde el portal)", "$0"],
      ["Doctor de cabecera", "$50"],
      ["Especialista o Urgent Care", "$75"],
      ["Sala de emergencias u hospitalización", "$150"],
    ],
    bills: "El doctor envía la factura directamente a Impact usando tu tarjeta.",
    rx: "<strong>Medicinas:</strong> págalas en la farmacia mostrando tu tarjeta y sube el recibo en el portal.",
    wellness: "Tienes una <strong>visita de bienestar (chequeo anual)</strong> al año más <strong>$150 para laboratorios</strong>, sin costo para ti.",
    preTitle: "⚠️ Antes de estos servicios, llama primero",
    preBody: (phone: string) =>
      `Para estos servicios se necesita <strong>aprobación previa (pre-elegibilidad)</strong> con 3 a 5 días hábiles de anticipación. Pide a tu doctor que llame al ${phone}:`,
    preList: [
      "Cirugías que no sean de emergencia",
      "Resonancias magnéticas (MRI) y PET scans",
      "Embarazo / maternidad",
      "Tratamiento de cáncer",
      "Procedimientos cardíacos programados",
    ],
    closing: "Cualquier pregunta, respóndeme a este correo o escríbeme. <strong>¡Estoy para ayudarte!</strong>",
    regards: "Saludos,",
  },
  en: {
    subject: (first: string) => `Welcome to Impact Health${first ? `, ${first}` : ""}! Important information about your plan`,
    preheader: "Your member ID card, your portal, and how to start using your plan. Save this email.",
    heroTitle: "Welcome to Impact Health Sharing!",
    heroSub: "You're now part of the community.",
    hello: "Hi",
    intro: "Congratulations on getting your health plan with <strong>Impact Health Sharing</strong>! Here's all the important information.",
    save: "📌 I recommend saving this email.",
    cardTitle: "📎 Your member ID card is attached",
    cardBody: "You'll find your <strong>member ID card (PDF)</strong> attached to this email. Save it on your phone and show it at the doctor's office, the pharmacy or the hospital at every visit.",
    planTitle: "📋 Your plan details",
    planName: "Plan name",
    memberId: "Your member ID",
    startDate: "Start date",
    monthly: "Your monthly payment",
    paymentDay: "Payment date",
    support: "Customer service",
    portalTitle: "🔐 Your member portal",
    username: "Username:",
    password: "Temporary password:",
    portalButton: "Go to my portal",
    changePassword: "For your security, change this password the first time you log in.",
    portalBody: "In the portal you can view and download your <strong>member ID card</strong>, check your payments, upload pharmacy receipts and use the <strong>free telehealth</strong>.",
    dentalTitle: "🦷 Your dental benefit",
    dentalBody: "Your plan also includes a dental benefit. Your <strong>dental ID will be available 48 business hours</strong> after your enrollment. You'll be able to download it then, and I'll also send it to you here.",
    pcpTitle: "👨‍⚕️ Getting started with your primary care doctor",
    steps: [
      "Book an appointment with the doctor you want as your primary care doctor. We recommend booking <strong>at least one week ahead</strong>.",
      `Open this link and fill in your appointment details:<br><a href="${PROVIDER_FORM_URL}" style="color:${BLUE};font-weight:600;word-break:break-all;">app.impacthealthsharing.com/forms/provider-assistance</a>`,
      "Impact contacts the doctor's office and handles the paperwork for you. This takes <strong>3 to 5 business days</strong> (not counting Saturdays or Sundays).",
      "Impact will text or email you when everything is ready. <strong>After that, you can go to your appointment!</strong>",
    ],
    formButton: "Fill in my appointment details",
    noCall: "You don't need to call Impact before the appointment; the form is enough.",
    noDoctor: `<strong>Don't have a doctor?</strong> Email <a href="mailto:${CARE_NAVIGATOR}" style="color:${BLUE};font-weight:600;">${CARE_NAVIGATOR}</a> with the type of doctor and your ZIP code, and they'll send you options.`,
    usageTitle: "🏥 How to use your plan",
    anyDoctor: "You can see any doctor you choose. <strong>There's no closed network.</strong>",
    feesIntro: "At each visit you only pay the provider fee:",
    fees: [
      ["Telehealth (from the portal)", "$0"],
      ["Primary care doctor", "$50"],
      ["Specialist or Urgent Care", "$75"],
      ["Emergency room or hospital stay", "$150"],
    ],
    bills: "The doctor bills Impact directly using your card.",
    rx: "<strong>Prescriptions:</strong> pay at the pharmacy showing your card, then upload the receipt in the portal.",
    wellness: "You get one <strong>wellness visit (annual checkup)</strong> a year plus <strong>$150 for lab work</strong>, at no cost to you.",
    preTitle: "⚠️ Before these services, call first",
    preBody: (phone: string) =>
      `These services need <strong>prior approval (pre-eligibility)</strong> 3 to 5 business days in advance. Ask your doctor to call ${phone}:`,
    preList: [
      "Non-emergency surgeries",
      "MRIs and PET scans",
      "Pregnancy / maternity",
      "Cancer treatment",
      "Scheduled heart procedures",
    ],
    closing: "Any questions, just reply to this email or message me. <strong>I'm here to help!</strong>",
    regards: "Best regards,",
  },
} satisfies Record<ImpactLanguage, unknown>;

const TEXT = "font-size:15px;line-height:1.6;color:#1f2937;";
const P = `margin:0;${TEXT}`;

function sectionTitle(text: string, color = BLUE): string {
  return `<p style="margin:0 0 12px 0;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};">${text}</p>`;
}

function section(inner: string): string {
  return `<tr><td class="px" style="padding:28px 32px 0 32px;">${inner}</td></tr>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" align="center" style="padding:14px 0 4px 0;"><a href="${href}" style="display:inline-block;background-color:${BLUE};color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:13px 28px;border-radius:8px;">${label}</a></td></tr></table>`;
}

/** Two-column striped table; the right column is already-safe HTML. */
function rowsTable(rows: Array<[string, string]>, valueColor = "#111827"): string {
  const body = rows
    .map(([label, value], i) => {
      const bg = i % 2 === 1 ? "background-color:#f9fafb;" : "";
      const border = i < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : "";
      return `<tr><td style="padding:12px 16px;font-size:15px;color:#6b7280;${border}${bg}">${label}</td><td style="padding:12px 16px;font-size:15px;font-weight:700;color:${valueColor};text-align:right;${border}${bg}">${value}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;">${body}</table>`;
}

function steps(items: string[]): string {
  const rows = items
    .map(
      (text, i) =>
        `<tr><td width="40" valign="top" style="padding:0 12px 14px 0;"><div style="width:28px;height:28px;line-height:28px;border-radius:14px;background-color:${BLUE};color:#ffffff;font-size:14px;font-weight:700;text-align:center;">${i + 1}</div></td><td valign="top" style="padding:3px 0 14px 0;${P}">${text}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

function body(payload: ImpactWelcomePayload, tempPassword: string): string {
  const t = COPY[payload.language];
  const first = esc(payload.first_name);
  const check = (html: string) => `<p style="margin:0 0 10px 0;${TEXT}">✅ ${html}</p>`;

  return [
    // Greeting
    `<tr><td class="px" style="padding:28px 32px 0 32px;">
      <p style="margin:0 0 14px 0;font-size:17px;line-height:1.6;color:#111827;">${t.hello}${first ? ` <strong>${first}</strong>` : ""},</p>
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#1f2937;">${t.intro}</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BLUE};font-weight:600;">${t.save}</p>
    </td></tr>`,
    // Attached card
    section(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;"><tr><td style="padding:16px 18px;">${sectionTitle(t.cardTitle, "#047857")}<p style="margin:0;font-size:15px;line-height:1.6;color:#064e3b;">${t.cardBody}</p></td></tr></table>`
    ),
    // Plan details
    section(
      sectionTitle(t.planTitle) +
        rowsTable([
          [t.planName, "Impact Health Sharing"],
          [t.memberId, esc(payload.member_id)],
          [t.startDate, esc(payload.start_date)],
          [t.monthly, esc(payload.monthly_amount)],
          [t.paymentDay, esc(payload.payment_day)],
          [t.support, phoneLink(BLUE)],
        ])
    ),
    // Portal
    section(
      sectionTitle(t.portalTitle) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;"><tr><td style="padding:18px 18px 4px 18px;">
          <p style="margin:0 0 8px 0;font-size:15px;line-height:1.5;"><span style="color:#6b7280;">${t.username}</span> <strong style="color:#111827;">${esc(payload.portal_username)}</strong></p>
          <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;"><span style="color:#6b7280;">${t.password}</span> <strong style="color:#111827;font-family:Consolas,'Courier New',monospace;font-size:16px;background-color:#ffffff;border:1px solid #bae6fd;border-radius:4px;padding:2px 6px;">${esc(tempPassword)}</strong></p>
        </td></tr><tr><td style="padding:0 18px 18px 18px;">${button(PORTAL_URL, t.portalButton)}</td></tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr><td style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 14px;font-size:14px;line-height:1.5;color:#92400e;border-radius:4px;">⚠️ <strong>${t.changePassword}</strong></td></tr></table>
        <p style="margin:14px 0 0 0;${TEXT}">${t.portalBody}</p>`
    ),
    // Dental
    section(sectionTitle(t.dentalTitle) + `<p style="${P}">${t.dentalBody}</p>`),
    // Primary care doctor
    section(
      sectionTitle(t.pcpTitle) +
        steps(t.steps) +
        button(PROVIDER_FORM_URL, t.formButton) +
        `<p style="margin:12px 0 0 0;${TEXT}">${t.noCall}</p>` +
        `<p style="margin:12px 0 0 0;${TEXT}">${t.noDoctor}</p>`
    ),
    // How to use the plan
    section(
      sectionTitle(t.usageTitle) +
        check(t.anyDoctor) +
        check(t.feesIntro) +
        `<div style="margin-bottom:14px;">${rowsTable(
          t.fees.map(([label, fee], i) => [label, i === 0 ? `<span style="color:#16a34a;">${fee}</span>` : fee] as [string, string])
        )}</div>` +
        check(t.bills) +
        check(t.rx) +
        check(t.wellness)
    ),
    // Pre-eligibility
    section(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fdba74;border-radius:8px;"><tr><td style="padding:18px;">${sectionTitle(t.preTitle, "#c2410c")}<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#431407;">${t.preBody(phoneLink("#c2410c"))}</p>${t.preList
        .map((item) => `<p style="margin:0 0 6px 0;font-size:15px;line-height:1.5;color:#431407;">• ${item}</p>`)
        .join("")}</td></tr></table>`
    ),
    // Sign-off
    `<tr><td class="px" style="padding:28px 32px 32px 32px;">
      <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#1f2937;">${t.closing}</p>
      <p style="margin:0 0 4px 0;font-size:16px;line-height:1.5;color:#1f2937;">${t.regards}</p>
      ${payload.agent_name ? `<p style="margin:0;font-size:17px;line-height:1.5;font-weight:700;color:#111827;">${esc(payload.agent_name)}</p>` : ""}
      <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">Isaac Plans Insurance</p>
    </td></tr>`,
  ].join("\n");
}

export function renderImpactWelcomeEmail(
  payload: ImpactWelcomePayload,
  tempPassword: string
): { subject: string; html: string } {
  const t = COPY[payload.language];
  const site = `https://isaacplans.com/${payload.language}`;
  const html = `<!doctype html>
<html lang="${payload.language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.heroTitle}</title>
<style type="text/css">
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; height:auto; outline:none; text-decoration:none; }
  @media only screen and (max-width:620px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:24px !important; }
    .btn a { display:block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f4f6;">${t.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;">
  <tr><td class="px" style="padding:18px 32px;border-bottom:3px solid ${BLUE};background-color:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:16px;"><a href="${site}" style="text-decoration:none;display:block;"><img src="${LOGO_URL}" alt="Isaac Plans" height="44" style="height:44px;width:auto;display:block;"></a></td>
      <td style="vertical-align:middle;border-left:2px solid #e5e7eb;padding-left:16px;"><a href="${site}" style="text-decoration:none;color:${BLUE};font-size:17px;font-weight:700;">isaacplans.com</a></td>
    </tr></table>
  </td></tr>
  <tr><td class="px" style="background-color:${BLUE};padding:32px;text-align:center;">
    <p style="margin:0 0 8px 0;font-size:34px;line-height:1;">🎉</p>
    <h1 class="h1" style="margin:0 0 8px 0;font-size:28px;line-height:1.25;font-weight:800;color:#ffffff;">${t.heroTitle}</h1>
    <p style="margin:0;font-size:16px;line-height:1.5;color:#dbeafe;">${t.heroSub}</p>
  </td></tr>
${body(payload, tempPassword)}
  <tr><td class="px" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">Isaac Plans Insurance · <a href="${site}" style="color:#6b7280;text-decoration:underline;">isaacplans.com</a></p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`;
  return { subject: t.subject(payload.first_name.trim()), html };
}
