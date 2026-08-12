import type { IntakeLobConfig } from "@/lib/intake-core/types";
import { ancillarySections } from "./_shared";

/**
 * Health Coverage Alternative.
 *
 * The whole point of this line is that it works for people ACA does not: no immigration status
 * requirement and no Social Security number requirement. So the standard ancillary SSN question —
 * required, with no way out — would contradict the promise on the landing page and stop the exact
 * prospect this product exists for. Here it is optional, with a reason captured instead.
 */
const sections = ancillarySections("ha", {
  includeTobacco: true,
  coverageTitleEn: "Coverage you need",
  coverageTitleEs: "Cobertura que necesita",
}).map((section) => {
  if (section.key !== "personal") return section;
  return {
    ...section,
    fields: section.fields.flatMap((field) => {
      if (field.key !== "ssn") return [field];
      return [
        {
          key: "hasSsn",
          labelEn: "Do you have a Social Security number?",
          labelEs: "¿Tiene número de seguro social?",
          type: "select" as const,
          required: true,
          options: [
            { value: "yes", labelEn: "Yes", labelEs: "Sí" },
            { value: "no", labelEn: "No", labelEs: "No" },
          ],
          crm: { kind: "custom" as const, slug: "ha_has_ssn" },
          crmLabel: "Has SSN",
          helpEn: "Answering No is fine — these plans do not require one.",
          helpEs: "Responder No está bien — estos planes no lo requieren.",
        },
        { ...field, required: false, showIf: { field: "hasSsn", equals: "yes" } },
      ];
    }),
  };
});

export const healthAlternativeIntake: IntakeLobConfig = {
  lob: "health-alternative",
  label: "Health Coverage Alternative",
  formTitle: {
    en: "Health Coverage Application",
    es: "Solicitud de cobertura de salud",
  },
  slugPrefix: "ha",
  cookieName: "ha_intake_device",
  ownerEnvVar: "HEALTH_ALTERNATIVE_DEFAULT_OWNER_USER_ID",
  intakeSlug: { en: "health-alternative/intake", es: "alternativa-de-salud/admision" },
  sections,
};
