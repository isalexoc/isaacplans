import type { IntakeLobConfig } from "@/lib/intake-core/types";
import { ancillarySections } from "./_shared";

/**
 * Short Term Medical. Medically underwritten, so tobacco use is asked; otherwise the standard
 * ancillary question set.
 */
export const shortTermMedicalIntake: IntakeLobConfig = {
  lob: "short-term-medical",
  label: "Short Term Medical",
  formTitle: {
    en: "Short Term Medical Application",
    es: "Solicitud de cobertura a corto plazo",
  },
  slugPrefix: "stm",
  cookieName: "stm_intake_device",
  ownerEnvVar: "STM_DEFAULT_OWNER_USER_ID",
  intakeSlug: { en: "short-term-medical/intake", es: "cobertura-a-corto-plazo/admision" },
  sections: ancillarySections("stm", {
    includeTobacco: true,
    coverageTitleEn: "Coverage you need",
    coverageTitleEs: "Cobertura que necesita",
  }),
};
