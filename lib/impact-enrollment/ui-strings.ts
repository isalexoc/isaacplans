/**
 * Dialog chrome, in the agent's dashboard language. The client's messages follow the contact's
 * `spanish` tag instead (see server.ts `contactLanguage`).
 */

import type { IntakeLocale } from "@/lib/intake-core/ui-strings";

type Dict = Record<IntakeLocale, string>;

export const IMPACT_UI = {
  button: { en: "Impact enrollment", es: "Inscripción Impact" } as Dict,
  buttonSent: { en: "Impact sent", es: "Impact enviado" } as Dict,
  title: { en: "Impact Health Sharing welcome", es: "Bienvenida de Impact Health Sharing" } as Dict,
  description: {
    en: "Fill in the membership details and upload the ID card. The welcome email goes out with the card attached, and your CRM workflow sends the texts and WhatsApp.",
    es: "Complete los datos de la membresía y suba la tarjeta. El correo de bienvenida sale con la tarjeta adjunta, y su workflow del CRM envía los textos y el WhatsApp.",
  } as Dict,
  card: { en: "Member ID card (PDF)", es: "Tarjeta de miembro (PDF)" } as Dict,
  cardUpload: { en: "Upload the card PDF", es: "Subir el PDF de la tarjeta" } as Dict,
  cardHint: {
    en: "The PDF from the Impact portal. It is attached to the email, and sent as an image in the first text.",
    es: "El PDF que descarga del portal de Impact. Va adjunto al correo, y como imagen en el primer texto.",
  } as Dict,
  cardRendering: { en: "Preparing the card…", es: "Preparando la tarjeta…" } as Dict,
  cardChange: { en: "Change", es: "Cambiar" } as Dict,
  cardStored: {
    en: "The card you sent last time will be reused. Upload another only if it changed.",
    es: "Se usará la tarjeta que ya envió. Suba otra solo si cambió.",
  } as Dict,
  cardPages: { en: "{pages} sides", es: "{pages} lados" } as Dict,
  cardReadError: {
    en: "Could not read that PDF. Download it again from the Impact portal.",
    es: "No se pudo leer ese PDF. Descárguelo otra vez del portal de Impact.",
  } as Dict,
  cardNotPdf: { en: "Upload the card as a PDF.", es: "Suba la tarjeta en PDF." } as Dict,
  cardTooBig: { en: "That PDF is too large (3 MB max).", es: "Ese PDF es muy grande (máximo 3 MB)." } as Dict,
  errCard: { en: "Upload the member ID card (PDF).", es: "Suba la tarjeta de miembro (PDF)." } as Dict,
  channels: { en: "Send", es: "Enviar" } as Dict,
  channelEmail: { en: "Welcome email with the card attached", es: "Correo de bienvenida con la tarjeta adjunta" } as Dict,
  channelMessages: { en: "Texts and WhatsApp (your workflow)", es: "Textos y WhatsApp (su workflow)" } as Dict,
  emailMissing: {
    en: "The email can't go out yet: set IMPACT_TEMP_PASSWORD (the portal password) in Vercel.",
    es: "El correo aún no puede salir: configure IMPACT_TEMP_PASSWORD (la contraseña del portal) en Vercel.",
  } as Dict,
  errChannels: {
    en: "Pick at least one: the email, or the texts and WhatsApp.",
    es: "Elija al menos uno: el correo, o los textos y WhatsApp.",
  } as Dict,
  loading: { en: "Loading the contact…", es: "Cargando el contacto…" } as Dict,
  client: { en: "Client", es: "Cliente" } as Dict,
  emailHint: {
    en: "Their portal username. It must be the email used at Impact.",
    es: "Es su usuario del portal. Debe ser el correo usado en Impact.",
  } as Dict,
  noEmail: {
    en: "This contact has no email in the CRM. Add the email used at Impact first: it is the portal username.",
    es: "Este contacto no tiene correo en el CRM. Agregue primero el correo usado en Impact: es el usuario del portal.",
  } as Dict,
  noPhone: {
    en: "No phone in the CRM, so the texts and WhatsApp will not go out.",
    es: "No hay teléfono en el CRM, así que los textos y el WhatsApp no se enviarán.",
  } as Dict,
  languageEs: {
    en: "Messages in Spanish: the contact has the “spanish” tag.",
    es: "Mensajes en español: el contacto tiene la etiqueta “spanish”.",
  } as Dict,
  languageEn: {
    en: "Messages in English: the contact doesn't have the “spanish” tag.",
    es: "Mensajes en inglés: el contacto no tiene la etiqueta “spanish”.",
  } as Dict,
  languageHint: {
    en: "To switch, add or remove the “spanish” tag in the CRM, then open this again.",
    es: "Para cambiarlo, agregue o quite la etiqueta “spanish” en el CRM y abra esto de nuevo.",
  } as Dict,
  memberId: { en: "Member ID", es: "ID de miembro" } as Dict,
  startDate: { en: "Start date", es: "Fecha de inicio" } as Dict,
  monthlyAmount: { en: "Monthly payment", es: "Pago mensual" } as Dict,
  paymentDay: { en: "Payment day", es: "Día de pago" } as Dict,
  pickDay: { en: "Day of the month…", es: "Día del mes…" } as Dict,
  dayOption: { en: "Day {day}", es: "Día {day}" } as Dict,
  preview: { en: "What the client will see", es: "Lo que verá el cliente" } as Dict,
  workflowMissing: {
    en: "The texts and WhatsApp workflow is not connected yet. Set {env} in Vercel.",
    es: "El workflow de textos y WhatsApp aún no está conectado. Configure {env} en Vercel.",
  } as Dict,
  lastSent: { en: "Last sent {date}", es: "Último envío: {date}" } as Dict,
  sentTimes: { en: "{count} times", es: "{count} veces" } as Dict,
  send: { en: "Send welcome", es: "Enviar bienvenida" } as Dict,
  resend: { en: "Send again", es: "Enviar de nuevo" } as Dict,
  sending: { en: "Sending…", es: "Enviando…" } as Dict,
  resendConfirm: {
    en: "This client already got the welcome. Send every message again?",
    es: "Este cliente ya recibió la bienvenida. ¿Enviar todos los mensajes otra vez?",
  } as Dict,
  sentTitle: { en: "Welcome sent", es: "Bienvenida enviada" } as Dict,
  sentEmail: {
    en: "The welcome email went out with the ID card attached.",
    es: "El correo de bienvenida salió con la tarjeta adjunta.",
  } as Dict,
  sentMessages: {
    en: "Your CRM workflow is sending the texts and WhatsApp now.",
    es: "Su workflow del CRM está enviando ahora los textos y el WhatsApp.",
  } as Dict,
  sentNote: {
    en: "The details were added as a note on the contact.",
    es: "Los datos quedaron como nota en el contacto.",
  } as Dict,
  workflowFailed: {
    en: "The texts and WhatsApp did NOT go out: the workflow refused the request. Open this again and send with only “Texts and WhatsApp” ticked.",
    es: "Los textos y el WhatsApp NO salieron: el workflow rechazó el envío. Ábralo otra vez y envíe solo con «Textos y WhatsApp» marcado.",
  } as Dict,
  noteFailed: {
    en: "The note could not be added to the contact. The messages above still went out.",
    es: "No se pudo agregar la nota al contacto. Los mensajes de arriba sí salieron.",
  } as Dict,
  done: { en: "Done", es: "Listo" } as Dict,
  cancel: { en: "Cancel", es: "Cancelar" } as Dict,
  retry: { en: "Try again", es: "Reintentar" } as Dict,
  errAmount: { en: "Enter the monthly amount, e.g. 189.50.", es: "Ingrese el pago mensual, p. ej. 189.50." } as Dict,
  errMemberId: { en: "Enter the member ID.", es: "Ingrese el ID de miembro." } as Dict,
  errStartDate: { en: "Pick the start date.", es: "Elija la fecha de inicio." } as Dict,
  errPaymentDay: { en: "Pick the payment day.", es: "Elija el día de pago." } as Dict,
} as const;

/** Fill `{name}` tokens. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
