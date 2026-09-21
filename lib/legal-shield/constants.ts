/**
 * Every constant the LegalShield opt-in funnel needs, in one place.
 *
 * Two rules govern this file:
 *
 * 1. **No React, no JSX.** It is imported by the client funnel, by two server route handlers, by
 *    the footer, AND by the react-pdf guide builder — and react-pdf renders to a PDF primitive
 *    tree, not to DOM, so a shared "disclaimer component" is impossible. The disclaimer is a plain
 *    string array that each surface renders in its own way.
 *
 * 2. **The label maps live here, not in the funnel component.** `app/api/legal-shield/append`
 *    imports the same Spanish strings the visitor tapped, so what lands in the CRM is verbatim what
 *    Ysmael reads back off the call script: "veo aquí en tu formulario que te interesa
 *    específicamente el tema de ___". A second copy of these strings would drift and the script
 *    would quietly start lying.
 *
 * Asset URLs start empty on purpose. Every consumer has a designed fallback (typeset wordmark,
 * gradient cover, hidden button), so the funnel ships and converts before Isaac supplies the files.
 */

// ---------------------------------------------------------------------------
// Assets
//
// Everything is a Cloudinary derivation of an original Isaac uploaded, so there is one source of
// truth per asset and the sizing/format work happens at the CDN rather than in a checked-in file.
// All live under res.cloudinary.com/isaacdev/, already allowed by next.config remotePatterns.
// ---------------------------------------------------------------------------

const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

/**
 * The LegalShield mark, in two versions, because the site has a dark mode and a logo does not.
 *
 * Both source files ship with a solid white background baked in — no alpha channel — so a raw
 * `<img>` would put a white brick in the header the moment the page goes dark. The chain fixes
 * that at the CDN:
 *
 *   e_trim:10                  strips the generous white margin around the artwork (without it
 *                              the mark renders tiny inside its own padding)
 *   co_white,e_make_transparent:12   knocks the white background out to real transparency
 *   e_colorize:100,co_white    (dark only) repaints the black artwork white
 *   h_96,c_fit                 3× the ~32px render height, so it stays crisp on a phone
 *
 * Light uses the purple original; dark starts from the black one because colorising black to
 * white is clean, while colorising purple would flatten the shield's two tones into one.
 * After trimming, both land at ~365×72 — the same aspect ratio, so swapping them cannot shift
 * the layout.
 */
export const LEGAL_SHIELD_LOGO_URL_LIGHT = `${CLOUDINARY}/e_trim:10/co_white,e_make_transparent:12/f_auto,q_auto,h_96,c_fit/v1790001003/images_4_qazmwo.png`;

export const LEGAL_SHIELD_LOGO_URL_DARK = `${CLOUDINARY}/e_trim:10/co_white,e_make_transparent:12/e_colorize:100,co_white/f_auto,q_auto,h_96,c_fit/v1790001003/images_2_vnwni7.png`;

/** The free guide. Public Cloudinary URL, versioned, so an emailed link keeps resolving. */
export const LEGAL_SHIELD_GUIDE_PDF_URL = `${CLOUDINARY}/v1790000614/guia_legal_shield_gt48jt.pdf`;

/**
 * The guide's own cover, rendered from page 1 of the PDF — no second asset to keep in sync, and
 * the image on the landing page is guaranteed to be the cover of the file that actually arrives.
 * `e_trim` removes the page's white margin and the `c_crop` drops the footer line below the
 * artwork.
 */
export const LEGAL_SHIELD_GUIDE_COVER_URL = `${CLOUDINARY}/pg_1/e_trim:10/c_crop,g_north,h_0.945/f_jpg,q_auto:good,w_900/v1790000614/guia_legal_shield_gt48jt.pdf`;

/** What the guide is actually called. The landing page must promise the file it delivers. */
export const LEGAL_SHIELD_GUIDE_TITLE = "Guía Preventiva para Familias Latinas";

/** Ysmael's headshot, face-cropped square for the circular avatar on the success screen. */
export const YSMAEL_HEADSHOT_URL = `${CLOUDINARY}/f_auto,q_auto,c_fill,g_face,z_0.7,w_192,h_192/v1790001116/677661707_10239564285542052_6169561768116144074_n_v5zqwu.jpg`;

/** Ysmael's .vcf contact card. Empty ⇒ the "Guardar contacto" button is hidden. */
export const YSMAEL_VCARD_URL = "";

/** LegalShield self-enrollment referral link. Empty ⇒ the apply button renders disabled. */
export const LEGAL_SHIELD_REFERRAL_URL = "";

/** Optional walkthrough video for /legal-shield/apply. Empty ⇒ a designed "próximamente" frame. */
export const LEGAL_SHIELD_APPLY_VIDEO_URL = "";

/** Poster frame for the walkthrough video. Only used when the video URL is set. */
export const LEGAL_SHIELD_APPLY_VIDEO_POSTER_URL = "";

// ---------------------------------------------------------------------------
// Contact — Ysmael, NOT Isaac. `nav("phone")` resolves to Isaac's 540-426-1804.
// ---------------------------------------------------------------------------

export const LS_PHONE_DISPLAY = "(540) 376-1831";
export const LS_PHONE_TEL = "tel:+15403761831";
export const LS_WHATSAPP_HREF = "https://wa.me/15403761831";
export const LS_ADVISOR_NAME = "Ysmael Orraiz";
export const LS_ADVISOR_TITLE = "Asociado Independiente de LegalShield";

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const LS_OPTIN_PATH = "/legal-shield/proteccion-legal";
export const LS_APPLY_PATH = "/legal-shield/apply";

/** The `source` on the lead blob. Drives tags, CAPI content_name, and duplicate-merge CAPI. */
export const LS_LEAD_SOURCE = "legal_shield_optin_ads";

// ---------------------------------------------------------------------------
// Questionnaire — screens 2 and 3 of the ad brief.
// ---------------------------------------------------------------------------

export const AREA_SLUGS = [
  "multas_transito",
  "contratos",
  "proteccion_familiar",
  "irs_identidad",
  "duda_especifica",
] as const;

export type AreaSlug = (typeof AREA_SLUGS)[number];

/** Exactly the wording from the ad brief — this is what the advisor reads back. */
export const AREA_LABELS_ES: Record<AreaSlug, string> = {
  multas_transito: "Multas de tránsito o accidentes automovilísticos",
  contratos: "Revisión de contratos (alquiler, compra, venta, servicios)",
  proteccion_familiar:
    "Protección familiar (testamentos, poderes médicos, decisiones sobre hijos)",
  irs_identidad:
    "Cartas del IRS o protección contra robo de identidad y fraudes financieros",
  duda_especifica: "Tengo una duda legal específica y necesito orientación rápida",
};

export const URGENCY_SLUGS = ["ahora_mismo", "prevencion"] as const;

export type UrgencySlug = (typeof URGENCY_SLUGS)[number];

export const URGENCY_LABELS_ES: Record<UrgencySlug, string> = {
  ahora_mismo: "Tengo una situación legal ahora mismo y necesito orientación pronto",
  prevencion: "Todo está bien, pero quiero estar prevenido y protegido por si algo pasa",
};

/**
 * One tag per area.
 *
 * Isaac asked for no new custom fields, so tags carry the structured half of the questionnaire —
 * they are what GHL smart lists and workflow filters can actually match on. The readable half
 * goes into `lead_source_details`, the shared field every lead type on this site already writes
 * to, so the advisor still has a sentence to read rather than a list of slugs.
 */
export const AREA_TAGS: Record<AreaSlug, string> = {
  multas_transito: "ls_area_transito",
  contratos: "ls_area_contratos",
  proteccion_familiar: "ls_area_familia",
  irs_identidad: "ls_area_irs_identidad",
  duda_especifica: "ls_area_duda_especifica",
};

/** Applied when urgency is `ahora_mismo` so GHL can route hot leads to the front of the queue. */
export const LS_TAG_URGENCY_NOW = "ls_urgencia_ahora";

/** Applied when urgency is `prevencion` — a different cadence, not a worse lead. */
export const LS_TAG_URGENCY_PREVENTION = "ls_urgencia_prevencion";

/** Applied on the final questionnaire save. Lets the advisor notification branch on "answered vs not". */
export const LS_TAG_QUESTIONNAIRE_COMPLETE = "ls_cuestionario_completo";

export function isAreaSlug(value: unknown): value is AreaSlug {
  return typeof value === "string" && (AREA_SLUGS as readonly string[]).includes(value);
}

export function isUrgencySlug(value: unknown): value is UrgencySlug {
  return typeof value === "string" && (URGENCY_SLUGS as readonly string[]).includes(value);
}

/** Selected area slugs → the pipe-joined Spanish string the advisor reads. */
export function formatAreasForCrm(slugs: readonly string[]): string {
  return slugs
    .filter(isAreaSlug)
    .map((slug) => AREA_LABELS_ES[slug])
    .join(" | ");
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * Isaac asked for the consent checkboxes to be removed. Consent is therefore captured by
 * submission: this exact sentence sits directly above the submit button, and the CRM lead block
 * records it verbatim with a timestamp, the client IP and the page URL — so there is still an
 * evidentiary record of what the visitor was shown when they chose to submit.
 *
 * Writing the text itself rather than only a boolean is the point: editing this string changes
 * what is stored from now on and leaves every earlier record saying what it actually said.
 */
export const CONSENT_DISCLOSURE_ES =
  "Al enviar este formulario autorizas a Ysmael Orraiz a contactarte por teléfono, mensaje de texto y WhatsApp al número que proporcionaste. No es condición de compra. Pueden aplicar tarifas de tu operador. Responde STOP para dejar de recibir mensajes.";

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

/**
 * Rendered server-side in the footer and printed on the guide's back page.
 *
 * LegalShield's advertising guidelines for Independent Associates require that marketing identify
 * the associate as independent, not read as an official LegalShield property, and never describe
 * the plans as insurance. Those three requirements are why each paragraph is here.
 */
export const LEGAL_SHIELD_DISCLAIMER_ES: readonly string[] = [
  "Ysmael Orraiz es Asociado Independiente de LegalShield, no empleado de LegalShield. Este sitio es material de mercadeo de un asociado independiente; no es un sitio oficial de LegalShield ni está operado por LegalShield.",
  "Los planes de LegalShield son planes de servicios legales prepagados. NO son un seguro. Los planes tienen exclusiones y limitaciones, y la disponibilidad, los servicios incluidos y los precios varían según el estado. Consulta los detalles del plan vigente en tu estado antes de inscribirte.",
];

/** The short version, shown above the submit button and in the FAQ. */
export const NOT_INSURANCE_LINE_ES =
  "Esto no es un seguro. Es una membresía de servicios legales.";
