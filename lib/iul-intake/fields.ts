/**
 * IUL intake — single source of truth for the multi-step form.
 *
 * Drives: the form UI, zod validation (lib/iul-intake/schema.ts), CRM mapping on completion
 * (app/api/iul-intake/[token]/complete), and the read-only client view.
 *
 * Field values are stored in the session `data` jsonb keyed by `field.key`. Fields flagged
 * `sensitive` are encrypted at rest. CRM targets are either GHL native contact fields or a
 * custom field referenced by slug (see lib/iul-intake/ghl-field-ids.ts).
 */

import type { GhlFieldSlug } from "./ghl-field-ids";

export type NativeContactField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "dateOfBirth"
  | "address1"
  | "city"
  | "state"
  | "postalCode"
  | "companyName";

export type CrmTarget =
  | { kind: "native"; field: NativeContactField }
  | { kind: "custom"; slug: GhlFieldSlug };

export type IntakeFieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "dob"
  | "height"
  | "select"
  | "ssn"
  | "number"
  | "money"
  | "premium"
  | "address"
  | "textarea"
  | "beneficiaries"
  | "file";

/** A file stored in the CRM media library and referenced on a FILE_UPLOAD custom field. */
export type FileRef = {
  url: string;
  name: string;
  fileId?: string;
};

export type IntakeOption = {
  value: string;
  labelEn: string;
  labelEs: string;
  /** Hidden from clients; only the admin (owner) filling the form sees this option. */
  ownerOnly?: boolean;
};

/** Where an `address` field writes the resolved city/state/zip from autocomplete. */
export type AddressTargets = {
  city?: string;
  state?: string;
  zip?: string;
};

export type IntakeField = {
  key: string;
  labelEn: string;
  labelEs: string;
  type: IntakeFieldType;
  required?: boolean;
  sensitive?: boolean;
  /** Hidden from clients; only the admin (owner) sees/fills this field. */
  ownerOnly?: boolean;
  /** Restrict input to digits only (kept as a string to preserve leading zeros). */
  digitsOnly?: boolean;
  /** Maximum number of characters accepted. */
  maxLength?: number;
  /** For `address` fields: sibling field keys to populate from autocomplete. */
  addressTargets?: AddressTargets;
  /** Where this value is written in the CRM. Omit for DB-only fields. */
  crm?: CrmTarget;
  options?: IntakeOption[];
  placeholderEn?: string;
  placeholderEs?: string;
  /** Show this field only when another field equals one of these values. */
  showIf?: { field: string; equals: string | string[] };
  /** Hint rendered under the input. */
  helpEn?: string;
  helpEs?: string;
};

export type IntakeSection = {
  key: string;
  titleEn: string;
  titleEs: string;
  descriptionEn?: string;
  descriptionEs?: string;
  /** Hidden from clients; only the admin (owner) sees this whole section. */
  ownerOnly?: boolean;
  fields: IntakeField[];
};

const native = (field: NativeContactField): CrmTarget => ({ kind: "native", field });
const custom = (slug: GhlFieldSlug): CrmTarget => ({ kind: "custom", slug });

const YES_NO: IntakeOption[] = [
  { value: "yes", labelEn: "Yes", labelEs: "Sí" },
  { value: "no", labelEn: "No", labelEs: "No" },
];

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    key: "personal",
    titleEn: "Personal information",
    titleEs: "Información personal",
    descriptionEn: "Details about the proposed insured.",
    descriptionEs: "Datos del asegurado propuesto.",
    fields: [
      { key: "firstName", labelEn: "First name", labelEs: "Primer nombre", type: "text", required: true, crm: native("firstName") },
      { key: "lastName", labelEn: "Last name", labelEs: "Primer apellido", type: "text", required: true, crm: native("lastName") },
      { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true, crm: native("dateOfBirth") },
      {
        key: "sex", labelEn: "Sex", labelEs: "Sexo", type: "select", required: true, crm: custom("gender"),
        options: [
          { value: "Male", labelEn: "Male", labelEs: "Masculino" },
          { value: "Female", labelEn: "Female", labelEs: "Femenino" },
        ],
      },
      {
        key: "maritalStatus", labelEn: "Marital status", labelEs: "Estado civil", type: "select", required: true, crm: custom("marital_status"),
        options: [
          { value: "Single", labelEn: "Single", labelEs: "Soltero(a)" },
          { value: "Married", labelEn: "Married", labelEs: "Casado(a)" },
          { value: "Divorced", labelEn: "Divorced", labelEs: "Divorciado(a)" },
          { value: "Widowed", labelEn: "Widowed", labelEs: "Viudo(a)" },
        ],
      },
      { key: "usCitizen", labelEn: "US citizen?", labelEs: "¿Ciudadano americano?", type: "select", required: true, crm: custom("us_citizen"), options: YES_NO },
      {
        key: "idType", labelEn: "I have", labelEs: "Tengo", type: "select", required: true, crm: custom("id_type"),
        options: [
          { value: "SSN", labelEn: "Social Security Number (SSN)", labelEs: "Número de seguro social (SSN)" },
          { value: "ITIN", labelEn: "Individual Taxpayer ID (ITIN)", labelEs: "ITIN" },
        ],
      },
      { key: "ssn", labelEn: "SSN / ITIN", labelEs: "Número de seguro social o ITIN", type: "ssn", required: true, sensitive: true, digitsOnly: true, maxLength: 9, crm: custom("ssn") },
      { key: "yearsInUsa", labelEn: "Years residing in the USA", labelEs: "Años residiendo en EE. UU.", type: "number", required: true, maxLength: 3, crm: custom("years_in_usa") },
      { key: "birthCountry", labelEn: "Birth country", labelEs: "País de nacimiento", type: "text", required: true, crm: custom("birth_country") },
      { key: "birthCityState", labelEn: "Birth city and state", labelEs: "Ciudad y estado de nacimiento", type: "text", required: true, crm: custom("birth_city_state") },
      { key: "countryOfCitizenship", labelEn: "Country of citizenship", labelEs: "País de ciudadanía", type: "text", required: true, crm: custom("country_of_citizenship") },
      {
        key: "visaType", labelEn: "Type of visa", labelEs: "Tipo de visa", type: "text", crm: custom("visa_type"),
        showIf: { field: "usCitizen", equals: "no" },
      },
      { key: "height", labelEn: "Height", labelEs: "Altura", type: "height", required: true, crm: custom("height") },
      { key: "weight", labelEn: "Weight (lbs)", labelEs: "Peso (lbs)", type: "number", required: true, maxLength: 3, crm: custom("weight") },
      { key: "driversLicense", labelEn: "Has a driver's license?", labelEs: "¿Tiene licencia de conducir?", type: "select", required: true, crm: custom("drivers_license"), options: YES_NO },
      {
        key: "dlNumber", labelEn: "Driver's license number", labelEs: "Número de licencia de conducir", type: "text", sensitive: true, crm: custom("dl_number"),
        showIf: { field: "driversLicense", equals: "yes" },
      },
      {
        key: "dlState", labelEn: "License state", labelEs: "Estado de la licencia", type: "text", crm: custom("dl_state"),
        showIf: { field: "driversLicense", equals: "yes" },
      },
      { key: "tobacco", labelEn: "Used tobacco/nicotine in the last 5 years?", labelEs: "¿Ha usado tabaco/nicotina en los últimos 5 años?", type: "select", required: true, crm: custom("tobacco"), options: YES_NO },
    ],
  },
  {
    key: "residence",
    titleEn: "Residence & contact",
    titleEs: "Residencia y contacto",
    fields: [
      {
        key: "address1", labelEn: "Street address (no P.O. Box)", labelEs: "Dirección (no apartado postal)", type: "address", required: true, crm: native("address1"),
        addressTargets: { city: "city", state: "state", zip: "postalCode" },
        placeholderEn: "Start typing your address…", placeholderEs: "Empiece a escribir su dirección…",
      },
      { key: "city", labelEn: "City", labelEs: "Ciudad", type: "text", required: true, crm: native("city") },
      { key: "state", labelEn: "State", labelEs: "Estado", type: "text", required: true, crm: native("state") },
      { key: "postalCode", labelEn: "Zip code", labelEs: "Código postal", type: "text", required: true, digitsOnly: true, maxLength: 5, crm: native("postalCode") },
      { key: "phone", labelEn: "Phone number", labelEs: "Número de teléfono", type: "tel", required: true, crm: native("phone") },
      { key: "yearsAtAddress", labelEn: "Years at current address", labelEs: "Años en la dirección actual", type: "number", required: true, maxLength: 3, crm: custom("years_at_address") },
      { key: "email", labelEn: "Email", labelEs: "Correo electrónico", type: "email", required: true, crm: native("email") },
    ],
  },
  {
    key: "employment",
    titleEn: "Employment",
    titleEs: "Empleo",
    fields: [
      { key: "employed", labelEn: "Currently employed?", labelEs: "¿Está trabajando actualmente?", type: "select", required: true, crm: custom("employed"), options: YES_NO },
      { key: "employer", labelEn: "Employer", labelEs: "Empleador", type: "text", crm: native("companyName"), showIf: { field: "employed", equals: "yes" } },
      { key: "occupation", labelEn: "Occupation", labelEs: "Ocupación", type: "text", crm: custom("occupation"), showIf: { field: "employed", equals: "yes" } },
      { key: "yearsWithEmployer", labelEn: "Years with current employer", labelEs: "Años con el empleador actual", type: "number", maxLength: 2, crm: custom("years_with_employer"), showIf: { field: "employed", equals: "yes" } },
      {
        key: "employerStreet", labelEn: "Employer street address", labelEs: "Dirección del empleador", type: "address", crm: custom("employer_street"), showIf: { field: "employed", equals: "yes" },
        addressTargets: { city: "employerCity", state: "employerState", zip: "employerZip" },
        placeholderEn: "Start typing the address…", placeholderEs: "Empiece a escribir la dirección…",
      },
      { key: "employerCity", labelEn: "Employer city", labelEs: "Ciudad del empleador", type: "text", crm: custom("employer_city"), showIf: { field: "employed", equals: "yes" } },
      { key: "employerState", labelEn: "Employer state", labelEs: "Estado del empleador", type: "text", crm: custom("employer_state"), showIf: { field: "employed", equals: "yes" } },
      { key: "employerZip", labelEn: "Employer zip code", labelEs: "Código postal del empleador", type: "text", digitsOnly: true, maxLength: 5, crm: custom("employer_zip"), showIf: { field: "employed", equals: "yes" } },
      { key: "workPhone", labelEn: "Work phone number", labelEs: "Teléfono del empleador", type: "tel", crm: custom("work_phone"), showIf: { field: "employed", equals: "yes" } },
    ],
  },
  {
    key: "financial",
    titleEn: "Financial information",
    titleEs: "Información financiera",
    fields: [
      { key: "grossIncomeCurrent", labelEn: "Gross income for {currentYear}", labelEs: "Ingreso bruto de {currentYear}", type: "money", required: true, crm: custom("gross_income_current") },
      { key: "grossIncomePrevious", labelEn: "Gross income for {lastYear} (last year)", labelEs: "Ingreso bruto de {lastYear} (año anterior)", type: "money", required: true, crm: custom("gross_income_previous") },
      { key: "netWorth", labelEn: "Net worth", labelEs: "Patrimonio o valor neto", type: "money", required: true, crm: custom("net_worth") },
      {
        key: "sourceOfFunds", labelEn: "Source of funds", labelEs: "Fuente de fondos", type: "select", required: true, crm: custom("source_of_funds"),
        options: [
          { value: "Employment", labelEn: "Employment", labelEs: "Empleo" },
          { value: "Savings", labelEn: "Savings", labelEs: "Ahorros" },
          { value: "Investments", labelEn: "Investments", labelEs: "Inversiones" },
          { value: "Other", labelEn: "Other", labelEs: "Otro" },
        ],
      },
    ],
  },
  {
    key: "beneficiaries",
    titleEn: "Beneficiaries",
    titleEs: "Beneficiarios",
    descriptionEn: "Add up to four beneficiaries. Percentages should total 100%.",
    descriptionEs: "Agregue hasta cuatro beneficiarios. Los porcentajes deben sumar 100%.",
    fields: [
      { key: "beneficiaries", labelEn: "Beneficiaries", labelEs: "Beneficiarios", type: "beneficiaries", required: true, sensitive: true },
    ],
  },
  {
    key: "payment",
    titleEn: "Banking & payment",
    titleEs: "Banco y pago",
    descriptionEn: "Sensitive banking details — stored encrypted.",
    descriptionEs: "Datos bancarios sensibles — almacenados cifrados.",
    fields: [
      {
        key: "payorSameAs", labelEn: "Who is the policy payor?", labelEs: "¿Quién es el pagador de la póliza?", type: "select", required: true, crm: custom("payor_same_as"),
        options: [
          { value: "Primary insured", labelEn: "Primary insured", labelEs: "Asegurado principal" },
          { value: "Other", labelEn: "Other", labelEs: "Otro" },
        ],
      },
      { key: "bankName", labelEn: "Bank name", labelEs: "Nombre del banco", type: "text", required: true, crm: custom("bank_name") },
      {
        key: "paymentMethod", labelEn: "Payment method", labelEs: "Método de pago", type: "select", required: true, crm: custom("payment_method"),
        options: [
          { value: "Electronic (bank draft)", labelEn: "Electronic (bank draft)", labelEs: "Electrónico (débito bancario)" },
          { value: "Credit card", labelEn: "Credit card", labelEs: "Tarjeta de crédito", ownerOnly: true },
          { value: "Other", labelEn: "Other", labelEs: "Otro", ownerOnly: true },
        ],
      },
      { key: "routingNumber", labelEn: "Routing number", labelEs: "Número de ruta", type: "text", required: true, sensitive: true, digitsOnly: true, maxLength: 9, crm: custom("routing_number") },
      { key: "accountNumber", labelEn: "Account number", labelEs: "Número de cuenta", type: "text", required: true, sensitive: true, digitsOnly: true, maxLength: 17, crm: custom("account_number") },
      {
        key: "accountType", labelEn: "Account type", labelEs: "Tipo de cuenta", type: "select", required: true, crm: custom("account_type"),
        options: [
          { value: "Checking", labelEn: "Checking", labelEs: "Corriente" },
          { value: "Savings", labelEn: "Savings", labelEs: "Ahorros" },
        ],
      },
      { key: "initialPlannedPremium", labelEn: "Initial planned premium (monthly payment)", labelEs: "Prima inicial planeada (pago mensual)", type: "premium", required: true, crm: custom("initial_planned_premium") },
      {
        key: "premiumPaymentMode", labelEn: "Premium payment mode (how often you pay)", labelEs: "Modo de pago de la prima (con qué frecuencia paga)", type: "select", required: true, crm: custom("premium_payment_mode"),
        options: [
          { value: "Monthly", labelEn: "Monthly", labelEs: "Mensual" },
          { value: "Quarterly", labelEn: "Quarterly", labelEs: "Trimestral" },
          { value: "Semi-annual", labelEn: "Semi-annual", labelEs: "Semestral" },
          { value: "Annual", labelEn: "Annual", labelEs: "Anual" },
        ],
      },
    ],
  },
  {
    key: "health",
    titleEn: "Health & doctor",
    titleEs: "Salud y médico",
    fields: [
      { key: "medHeartStrokeCancer", labelEn: "In the past 12 months, treated for or experienced heart trouble, stroke, or cancer?", labelEs: "En los últimos 12 meses, ¿tratado o con problemas cardíacos, derrame o cáncer?", type: "select", required: true, crm: custom("med_heart_stroke_cancer"), options: YES_NO },
      { key: "medDiabetesBlood", labelEn: "Diabetes, anemia, or any blood disorder; sugar, protein, or blood in urine?", labelEs: "¿Diabetes, anemia o trastorno de la sangre; azúcar, proteína o sangre en la orina?", type: "select", required: true, crm: custom("med_diabetes_blood"), options: YES_NO },
      { key: "medMedsDiet", labelEn: "Are you currently taking any medication or prescriptions?", labelEs: "¿Toma actualmente algún medicamento o receta?", type: "select", required: true, crm: custom("med_meds_diet"), options: YES_NO },
      {
        key: "medsList", labelEn: "Please list your current medications", labelEs: "Por favor liste sus medicamentos actuales", type: "textarea", required: true, crm: custom("meds_list"),
        showIf: { field: "medMedsDiet", equals: "yes" },
        placeholderEn: "e.g. Metformin 500mg, Lisinopril 10mg…", placeholderEs: "ej. Metformina 500mg, Lisinopril 10mg…",
      },
      { key: "doctorName", labelEn: "Primary doctor name", labelEs: "Nombre del médico primario", type: "text", required: true, crm: custom("doctor_name") },
      {
        key: "doctorAddress", labelEn: "Doctor address", labelEs: "Dirección del médico", type: "address", required: true, crm: custom("doctor_address"),
        placeholderEn: "Start typing the address…", placeholderEs: "Empiece a escribir la dirección…",
      },
      { key: "doctorPhone", labelEn: "Doctor phone", labelEs: "Teléfono del médico", type: "tel", required: true, crm: custom("doctor_phone") },
    ],
  },
  {
    key: "family",
    titleEn: "Family history",
    titleEs: "Historial familiar",
    fields: [
      { key: "fatherAge", labelEn: "Father's age", labelEs: "Edad del papá", type: "number", required: true, maxLength: 3, crm: custom("father_age") },
      {
        key: "fatherStatus", labelEn: "Father is", labelEs: "El papá está", type: "select", required: true, crm: custom("father_status"),
        options: [
          { value: "Living", labelEn: "Living", labelEs: "Vivo" },
          { value: "Deceased", labelEn: "Deceased", labelEs: "Fallecido" },
        ],
      },
      { key: "fatherAgeAtDeath", labelEn: "Father's age at death", labelEs: "Edad del papá al fallecer", type: "number", maxLength: 3, crm: custom("father_age_at_death"), showIf: { field: "fatherStatus", equals: "Deceased" } },
      { key: "motherAge", labelEn: "Mother's age", labelEs: "Edad de la mamá", type: "number", required: true, maxLength: 3, crm: custom("mother_age") },
      {
        key: "motherStatus", labelEn: "Mother is", labelEs: "La mamá está", type: "select", required: true, crm: custom("mother_status"),
        options: [
          { value: "Living", labelEn: "Living", labelEs: "Viva" },
          { value: "Deceased", labelEn: "Deceased", labelEs: "Fallecida" },
        ],
      },
      { key: "motherAgeAtDeath", labelEn: "Mother's age at death", labelEs: "Edad de la mamá al fallecer", type: "number", crm: custom("mother_age_at_death"), showIf: { field: "motherStatus", equals: "Deceased" } },
    ],
  },
  {
    key: "attachments",
    titleEn: "Documents",
    titleEs: "Documentos",
    descriptionEn: "Upload photos or PDFs. Files are stored securely in the CRM.",
    descriptionEs: "Suba fotos o PDF. Los archivos se almacenan de forma segura en el CRM.",
    fields: [
      { key: "attachmentDriversLicense", labelEn: "Driver's license", labelEs: "Licencia de conducir", type: "file", crm: custom("attachment_drivers_license") },
      { key: "attachmentBankDoc", labelEn: "Voided check / account & routing", labelEs: "Cheque anulado / cuenta y ruta", type: "file", crm: custom("attachment_bank_doc") },
      { key: "attachmentOther", labelEn: "Other documents", labelEs: "Otros documentos", type: "file", crm: custom("attachment_other") },
    ],
  },
  {
    key: "agent",
    titleEn: "Agent notes",
    titleEs: "Notas del agente",
    descriptionEn: "Internal — not required from the client.",
    descriptionEs: "Interno — no requerido del cliente.",
    ownerOnly: true,
    fields: [
      { key: "additionalComments", labelEn: "Additional comments", labelEs: "Comentarios adicionales", type: "textarea", crm: custom("additional_comments") },
    ],
  },
];

/** Beneficiary slot slugs in order, for CRM serialization (beneficiary_1..4). */
export const BENEFICIARY_SLUGS: GhlFieldSlug[] = [
  "beneficiary_1",
  "beneficiary_2",
  "beneficiary_3",
  "beneficiary_4",
];

export const MAX_BENEFICIARIES = 4;

/** Relationship options for the beneficiaries editor (value stored = English label). */
export const BENEFICIARY_RELATIONSHIPS: IntakeOption[] = [
  { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
  { value: "Son", labelEn: "Son", labelEs: "Hijo" },
  { value: "Daughter", labelEn: "Daughter", labelEs: "Hija" },
  { value: "Father", labelEn: "Father", labelEs: "Padre" },
  { value: "Mother", labelEn: "Mother", labelEs: "Madre" },
  { value: "Brother", labelEn: "Brother", labelEs: "Hermano" },
  { value: "Sister", labelEn: "Sister", labelEs: "Hermana" },
  { value: "Grandfather", labelEn: "Grandfather", labelEs: "Abuelo" },
  { value: "Grandmother", labelEn: "Grandmother", labelEs: "Abuela" },
  { value: "Grandson", labelEn: "Grandson", labelEs: "Nieto" },
  { value: "Granddaughter", labelEn: "Granddaughter", labelEs: "Nieta" },
  { value: "Domestic partner", labelEn: "Domestic partner", labelEs: "Pareja de hecho" },
  { value: "Estate/Trust", labelEn: "Estate / Trust", labelEs: "Patrimonio / Fideicomiso" },
  { value: "Other", labelEn: "Other", labelEs: "Otro" },
];

/** Sections a given role should see/step through (clients skip owner-only sections). */
export function visibleSections(isOwner: boolean): IntakeSection[] {
  if (isOwner) return INTAKE_SECTIONS;
  return INTAKE_SECTIONS.filter((s) => !s.ownerOnly);
}

export type Beneficiary = {
  firstName: string;
  lastName: string;
  relationship: string;
  percent: string;
  dateOfBirth: string;
  ssn: string;
};

export function emptyBeneficiary(): Beneficiary {
  return { firstName: "", lastName: "", relationship: "", percent: "", dateOfBirth: "", ssn: "" };
}

/** Flat list of plain scalar fields (excludes composite beneficiaries + file uploads). */
export function allScalarFields(): IntakeField[] {
  return INTAKE_SECTIONS.flatMap((s) => s.fields).filter(
    (f) => f.type !== "beneficiaries" && f.type !== "file"
  );
}

/** All file-upload fields, keyed for the files API / CRM media sync. */
export function allFileFields(): IntakeField[] {
  return INTAKE_SECTIONS.flatMap((s) => s.fields).filter((f) => f.type === "file");
}

export function fieldByKey(key: string): IntakeField | undefined {
  for (const section of INTAKE_SECTIONS) {
    const f = section.fields.find((x) => x.key === key);
    if (f) return f;
  }
  return undefined;
}

/** True when a field's showIf condition is satisfied by the current data. */
export function isFieldVisible(field: IntakeField, data: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const current = data[field.showIf.field];
  const expected = field.showIf.equals;
  if (Array.isArray(expected)) return expected.includes(String(current ?? ""));
  return String(current ?? "") === expected;
}
