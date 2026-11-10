/**
 * Strings for the agent's confirmation dialog on the ACA intake dashboard. The dialog follows the
 * dashboard's language; what the CLIENT reads (email, page, form) follows the request's language.
 * Spanish uses "usted", like lib/aca-intake/ui-strings.ts.
 */

import type { AcaConfirmationLanguage } from "./types";

type Dict = Record<AcaConfirmationLanguage, string>;

export const ACA_CONF_UI = {
  button: { en: "Confirmation", es: "Confirmación" } as Dict,
  badgeSigned: { en: "Signed", es: "Firmada" } as Dict,
  badgeSent: { en: "Sent", es: "Enviada" } as Dict,
  badgeExpired: { en: "Expired", es: "Vencida" } as Dict,
  title: { en: "Application review confirmation (CMS)", es: "Confirmación de revisión de la solicitud (CMS)" } as Dict,
  description: {
    en: "The client confirms by e-signature that they reviewed their Marketplace application and it is accurate.",
    es: "El cliente confirma con su firma electrónica que revisó su solicitud del Mercado y que es correcta.",
  } as Dict,
  reminder: {
    en: "Send it when the application is complete and BEFORE you submit it to the Marketplace. Submit only once it shows “Signed”. Every new application, update or plan change needs a new confirmation.",
    es: "Envíela cuando la solicitud esté completa y ANTES de enviarla al Mercado. Envíe la solicitud solo cuando aparezca «Firmada». Cada solicitud nueva, actualización o cambio de plan necesita una confirmación nueva.",
  } as Dict,
  loading: { en: "Loading…", es: "Cargando…" } as Dict,
  retry: { en: "Retry", es: "Reintentar" } as Dict,
  close: { en: "Close", es: "Cerrar" } as Dict,
  cancel: { en: "Cancel", es: "Cancelar" } as Dict,

  // Form
  client: { en: "Client (from the CRM)", es: "Cliente (del CRM)" } as Dict,
  legalName: { en: "Legal name (as on the application)", es: "Nombre legal (como aparece en la solicitud)" } as Dict,
  legalNameHint: {
    en: "Printed on the form the client signs. Use the name exactly as on the Marketplace application.",
    es: "Se imprime en el formulario que firma el cliente. Use el nombre exacto de la solicitud del Mercado.",
  } as Dict,
  errName: { en: "Enter the client's full legal name.", es: "Ingrese el nombre legal completo del cliente." } as Dict,
  language: { en: "Client's language", es: "Idioma del cliente" } as Dict,
  languageHint: {
    en: "From the contact's spanish tag; you can change it. The client can also switch on the page.",
    es: "Según la etiqueta spanish del contacto; puede cambiarlo. El cliente también puede cambiarlo en la página.",
  } as Dict,
  spanish: { en: "Spanish", es: "Español" } as Dict,
  english: { en: "English", es: "Inglés" } as Dict,
  agent: { en: "Agent on the form", es: "Agente en el formulario" } as Dict,
  agentMissing: {
    en: "The agent's NPN isn't set. Add ACA_AGENT_NPN in Vercel (and .env), redeploy, then send.",
    es: "Falta el NPN del agente. Agregue ACA_AGENT_NPN en Vercel (y .env), vuelva a desplegar y luego envíe.",
  } as Dict,
  emailMissing: {
    en: "This contact has no email in the CRM. Add the client's own email there, then reopen this window.",
    es: "Este contacto no tiene correo en el CRM. Agregue el correo del cliente allí y vuelva a abrir esta ventana.",
  } as Dict,
  emailAgency: {
    en: "The contact's email is an @isaacplans.com address. The link must go to the client's own email.",
    es: "El correo del contacto es de @isaacplans.com. El enlace debe ir al correo propio del cliente.",
  } as Dict,
  fileFieldMissing: {
    en: "The signed PDF will be archived, but not saved in the contact's Documents until ACA_CONFIRMATION_FILE_FIELD_ID is set (run pnpm aca-confirmation:field).",
    es: "El PDF firmado se archivará, pero no se guardará en Documentos del contacto hasta configurar ACA_CONFIRMATION_FILE_FIELD_ID (ejecute pnpm aca-confirmation:field).",
  } as Dict,
  preview: { en: "Preview the document", es: "Ver el documento" } as Dict,
  hidePreview: { en: "Hide the document", es: "Ocultar el documento" } as Dict,
  send: { en: "Send for signature", es: "Enviar para firma" } as Dict,
  sending: { en: "Sending…", es: "Enviando…" } as Dict,
  linkExpiry: { en: "The link works once and expires in {days} days.", es: "El enlace funciona una vez y vence en {days} días." } as Dict,

  // Live card
  liveTitle: { en: "Current request", es: "Solicitud actual" } as Dict,
  stepSent: { en: "Sent by email", es: "Enviada por correo" } as Dict,
  stepSentTimes: { en: "sent {count} times", es: "enviada {count} veces" } as Dict,
  stepNotSent: { en: "The email did not go out", es: "El correo no salió" } as Dict,
  stepOpened: { en: "Opened by the client", es: "Abierta por el cliente" } as Dict,
  stepWaitingOpen: { en: "Waiting for the client to open it…", es: "Esperando a que el cliente la abra…" } as Dict,
  stepSigned: { en: "Signed", es: "Firmada" } as Dict,
  stepWaitingSign: { en: "Not signed yet", es: "Todavía sin firmar" } as Dict,
  views: { en: "{count} views", es: "{count} vistas" } as Dict,
  methodDrawn: { en: "drawn", es: "dibujada" } as Dict,
  methodTyped: { en: "typed", es: "escrita" } as Dict,
  signedBanner: {
    en: "Signed — you can submit the application now.",
    es: "Firmada — ya puede enviar la solicitud.",
  } as Dict,
  expiredBanner: {
    en: "This link expired before it was signed. Resend it to give the client another 7 days.",
    es: "Este enlace venció sin firmarse. Reenvíelo para darle al cliente otros 7 días.",
  } as Dict,
  cancelledBanner: { en: "This request was cancelled.", es: "Esta solicitud fue cancelada." } as Dict,
  afterTitle: { en: "After signing", es: "Después de firmar" } as Dict,
  afterPdf: { en: "PDF archived (kept 10 years)", es: "PDF archivado (se guarda 10 años)" } as Dict,
  afterFile: { en: "Saved in the contact's Documents", es: "Guardado en Documentos del contacto" } as Dict,
  afterNote: { en: "Note in the CRM", es: "Nota en el CRM" } as Dict,
  afterTag: { en: "Tag aca_confirmation_signed", es: "Etiqueta aca_confirmation_signed" } as Dict,
  ipMatch: {
    en: "Signed from the same IP address you used for this request. If the client didn't sign it themselves, cancel it and send a new one: the client must sign their own confirmation. This is noted on the PDF.",
    es: "Se firmó desde la misma dirección IP que usted usó para esta solicitud. Si el cliente no la firmó en persona, cancélela y envíe una nueva: el cliente debe firmar su propia confirmación. Esto queda anotado en el PDF.",
  } as Dict,
  pollStopped: {
    en: "Live updates paused after 15 minutes.",
    es: "Las actualizaciones en vivo se pausaron después de 15 minutos.",
  } as Dict,
  refresh: { en: "Refresh", es: "Actualizar" } as Dict,
  contactUnavailable: {
    en: "The CRM didn't return this contact (it may have been merged or deleted). Its confirmations are listed below; sending a new one needs the contact.",
    es: "El CRM no devolvió este contacto (puede haberse unido o eliminado). Sus confirmaciones aparecen abajo; para enviar una nueva se necesita el contacto.",
  } as Dict,
  py2028: {
    en: "From Aug 1, 2027 this form only covers plan-year-2027 coverage. For plan-year-2028 enrollments CMS requires its own HHS form, word for word.",
    es: "Desde el 1 de agosto de 2027 este formulario solo sirve para cobertura del año 2027. Para inscripciones del año 2028, CMS exige su propio formulario de HHS, palabra por palabra.",
  } as Dict,
  pollError: {
    en: "Live updates stopped (connection problem). Close and reopen to refresh.",
    es: "Se detuvieron las actualizaciones (problema de conexión). Cierre y vuelva a abrir para actualizar.",
  } as Dict,
  copyLink: { en: "Copy link", es: "Copiar enlace" } as Dict,
  copied: { en: "Copied!", es: "¡Copiado!" } as Dict,
  copyHint: {
    en: "If the email is slow, you can paste the link in a WhatsApp or text to the client.",
    es: "Si el correo tarda, puede pegar el enlace en un WhatsApp o mensaje al cliente.",
  } as Dict,
  resend: { en: "Resend email", es: "Reenviar correo" } as Dict,
  resendConfirm: {
    en: "Email the same link to the client again? It will be valid for another 7 days.",
    es: "¿Enviar el mismo enlace al cliente otra vez? Será válido por otros 7 días.",
  } as Dict,
  resent: { en: "Email sent again.", es: "Correo reenviado." } as Dict,
  cancelRequest: { en: "Cancel request", es: "Cancelar solicitud" } as Dict,
  cancelConfirm: {
    en: "Cancel this request? The link will stop working. You can send a new one afterwards.",
    es: "¿Cancelar esta solicitud? El enlace dejará de funcionar. Después puede enviar una nueva.",
  } as Dict,
  downloadPdf: { en: "Download PDF", es: "Descargar PDF" } as Dict,
  viewPdf: { en: "View PDF", es: "Ver PDF" } as Dict,
  newConfirmation: { en: "New confirmation", es: "Nueva confirmación" } as Dict,

  // History
  history: { en: "Earlier confirmations", es: "Confirmaciones anteriores" } as Dict,
  historySigned: { en: "Signed {date}", es: "Firmada {date}" } as Dict,
  historySent: { en: "Sent {date}", es: "Enviada {date}" } as Dict,
  historyCancelled: { en: "Cancelled", es: "Cancelada" } as Dict,
  historyExpired: { en: "Expired unsigned", es: "Vencida sin firmar" } as Dict,
} as const;

export function tr(dict: Dict, locale: AcaConfirmationLanguage): string {
  return dict[locale];
}

/** Fill `{name}` tokens. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
