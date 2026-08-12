import type { IntakeField, IntakeLobConfig, IntakeSection } from "@/lib/intake-core/types";
import {
  YES_NO,
  agentSection,
  custom,
  documentsSection,
  paymentSection,
  personalSection,
  residenceSection,
} from "./_shared";

/**
 * Life Insurance.
 *
 * The only one of the five that is genuinely a different application: carriers underwrite on
 * health and lifestyle, the applicant chooses a face amount rather than a "who's covered" tier,
 * and beneficiaries have to be named with percentages that add up. So it reuses the applicant,
 * address, documents, payment and agent-notes blocks and replaces the coverage/dependents steps.
 */

const P = "life";

const COVERAGE_SECTION: IntakeSection = {
  key: "coverage",
  titleEn: "Coverage you want",
  titleEs: "Cobertura que desea",
  descriptionEn: "A rough number is fine — we'll refine it together.",
  descriptionEs: "Un número aproximado está bien — lo ajustamos juntos.",
  fields: [
    {
      key: "coverageAmount", labelEn: "How much coverage?", labelEs: "¿Cuánta cobertura?", type: "money", required: true,
      crm: custom(`${P}_coverage_amount`), crmLabel: "Coverage amount",
      placeholderEn: "e.g. 250,000", placeholderEs: "ej. 250,000",
    },
    {
      key: "productType", labelEn: "What kind of policy?", labelEs: "¿Qué tipo de póliza?", type: "select", required: true,
      crm: custom(`${P}_product_type`), crmLabel: "Product type",
      options: [
        { value: "Term", labelEn: "Term — lowest cost, covers a set number of years", labelEs: "Término — el costo más bajo, cubre cierta cantidad de años" },
        { value: "Whole life", labelEn: "Whole life — permanent, builds cash value", labelEs: "Vida entera — permanente, acumula valor en efectivo" },
        { value: "IUL", labelEn: "Indexed universal life (IUL)", labelEs: "Vida universal indexada (IUL)" },
        { value: "Final expense", labelEn: "Final expense — burial and funeral costs", labelEs: "Gastos finales — costos de entierro y funeral" },
        { value: "Not sure", labelEn: "I'm not sure — help me decide", labelEs: "No estoy seguro(a) — ayúdenme a decidir" },
      ],
    },
    {
      key: "termLength", labelEn: "How many years?", labelEs: "¿Cuántos años?", type: "select",
      showIf: { field: "productType", equals: "Term" }, crm: custom(`${P}_term_length`), crmLabel: "Term length",
      options: [
        { value: "10 years", labelEn: "10 years", labelEs: "10 años" },
        { value: "15 years", labelEn: "15 years", labelEs: "15 años" },
        { value: "20 years", labelEn: "20 years", labelEs: "20 años" },
        { value: "30 years", labelEn: "30 years", labelEs: "30 años" },
      ],
    },
    {
      key: "requestedEffectiveDate", labelEn: "When would you like it to start?", labelEs: "¿Cuándo desea que comience?",
      type: "date", required: true, crm: custom(`${P}_effective_date`), crmLabel: "Requested effective date",
    },
    {
      key: "coveragePurpose", labelEn: "What is this coverage for?", labelEs: "¿Para qué es esta cobertura?", type: "textarea",
      crm: custom(`${P}_coverage_purpose`), crmLabel: "Coverage purpose",
      placeholderEn: "e.g. replace my income, pay off the mortgage, cover my funeral",
      placeholderEs: "ej. reemplazar mis ingresos, pagar la hipoteca, cubrir mi funeral",
    },
  ],
};

const MEDICATION_FIELDS: IntakeField[] = [
  { key: "drugName", labelEn: "Medication name", labelEs: "Nombre del medicamento", type: "text", required: true },
  { key: "dosage", labelEn: "Dosage", labelEs: "Dosis", type: "text", placeholderEn: "e.g. 500 mg", placeholderEs: "ej. 500 mg" },
  { key: "reason", labelEn: "What is it for?", labelEs: "¿Para qué es?", type: "text" },
];

const HEALTH_SECTION: IntakeSection = {
  key: "health",
  titleEn: "Health & lifestyle",
  titleEs: "Salud y estilo de vida",
  descriptionEn: "Carriers ask these to set your rate. Answer honestly — a surprise at underwriting costs more time than a Yes here.",
  descriptionEs: "Las aseguradoras preguntan esto para fijar su tarifa. Responda con sinceridad — una sorpresa durante la evaluación cuesta más tiempo que un Sí aquí.",
  fields: [
    { key: "heightFeet", labelEn: "Height (feet)", labelEs: "Estatura (pies)", type: "number", required: true, maxLength: 1, crm: custom(`${P}_height_feet`), crmLabel: "Height (feet)" },
    { key: "heightInches", labelEn: "Height (inches)", labelEs: "Estatura (pulgadas)", type: "number", required: true, maxLength: 2, crm: custom(`${P}_height_inches`), crmLabel: "Height (inches)" },
    { key: "weightLbs", labelEn: "Weight (lbs)", labelEs: "Peso (libras)", type: "number", required: true, maxLength: 3, crm: custom(`${P}_weight_lbs`), crmLabel: "Weight (lbs)" },
    {
      key: "tobaccoUse", labelEn: "Have you used tobacco or nicotine in the last 12 months?",
      labelEs: "¿Ha usado tabaco o nicotina en los últimos 12 meses?",
      type: "select", required: true, options: YES_NO, crm: custom(`${P}_tobacco`), crmLabel: "Tobacco use",
    },
    {
      key: "tobaccoDetail", labelEn: "What kind, and how often?", labelEs: "¿Qué tipo y con qué frecuencia?", type: "text",
      showIf: { field: "tobaccoUse", equals: "yes" }, crm: custom(`${P}_tobacco_detail`), crmLabel: "Tobacco detail",
      placeholderEn: "e.g. cigarettes, half a pack a day", placeholderEs: "ej. cigarrillos, medio paquete al día",
    },
    {
      key: "majorConditions", labelEn: "Any diagnosed medical conditions?", labelEs: "¿Alguna condición médica diagnosticada?",
      type: "textarea", crm: custom(`${P}_major_conditions`), crmLabel: "Major conditions",
      helpEn: "Heart disease, cancer, diabetes, stroke, COPD and similar. Leave blank if none.",
      helpEs: "Enfermedad cardíaca, cáncer, diabetes, derrame, EPOC y similares. Deje en blanco si no tiene.",
    },
    {
      key: "takesMedications", labelEn: "Do you take any prescription medications?", labelEs: "¿Toma algún medicamento recetado?",
      type: "select", required: true, options: YES_NO, crm: custom(`${P}_takes_medications`), crmLabel: "Takes medications",
    },
    {
      key: "medications", labelEn: "Your medications", labelEs: "Sus medicamentos", type: "repeater",
      minRows: 1, maxRows: 10, showIf: { field: "takesMedications", equals: "yes" },
      rowLabelEn: "Medication", rowLabelEs: "Medicamento",
      rowFields: MEDICATION_FIELDS,
      crm: custom(`${P}_medications_list`),
    },
    {
      key: "hospitalizedLast2Years", labelEn: "Hospitalized in the last 2 years?", labelEs: "¿Hospitalizado en los últimos 2 años?",
      type: "select", required: true, options: YES_NO, crm: custom(`${P}_hospitalized_2y`), crmLabel: "Hospitalized last 2 years",
    },
    {
      key: "hazardousActivity", labelEn: "Any hazardous job or hobby?", labelEs: "¿Trabajo o pasatiempo peligroso?",
      type: "select", required: true, options: YES_NO, crm: custom(`${P}_hazardous_activity`), crmLabel: "Hazardous occupation or hobby",
      helpEn: "Aviation, scuba diving, racing, roofing, and the like.",
      helpEs: "Aviación, buceo, carreras, techado y similares.",
    },
    {
      key: "hazardousDetail", labelEn: "Tell us about it", labelEs: "Cuéntenos", type: "text",
      showIf: { field: "hazardousActivity", equals: "yes" }, crm: custom(`${P}_hazardous_detail`), crmLabel: "Hazardous detail",
    },
    {
      key: "drivingViolations", labelEn: "DUI or major driving violation in the last 5 years?",
      labelEs: "¿DUI o infracción de tránsito grave en los últimos 5 años?",
      type: "select", required: true, options: YES_NO, crm: custom(`${P}_driving_violations`), crmLabel: "Driving violations",
    },
  ],
};

const BENEFICIARY_FIELDS: IntakeField[] = [
  { key: "fullName", labelEn: "Full name", labelEs: "Nombre completo", type: "text", required: true },
  {
    key: "relationship", labelEn: "Relationship to you", labelEs: "Parentesco con usted", type: "select", required: true,
    options: [
      { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
      { value: "Child", labelEn: "Child", labelEs: "Hijo(a)" },
      { value: "Parent", labelEn: "Parent", labelEs: "Padre o madre" },
      { value: "Sibling", labelEn: "Sibling", labelEs: "Hermano(a)" },
      { value: "Trust or estate", labelEn: "Trust or estate", labelEs: "Fideicomiso o patrimonio" },
      { value: "Other", labelEn: "Other", labelEs: "Otro" },
    ],
  },
  { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob" },
  {
    key: "percentage", labelEn: "Percentage", labelEs: "Porcentaje", type: "number", required: true, maxLength: 3,
    helpEn: "All primary beneficiaries must add up to 100%.",
    helpEs: "Todos los beneficiarios primarios deben sumar 100%.",
  },
  {
    key: "tier", labelEn: "Primary or contingent?", labelEs: "¿Primario o contingente?", type: "select", required: true,
    options: [
      { value: "Primary", labelEn: "Primary", labelEs: "Primario" },
      { value: "Contingent", labelEn: "Contingent (backup)", labelEs: "Contingente (de respaldo)" },
    ],
  },
];

const BENEFICIARIES_SECTION: IntakeSection = {
  key: "beneficiaries",
  titleEn: "Beneficiaries",
  titleEs: "Beneficiarios",
  descriptionEn: "Who receives the money. You can change this any time after the policy is issued.",
  descriptionEs: "Quién recibe el dinero. Puede cambiarlo en cualquier momento después de emitida la póliza.",
  fields: [
    {
      key: "beneficiaries", labelEn: "Your beneficiaries", labelEs: "Sus beneficiarios", type: "repeater",
      minRows: 1, maxRows: 4,
      rowLabelEn: "Beneficiary", rowLabelEs: "Beneficiario",
      rowFields: BENEFICIARY_FIELDS,
      crmSlots: [`${P}_beneficiary_1`, `${P}_beneficiary_2`, `${P}_beneficiary_3`, `${P}_beneficiary_4`],
      rowFormat: (row, index) => {
        const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        const parts = [s(row.fullName), s(row.relationship)].filter(Boolean);
        if (s(row.percentage)) parts.push(`${s(row.percentage)}%`);
        if (s(row.tier)) parts.push(s(row.tier));
        if (s(row.dateOfBirth)) parts.push(`DOB ${s(row.dateOfBirth)}`);
        return parts.length ? `${index + 1}. ${parts.join(", ")}` : "";
      },
    },
  ],
};

export const lifeInsuranceIntake: IntakeLobConfig = {
  lob: "life-insurance",
  label: "Life Insurance",
  formTitle: {
    en: "Life Insurance Application",
    es: "Solicitud de seguro de vida",
  },
  slugPrefix: P,
  cookieName: "life_intake_device",
  ownerEnvVar: "LIFE_INSURANCE_DEFAULT_OWNER_USER_ID",
  intakeSlug: { en: "life-insurance/intake", es: "seguro-de-vida/admision" },
  sections: [
    personalSection(P),
    residenceSection(P),
    COVERAGE_SECTION,
    HEALTH_SECTION,
    BENEFICIARIES_SECTION,
    documentsSection(P),
    paymentSection(P),
    agentSection(P),
  ],
};
