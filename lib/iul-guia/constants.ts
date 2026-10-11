/**
 * Every constant the IUL lead-magnet opt-in needs, in one place.
 *
 * Same two rules as `lib/legal-shield/constants.ts`, for the same reasons:
 *
 * 1. **No React, no JSX.** This file is imported by the client funnel, by the server sections, and
 *    by two server route handlers. A shared "disclaimer component" is impossible across those.
 * 2. **The label maps live here, not in the funnel component.** `/api/contact-append-iul` writes
 *    the readable English labels to the CRM, while the visitor taps Spanish. Two copies of these
 *    maps would drift and the CRM note would quietly start lying.
 *
 * This funnel is **Spanish only** and its copy is hardcoded rather than translated. That is
 * deliberate: the quiz copy on `/iul/get-covered` lives in `iulQuote.form.steps`, shared with
 * `/iul/quote`, and its Step-1 labels live in `contactPage.info.form`, shared with ~16 other
 * forms. Editing either to fit a lead-magnet page would silently change pages nobody asked to
 * change. Hardcoding is the cheaper correctness guarantee.
 */

const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/**
 * The free guide PDF.
 *
 * Empty until Isaac supplies the file. Every consumer degrades on purpose — the success screen
 * hides its download button, the email route returns 200 and sends nothing — so the page ships
 * and converts before the PDF exists. Pasting the URL here is the only step to turn delivery on.
 */
export const IUL_GUIA_PDF_URL = "";

/**
 * The 3D book mockup, served as a Cloudinary derivation of Isaac's original upload.
 *
 * `e_trim:8` crops the generous light canvas down to the book and its shadow. The background is
 * LEFT IN rather than knocked out: the cover's lettering is white, so `e_make_transparent` would
 * eat "DINERO RIQUEZA IUL" along with the background and the title would render as holes. The
 * image is framed in a light card instead, which is how a product shot normally sits anyway.
 *
 * `w_760` is 2x the 380px display width — the source is 1122x1402 at 1.4 MB, which is a poor LCP
 * on the phones this ad traffic arrives on.
 */
export const IUL_GUIA_COVER_URL = `${CLOUDINARY}/e_trim:8/f_auto,q_auto,w_760/v1791748128/ce4a5878-1b17-44a6-b32c-340d6646a183_g4taxo.png`;

/** The name the offer goes by on the button, the success screen and the email subject. */
export const IUL_GUIA_TITLE = "Dinero, Riqueza, IUL";

// ---------------------------------------------------------------------------
// Lead routing
// ---------------------------------------------------------------------------

/**
 * Its own source, NOT `iul_get_covered_ads`.
 *
 * The whole point of this page is to be comparable against `/iul/get-covered` — different field
 * order, different offer, different creative. Reusing that funnel's source would merge the two
 * populations in the CRM and make the comparison unanswerable, which is the failure the September
 * analysis flagged. This string is also what `allowDuplicateMergeCapi` keys on in
 * `/api/create-contact`, so a returning lead still fires CAPI with the Pixel's event id.
 */
export const IUL_GUIA_LEAD_SOURCE = "iul_guia_ads";

/** Campaign label written to the CRM note alongside the source. */
export const IUL_GUIA_CAMPAIGN = "iul_guia_lead_magnet";

/** Bumped when the PDF is replaced, so the CRM can tell which edition a lead was sent. */
export const IUL_GUIA_VERSION = "dinero_riqueza_iul_v1";

// ---------------------------------------------------------------------------
// Contact — Isaac, same numbers as the rest of the site.
// ---------------------------------------------------------------------------

export const IUL_GUIA_PHONE_DISPLAY = "540-426-1804";
export const IUL_GUIA_PHONE_TEL = "tel:+15404261804";
export const IUL_GUIA_WHATSAPP_HREF = "https://wa.me/15406813507";
export const IUL_GUIA_AGENT_NAME = "Isaac Orraiz";
export const IUL_GUIA_AGENT_TITLE = "Agente de seguros con licencia";

// ---------------------------------------------------------------------------
// Quiz options
//
// Keys are stored and sent; labels are what the visitor reads. The English `*_CRM_LABELS` are
// what `/api/contact-append-iul` already expects, so they must stay byte-identical to the maps
// in `components/iul/iul-get-covered-funnel.tsx`.
// ---------------------------------------------------------------------------

export const RETIREMENT_SLUGS = ["within-10", "within-20", "within-30", "retired"] as const;
export type RetirementSlug = (typeof RETIREMENT_SLUGS)[number];

export const RETIREMENT_LABELS_ES: Record<RetirementSlug, string> = {
  "within-10": "Dentro de 10 años",
  "within-20": "Dentro de 20 años",
  "within-30": "Dentro de 30 años",
  retired: "Ya estoy jubilado",
};

export const RETIREMENT_CRM_LABELS: Record<RetirementSlug, string> = {
  "within-10": "Within 10 Years",
  "within-20": "Within 20 Years",
  "within-30": "Within 30 Years",
  retired: "Currently Retired",
};

/**
 * Monthly capacity brackets.
 *
 * The floor is DELIBERATELY lower than `/iul/get-covered`, which starts at "Menos de $300".
 * 41-44% of this market says life insurance is "muy caro" while 72-75% overestimate the real cost
 * by 3-5x, so a bottom bracket of $300 self-excludes the single largest group before they ever
 * reach a call. This question is asked AFTER the contact is banked, so a wider floor costs nothing
 * in CRM terms — and a low answer is a Final Expense routing signal, not a disqualification.
 */
export const SAVINGS_SLUGS = ["less-150", "150-300", "300-500", "more-500"] as const;
export type SavingsSlug = (typeof SAVINGS_SLUGS)[number];

export const SAVINGS_LABELS_ES: Record<SavingsSlug, string> = {
  "less-150": "Menos de $150",
  "150-300": "$150 - $300",
  "300-500": "$300 - $500",
  "more-500": "Más de $500",
};

export const SAVINGS_CRM_LABELS: Record<SavingsSlug, string> = {
  "less-150": "Less than $150",
  "150-300": "$150 - $300",
  "300-500": "$300 - $500",
  "more-500": "More than $500",
};

export const CALL_TIME_SLUGS = ["morning", "midday", "afternoon"] as const;
export type CallTimeSlug = (typeof CALL_TIME_SLUGS)[number];

export const CALL_TIME_LABELS_ES: Record<CallTimeSlug, string> = {
  morning: "En la mañana",
  midday: "Al mediodía",
  afternoon: "En la tarde",
};

export const CALL_TIME_CRM_LABELS: Record<CallTimeSlug, string> = {
  morning: "Morning (8am - 12pm)",
  midday: "Midday (12pm - 2pm)",
  afternoon: "Afternoon (2pm - 6pm)",
};

// ---------------------------------------------------------------------------
// Disclosures
// ---------------------------------------------------------------------------

/**
 * Carried on the page footer and at the bottom of the guide email.
 *
 * NAIC Model 570 requires a life insurance advertisement to identify the insurer rather than only
 * the agent, and treats "savings", "investment", "investment plan" and "retirement plan" as
 * prohibited characterisations where they tend to mislead. The copy on this page is written around
 * that; this block is the belt to that suspenders.
 */
export const IUL_GUIA_DISCLAIMER_ES = [
  "Material educativo únicamente. No constituye asesoría fiscal, legal ni contable, y no es una oferta de contrato de seguro.",
  "Un seguro de vida universal indexado es un contrato de seguro de vida, no una cuenta bancaria ni un producto de inversión. Los valores no garantizados están sujetos a cambios y dependen de la aseguradora emisora.",
  "La disponibilidad de productos, su contenido y su precio varían según el estado y dependen de la evaluación de la aseguradora.",
  "Isaac Orraiz es un agente de seguros con licencia. Isaac Plans Insurance no está afiliada ni respaldada por ninguna agencia gubernamental.",
] as const;
