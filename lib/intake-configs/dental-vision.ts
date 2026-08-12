import type { IntakeLobConfig } from "@/lib/intake-core/types";
import { ancillarySections } from "./_shared";

/**
 * Dental & Vision. Guaranteed-issue in practice, so no tobacco or health questions — just who is
 * being covered and when it starts.
 */
export const dentalVisionIntake: IntakeLobConfig = {
  lob: "dental-vision",
  label: "Dental & Vision",
  formTitle: {
    en: "Dental & Vision Application",
    es: "Solicitud dental y de visión",
  },
  slugPrefix: "dv",
  cookieName: "dv_intake_device",
  ownerEnvVar: "DENTAL_VISION_DEFAULT_OWNER_USER_ID",
  intakeSlug: { en: "dental-vision/intake", es: "dental-vision/admision" },
  sections: ancillarySections("dv", {
    coverageTitleEn: "Coverage you need",
    coverageTitleEs: "Cobertura que necesita",
  }),
};
