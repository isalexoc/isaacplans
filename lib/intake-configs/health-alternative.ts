import type { IntakeField, IntakeLobConfig, IntakeOption, IntakeSection, RepeaterRow } from "@/lib/intake-core/types";
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import { ancillarySections } from "./_shared";
import {
  IMPACT_LAST_PAYMENT_DAY,
  PAYMENT_DAY_OPTIONS,
  impactPaymentDayNote,
  isImpactPaymentDayValid,
} from "./impact-schedule";

/**
 * Health Coverage Alternative, which in practice means **Impact Health Sharing enrollments**.
 *
 * Built on the shared ancillary question set, then reshaped for what Impact's enrollment asks:
 *  - height and weight for every member, plus email and phone for every added person;
 *  - an SSN **or an ITIN**, required for the applicant. This line exists for people ACA doesn't
 *    serve, so a Social Security number alone would turn away the exact prospect it is for;
 *    the ITIN keeps the door open. Added people may have neither (a newborn, say);
 *  - a valid, unexpired photo ID (type, number, issuing state, issue and expiration dates) for
 *    the applicant only. Impact confirmed no other member needs one;
 *  - a start date that can only be the 1st of a month, and a payment day from 1 to 28, checked
 *    against each other (see impact-schedule.ts);
 *  - the one-time $79 enrollment fee, stated before the client gives payment details.
 *
 * The new applicant answers are not CRM fields. Isaac keeps Impact data out of new GHL custom
 * fields, and he reads these from the client summary when he enrolls. An added person's answers
 * ride along in the existing `ha_dependent_N` text fields.
 */

const ID_TYPE_OPTIONS: IntakeOption[] = [
  { value: "SSN", labelEn: "Social Security (SSN)", labelEs: "Seguro Social (SSN)" },
  { value: "ITIN", labelEn: "ITIN", labelEs: "ITIN" },
];

const ID_TYPE_OR_NONE: IntakeOption[] = [
  ...ID_TYPE_OPTIONS,
  { value: "None", labelEn: "Doesn't have one", labelEs: "No tiene" },
];

const HAS_ID_NUMBER = ["SSN", "ITIN"];

// ── Photo ID: Impact needs a valid, unexpired one for the applicant (no other member) ──

const PHOTO_ID_OPTIONS: IntakeOption[] = [
  { value: "Driver's license", labelEn: "Driver's license", labelEs: "Licencia de conducir" },
  { value: "State ID", labelEn: "State ID", labelEs: "Identificación estatal (State ID)" },
  { value: "Passport", labelEn: "Passport", labelEs: "Pasaporte" },
  { value: "Permanent resident card", labelEn: "Permanent resident card (green card)", labelEs: "Tarjeta de residente permanente (green card)" },
  { value: "Military ID", labelEn: "Military ID", labelEs: "Identificación militar" },
];

/**
 * Only state-issued IDs have an issuing state. A passport, a green card and a military ID are
 * federal (or foreign) documents, so asking which state issued them has no right answer.
 */
const STATE_ISSUED_IDS = ["Driver's license", "State ID"];

const ID_STATE_OPTIONS: IntakeOption[] = [...US_STATE_OPTIONS, { code: "PR", name: "Puerto Rico" }]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(({ code, name }) => ({ value: code, labelEn: name, labelEs: name }));

/** The applicant's five ID questions. */
const PHOTO_ID_FIELDS: IntakeField[] = [
  {
    key: "idDocType",
    labelEn: "Type of ID",
    labelEs: "Tipo de identificación",
    type: "select",
    required: true,
    options: PHOTO_ID_OPTIONS,
  },
  {
    key: "idDocNumber",
    labelEn: "ID number",
    labelEs: "Número de identificación",
    type: "text",
    required: true,
    sensitive: true,
    maxLength: 25,
  },
  {
    key: "idDocState",
    labelEn: "State where it was issued",
    labelEs: "Estado que la emitió",
    type: "select",
    required: true,
    options: ID_STATE_OPTIONS,
    showIf: { field: "idDocType", equals: STATE_ISSUED_IDS },
  },
  {
    key: "idDocIssueDate",
    labelEn: "Issue date",
    labelEs: "Fecha de emisión",
    type: "dateParts",
    required: true,
    yearsBack: 40,
    dateRule: "past",
  },
  {
    key: "idDocExpiration",
    labelEn: "Expiration date",
    labelEs: "Fecha de vencimiento",
    type: "dateParts",
    required: true,
    yearsBack: 2,
    yearsAhead: 20,
    dateRule: "notExpired",
  },
];

const heightField: IntakeField = { key: "height", labelEn: "Height", labelEs: "Estatura", type: "height", required: true };

const weightField: IntakeField = {
  key: "weight",
  labelEn: "Weight (lbs)",
  labelEs: "Peso (libras)",
  type: "number",
  required: true,
  digitsOnly: true,
  maxLength: 3,
  placeholderEn: "e.g. 160",
  placeholderEs: "ej. 160",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** One added person on one CRM line: everything Impact asks, so the contact record is complete. */
function formatMemberRow(row: RepeaterRow, index: number): string {
  const parts: string[] = [];
  const name = [str(row.firstName), str(row.lastName)].filter(Boolean).join(" ");
  if (name) parts.push(name);
  if (str(row.relationship)) parts.push(str(row.relationship));
  if (str(row.dateOfBirth)) parts.push(`DOB ${str(row.dateOfBirth)}`);
  if (str(row.sex)) parts.push(str(row.sex));
  if (str(row.height)) parts.push(str(row.height));
  if (str(row.weight)) parts.push(`${str(row.weight)} lbs`);
  if (str(row.email)) parts.push(str(row.email));
  if (str(row.phone)) parts.push(str(row.phone));
  const idType = str(row.idType);
  if (HAS_ID_NUMBER.includes(idType) && str(row.ssn)) parts.push(`${idType} ${str(row.ssn)}`);
  else if (idType === "None") parts.push("No SSN/ITIN");
  return parts.length ? `${index + 1}. ${parts.join(", ")}` : "";
}

/** Applicant: SSN-or-ITIN instead of SSN-only, height + weight after sex, no second phone. */
function personal(section: IntakeSection): IntakeSection {
  return {
    ...section,
    fields: section.fields.flatMap((field): IntakeField[] => {
      if (field.key === "altPhone") return [];
      if (field.key === "sex") return [field, { ...heightField }, { ...weightField }];
      if (field.key !== "ssn") return [field];
      return [
        {
          key: "taxIdType",
          labelEn: "Which number will you use?",
          labelEs: "¿Qué número va a usar?",
          type: "select",
          required: true,
          options: ID_TYPE_OPTIONS,
          helpEn: "Impact needs one of the two. No Social Security number? Your ITIN works.",
          helpEs: "Impact necesita uno de los dos. ¿No tiene número de Seguro Social? Su ITIN sirve.",
        },
        {
          ...field,
          labelEn: "SSN or ITIN number",
          labelEs: "Número de SSN o ITIN",
          required: true,
          showIf: { field: "taxIdType", equals: HAS_ID_NUMBER },
          helpEn: "Encrypted, and never shown back to you in full.",
          helpEs: "Se guarda encriptado y nunca se le muestra completo.",
        },
      ];
    }),
  };
}

/** Added people: Impact asks the same of every member as of the applicant. */
function dependents(section: IntakeSection): IntakeSection {
  return {
    ...section,
    fields: section.fields.map((field) => {
      if (field.type !== "repeater") return field;
      const base = (field.rowFields ?? []).filter((f) => !["hasSsn", "ssn", "noSsnReason"].includes(f.key));
      const sharedSsn = (field.rowFields ?? []).find((f) => f.key === "ssn");
      const rowFields: IntakeField[] = [
        ...base,
        { ...heightField },
        { ...weightField },
        {
          key: "email",
          labelEn: "Email",
          labelEs: "Correo electrónico",
          type: "email",
          required: true,
          helpEn: "For a child, use a parent's email and phone.",
          helpEs: "Para un niño, use el correo y el teléfono de uno de los padres.",
        },
        { key: "phone", labelEn: "Phone", labelEs: "Teléfono", type: "tel", required: true },
        {
          key: "idType",
          labelEn: "Which number do they have?",
          labelEs: "¿Qué número tiene?",
          type: "select",
          required: true,
          options: ID_TYPE_OR_NONE,
        },
        {
          ...(sharedSsn as IntakeField),
          labelEn: "SSN or ITIN number",
          labelEs: "Número de SSN o ITIN",
          required: true,
          showIf: { field: "idType", equals: HAS_ID_NUMBER },
        },
      ];
      return { ...field, rowFields, rowFormat: formatMemberRow };
    }),
  };
}

/**
 * Start date as a 1st of the month, followed by the payment day it depends on. "Do you have
 * coverage right now?" (and the carrier question it opens) is dropped: Isaac doesn't use it.
 */
function coverage(section: IntakeSection): IntakeSection {
  return {
    ...section,
    fields: section.fields.flatMap((field): IntakeField[] => {
      if (field.key === "currentlyInsured" || field.key === "currentCarrier") return [];
      if (field.key !== "requestedEffectiveDate") return [field];
      return [
        {
          ...field,
          type: "monthStart",
          monthCount: 6,
          monthCutoffDay: IMPACT_LAST_PAYMENT_DAY,
          helpEn: "Impact plans always start on the 1st of the month.",
          helpEs: "Los planes de Impact siempre empiezan el día 1 del mes.",
        },
        {
          key: "paymentDay",
          labelEn: "What day of the month would you like to make your payment?",
          labelEs: "¿Qué día del mes desea hacer su pago?",
          type: "select",
          required: true,
          options: PAYMENT_DAY_OPTIONS,
          helpEn: "Any day from the 1st to the 28th. Your payment repeats on that day every month.",
          helpEs: "Cualquier día del 1 al 28. Su pago se repite ese día cada mes.",
          isValid: isImpactPaymentDayValid,
          liveNote: impactPaymentDayNote,
        },
      ];
    }),
  };
}

/**
 * The shared "Documents" step becomes the applicant's photo ID, typed in. Its two uploads (photo of
 * the ID, current insurance card) are dropped: Isaac doesn't need them.
 */
function documents(section: IntakeSection): IntakeSection {
  return {
    ...section,
    titleEn: "Your ID",
    titleEs: "Su identificación",
    descriptionEn: "Impact needs a valid ID that hasn't expired.",
    descriptionEs: "Impact necesita una identificación válida y vigente.",
    fields: PHOTO_ID_FIELDS.map((field) => ({ ...field })),
  };
}

/** The $79 fee, said up front on the step where they give payment details. */
function payment(section: IntakeSection): IntakeSection {
  return {
    ...section,
    callout: {
      tone: "info",
      titleEn: "One-time $79 enrollment fee",
      titleEs: "Cargo único de inscripción de $79",
      bodyEn:
        "New Impact members pay a one-time $79 enrollment fee on top of the monthly payment. It's paid once per family, " +
        "not per person, and never again, even if you add family members later.",
      bodyEs:
        "Los miembros nuevos de Impact pagan un cargo único de inscripción de $79, además del pago mensual. Se paga una " +
        "sola vez por familia, no por persona, y nunca más, aunque agregue familiares después.",
    },
  };
}

const RESHAPE: Record<string, (section: IntakeSection) => IntakeSection> = {
  personal,
  dependents,
  coverage,
  documents,
  payment,
};

const sections = ancillarySections("ha", {
  includeTobacco: true,
  coverageTitleEn: "Coverage you need",
  coverageTitleEs: "Cobertura que necesita",
}).map((section) => RESHAPE[section.key]?.(section) ?? section);

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
  impactEnrollment: true,
  impactPresentation: true,
  brandLogo: {
    src: "/images/impact/impact-health-sharing-logo.png",
    alt: "Impact Health Sharing",
    width: 242,
    height: 68,
  },
};
