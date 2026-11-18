/**
 * Spanish labels and badge tones for the AI Setter panel. Codes the engine stores (pause
 * reasons, send errors) are mapped where known and shown raw otherwise, so a new code is never
 * hidden.
 */

import type { Lang, LeadStatus, MessageStatus, Register } from "@/lib/ai-setter/types";
import type { ThreadMessageItem } from "./api-types";

export type Tone = "green" | "amber" | "red" | "blue" | "violet" | "slate";

export const TONE_CLASSES: Record<Tone, string> = {
  green: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  amber: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  red: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  blue: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  violet: "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  slate: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const MESSAGE_STATUS_META: Record<MessageStatus, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "amber" },
  shadow: { label: "Sombra: lo que enviaría", tone: "violet" },
  stale: { label: "Vencido", tone: "slate" },
  blocked: { label: "Bloqueado", tone: "red" },
  send_unknown: { label: "Envío dudoso", tone: "red" },
  failed: { label: "Falló", tone: "red" },
  approved: { label: "Aprobado", tone: "blue" },
  sending: { label: "Enviando", tone: "blue" },
  sent: { label: "Enviado", tone: "green" },
  rejected: { label: "Rechazado", tone: "slate" },
  superseded: { label: "Reemplazado", tone: "slate" },
};

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: Tone }> = {
  active: { label: "Activo", tone: "green" },
  paused: { label: "En pausa", tone: "amber" },
  handoff: { label: "Con Isaac", tone: "blue" },
  booked: { label: "Agendado", tone: "violet" },
  stopped: { label: "Cerrado", tone: "slate" },
  opted_out: { label: "Dio de baja", tone: "red" },
};

/** Display order of the lead filters. */
export const LEAD_STATUS_ORDER: readonly LeadStatus[] = ["active", "handoff", "paused", "booked", "stopped", "opted_out"];

export const AUTHOR_LABELS: Record<ThreadMessageItem["by"], string> = {
  lead: "Lead",
  ai: "IA",
  isaac: "Isaac",
  automation: "Automático",
};

/** "EN", "ES (usted)", "ES (tú)". */
export function languageLabel(lang: Lang | null, register: Register | null): string {
  if (lang === "en") return "EN";
  if (lang === "es") return register === "tu" ? "ES (tú)" : "ES (usted)";
  return "Idioma ?";
}

/** Maps, not object literals: a stored code is data and must never hit Object.prototype. */
const PAUSE_REASONS = new Map<string, string>([
  ["isaac_took_over", "Lo tomaste tú"],
  ["paused_by_isaac", "Lo pausaste tú"],
  ["isaac_replied", "Respondiste a mano"],
  ["ghl_dnd", "DND en el CRM"],
  ["loop", "Posible bucle de respuestas automáticas"],
  ["existing_client", "Ya es cliente"],
  ["asked_for_person", "Pidió hablar con una persona"],
  ["pricing_detail", "Pregunta de precio detallada"],
  ["health", "Tema de salud"],
  ["medicare", "Medicare"],
  ["complaint", "Queja"],
  ["legal", "Amenaza legal"],
  ["confused", "Conversación confusa"],
  ["media", "Mandó audio o foto"],
  ["stale_message", "Mensaje de hace más de 12 h"],
  ["model_refused", "La IA no quiso responder"],
  ["guard_failed", "El texto no pasó la revisión"],
  ["other", "Otro motivo"],
]);

export function pauseReasonLabel(code: string | null): string | null {
  if (!code) return null;
  if (code.startsWith("opt_out:")) return "Pidió no recibir mensajes";
  return PAUSE_REASONS.get(code) ?? code;
}

const PROBLEMS = new Map<string, string>([
  ["draft_expired", "Venció sin que lo aprobaras"],
  ["expired", "Venció sin que lo aprobaras"],
  ["no_body", "No tenía texto"],
  ["dry_run", "Modo sombra: no se envía nada"],
  ["paused_all", "El asistente estaba en pausa total"],
  ["newer_inbound", "El lead escribió algo nuevo antes del envío"],
  ["isaac_replied", "Respondiste a mano antes del envío"],
  ["whatsapp_window_closed", "Se cerró la ventana de 24 h de WhatsApp"],
  ["no_window", "No había horario permitido para enviarlo"],
  ["stale_inbound", "El mensaje del lead era demasiado viejo"],
  ["suppressed", "El número está en la lista de bajas"],
  ["dnd", "El contacto tiene DND"],
  ["guard", "El texto no pasó la revisión"],
  ["unknown_not_found", "No salió: no aparece en el CRM"],
]);

const PROBLEM_PREFIXES: Array<[string, string]> = [
  ["unknown_", "No se sabe si salió: revísalo en el CRM antes de hacer algo"],
  ["lead_", "El lead cambió de estado antes del envío"],
  ["contact_", "No se pudo leer el contacto en el CRM"],
  ["messages_", "No se pudo leer la conversación en el CRM"],
  ["dnd_", "El CRM lo rechazó por DND"],
  ["invalid_", "El CRM lo rechazó (dato inválido)"],
  ["scope_", "Falta un permiso (scope) en la integración del CRM"],
  ["rate_limited_", "El CRM pidió esperar (límite de envíos)"],
  ["other_", "El CRM lo rechazó"],
];

/** The reviewer's codes (lib/ai-setter/guard.ts): "banned_word:policy" → "Palabra prohibida: policy". */
const GUARD_CODES = new Map<string, string>([
  ["empty", "Texto vacío"],
  ["too_long", "Demasiado largo"],
  ["emoji", "Emojis"],
  ["placeholder", "Quedó un {marcador} sin llenar"],
  ["banned_word", "Palabra prohibida"],
  ["money", "Habla de dinero o precios"],
  ["promise", "Promesa"],
  ["health", "Tema de salud"],
  ["human_claim", "Da a entender que es humano"],
  ["self_notice", "Escribió el aviso de IA o STOP (eso lo agrega el código)"],
  ["link", "Link no permitido"],
  ["phone", "Teléfono que no es el de Isaac"],
  ["ungrounded_number", "Número que no está en la conversación"],
  ["ungrounded_name", "Nombre que no está en la conversación"],
  ["language", "Idioma"],
  ["register", "Tú/usted mezclados"],
  ["punctuation", "Puntuación"],
  ["encoding", "Codificación"],
]);

export function guardFlagLabel(flag: string): string {
  const separator = flag.indexOf(":");
  const code = separator === -1 ? flag : flag.slice(0, separator);
  const detail = separator === -1 ? "" : flag.slice(separator + 1);
  const label = GUARD_CODES.get(code);
  if (!label) return flag;
  return detail ? `${label}: ${detail}` : label;
}

/** Why a message did not go out, in Spanish; the raw code when it is not a known one. */
export function problemLabel(code: string | null): string | null {
  if (!code) return null;
  const known = PROBLEMS.get(code);
  if (known) return known;
  const prefixed = PROBLEM_PREFIXES.find(([prefix]) => code.startsWith(prefix));
  return prefixed ? `${prefixed[1]} (${code})` : code;
}
