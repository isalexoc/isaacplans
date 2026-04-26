/** Official Marketplace enrollment via HealthSherpa (agent-attributed). */
export const HEALTH_SHERPA_AGENT_URL =
  "https://www.healthsherpa.com/?_agent_id=isaacplans";

/** Hero art for Get Covered Fast — desktop split column only (hidden on small screens). */
export const GET_COVERED_FAST_HERO_IMAGE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1600,h_1200,c_fill,g_center/pexels-wanda-yanery-villarraga-tole-584965425-17052722_ewanjk.jpg";

/** Open Graph / Twitter card (1200×630) — aligned with hero art for social previews. */
export const GET_COVERED_FAST_OG_IMAGE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_center/pexels-wanda-yanery-villarraga-tole-584965425-17052722_ewanjk.jpg";

/** Cloudinary public IDs for `/final-expense/get-covered` OG / Twitter (1200×630). */
export const FINAL_EXPENSE_GET_COVERED_OG_PUBLIC_ID_EN =
  "gastos_finales_planes_regulados_por_el_estado_en_thdapq";
export const FINAL_EXPENSE_GET_COVERED_OG_PUBLIC_ID_ES =
  "Planes_y_beneficios_de_gastos_finales_aprobados_en_su_estado_es_cjhqtj";

const CLOUDINARY_ISAAC = "https://res.cloudinary.com/isaacdev/image/upload";

/**
 * Optimized 1200×630 OG image URL for the final expense get-covered page (`f_auto`, `q_auto`, fill, smart gravity).
 */
export function getFinalExpenseGetCoveredOgImageUrl(locale: string): string {
  const isEs = locale.toLowerCase().startsWith("es");
  const publicId = isEs
    ? FINAL_EXPENSE_GET_COVERED_OG_PUBLIC_ID_ES
    : FINAL_EXPENSE_GET_COVERED_OG_PUBLIC_ID_EN;
  return `${CLOUDINARY_ISAAC}/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${publicId}`;
}

/** Agent headshot on `/final-expense/get-covered` success (square, face-cropped; displayed as rounded-rect in UI). */
export const FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_320,h_320,c_fill,g_face/v1764176212/isaacpic_c8kca5_3_hz35qm.png";

/** vCard for “Save contact” on the get-covered success screen. */
export const FINAL_EXPENSE_GET_COVERED_VCARD_URL =
  "https://res.cloudinary.com/isaacdev/raw/upload/v1777217085/isaac-orraiz_uaubck.vcf";
