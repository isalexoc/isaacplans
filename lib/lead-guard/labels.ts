/** Spanish labels (Isaac reads Spanish) for the Telegram alert and the admin review page. */

import type { LeadGuardReason } from "./assess";
import type { LeadGuardSurface } from "./constants";

export const SURFACE_LABELS: Record<LeadGuardSurface, string> = {
  contact: "Contacto (formulario general)",
  get_covered_fast: "Get Covered Fast",
  agent_crm: "Agent CRM (agentes)",
  aca_form: "ACA (formulario)",
  dental_vision_form: "Dental y visión (formulario)",
  final_expense_form: "Gastos finales (formulario)",
  health_alternative_form: "Alternativa de salud (formulario)",
  hospital_indemnity_form: "Indemnización hospitalaria (formulario)",
  iul_form: "IUL (formulario)",
  life_insurance_form: "Seguro de vida (formulario)",
  short_term_medical_form: "Médico a corto plazo (formulario)",
  aca_funnel: "ACA (embudo)",
  final_expense_funnel: "Gastos finales (embudo)",
  health_alternative_funnel: "Alternativa de salud (embudo)",
  life_insurance_funnel: "Seguro de vida (embudo)",
  iul_funnel: "IUL (embudo)",
  iul_guia: "Guía IUL",
  legal_shield: "LegalShield",
  iul_lead_gen: "IUL (cotizador)",
  guide_download: "Guía descargable",
  web_other: "Sitio web (otro)",
  lead_magnet_download: "Guía (lead magnet)",
  partner_lead: "Socio referidor",
};

export const REASON_LABELS: Record<LeadGuardReason, string> = {
  // Blocked (bot certainty): logged only, never held; listed for completeness.
  no_js_post: "envío sin JavaScript (bot)",
  multi_blob: "varios tipos de lead a la vez (bot)",
  scripted_post: "envío de un script, sin navegador (bot)",
  // Held
  token_missing: "llegó sin la señal del formulario (página vieja o red lenta)",
  token_stale: "formulario abierto hace más de un día",
  token_forged: "señal del formulario inválida",
  no_blob: "sin tipo de lead",
  server_only_blob: "tipo de lead que solo envía el servidor",
  honeypot: "llenó el campo oculto (autollenado o bot)",
  too_fast: "enviado segundos después de abrir la página",
  phone_invalid: "teléfono que no existe",
  phone_unverified: "teléfono que no existe (lo confirmó)",
  name_junk: "nombre con enlaces o números",
  origin_foreign: "enviado desde otro sitio web",
  strict_rate: "muchos envíos seguidos en el formulario general",
  daily_cap: "más leads de lo normal hoy en este formulario",
};
