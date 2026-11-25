/**
 * The email an intake's owner gets when a client finishes on their own: the form submitted, or the
 * private link's numbers sent (lines with `notifyOwnerByEmail`: Legal Shield, whose associate has
 * no CRM login to see the tag or note Isaac's workflows react to).
 *
 * It carries the client's name, what happened and a link to the agent's summary, which needs the
 * agent's sign-in. Never an answer: no SSN digits, card, account, address or birth date, because
 * an inbox is not where those belong.
 *
 * Pure (no Clerk, no SMTP), so `pnpm test:staff-access` checks it offline.
 */

import type { IntakeLobConfig } from "./types";

export type OwnerNoticeEvent =
  | { kind: "completed" }
  /** `groups`: the labels of what arrived (e.g. "Tarjeta"), never the values. */
  | { kind: "secure"; groups: string[] };

export type OwnerNotice = { subject: string; text: string; html: string };

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** One line, no control characters: a name typed by a stranger goes into a mail header. */
const oneLine = (s: string): string => s.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

export function ownerNoticeContent(input: {
  config: Pick<IntakeLobConfig, "formTitle" | "fixedLocale">;
  event: OwnerNoticeEvent;
  clientName: string | null;
  viewUrl: string;
}): OwnerNotice {
  // The agent's language is the line's (Legal Shield: Spanish); other lines' agents read English.
  const es = input.config.fixedLocale === "es";
  const name = oneLine(input.clientName ?? "").slice(0, 80) || (es ? "Su cliente" : "Your client");
  const title = input.config.formTitle[es ? "es" : "en"];
  // "Solicitud de membresía de LegalShield" reads mid-sentence as "su solicitud de membresía…".
  const form = es ? title.charAt(0).toLowerCase() + title.slice(1) : title;

  const subject =
    input.event.kind === "completed"
      ? es
        ? `${name} completó su solicitud`
        : `${name} completed their application`
      : es
        ? `${name} le envió sus datos privados`
        : `${name} sent their private details`;

  const what =
    input.event.kind === "completed"
      ? es
        ? `${name} terminó y envió su ${form}.`
        : `${name} finished and submitted their ${form}.`
      : es
        ? `${name} envió desde su teléfono: ${input.event.groups.join(", ") || "sus datos"}. Ya están en su ${form}.`
        : `${name} sent from their phone: ${input.event.groups.join(", ") || "their details"}. They're on their ${form}.`;

  const cta = es ? "Abrir la solicitud" : "Open the application";
  const footer = es
    ? "Aviso automático. Por seguridad, este correo no lleva datos del cliente; para verlos, abra la solicitud con su usuario."
    : "Automatic notice. For safety this email carries none of the client's details; open the application signed in to see them.";

  const text = `${what}\n\n${cta}: ${input.viewUrl}\n\n${footer}`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px; margin: 0 0 20px;">${escapeHtml(what)}</p>
  <p style="margin: 0 0 24px;"><a href="${escapeHtml(input.viewUrl)}" style="display: inline-block; background: #07233b; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600;">${escapeHtml(cta)}</a></p>
  <p style="font-size: 12px; color: #6b7280; margin: 0;">${escapeHtml(footer)}</p>
</body></html>`;

  return { subject, text, html };
}
