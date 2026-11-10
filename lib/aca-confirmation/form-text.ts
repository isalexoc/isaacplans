/**
 * The confirmation the client signs: the single source of its wording. The signing page, the
 * dialog preview, the PDF and the snapshot frozen on every signed row all render from here.
 *
 * ─── Where the wording comes from ───
 *
 * CMS's own "Model Eligibility Application Review Form for Marketplace Agents, Brokers,
 * Web-brokers, and Agencies" (page 3 of the CMS Model Consent Form packet, OMB 0938-1438,
 * July 2025), in English and in CMS's Spanish translation, with the "(pick one…)" placeholders
 * filled in as "agent". Kept verbatim apart from three additions:
 *  - "…and I understand what they mean": CMS's FAQ (Q1) asks for a positive confirmation that the
 *    consumer understands what the attestations indicate;
 *  - the electronic-signature disclosure (E-SIGN Act: intent, paper copy, how to withdraw);
 *  - the line saying who requires the record and that it is kept 10 years.
 *
 * It covers the four elements 45 CFR 155.220(j)(2)(ii)(A)(1) requires: the date reviewed (the
 * signing time, filled in at signing), the consumer's name, the explanation of the attestations,
 * and the assisting agent's name.
 *
 * ─── Versioned, never edited in place ───
 *
 * Every request stores the version it was issued with, and a signed request also stores a snapshot
 * of the exact text. New wording is a NEW entry in FORM_VERSIONS, and CURRENT_FORM_VERSION moves to
 * it; an existing entry is never edited, or a pending link would show text that differs from what
 * the next one signs.
 *
 * From plan year 2028 (enrollments from Aug 1, 2027) CMS requires its own HHS-created form word for
 * word (§155.220(j)(2)(ii)(A)(2)), and a typed signature no longer counts. That form arrives here as
 * a new version with `allowTypedSignature: false`.
 *
 * Isomorphic and dependency-free: the admin dialog renders the preview in the browser.
 */

import type {
  AcaConfirmationFormVars,
  AcaConfirmationLanguage,
  AcaConfirmationRenderedForm,
} from "./types";

export type AcaConfirmationFormDefinition = {
  /** Whether a typed signature is accepted. False for the PY2028 HHS form. */
  allowTypedSignature: boolean;
  /**
   * From this date (YYYY-MM-DD) the dialog warns before sending that this wording only covers
   * plan-year-2027 coverage. Not a block: 2027 special-enrollment work stays valid until year end.
   */
  py2028NoticeFrom?: string;
  render: (language: AcaConfirmationLanguage, vars: AcaConfirmationFormVars) => AcaConfirmationRenderedForm;
};

const CMS_MODEL_2026_11 = "cms-model-2026-11";

function renderCmsModel2026(
  language: AcaConfirmationLanguage,
  vars: AcaConfirmationFormVars
): AcaConfirmationRenderedForm {
  const { consumerName: name, consumerEmail: email, agent, reviewedAt } = vars;

  if (language === "es") {
    return {
      version: CMS_MODEL_2026_11,
      language,
      title: "Confirmación de revisión de la solicitud de elegibilidad del Mercado",
      blocks: [
        {
          kind: "paragraph",
          text:
            `Yo, ${name}, he revisado la información de la solicitud de elegibilidad del Mercado y he ` +
            `confirmado su exactitud antes de que se envíe la solicitud. El agente, ${agent.name} ` +
            `(NPN ${agent.npn}), me explicó las certificaciones al final de la solicitud de elegibilidad ` +
            `antes de que se enviara la solicitud, se me dio la oportunidad de hacer preguntas sobre ellas ` +
            `y entiendo lo que significan.`,
        },
        {
          kind: "paragraph",
          text:
            "Entiendo que el agente no usará ni compartirá mi información de identificación personal (PII) " +
            "para ningún otro propósito que no sea aquellos para los que di mi consentimiento. El agente se " +
            "asegurará de que mi PII se mantenga privada y segura al crear, recopilar, divulgar, acceder, " +
            "mantener, almacenar y usar mi PII para los fines que consintió. Entiendo que no tengo que " +
            "compartir PII adicional o información de salud protegida (PHI) con mi agente más allá de lo que " +
            "se requiere en la solicitud del Mercado para fines de elegibilidad e inscripción.",
        },
        {
          kind: "fields",
          rows: [
            { label: "Fecha en que se revisó la información de la solicitud", value: reviewedAt ?? "Se registra al firmar" },
            { label: "Consumidor o representante autorizado", value: name },
            { label: "Correo electrónico", value: email },
            { label: "Agente que brindó la asistencia", value: agent.name },
            { label: "Número Nacional de Productor (NPN) del agente", value: agent.npn },
            { label: "Teléfono y correo del agente", value: `${agent.phone} · ${agent.email}` },
            { label: "Agencia", value: agent.agency },
          ],
        },
        {
          kind: "fine",
          text:
            `Firma electrónica: acepto firmar esta confirmación electrónicamente y mi firma electrónica tiene ` +
            `el mismo efecto legal que mi firma a mano. Puedo pedirle a mi agente una copia en papel, o retirar ` +
            `mi consentimiento para firmar electrónicamente, en cualquier momento llamando al ${agent.phone} o ` +
            `escribiendo a ${agent.email}.`,
        },
        {
          kind: "fine",
          text:
            "Esta confirmación es un requisito del Departamento de Salud y Servicios Humanos (HHS) y de los " +
            "Centros de Servicios de Medicare y Medicaid (CMS) de los Estados Unidos. El agente la conserva por " +
            "al menos 10 años y la entrega a CMS cuando la solicita.",
        },
      ],
      consent:
        "Revisé la información de mi solicitud, es correcta y acepto firmar esta confirmación electrónicamente.",
    };
  }

  return {
    version: CMS_MODEL_2026_11,
    language,
    title: "Marketplace Eligibility Application Review Confirmation",
    blocks: [
      {
        kind: "paragraph",
        text:
          `I, ${name}, have reviewed the Marketplace eligibility application information and confirmed its ` +
          `accuracy prior to the application being submitted. The agent, ${agent.name} (NPN ${agent.npn}), ` +
          `explained the attestations at the end of the eligibility application to me prior to the ` +
          `application being submitted, I was given an opportunity to ask questions about them, and I ` +
          `understand what they mean.`,
      },
      {
        kind: "paragraph",
        text:
          "I understand that the agent will not use or share my personally identifiable information (PII) for " +
          "any purposes other than those to which I consented. The agent will ensure that my PII is kept " +
          "private and safe when creating, collecting, disclosing, accessing, maintaining, storing, and using " +
          "my PII for the purposes I consented to. I understand that I do not have to share additional PII or " +
          "protected health information (PHI) with my agent beyond what is required on the Marketplace " +
          "application for eligibility and enrollment purposes.",
      },
      {
        kind: "fields",
        rows: [
          { label: "Date the application information was reviewed", value: reviewedAt ?? "Recorded when you sign" },
          { label: "Consumer or authorized representative", value: name },
          { label: "Email", value: email },
          { label: "Assisting agent", value: agent.name },
          { label: "Agent National Producer Number (NPN)", value: agent.npn },
          { label: "Agent phone and email", value: `${agent.phone} · ${agent.email}` },
          { label: "Agency", value: agent.agency },
        ],
      },
      {
        kind: "fine",
        text:
          `Electronic signature: I agree to sign this confirmation electronically, and my electronic signature ` +
          `has the same legal effect as my handwritten signature. I may ask my agent for a paper copy, or ` +
          `withdraw my consent to sign electronically, at any time by calling ${agent.phone} or writing to ` +
          `${agent.email}.`,
      },
      {
        kind: "fine",
        text:
          "This confirmation is required by the U.S. Department of Health and Human Services (HHS) and the " +
          "Centers for Medicare & Medicaid Services (CMS). The agent keeps it for at least 10 years and " +
          "provides it to CMS upon request.",
      },
    ],
    consent: "I reviewed my application information, it is accurate, and I agree to sign this confirmation electronically.",
  };
}

const FORM_VERSIONS: Record<string, AcaConfirmationFormDefinition> = {
  // The plan-year-2028 pre-enrollment period starts Aug 1, 2027 (91 FR 29591).
  [CMS_MODEL_2026_11]: { allowTypedSignature: true, py2028NoticeFrom: "2027-08-01", render: renderCmsModel2026 },
};

/** The version every new request is issued with. */
export const CURRENT_FORM_VERSION = CMS_MODEL_2026_11;

export function getFormDefinition(version: string): AcaConfirmationFormDefinition | null {
  return FORM_VERSIONS[version] ?? null;
}

/** Render one language of a form version. Throws on an unknown version: that is a code bug. */
export function renderConfirmationForm(
  version: string,
  language: AcaConfirmationLanguage,
  vars: AcaConfirmationFormVars
): AcaConfirmationRenderedForm {
  const def = getFormDefinition(version);
  if (!def) throw new Error(`Unknown ACA confirmation form version: ${version}`);
  return def.render(language, vars);
}

/** Both languages, for the signing page's EN/ES toggle. */
export function renderConfirmationFormBoth(
  version: string,
  vars: AcaConfirmationFormVars
): Record<AcaConfirmationLanguage, AcaConfirmationRenderedForm> {
  return { en: renderConfirmationForm(version, "en", vars), es: renderConfirmationForm(version, "es", vars) };
}
