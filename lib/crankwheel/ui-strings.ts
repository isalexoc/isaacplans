/**
 * Bilingual strings for the meeting panel.
 *
 * Self-contained rather than reaching into `lib/iul-intake/ui-strings.ts`, because the panel is
 * used on the standalone launcher too, which has nothing to do with IUL intake. Same `Dict` / `tr`
 * shape so it reads identically at the call site.
 *
 * All of these are agent-facing — the client never sees this panel, only the CrankWheel link.
 */

export type MeetingLocale = "en" | "es";

type Dict = Record<MeetingLocale, string>;

export function trm(dict: Dict, locale: MeetingLocale): string {
  return dict[locale];
}

export function pickMeetingLocale(locale: string): MeetingLocale {
  return locale === "es" ? "es" : "en";
}

export const MEET = {
  panelTitle: { en: "Screen share", es: "Compartir pantalla" } as Dict,
  panelBody: {
    en: "Put this client in front of your screen. Send them a link and start sharing from the CrankWheel extension.",
    es: "Muestre su pantalla a este cliente. Envíele un enlace y comparta desde la extensión de CrankWheel.",
  } as Dict,

  meetNow: { en: "Meet now", es: "Reunirse ahora" } as Dict,
  meetNowHelp: {
    en: "They tap the link and join straight away — no code to read back to you.",
    es: "Toca el enlace y entra directamente, sin código que dictarle a usted.",
  } as Dict,
  schedule: { en: "Schedule", es: "Agendar" } as Dict,
  scheduleHelp: {
    en: "A link that keeps working. You let them in when they arrive.",
    es: "Un enlace que sigue funcionando. Usted lo admite cuando llegue.",
  } as Dict,

  creating: { en: "Creating…", es: "Creando…" } as Dict,
  copyLink: { en: "Copy link", es: "Copiar enlace" } as Dict,
  linkCopied: { en: "Link copied!", es: "¡Enlace copiado!" } as Dict,
  sendLink: { en: "Send by text", es: "Enviar por mensaje" } as Dict,
  linkSent: { en: "Sent!", es: "¡Enviado!" } as Dict,
  revoke: { en: "Revoke this link", es: "Revocar este enlace" } as Dict,
  newLink: { en: "Create another link", es: "Crear otro enlace" } as Dict,

  waitingForClient: { en: "Waiting for the client to join…", es: "Esperando a que el cliente entre…" } as Dict,
  sharingStarted: { en: "You are sharing — waiting for the client", es: "Está compartiendo — esperando al cliente" } as Dict,
  clientJoined: { en: "Client joined", es: "El cliente entró" } as Dict,
  scheduledReady: { en: "Scheduled link ready to send", es: "Enlace agendado listo para enviar" } as Dict,
  revoked: { en: "This link has been revoked.", es: "Este enlace fue revocado." } as Dict,
  superseded: {
    en: "Replaced by a newer instant link, so this one no longer works.",
    es: "Reemplazado por un enlace instantáneo más nuevo, así que este ya no funciona.",
  } as Dict,

  /** The consequence of `truncate_older_links`, said plainly so it is never a surprise. */
  onlyOneNote: {
    en: "Creating a new instant link cancels any other instant link you have out.",
    es: "Crear un nuevo enlace instantáneo cancela cualquier otro enlace instantáneo pendiente.",
  } as Dict,
  scheduledHandshakeNote: {
    en: "They will read you a number when they arrive — click to let them in.",
    es: "Le dirán un número al llegar — haga clic para admitirlos.",
  } as Dict,

  /**
   * An instant link past its window is degraded, not dead — CrankWheel falls back to the same
   * number handshake a scheduled link uses. Saying so avoids a confusing moment mid-call.
   */
  windowPassed: {
    en: "The instant window has passed. The link still works, but they will read you a number to let them in.",
    es: "La ventana instantánea pasó. El enlace sigue funcionando, pero le dirán un número para admitirlos.",
  } as Dict,

  error: { en: "Something went wrong. Try again.", es: "Algo salió mal. Inténtelo de nuevo." } as Dict,
  noContact: {
    en: "No CRM contact linked, so this cannot be texted — copy the link instead.",
    es: "Sin contacto en el CRM, no se puede enviar por mensaje — copie el enlace.",
  } as Dict,
};
