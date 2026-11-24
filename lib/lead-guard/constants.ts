/**
 * Lead Guard: names shared by the browser and the server. No secrets, no server imports.
 *
 * Why this exists (Nov 2026): a form-bombing bot posted the server-rendered contact form without
 * running JavaScript, about 50 times a weekday, with Faker names, real strangers' emails and random
 * phones. Every post became a CRM contact and fired the contact workflow (quote email + SMS to
 * people who never asked). See LEAD_GUARD_SETUP.md.
 */

/** Where a lead came from. Server-derived (never trusted from the client). */
export type LeadGuardSurface =
  // Server-action forms (useActionState)
  | "contact"
  | "get_covered_fast"
  | "agent_crm"
  | "aca_form"
  | "dental_vision_form"
  | "final_expense_form"
  | "health_alternative_form"
  | "hospital_indemnity_form"
  | "iul_form"
  | "life_insurance_form"
  | "short_term_medical_form"
  // Browser fetch → /api/create-contact
  | "aca_funnel"
  | "final_expense_funnel"
  | "health_alternative_funnel"
  | "life_insurance_funnel"
  | "iul_funnel"
  | "iul_guia"
  | "legal_shield"
  | "iul_lead_gen"
  | "guide_download"
  | "web_other"
  // Front-door routes with their own CRM call
  | "lead_magnet_download"
  | "partner_lead";

/** Form field (server actions) that carries the form token; fetch callers send `leadGuard.t`. */
export const LEAD_TOKEN_FIELD = "_lgt";
/** "1" when the browser had to fetch the token at submit time (an old tab): its age means nothing. */
export const LEAD_FRESH_FIELD = "_lgf";
/** "1" when the visitor re-sent the same phone after "please double-check this number". */
export const LEAD_PHONE_ACK_FIELD = "_lg_pa";
/** Off-screen input only bots fill. Meaningless name so browser autofill never targets it. */
export const LEAD_HONEYPOT_FIELD = "_lg_hp";
/** In a server action's VALIDATION_ERROR: the digits it asked to double-check (the visitor's own). */
export const LEAD_PHONE_RECHECK_KEY = "_lgPhone";
/** JSON body key fetch callers add: `{ leadGuard: { t, f?, hp? } }`. */
export const LEAD_GUARD_BODY_KEY = "leadGuard";
/** The page's token, rendered by the root layout on <body data-lgt>. */
export const LEAD_TOKEN_BODY_ATTR = "lgt";
/** GET endpoint that mints a fresh token for old tabs. Neutral name, outside middleware (under /api). */
export const LEAD_TOKEN_PATH = "/api/form-session";
