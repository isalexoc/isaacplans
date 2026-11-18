/**
 * The fixed messages the AI Setter sends. Isaac approves each template ONCE (Ajustes stores its
 * hash); from then on it goes out on its own. Free text the model writes goes through
 * lib/ai-setter/guard.ts and waits for Isaac instead.
 *
 * Every template has three variants: English, Spanish "usted" (the default register) and Spanish
 * "tú". Any wording change changes `templateHash`, which sends the template back for re-approval.
 *
 * Brand voice: no "insurance / policy / premium" and no "seguro / póliza / prima"; the brand only
 * arrives through {brand}. English uses ASCII punctuation (straight quotes, "-"). Latin-American,
 * gender-neutral Spanish. One call to action per message. The code adds the greeting, the AI
 * disclosure and the STOP footer around these texts (lib/ai-setter/ui-strings.ts).
 *
 * Pure: no DB, no server-only (node `crypto` only for the hash).
 */

import { createHash } from "crypto";
import type { Lang, Register } from "./types";
import { capitalizeFirst } from "./ui-strings";

export type TemplateId =
  | "offer_times"
  | "offer_one_time"
  | "offer_times_now"
  | "price_redirect"
  | "info_redirect"
  | "who_is_this"
  | "confirm_booking"
  | "confirm_reschedule"
  | "confirm_cancel"
  | "existing_appointment"
  | "call_now_checking"
  | "call_now_calling"
  | "call_now_unavailable"
  | "handoff_hold"
  | "ask_state"
  | "out_of_license"
  | "not_interested_close"
  | "help"
  | "optout_confirm"
  | "optout_clarify"
  | "media_received"
  | "self_booking_link"
  | "ask_time_preference";

/** Every placeholder a template may use. */
export type TemplateVarName =
  | "slotA"
  | "slotB"
  | "when"
  | "topic"
  | "eta"
  | "link"
  | "agentPhone"
  | "agentFullName"
  | "brand"
  | "site"
  | "vcardUrl";

export type TemplateVars = Partial<Record<TemplateVarName, string>>;

export type TemplateMeta = {
  /** How many offered times ({slotA}/{slotB}) the text carries. */
  slots: 0 | 1 | 2;
  /** Placeholders the text needs; `renderTemplate` lists any that are missing. */
  vars: string[];
  /**
   * Reads well after "Hi Maria," and may open an exchange: add the greeting when no disclosure is
   * added (the disclosure carries its own greeting).
   */
  greet: boolean;
  /** HELP / opt-out: always sent by code, never subject to approval, never given the disclosure prefix. */
  compliance: boolean;
};

export type TemplateVariant = { lang: Lang; register: Register; text: string };

export type TemplateCatalogEntry = {
  id: TemplateId;
  hash: string;
  compliance: boolean;
  variants: TemplateVariant[];
};

type TemplateText = { en: string; es: Record<Register, string> };

const TEMPLATE_TEXTS: Record<TemplateId, TemplateText> = {
  offer_times: {
    en: "Can Isaac call you {slotA} or {slotB}?",
    es: {
      usted: "¿Le puede llamar Isaac {slotA} o {slotB}?",
      tu: "¿Te puede llamar Isaac {slotA} o {slotB}?",
    },
  },
  offer_one_time: {
    en: "Can Isaac call you {slotA}?",
    es: {
      usted: "¿Le puede llamar Isaac {slotA}?",
      tu: "¿Te puede llamar Isaac {slotA}?",
    },
  },
  offer_times_now: {
    en: "Can Isaac call you now, or is {slotA} better?",
    es: {
      usted: "¿Le puede llamar Isaac ahora, o prefiere {slotA}?",
      tu: "¿Te puede llamar Isaac ahora, o prefieres {slotA}?",
    },
  },
  price_redirect: {
    en: "Good question! It depends on your age, your state and what you want covered, so Isaac gives you exact numbers on a quick 15-minute call. {slotA} or {slotB}?",
    es: {
      usted:
        "¡Buena pregunta! Depende de su edad, el estado donde vive y lo que quiera cubrir; Isaac le da los números exactos en una llamada de 15 minutos. ¿{slotA} o {slotB}?",
      tu: "¡Buena pregunta! Depende de tu edad, el estado donde vives y lo que quieras cubrir; Isaac te da los números exactos en una llamada de 15 minutos. ¿{slotA} o {slotB}?",
    },
  },
  info_redirect: {
    en: "Of course! Since it depends on your situation, Isaac explains it in about 15 minutes. {slotA} or {slotB}?",
    es: {
      usted: "¡Con gusto! Como depende de su caso, Isaac se lo explica en unos 15 minutos. ¿{slotA} o {slotB}?",
      tu: "¡Con gusto! Como depende de tu caso, Isaac te lo explica en unos 15 minutos. ¿{slotA} o {slotB}?",
    },
  },
  who_is_this: {
    en: "You asked us about {topic}. Isaac is a licensed agent and would like to help. Can he call you {slotA} or {slotB}?",
    es: {
      usted:
        "Usted nos pidió información sobre {topic}. Isaac es agente con licencia y le quiere ayudar. ¿Le puede llamar {slotA} o {slotB}?",
      tu: "Nos pediste información sobre {topic}. Isaac es agente con licencia y te quiere ayudar. ¿Te puede llamar {slotA} o {slotB}?",
    },
  },
  confirm_booking: {
    en: "You're all set! Isaac will call you {when} from {agentPhone}. Save his number: {vcardUrl}. Need another time? Just reply here.",
    es: {
      usted:
        "¡Listo! Isaac le llamará {when} desde el {agentPhone}. Guarde su número: {vcardUrl}. ¿Necesita otro horario? Responda aquí.",
      tu: "¡Listo! Isaac te llamará {when} desde el {agentPhone}. Guarda su número: {vcardUrl}. ¿Necesitas otro horario? Responde aquí.",
    },
  },
  confirm_reschedule: {
    en: "Done! Your call with Isaac is now {when}. He'll call from {agentPhone}.",
    es: {
      usted: "¡Listo! Su llamada con Isaac quedó para {when}. Le llamará desde el {agentPhone}.",
      tu: "¡Listo! Tu llamada con Isaac quedó para {when}. Te llamará desde el {agentPhone}.",
    },
  },
  confirm_cancel: {
    en: "Done, I canceled your call with Isaac. If you want another time, just reply here.",
    es: {
      usted: "Listo, cancelé su llamada con Isaac. Si quiere otro horario, responda aquí.",
      tu: "Listo, cancelé tu llamada con Isaac. Si quieres otro horario, responde aquí.",
    },
  },
  existing_appointment: {
    en: "You already have your call with Isaac {when}. Does that still work for you?",
    es: {
      usted: "Ya tiene su llamada con Isaac {when}. ¿Le sigue quedando bien?",
      tu: "Ya tienes tu llamada con Isaac {when}. ¿Te sigue quedando bien?",
    },
  },
  call_now_checking: {
    en: "Great, let me check if Isaac is free right now.",
    es: {
      usted: "Perfecto, déjeme ver si Isaac está libre ahora mismo.",
      tu: "Perfecto, déjame ver si Isaac está libre ahora mismo.",
    },
  },
  call_now_calling: {
    en: "Isaac is calling you now from {agentPhone}.",
    es: {
      usted: "Isaac le está llamando ahora desde el {agentPhone}.",
      tu: "Isaac te está llamando ahora desde el {agentPhone}.",
    },
  },
  call_now_unavailable: {
    en: "Isaac can't take a call right now. Can he call you {slotA} or {slotB}?",
    es: {
      usted: "Isaac no puede atender una llamada en este momento. ¿Le puede llamar {slotA} o {slotB}?",
      tu: "Isaac no puede atender una llamada en este momento. ¿Te puede llamar {slotA} o {slotB}?",
    },
  },
  handoff_hold: {
    en: "Thanks! Isaac will reply to you personally {eta}.",
    es: {
      usted: "¡Gracias! Isaac le responde personalmente {eta}.",
      tu: "¡Gracias! Isaac te responde personalmente {eta}.",
    },
  },
  ask_state: {
    en: "So I can give you the right times, which state do you live in?",
    es: {
      usted: "Para darle el horario correcto, ¿en qué estado vive?",
      tu: "Para darte el horario correcto, ¿en qué estado vives?",
    },
  },
  out_of_license: {
    en: "Thank you! Isaac isn't able to help with this in your state right now, so I'll close your request. Take care!",
    es: {
      usted:
        "Gracias. Por ahora Isaac no puede ayudarle con esto en su estado, así que cierro su solicitud. ¡Que esté muy bien!",
      tu: "Gracias. Por ahora Isaac no puede ayudarte con esto en tu estado, así que cierro tu solicitud. ¡Que estés muy bien!",
    },
  },
  not_interested_close: {
    en: "Understood. I'll close your request. If anything changes, just reply here. Take care!",
    es: {
      usted: "Entendido. Cierro su solicitud. Si algo cambia, responda aquí. ¡Que esté muy bien!",
      tu: "Entendido. Cierro tu solicitud. Si algo cambia, responde aquí. ¡Que estés muy bien!",
    },
  },
  help: {
    en: "{brand}: {agentFullName}, licensed agent. Call {agentPhone} or visit {site}. Reply STOP to opt out.",
    es: {
      usted:
        "{brand}: {agentFullName}, agente con licencia. Llame al {agentPhone} o visite {site}. Responda STOP para no recibir más mensajes.",
      tu: "{brand}: {agentFullName}, agente con licencia. Llama al {agentPhone} o visita {site}. Responde STOP para no recibir más mensajes.",
    },
  },
  optout_confirm: {
    en: "Understood. You won't receive more messages from us. - {brand}",
    es: {
      usted: "Entendido. No le enviaremos más mensajes. - {brand}",
      tu: "Entendido. No te enviaremos más mensajes. - {brand}",
    },
  },
  optout_clarify: {
    en: "Do you want us to stop messaging you completely? Reply STOP to confirm. - {brand}",
    es: {
      usted: "¿Quiere que dejemos de escribirle por completo? Responda STOP para confirmar. - {brand}",
      tu: "¿Quieres que dejemos de escribirte por completo? Responde STOP para confirmar. - {brand}",
    },
  },
  media_received: {
    en: "Thanks! Isaac will review what you sent and reply {eta}.",
    es: {
      usted: "¡Gracias! Isaac revisará lo que nos envió y le responde {eta}.",
      tu: "¡Gracias! Isaac revisará lo que nos enviaste y te responde {eta}.",
    },
  },
  self_booking_link: {
    en: "No problem. You can pick the time that works best for you here: {link}",
    es: {
      usted: "Sin problema. Puede elegir la hora que mejor le quede aquí: {link}",
      tu: "Sin problema. Puedes elegir la hora que mejor te quede aquí: {link}",
    },
  },
  ask_time_preference: {
    en: "No problem. What day and time usually work best for you?",
    es: {
      usted: "Sin problema. ¿Qué día y hora le quedan mejor normalmente?",
      tu: "Sin problema. ¿Qué día y hora te quedan mejor normalmente?",
    },
  },
};

export const TEMPLATE_META: Record<TemplateId, TemplateMeta> = {
  offer_times: { slots: 2, vars: ["slotA", "slotB"], greet: true, compliance: false },
  offer_one_time: { slots: 1, vars: ["slotA"], greet: true, compliance: false },
  offer_times_now: { slots: 1, vars: ["slotA"], greet: true, compliance: false },
  price_redirect: { slots: 2, vars: ["slotA", "slotB"], greet: true, compliance: false },
  info_redirect: { slots: 2, vars: ["slotA", "slotB"], greet: true, compliance: false },
  who_is_this: { slots: 2, vars: ["topic", "slotA", "slotB"], greet: true, compliance: false },
  confirm_booking: { slots: 0, vars: ["when", "agentPhone", "vcardUrl"], greet: false, compliance: false },
  confirm_reschedule: { slots: 0, vars: ["when", "agentPhone"], greet: false, compliance: false },
  confirm_cancel: { slots: 0, vars: [], greet: false, compliance: false },
  existing_appointment: { slots: 0, vars: ["when"], greet: true, compliance: false },
  call_now_checking: { slots: 0, vars: [], greet: true, compliance: false },
  call_now_calling: { slots: 0, vars: ["agentPhone"], greet: false, compliance: false },
  call_now_unavailable: { slots: 2, vars: ["slotA", "slotB"], greet: false, compliance: false },
  handoff_hold: { slots: 0, vars: ["eta"], greet: true, compliance: false },
  ask_state: { slots: 0, vars: [], greet: true, compliance: false },
  out_of_license: { slots: 0, vars: [], greet: true, compliance: false },
  not_interested_close: { slots: 0, vars: [], greet: true, compliance: false },
  help: { slots: 0, vars: ["brand", "agentFullName", "agentPhone", "site"], greet: false, compliance: true },
  optout_confirm: { slots: 0, vars: ["brand"], greet: false, compliance: true },
  optout_clarify: { slots: 0, vars: ["brand"], greet: false, compliance: true },
  media_received: { slots: 0, vars: ["eta"], greet: true, compliance: false },
  self_booking_link: { slots: 0, vars: ["link"], greet: false, compliance: false },
  ask_time_preference: { slots: 0, vars: [], greet: false, compliance: false },
};

/** One-line purpose of each template, for the admin UI (Ajustes -> plantillas). */
export const TEMPLATE_DESCRIPTIONS: Record<TemplateId, { en: string; es: string }> = {
  offer_times: { en: "Offers two call times picked by code.", es: "Ofrece dos horas para la llamada (las elige el código)." },
  offer_one_time: { en: "Offers a single call time when only one fits.", es: "Ofrece una sola hora cuando solo una sirve." },
  offer_times_now: {
    en: "Isaac is free: offers a call right now or one later time.",
    es: "Isaac está libre: ofrece llamar ahora o a otra hora.",
  },
  price_redirect: {
    en: "Answers a price question by steering to a 15-minute call, with two times.",
    es: "Responde la pregunta de precio llevando a la llamada de 15 minutos, con dos horas.",
  },
  info_redirect: {
    en: "Answers a request for information by steering to the call, with two times.",
    es: "Responde a \"mándeme información\" llevando a la llamada, con dos horas.",
  },
  who_is_this: {
    en: "Explains who is writing and why, then offers two times.",
    es: "Explica quién escribe y por qué, y ofrece dos horas.",
  },
  confirm_booking: {
    en: "Confirms a new appointment with Isaac's number and contact card.",
    es: "Confirma la cita nueva con el número de Isaac y su tarjeta de contacto.",
  },
  confirm_reschedule: { en: "Confirms the new time of a rescheduled call.", es: "Confirma la nueva hora de una llamada reagendada." },
  confirm_cancel: {
    en: "Confirms a canceled call and leaves the door open.",
    es: "Confirma que se canceló la llamada y deja la puerta abierta.",
  },
  existing_appointment: {
    en: "Reminds the lead of the call already booked and asks if it still works.",
    es: "Recuerda la llamada ya agendada y pregunta si le sigue quedando bien.",
  },
  call_now_checking: {
    en: "\"Call me now\": says the assistant is checking whether Isaac is free.",
    es: "\"Llámeme ya\": dice que está viendo si Isaac está libre.",
  },
  call_now_calling: {
    en: "Isaac tapped \"I'm calling\": says he is calling now and from which number.",
    es: "Isaac tocó \"Estoy llamando\": avisa que llama ahora y desde qué número.",
  },
  call_now_unavailable: {
    en: "Isaac could not take the call now: offers two times instead.",
    es: "Isaac no puede llamar ahora: ofrece dos horas.",
  },
  handoff_hold: {
    en: "Hands the conversation to Isaac with a real reply time.",
    es: "Pasa la conversación a Isaac con una hora real de respuesta.",
  },
  ask_state: {
    en: "Asks which state the lead lives in (needed for times and license).",
    es: "Pregunta en qué estado vive (para el horario y la licencia).",
  },
  out_of_license: {
    en: "Closes kindly when Isaac is not licensed in the lead's state.",
    es: "Cierra con amabilidad cuando Isaac no tiene licencia en ese estado.",
  },
  not_interested_close: {
    en: "Closes kindly when the lead is not interested, without insisting.",
    es: "Cierra con amabilidad cuando no le interesa, sin insistir.",
  },
  help: {
    en: "Fixed HELP reply: brand, agent, phone, website and STOP.",
    es: "Respuesta fija a HELP/AYUDA: marca, agente, teléfono, web y STOP.",
  },
  optout_confirm: { en: "Confirms an opt-out; nothing is sent after it.", es: "Confirma la baja; después ya no se envía nada." },
  optout_clarify: {
    en: "Asks once whether an ambiguous message meant opting out.",
    es: "Pregunta una sola vez si un mensaje ambiguo era una baja.",
  },
  media_received: {
    en: "Thanks the lead for a photo or audio; Isaac reviews it.",
    es: "Agradece la foto o el audio; Isaac lo revisa.",
  },
  self_booking_link: {
    en: "After two declined offers, sends the link to pick a time.",
    es: "Después de dos rechazos, manda el link para que elija su hora.",
  },
  ask_time_preference: {
    en: "Asks which day and time usually work best for the lead.",
    es: "Pregunta qué día y hora le quedan mejor normalmente.",
  },
};

/** Every template id, in catalog order. */
export const TEMPLATE_IDS: readonly TemplateId[] = Object.freeze(Object.keys(TEMPLATE_TEXTS) as TemplateId[]);

/** A Record so the compiler insists every variable name is listed. */
const VAR_NAMES: Record<TemplateVarName, true> = {
  slotA: true,
  slotB: true,
  when: true,
  topic: true,
  eta: true,
  link: true,
  agentPhone: true,
  agentFullName: true,
  brand: true,
  site: true,
  vcardUrl: true,
};

const PLACEHOLDER = /\{(\w+)\}/g;

/** Runtime check for ids that arrive as data (tool input, admin POST, DB rows). */
export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TEMPLATE_TEXTS, v);
}

/** HELP and opt-out templates: sent by code, never subject to approval, never given the disclosure. */
export function isComplianceTemplate(id: TemplateId): boolean {
  return TEMPLATE_META[id].compliance;
}

/** The raw text with its {placeholders}. English ignores the register. */
export function getTemplateText(id: TemplateId, lang: Lang, register: Register): string {
  const t = TEMPLATE_TEXTS[id];
  return lang === "en" ? t.en : t.es[register];
}

function isVarName(name: string): name is TemplateVarName {
  return Object.prototype.hasOwnProperty.call(VAR_NAMES, name);
}

function varValue(vars: TemplateVars, name: string): string | null {
  if (!isVarName(name)) return null;
  const value = vars[name];
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean || null;
}

/** Spanish "o" becomes "u" before an /o/ sound, as in "ayer u hoy" (RAE): "… o hoy a las 6" -> "u hoy". */
function spanishOrBeforeO(raw: string, vars: TemplateVars): string {
  return raw.replace(/ o \{(\w+)\}/g, (match: string, name: string) => {
    const value = varValue(vars, name);
    return value && /^[Hh]?[oóOÓ]/.test(value) ? ` u {${name}}` : match;
  });
}

/** True when the text before a placeholder ends a sentence (or a sentence-opening "¿"/"¡"). */
function startsSentence(prefix: string): boolean {
  const before = prefix.replace(/[¿¡]+$/, "");
  return before.trim() === "" || /[.!?]\s+$/.test(before);
}

function isUrlLike(value: string): boolean {
  return /^(?:https?:\/\/|www\.)/i.test(value);
}

/**
 * Fills the placeholders. A value that starts a sentence gets a capital ("¿{slotA} o {slotB}?" ->
 * "¿Hoy a las 4:30…"); in Spanish "o" before a value with an /o/ sound becomes "u" ("… u hoy a
 * las 6"). Missing or blank values stay as "{name}" and are listed in `missing`: callers must not
 * send when `missing` is non-empty.
 */
export function renderTemplate(
  id: TemplateId,
  lang: Lang,
  register: Register,
  vars: TemplateVars
): { text: string; missing: string[] } {
  const base = getTemplateText(id, lang, register);
  const raw = lang === "es" ? spanishOrBeforeO(base, vars) : base;
  const missing: string[] = [];
  const text = raw.replace(PLACEHOLDER, (match: string, name: string, offset: number) => {
    const value = varValue(vars, name);
    if (value === null) {
      if (!missing.includes(name)) missing.push(name);
      return match;
    }
    return startsSentence(raw.slice(0, offset)) && !isUrlLike(value) ? capitalizeFirst(value) : value;
  });
  return { text: text.replace(/ {2,}/g, " ").trim(), missing };
}

/**
 * sha256 (hex, first 16 chars) of the three raw variants (EN, ES usted, ES tú) joined by
 * "\n---\n". Isaac's approval is stored against it, so any wording change needs re-approval.
 */
export function templateHash(id: TemplateId): string {
  const t = TEMPLATE_TEXTS[id];
  return createHash("sha256")
    .update([t.en, t.es.usted, t.es.tu].join("\n---\n"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Every template with its hash and raw variants, for the approval screen. English is listed once,
 * under the default register ("usted"), since it ignores the register.
 */
export function templateCatalog(): TemplateCatalogEntry[] {
  return TEMPLATE_IDS.map((id): TemplateCatalogEntry => ({
    id,
    hash: templateHash(id),
    compliance: isComplianceTemplate(id),
    variants: [
      { lang: "en", register: "usted", text: getTemplateText(id, "en", "usted") },
      { lang: "es", register: "usted", text: getTemplateText(id, "es", "usted") },
      { lang: "es", register: "tu", text: getTemplateText(id, "es", "tu") },
    ],
  }));
}
