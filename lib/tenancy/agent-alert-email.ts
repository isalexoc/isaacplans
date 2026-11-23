/**
 * The email an agent gets when something happens on one of their applications. It carries NO client
 * details (no name, phone, email or answers), only what happened and the way to the dashboard,
 * where the agent signs in to see the rest: an inbox is not a place for a client's data.
 *
 * Pure (one type import), so `pnpm test:agent-data` can pin it.
 */

import type { AgentAlertKind } from "./agent-data";

export type AgentAlertEmail = { subject: string; text: string; html: string };

const WORDS = {
  en: {
    started: "A client started an application",
    completed: "A client completed an application",
    secure_submit: "A client sent the secure form",
    open: "Open your dashboard to see it:",
    button: "Open my dashboard",
    footer: "For your clients' privacy, these alerts never include client details.",
  },
  es: {
    started: "Un cliente comenzó una solicitud",
    completed: "Un cliente completó una solicitud",
    secure_submit: "Un cliente envió el formulario seguro",
    open: "Abra su panel para ver los detalles:",
    button: "Abrir mi panel",
    footer: "Por la privacidad de sus clientes, estos avisos nunca incluyen datos del cliente.",
  },
} as const;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The alert for one event, in the agent's language, pointing at their dashboard. */
export function agentAlertEmail(input: {
  kind: AgentAlertKind;
  locale: "en" | "es";
  dashboardUrl: string;
}): AgentAlertEmail {
  const w = WORDS[input.locale];
  const headline = w[input.kind];
  const url = input.dashboardUrl;
  const text = `${headline}.\n\n${w.open}\n${url}\n\n${w.footer}\n`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111827">` +
    `<p style="font-size:18px;font-weight:bold;margin:0 0 12px">${escapeHtml(headline)}.</p>` +
    `<p style="margin:0 0 16px">${escapeHtml(w.open)}</p>` +
    `<p style="margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1f2937;color:#ffffff;` +
    `padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(w.button)}</a></p>` +
    `<p style="margin:0;font-size:13px;color:#6b7280">${escapeHtml(w.footer)}</p>` +
    `</div>`;
  return { subject: headline, text, html };
}
