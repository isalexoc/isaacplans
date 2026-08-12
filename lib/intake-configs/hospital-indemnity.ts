import type { IntakeLobConfig } from "@/lib/intake-core/types";
import { ancillarySections } from "./_shared";

/**
 * Hospital Indemnity. Benefit amounts are set with the agent after review, so the intake collects
 * the applicant and payment details rather than a requested benefit level.
 */
export const hospitalIndemnityIntake: IntakeLobConfig = {
  lob: "hospital-indemnity",
  label: "Hospital Indemnity",
  formTitle: {
    en: "Hospital Indemnity Application",
    es: "Solicitud de indemnización hospitalaria",
  },
  slugPrefix: "hi",
  cookieName: "hi_intake_device",
  ownerEnvVar: "HOSPITAL_INDEMNITY_DEFAULT_OWNER_USER_ID",
  intakeSlug: { en: "hospital-indemnity/intake", es: "indemnizacion-hospitalaria/admision" },
  sections: ancillarySections("hi", {
    includeTobacco: true,
    coverageTitleEn: "Coverage you need",
    coverageTitleEs: "Cobertura que necesita",
  }),
};
