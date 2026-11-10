/**
 * Strings for the client's signing page. Not next-intl, like every intake/capture page in this
 * repo (lib/aca-intake/ui-strings.ts): the page is self-contained and its language can switch
 * client-side. Spanish uses "usted", like the ACA intake.
 *
 * The form's own wording is NOT here: it comes from the server (form-text.ts, versioned).
 */

import type { AcaConfirmationLanguage } from "./types";

type Dict = Record<AcaConfirmationLanguage, string>;

export const PAGE_UI = {
  loading: { en: "Loading your document…", es: "Cargando su documento…" } as Dict,
  title: { en: "Review and sign", es: "Revise y firme" } as Dict,
  intro: {
    en: "Your agent, {agent}, asks you to confirm that you reviewed your Marketplace application before it is submitted.",
    es: "Su agente, {agent}, le pide confirmar que revisó su solicitud del Mercado antes de enviarla.",
  } as Dict,
  readFirst: {
    en: "Read the document, then sign below.",
    es: "Lea el documento y luego firme abajo.",
  } as Dict,
  signatureHeading: { en: "Your signature", es: "Su firma" } as Dict,
  tabDraw: { en: "Draw", es: "Dibujar" } as Dict,
  tabType: { en: "Type", es: "Escribir" } as Dict,
  drawHint: { en: "Sign here with your finger or mouse", es: "Firme aquí con su dedo o el mouse" } as Dict,
  drawAria: { en: "Signature area", es: "Área de firma" } as Dict,
  clear: { en: "Clear", es: "Borrar" } as Dict,
  typeLabel: { en: "Type your full name", es: "Escriba su nombre completo" } as Dict,
  typePreview: { en: "This is how your signature will look:", es: "Así se verá su firma:" } as Dict,
  sign: { en: "Sign", es: "Firmar" } as Dict,
  signing: { en: "Signing…", es: "Firmando…" } as Dict,
  needSignature: {
    en: "Sign above and check the box to continue.",
    es: "Firme arriba y marque la casilla para continuar.",
  } as Dict,
  recorded: {
    en: "When you sign, the date and time, your IP address and your device are recorded.",
    es: "Al firmar se registran la fecha y la hora, su dirección IP y su dispositivo.",
  } as Dict,
  questions: { en: "Questions? Call {agent} at", es: "¿Preguntas? Llame a {agent} al" } as Dict,
  doneTitle: { en: "All set, {name}!", es: "¡Listo, {name}!" } as Dict,
  doneBody: {
    en: "You signed your confirmation on {date}.",
    es: "Firmó su confirmación el {date}.",
  } as Dict,
  doneNext: { en: "You can let your agent know.", es: "Ya puede avisarle a su agente." } as Dict,
  deadTitle: { en: "This link can't be used", es: "Este enlace no se puede usar" } as Dict,
  deadNotFound: {
    en: "This link isn't valid. Check that you copied all of it, or ask your agent for a new one.",
    es: "Este enlace no es válido. Revise que lo copió completo o pídale uno nuevo a su agente.",
  } as Dict,
  deadSigned: { en: "This confirmation was already signed. Thank you!", es: "Esta confirmación ya fue firmada. ¡Gracias!" } as Dict,
  deadSignedOn: {
    en: "This confirmation was already signed on {date}. Thank you!",
    es: "Esta confirmación ya fue firmada el {date}. ¡Gracias!",
  } as Dict,
  deadCancelled: {
    en: "Your agent cancelled this request. If you think that's a mistake, please contact them.",
    es: "Su agente canceló esta solicitud. Si cree que es un error, comuníquese con su agente.",
  } as Dict,
  deadExpired: {
    en: "This link has expired. Ask your agent for a new one.",
    es: "Este enlace venció. Pídale a su agente uno nuevo.",
  } as Dict,
  deadContact: { en: "Your agent: {agent}", es: "Su agente: {agent}" } as Dict,
  errSignatureShort: {
    en: "Your signature is too short. Please sign again a little bigger.",
    es: "Su firma es muy corta. Por favor firme otra vez un poco más grande.",
  } as Dict,
  errTypedName: { en: "Type your full name to sign.", es: "Escriba su nombre completo para firmar." } as Dict,
  errSignatureImage: {
    en: "We couldn't read your signature. Please clear it and sign again.",
    es: "No pudimos leer su firma. Bórrela y firme otra vez.",
  } as Dict,
  errTypedNotAllowed: {
    en: "This document must be signed by drawing your signature.",
    es: "Este documento se debe firmar dibujando su firma.",
  } as Dict,
  errGeneric: {
    en: "Please check your signature and try again.",
    es: "Revise su firma e inténtelo otra vez.",
  } as Dict,
  errNetwork: {
    en: "We couldn't send your signature. Check your connection and try again.",
    es: "No pudimos enviar su firma. Revise su conexión e inténtelo otra vez.",
  } as Dict,
  errLoad: {
    en: "We couldn't load your document. Please try again in a moment.",
    es: "No pudimos cargar su documento. Inténtelo otra vez en un momento.",
  } as Dict,
  retry: { en: "Try again", es: "Intentar de nuevo" } as Dict,
} as const;

export function tr(dict: Dict, language: AcaConfirmationLanguage): string {
  return dict[language];
}

/** Fill `{name}` tokens. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
