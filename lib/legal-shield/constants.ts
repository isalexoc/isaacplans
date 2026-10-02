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

/*
 * There is deliberately NO LegalShield logo constant here.
 *
 * The company's advertising guidelines do not let an Independent Associate put its mark on their
 * own marketing, so the funnel brands itself "Escudo Legal" with a typographic lockup instead —
 * see components/legal-shield/legal-shield-brand.tsx. The LegalShield NAME still appears in text
 * where the disclosure requires it; that is nominative use, not trademark artwork.
 */

/** The free guide. Public Cloudinary URL, versioned, so an emailed link keeps resolving. */
export const LEGAL_SHIELD_GUIDE_PDF_URL = `${CLOUDINARY}/v1790000614/guia_legal_shield_gt48jt.pdf`;

/**
 * The 3D book mockup used as the hero visual. `e_trim` crops the generous white canvas down to the
 * book and its shadow.
 *
 * The white background is deliberately LEFT IN. Knocking it out looks like the obvious move, but
 * the cover's lettering is white too, so `e_make_transparent` eats "ESCUDO LEGAL" along with the
 * background and the title renders as holes. The image is framed in a light card instead, which is
 * how a product shot normally sits anyway.
 */
export const LEGAL_SHIELD_GUIDE_COVER_URL = `${CLOUDINARY}/e_trim:8/f_auto,q_auto,w_700/v1790003691/legal-shield-purple_kko0wd.png`;

/**
 * The name the offer goes by everywhere the visitor sees it — the book mockup, the button, the
 * email subject.
 *
 * NOTE: the PDF's own cover is titled "Guía Preventiva para Familias Latinas", so a lead who
 * clicks "Escudo Legal" opens a file with a different name on it. Nothing breaks, but it is worth
 * settling: either the mockup or the PDF cover should be re-made to match the other.
 */
export const LEGAL_SHIELD_GUIDE_TITLE = "Escudo Legal";

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
