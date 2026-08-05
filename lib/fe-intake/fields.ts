/**
 * Final Expense intake — single source of truth for the client-facing wizard.
 *
 * Drives: the one-question-per-screen form UI, completion validation
 * (lib/fe-intake/schema.ts), CRM mapping on completion (app/api/fe-intake/[token]/complete),
 * and the agent's read-only client-view summary.
 *
 * There is no owner-only section — the form describes "the Insured" (the person getting
 * covered); `relationship` records how the person filling it out relates to them, defaulting
 * to "Self".
 *
 * Field values are stored in the session `data` jsonb keyed by `field.key`. Fields flagged
 * `sensitive` are encrypted at rest. CRM targets are either GHL native contact fields or a
 * custom field referenced by slug (see lib/fe-intake/ghl-field-ids.ts).
 */

import type { FeFieldSlug } from "./ghl-field-ids";

export type NativeContactField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "dateOfBirth"
  | "address1"
  | "city"
  | "state"
  | "postalCode";

export type CrmTarget =
  | { kind: "native"; field: NativeContactField }
  | { kind: "custom"; slug: FeFieldSlug };

export type FeFieldType =
  | "text"
  | "email"
  | "tel"
  | "dob"
  | "height"
  | "zip"
  | "select"
  | "ssn"
  | "address"
  | "drug"
  | "repeater";

export type FeOption = {
  value: string;
  labelEn: string;
  labelEs: string;
};

/** Where an `address` field writes the resolved city/state/zip from autocomplete. */
export type AddressTargets = {
  city?: string;
  state?: string;
  zip?: string;
};

export type FeField = {
  key: string;
  labelEn: string;
  labelEs: string;
  type: FeFieldType;
  required?: boolean;
  sensitive?: boolean;
  /** Restrict input to digits only (kept as a string to preserve leading zeros). */
  digitsOnly?: boolean;
  /** Maximum number of characters accepted. */
  maxLength?: number;
  /** For `address` fields: sibling field keys to populate from autocomplete, folded onto the
   * same screen as the address search input (shown once resolved) rather than asked separately. */
  addressTargets?: AddressTargets;
  /** Where this value is written in the CRM. Omit for DB-only fields. */
  crm?: CrmTarget;
  /** Name to give this field in the CRM when `labelEn` would make a poor one (a question). */
  crmLabel?: string;
  options?: FeOption[];
  placeholderEn?: string;
  placeholderEs?: string;
  /**
   * Show this field only when another field equals one of these values. Inside a `repeater`
   * the referenced field is resolved against the ROW, not the top-level form data.
   */
  showIf?: { field: string; equals: string | string[] };
  /** Hint rendered under the question. */
  helpEn?: string;
  helpEs?: string;
  /** Shown instead of advancing when the answer is "no" — e.g. the no-SSN standard-plan note. */
  noteEn?: string;
  noteEs?: string;
  // ── `repeater` only ──
  rowFields?: FeField[];
  minRows?: number;
  maxRows?: number;
  rowLabelEn?: string;
  rowLabelEs?: string;
};

export type FeSection = {
  key: string;
  titleEn: string;
  titleEs: string;
  fields: FeField[];
};

const native = (field: NativeContactField): CrmTarget => ({ kind: "native", field });
const custom = (slug: FeFieldSlug): CrmTarget => ({ kind: "custom", slug });

const YES_NO: FeOption[] = [
  { value: "yes", labelEn: "Yes", labelEs: "Sí" },
  { value: "no", labelEn: "No", labelEs: "No" },
];

const GENDER_OPTIONS: FeOption[] = [
  { value: "Male", labelEn: "Male", labelEs: "Masculino" },
  { value: "Female", labelEn: "Female", labelEs: "Femenino" },
];

const RELATIONSHIP_OPTIONS: FeOption[] = [
  { value: "Self", labelEn: "Self", labelEs: "Yo mismo(a)" },
  { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
  { value: "Son", labelEn: "Son", labelEs: "Hijo" },
  { value: "Daughter", labelEn: "Daughter", labelEs: "Hija" },
  { value: "Parent", labelEn: "Parent", labelEs: "Padre o madre" },
  { value: "Grandchild", labelEn: "Grandchild", labelEs: "Nieto(a)" },
  { value: "Other", labelEn: "Other", labelEs: "Otro" },
];

const BENEFICIARY_RELATIONSHIP_OPTIONS: FeOption[] = [
  { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
  { value: "Son", labelEn: "Son", labelEs: "Hijo" },
  { value: "Daughter", labelEn: "Daughter", labelEs: "Hija" },
  { value: "Parent", labelEn: "Parent", labelEs: "Padre o madre" },
  { value: "Sibling", labelEn: "Sibling", labelEs: "Hermano(a)" },
  { value: "Grandchild", labelEn: "Grandchild", labelEs: "Nieto(a)" },
  { value: "Other", labelEn: "Other", labelEs: "Otro" },
];

/** Curated underwriting-relevant condition categories — no external "usage" API dependency. */
export const USAGE_OPTIONS: FeOption[] = [
  { value: "Cholesterol", labelEn: "Cholesterol", labelEs: "Colesterol" },
  { value: "Diabetes", labelEn: "Diabetes", labelEs: "Diabetes" },
  { value: "Blood Pressure", labelEn: "Blood pressure", labelEs: "Presión arterial" },
  { value: "Heart Disease", labelEn: "Heart disease", labelEs: "Enfermedad del corazón" },
  { value: "Depression/Anxiety", labelEn: "Depression / anxiety", labelEs: "Depresión / ansiedad" },
  { value: "Thyroid", labelEn: "Thyroid", labelEs: "Tiroides" },
  { value: "Pain/Arthritis", labelEn: "Pain / arthritis", labelEs: "Dolor / artritis" },
  { value: "Other", labelEn: "Other", labelEs: "Otro" },
];

/**
 * `{drug}` is replaced at render time with the row's own `drugName` value (see
 * lib/fe-intake/ui-strings.ts::applyDrugToken) — "What is Lisinopril for?" instead of a
 * generic "What is it for?", since by this point in the row the drug name is already known.
 */
const MEDICATION_FIELDS: FeField[] = [
  {
    key: "drugName", labelEn: "What medication is it?", labelEs: "¿Qué medicamento es?", type: "drug", required: true,
    placeholderEn: "Start typing a medication name…", placeholderEs: "Empiece a escribir el nombre…",
  },
  {
    key: "usage", labelEn: "What is {drug} for?", labelEs: "¿Para qué es {drug}?", type: "select", required: true,
    options: USAGE_OPTIONS,
  },
  {
    key: "usageOther", labelEn: "What condition is {drug} for?", labelEs: "¿Para qué condición es {drug}?", type: "text",
    required: true, showIf: { field: "usage", equals: "Other" },
  },
];

const BENEFICIARY_FIELDS: FeField[] = [
  { key: "firstName", labelEn: "Beneficiary's first name", labelEs: "Primer nombre del beneficiario", type: "text", required: true },
  { key: "lastName", labelEn: "Beneficiary's last name", labelEs: "Apellido del beneficiario", type: "text", required: true },
  {
    key: "relationship", labelEn: "Relationship to the Insured", labelEs: "Relación con el asegurado",
    type: "select", required: true, options: BENEFICIARY_RELATIONSHIP_OPTIONS,
  },
];

export const FE_SECTIONS: FeSection[] = [
  {
    key: "about",
    titleEn: "About the Insured",
    titleEs: "Sobre el asegurado",
    fields: [
      { key: "firstName", labelEn: "First name", labelEs: "Primer nombre", type: "text", required: true, crm: native("firstName") },
      { key: "lastName", labelEn: "Last name", labelEs: "Apellido", type: "text", required: true, crm: native("lastName") },
      {
        key: "email", labelEn: "Email", labelEs: "Correo electrónico", type: "email", crm: native("email"),
        helpEn: "Optional — we'll use the email on your account if you skip this.",
        helpEs: "Opcional — usaremos el correo de su cuenta si omite esto.",
      },
      { key: "phone", labelEn: "Phone number", labelEs: "Número de teléfono", type: "tel", required: true, crm: native("phone") },
      { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true, crm: native("dateOfBirth") },
      { key: "gender", labelEn: "Gender", labelEs: "Género", type: "select", required: true, crm: custom("gender"), options: GENDER_OPTIONS },
      {
        key: "relationship", labelEn: "What is your relationship to the Insured?", labelEs: "¿Cuál es su relación con el asegurado?",
        type: "select", required: true, crm: custom("relationship_to_insured"), crmLabel: "Relationship to Insured",
        options: RELATIONSHIP_OPTIONS,
        helpEn: "\"Self\" if you're the one being insured.",
        helpEs: "\"Yo mismo(a)\" si usted es la persona asegurada.",
      },
    ],
  },
  {
    key: "ssn",
    titleEn: "Social Security Number",
    titleEs: "Número de seguro social",
    fields: [
      {
        key: "hasSsn", labelEn: "Do you have a Social Security number?", labelEs: "¿Tiene número de seguro social?",
        type: "select", required: true, crm: custom("has_ssn"), crmLabel: "Has SSN", options: YES_NO,
        noteEn: "No problem — we can still get you great coverage with no waiting period. Without an SSN, you'll be placed on a standard plan rather than preferred or super-preferred rates.",
        noteEs: "No hay problema — de igual forma podemos ofrecerle excelente cobertura sin período de espera. Sin un SSN, se le colocará en un plan estándar en lugar de tarifas preferentes o súper preferentes.",
      },
      {
        key: "ssn", labelEn: "Social Security number", labelEs: "Número de seguro social", type: "ssn",
        required: true, sensitive: true, digitsOnly: true, maxLength: 9, crm: custom("ssn"),
        showIf: { field: "hasSsn", equals: "yes" },
      },
    ],
  },
  {
    key: "address",
    titleEn: "Address",
    titleEs: "Dirección",
    fields: [
      {
        key: "address1", labelEn: "Home address", labelEs: "Dirección", type: "address", required: true, crm: native("address1"),
        addressTargets: { city: "city", state: "state", zip: "postalCode" },
        placeholderEn: "Start typing your address…", placeholderEs: "Empiece a escribir su dirección…",
      },
      { key: "city", labelEn: "City", labelEs: "Ciudad", type: "text", required: true, crm: native("city") },
      { key: "state", labelEn: "State", labelEs: "Estado", type: "text", required: true, crm: native("state") },
      { key: "postalCode", labelEn: "Zip code", labelEs: "Código postal", type: "zip", required: true, digitsOnly: true, maxLength: 5, crm: native("postalCode") },
    ],
  },
  {
    key: "beneficiaries",
    titleEn: "Beneficiaries",
    titleEs: "Beneficiarios",
    fields: [
      {
        key: "beneficiaries", labelEn: "Beneficiaries", labelEs: "Beneficiarios", type: "repeater",
        rowFields: BENEFICIARY_FIELDS, minRows: 2, maxRows: 10,
        rowLabelEn: "Beneficiary", rowLabelEs: "Beneficiario",
        helpEn: "Who should receive the payout? At least two, and you can add more.",
        helpEs: "¿Quién debe recibir el pago? Al menos dos, y puede agregar más.",
      },
    ],
  },
  {
    key: "security",
    titleEn: "Security Question",
    titleEs: "Pregunta de seguridad",
    fields: [
      {
        key: "mothersMaidenName", labelEn: "What is your mother's maiden name?", labelEs: "¿Cuál es el apellido de soltera de su madre?",
        type: "text", required: true, sensitive: true, crm: custom("mothers_maiden_name"), crmLabel: "Mother's maiden name",
      },
    ],
  },
  {
    key: "medical",
    titleEn: "Height, Weight & Medications",
    titleEs: "Estatura, peso y medicamentos",
    fields: [
      {
        key: "physicianOrFacilityName", labelEn: "Who is your doctor, or what's the name of the medical facility you go to?",
        labelEs: "¿Quién es su médico, o cuál es el nombre del centro médico al que asiste?",
        type: "text", crm: custom("physician_name"), crmLabel: "Physician / facility name",
      },
      {
        key: "physicianCity", labelEn: "What city is that in?", labelEs: "¿En qué ciudad está ubicado?",
        type: "text", crm: custom("physician_city"), crmLabel: "Physician / facility city",
      },
      {
        key: "height", labelEn: "What is your height?", labelEs: "¿Cuál es su estatura?", type: "height",
        required: true, crm: custom("height"),
      },
      {
        key: "weight", labelEn: "What is your weight (lbs)?", labelEs: "¿Cuál es su peso (lbs)?", type: "text",
        required: true, digitsOnly: true, maxLength: 3, crm: custom("weight"),
        placeholderEn: "e.g. 175", placeholderEs: "ej. 175",
      },
      {
        key: "takesMedications", labelEn: "Do you take any medications?", labelEs: "¿Toma algún medicamento?",
        type: "select", required: true, crm: custom("takes_medications"), crmLabel: "Takes medications", options: YES_NO,
      },
      {
        key: "medications", labelEn: "Medications", labelEs: "Medicamentos", type: "repeater",
        showIf: { field: "takesMedications", equals: "yes" },
        rowFields: MEDICATION_FIELDS, minRows: 1, maxRows: 15,
        rowLabelEn: "Medication", rowLabelEs: "Medicamento",
      },
    ],
  },
  {
    key: "tobacco",
    titleEn: "Tobacco and Nicotine",
    titleEs: "Tabaco y nicotina",
    fields: [
      {
        key: "tobaccoUse", labelEn: "Do you use any form of tobacco or nicotine?", labelEs: "¿Usa algún tipo de tabaco o nicotina?",
        type: "select", required: true, crm: custom("tobacco_use"), crmLabel: "Uses tobacco/nicotine", options: YES_NO,
      },
      {
        key: "tobacco10yr",
        labelEn: "In the past 10 years, have you used any form of tobacco or nicotine products, or had a blood pressure reading over 135/85?",
        labelEs: "En los últimos 10 años, ¿ha usado algún producto de tabaco o nicotina, o ha tenido una lectura de presión arterial superior a 135/85?",
        type: "select", required: true, crm: custom("tobacco_10yr"), crmLabel: "Tobacco/BP — past 10 years", options: YES_NO,
      },
      {
        key: "tobacco5yr", labelEn: "In the past 5 years, have you used any form of tobacco or nicotine products?",
        labelEs: "En los últimos 5 años, ¿ha usado algún producto de tabaco o nicotina?",
        type: "select", required: true, crm: custom("tobacco_5yr"), crmLabel: "Tobacco — past 5 years", options: YES_NO,
      },
      {
        key: "tobacco12mo", labelEn: "In the past 12 months, have you used any form of tobacco or nicotine products?",
        labelEs: "En los últimos 12 meses, ¿ha usado algún producto de tabaco o nicotina?",
        type: "select", required: true, crm: custom("tobacco_12mo"), crmLabel: "Tobacco — past 12 months", options: YES_NO,
      },
    ],
  },
  {
    key: "health",
    titleEn: "Health",
    titleEs: "Salud",
    fields: [
      {
        key: "cancerStroke", labelEn: "Have you ever been diagnosed with cancer or had a stroke?",
        labelEs: "¿Alguna vez le han diagnosticado cáncer o ha tenido un derrame cerebral?",
        type: "select", required: true, crm: custom("cancer_stroke"), crmLabel: "Cancer or stroke history", options: YES_NO,
      },
      {
        key: "cancerStrokeFree2yr", labelEn: "In the past 2 years, have you been cancer and stroke free?",
        labelEs: "En los últimos 2 años, ¿ha estado libre de cáncer y derrame cerebral?",
        type: "select", required: true, crm: custom("cancer_stroke_free_2yr"), crmLabel: "Cancer/stroke free — 2 years", options: YES_NO,
      },
      {
        key: "cancerStrokeFree5yr", labelEn: "In the past 5 years, have you been cancer and stroke free?",
        labelEs: "En los últimos 5 años, ¿ha estado libre de cáncer y derrame cerebral?",
        type: "select", required: true, crm: custom("cancer_stroke_free_5yr"), crmLabel: "Cancer/stroke free — 5 years", options: YES_NO,
      },
      {
        key: "cancerStrokeFree10yr", labelEn: "In the past 10 years, have you been cancer and stroke free?",
        labelEs: "En los últimos 10 años, ¿ha estado libre de cáncer y derrame cerebral?",
        type: "select", required: true, crm: custom("cancer_stroke_free_10yr"), crmLabel: "Cancer/stroke free — 10 years", options: YES_NO,
      },
    ],
  },
  {
    key: "hospitalizations",
    titleEn: "Hospitalizations",
    titleEs: "Hospitalizaciones",
    fields: [
      {
        key: "hospitalizedCurrent", labelEn: "Are you currently hospitalized or in a nursing facility?",
        labelEs: "¿Está actualmente hospitalizado(a) o en un centro de enfermería?",
        type: "select", required: true, crm: custom("hospitalized_current"), crmLabel: "Currently hospitalized", options: YES_NO,
      },
      {
        key: "hospitalized10yr", labelEn: "Have you been hospitalized two or more times in the past 10 years?",
        labelEs: "¿Ha sido hospitalizado(a) dos o más veces en los últimos 10 años?",
        type: "select", required: true, crm: custom("hospitalized_10yr"), crmLabel: "Hospitalized 2+ — 10 years", options: YES_NO,
      },
      {
        key: "hospitalized5yr", labelEn: "Have you been hospitalized two or more times in the past 5 years?",
        labelEs: "¿Ha sido hospitalizado(a) dos o más veces en los últimos 5 años?",
        type: "select", required: true, crm: custom("hospitalized_5yr"), crmLabel: "Hospitalized 2+ — 5 years", options: YES_NO,
      },
      {
        key: "hospitalized3yr", labelEn: "Have you been hospitalized two or more times in the past 3 years?",
        labelEs: "¿Ha sido hospitalizado(a) dos o más veces en los últimos 3 años?",
        type: "select", required: true, crm: custom("hospitalized_3yr"), crmLabel: "Hospitalized 2+ — 3 years", options: YES_NO,
      },
      {
        key: "hospitalized6mo", labelEn: "Have you been hospitalized two or more times in the past 6 months?",
        labelEs: "¿Ha sido hospitalizado(a) dos o más veces en los últimos 6 meses?",
        type: "select", required: true, crm: custom("hospitalized_6mo"), crmLabel: "Hospitalized 2+ — 6 months", options: YES_NO,
      },
    ],
  },
];

/** Sections a given role should see/step through. No owner-only section exists (yet). */
export function visibleSections(_isOwner: boolean): FeSection[] {
  return FE_SECTIONS;
}

/** One row of a repeater. Every sub-value is a plain string (no file uploads in this intake). */
export type RepeaterRow = Record<string, string | undefined>;

/** Build an empty row for a repeater field (every declared sub-field present and blank). */
export function emptyRow(field: FeField): RepeaterRow {
  const row: RepeaterRow = {};
  for (const sub of field.rowFields ?? []) row[sub.key] = "";
  return row;
}

/** Flat list of plain scalar fields (excludes repeaters). */
export function allScalarFields(): FeField[] {
  return FE_SECTIONS.flatMap((s) => s.fields).filter((f) => f.type !== "repeater");
}

/** All repeater fields, in section order. */
export function allRepeaterFields(): FeField[] {
  return FE_SECTIONS.flatMap((s) => s.fields).filter((f) => f.type === "repeater");
}

export function fieldByKey(key: string): FeField | undefined {
  for (const section of FE_SECTIONS) {
    const f = section.fields.find((x) => x.key === key);
    if (f) return f;
  }
  return undefined;
}

/** A sub-field inside a repeater row, e.g. rowFieldByKey("medications", "usage"). */
export function rowFieldByKey(repeaterKey: string, rowFieldKey: string): FeField | undefined {
  const repeater = fieldByKey(repeaterKey);
  if (!repeater || repeater.type !== "repeater") return undefined;
  return repeater.rowFields?.find((f) => f.key === rowFieldKey);
}

/**
 * True when a field's showIf condition is satisfied by the given data.
 * Inside a repeater, pass the ROW object so conditions resolve against sibling sub-fields.
 */
export function isFieldVisible(field: FeField, data: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const current = data[field.showIf.field];
  const expected = field.showIf.equals;
  if (Array.isArray(expected)) return expected.includes(String(current ?? ""));
  return String(current ?? "") === expected;
}

/** A row counts as "filled" when any sub-field has a value. */
export function isRowFilled(field: FeField, row: RepeaterRow): boolean {
  for (const sub of field.rowFields ?? []) {
    const v = row[sub.key];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}
