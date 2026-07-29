/**
 * ACA intake — single source of truth for the multi-step form.
 *
 * Drives: the form UI, completion validation (lib/aca-intake/schema.ts), CRM mapping on
 * completion (app/api/aca-intake/[token]/complete), and the read-only client view.
 *
 * Field values are stored in the session `data` jsonb keyed by `field.key`. Fields flagged
 * `sensitive` are encrypted at rest — including sub-fields inside repeater rows. CRM targets
 * are either GHL native contact fields or a custom field referenced by slug (see
 * lib/aca-intake/ghl-field-ids.ts).
 *
 * Differences from the IUL config this mirrors:
 *  - `repeater` replaces the hard-coded `beneficiaries` type: sub-fields are declared here in
 *    `rowFields` and rendered through the same input dispatch, so row-scoped `showIf` and
 *    per-row file uploads work without bespoke components.
 *  - `zip` is a real field type rather than inferred from `digitsOnly && maxLength === 5`.
 *  - No `height` / `metric` types — irrelevant for health coverage.
 */

import type { AcaFieldSlug } from "./ghl-field-ids";

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
  | { kind: "custom"; slug: AcaFieldSlug };

export type AcaFieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "dob"
  | "zip"
  | "select"
  | "ssn"
  | "number"
  | "money"
  | "address"
  | "textarea"
  | "repeater"
  | "file";

/** A file stored in the CRM media library and referenced on a FILE_UPLOAD custom field. */
export type FileRef = {
  url: string;
  name: string;
  fileId?: string;
};

export type AcaOption = {
  value: string;
  labelEn: string;
  labelEs: string;
  /** Hidden from clients; only the admin (owner) filling the form sees this option. */
  ownerOnly?: boolean;
};

/** Where an `address` field writes the resolved city/state/zip/county from autocomplete. */
export type AddressTargets = {
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
};

export type AcaField = {
  key: string;
  labelEn: string;
  labelEs: string;
  type: AcaFieldType;
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
  /** For `address` fields: store the whole formatted address in this one field. */
  fullAddress?: boolean;
  /** Where this value is written in the CRM. Omit for DB-only fields. */
  crm?: CrmTarget;
  /**
   * Name to give this field in the CRM, when `labelEn` would make a poor one — client-facing
   * labels are questions ("Who is paying?") and some carry `{currentYear}` tokens that must
   * never be baked into a permanent field name. Falls back to `labelEn`.
   */
  crmLabel?: string;
  options?: AcaOption[];
  placeholderEn?: string;
  placeholderEs?: string;
  /**
   * Show this field only when another field equals one of these values. Inside a `repeater`
   * the referenced field is resolved against the ROW, not the top-level form data.
   */
  showIf?: { field: string; equals: string | string[] };
  /** Hint rendered under the input. */
  helpEn?: string;
  helpEs?: string;
  // ── `repeater` only ──
  /** Sub-fields rendered for each row. */
  rowFields?: AcaField[];
  /** Rows always present and never removable (default 1). */
  minRows?: number;
  /** Hard cap on rows. */
  maxRows?: number;
  /** Singular noun for the row header — "Household member 2". */
  rowLabelEn?: string;
  rowLabelEs?: string;
};

export type AcaSection = {
  key: string;
  titleEn: string;
  titleEs: string;
  descriptionEn?: string;
  descriptionEs?: string;
  /** Hidden from clients; only the admin (owner) sees this whole section. */
  ownerOnly?: boolean;
  fields: AcaField[];
};

const native = (field: NativeContactField): CrmTarget => ({ kind: "native", field });
const custom = (slug: AcaFieldSlug): CrmTarget => ({ kind: "custom", slug });

const YES_NO: AcaOption[] = [
  { value: "yes", labelEn: "Yes", labelEs: "Sí" },
  { value: "no", labelEn: "No", labelEs: "No" },
];

const SEX_OPTIONS: AcaOption[] = [
  { value: "Male", labelEn: "Male", labelEs: "Masculino" },
  { value: "Female", labelEn: "Female", labelEs: "Femenino" },
];

/** Sub-fields for one household member. Row 1 is the primary applicant (prefilled from step 1). */
const HOUSEHOLD_MEMBER_FIELDS: AcaField[] = [
  {
    key: "relationship", labelEn: "Relationship to you", labelEs: "Parentesco con usted", type: "select", required: true,
    options: [
      { value: "Self", labelEn: "Self (primary applicant)", labelEs: "Usted mismo (solicitante principal)" },
      { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
      { value: "Domestic partner", labelEn: "Domestic partner", labelEs: "Pareja de hecho" },
      { value: "Son", labelEn: "Son", labelEs: "Hijo" },
      { value: "Daughter", labelEn: "Daughter", labelEs: "Hija" },
      { value: "Stepchild", labelEn: "Stepchild", labelEs: "Hijastro(a)" },
      { value: "Foster child", labelEn: "Foster child", labelEs: "Hijo(a) de crianza" },
      { value: "Parent", labelEn: "Parent", labelEs: "Padre o madre" },
      { value: "Grandchild", labelEn: "Grandchild", labelEs: "Nieto(a)" },
      { value: "Other relative", labelEn: "Other relative", labelEs: "Otro familiar" },
      { value: "Unrelated", labelEn: "Unrelated", labelEs: "Sin parentesco" },
    ],
  },
  { key: "firstName", labelEn: "First name", labelEs: "Primer nombre", type: "text", required: true },
  { key: "lastName", labelEn: "Last name", labelEs: "Apellido", type: "text", required: true },
  { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true },
  { key: "sex", labelEn: "Sex", labelEs: "Sexo", type: "select", required: true, options: SEX_OPTIONS },
  {
    key: "hasSsn", labelEn: "Do they have a Social Security number?", labelEs: "¿Tiene número de seguro social?", type: "select", required: true,
    options: YES_NO,
  },
  {
    key: "ssn", labelEn: "Social Security number", labelEs: "Número de seguro social", type: "ssn", required: true, sensitive: true,
    digitsOnly: true, maxLength: 9, showIf: { field: "hasSsn", equals: "yes" },
  },
  {
    key: "noSsnReason", labelEn: "Why no SSN?", labelEs: "¿Por qué no tiene SSN?", type: "select", required: true,
    showIf: { field: "hasSsn", equals: "no" },
    options: [
      { value: "Not eligible for an SSN", labelEn: "Not eligible for an SSN", labelEs: "No elegible para un SSN" },
      { value: "Applied but not received", labelEn: "Applied but not received yet", labelEs: "Solicitado pero aún no recibido" },
      { value: "Religious objection", labelEn: "Religious objection", labelEs: "Objeción religiosa" },
    ],
  },
  { key: "isUsCitizen", labelEn: "Is this person a US citizen?", labelEs: "¿Es ciudadano(a) de EE. UU.?", type: "select", required: true, options: YES_NO },
  {
    key: "isNaturalizedCitizen", labelEn: "Are they a naturalized citizen?", labelEs: "¿Es ciudadano(a) naturalizado(a)?", type: "select", required: true,
    showIf: { field: "isUsCitizen", equals: "yes" },
    helpEn: "Answer No if they were born in the US — nothing else is needed.",
    helpEs: "Responda No si nació en EE. UU. — no se necesita nada más.",
  },
  {
    key: "docCitizenshipCertificate", labelEn: "Naturalization or citizenship certificate", labelEs: "Certificado de naturalización o ciudadanía",
    type: "file", required: true, crm: custom("aca_doc_citizenship"), crmLabel: "Citizenship certificate",
    showIf: { field: "isNaturalizedCitizen", equals: "yes" },
    helpEn: "Take a photo of the certificate or upload a file.",
    helpEs: "Tome una foto del certificado o suba un archivo.",
  },
  {
    key: "docLegalPresenceFront", labelEn: "Legal presence document — FRONT", labelEs: "Documento de presencia legal — FRENTE",
    type: "file", required: true, crm: custom("aca_doc_legal_front"), crmLabel: "Legal presence doc (front)",
    showIf: { field: "isUsCitizen", equals: "no" },
    helpEn: "Green card, work permit (EAD) or similar. Take a photo or upload a file.",
    helpEs: "Tarjeta verde, permiso de trabajo (EAD) o similar. Tome una foto o suba un archivo.",
  },
  {
    key: "docLegalPresenceBack", labelEn: "Legal presence document — BACK", labelEs: "Documento de presencia legal — REVERSO",
    type: "file", required: true, crm: custom("aca_doc_legal_back"), crmLabel: "Legal presence doc (back)",
    showIf: { field: "isUsCitizen", equals: "no" },
    helpEn: "The back of the same card.",
    helpEs: "El reverso de la misma tarjeta.",
  },
];

const DOCTOR_FIELDS: AcaField[] = [
  { key: "name", labelEn: "Doctor name", labelEs: "Nombre del médico", type: "text", required: true },
  { key: "specialty", labelEn: "Specialty", labelEs: "Especialidad", type: "text" },
  { key: "facility", labelEn: "Clinic or hospital", labelEs: "Clínica u hospital", type: "text" },
  { key: "city", labelEn: "City", labelEs: "Ciudad", type: "text" },
];

const PRESCRIPTION_FIELDS: AcaField[] = [
  { key: "drugName", labelEn: "Medication name", labelEs: "Nombre del medicamento", type: "text", required: true },
  { key: "dosage", labelEn: "Dosage", labelEs: "Dosis", type: "text", placeholderEn: "e.g. 500 mg", placeholderEs: "ej. 500 mg" },
  { key: "frequency", labelEn: "How often", labelEs: "Con qué frecuencia", type: "text", placeholderEn: "e.g. twice a day", placeholderEs: "ej. dos veces al día" },
];

export const ACA_SECTIONS: AcaSection[] = [
  {
    key: "personal",
    titleEn: "About you",
    titleEs: "Sobre usted",
    descriptionEn: "Details about the primary applicant.",
    descriptionEs: "Datos del solicitante principal.",
    fields: [
      { key: "firstName", labelEn: "First name", labelEs: "Primer nombre", type: "text", required: true, crm: native("firstName") },
      { key: "middleName", labelEn: "Middle name (optional)", labelEs: "Segundo nombre (opcional)", type: "text", crm: custom("middle_name"), crmLabel: "Middle name" },
      { key: "lastName", labelEn: "Last name", labelEs: "Primer apellido", type: "text", required: true, crm: native("lastName") },
      {
        key: "secondLastName", labelEn: "Second last name (optional)", labelEs: "Segundo apellido (opcional)", type: "text",
        helpEn: "If your ID shows two last names, include both.",
        helpEs: "Si su identificación muestra dos apellidos, incluya ambos.",
      },
      { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true, crm: native("dateOfBirth") },
      {
        key: "sex", labelEn: "Sex", labelEs: "Sexo", type: "select", required: true, crm: custom("gender"), options: SEX_OPTIONS,
        helpEn: "Must match your Social Security record.",
        helpEs: "Debe coincidir con su registro del seguro social.",
      },
      { key: "ssn", labelEn: "Social Security number", labelEs: "Número de seguro social", type: "ssn", required: true, sensitive: true, digitsOnly: true, maxLength: 9, crm: custom("ssn") },
      {
        key: "maritalStatus", labelEn: "Marital status", labelEs: "Estado civil", type: "select", required: true, crm: custom("marital_status"),
        options: [
          { value: "Single", labelEn: "Single", labelEs: "Soltero(a)" },
          { value: "Married", labelEn: "Married", labelEs: "Casado(a)" },
          { value: "Divorced", labelEn: "Divorced", labelEs: "Divorciado(a)" },
          { value: "Widowed", labelEn: "Widowed", labelEs: "Viudo(a)" },
          { value: "Separated", labelEn: "Separated", labelEs: "Separado(a)" },
          { value: "Domestic partnership", labelEn: "Domestic partnership", labelEs: "Pareja de hecho" },
        ],
      },
      { key: "phone", labelEn: "Phone number", labelEs: "Número de teléfono", type: "tel", required: true, crm: native("phone") },
      { key: "altPhone", labelEn: "Alternate phone (optional)", labelEs: "Teléfono alterno (opcional)", type: "tel", crm: custom("alt_phone"), crmLabel: "Alternate phone" },
      { key: "email", labelEn: "Email", labelEs: "Correo electrónico", type: "email", required: true, crm: native("email") },
    ],
  },
  {
    key: "residence",
    titleEn: "Home address",
    titleEs: "Dirección",
    descriptionEn: "Your county decides which plans and prices you qualify for, so please double-check it.",
    descriptionEs: "Su condado determina los planes y precios disponibles, por favor verifíquelo.",
    fields: [
      {
        key: "address1", labelEn: "Street address (no P.O. Box)", labelEs: "Dirección (no apartado postal)", type: "address", required: true, crm: native("address1"),
        addressTargets: { city: "city", state: "state", zip: "postalCode", county: "county" },
        placeholderEn: "Start typing your address…", placeholderEs: "Empiece a escribir su dirección…",
      },
      { key: "address2", labelEn: "Apartment, unit or suite (optional)", labelEs: "Apartamento, unidad o suite (opcional)", type: "text" },
      { key: "city", labelEn: "City", labelEs: "Ciudad", type: "text", required: true, crm: native("city") },
      { key: "state", labelEn: "State", labelEs: "Estado", type: "text", required: true, crm: native("state") },
      { key: "postalCode", labelEn: "Zip code", labelEs: "Código postal", type: "zip", required: true, digitsOnly: true, maxLength: 5, crm: native("postalCode") },
      {
        key: "county", labelEn: "County", labelEs: "Condado", type: "text", required: true, crm: custom("county"),
        helpEn: "Filled in automatically when possible — please confirm it is correct.",
        helpEs: "Se completa automáticamente cuando es posible — confirme que sea correcto.",
      },
      { key: "mailingSameAsHome", labelEn: "Is your mailing address the same?", labelEs: "¿Su dirección postal es la misma?", type: "select", required: true, options: YES_NO },
      {
        key: "mailingAddress", labelEn: "Mailing address", labelEs: "Dirección postal", type: "address", required: true, fullAddress: true, crm: custom("mailing_address"),
        showIf: { field: "mailingSameAsHome", equals: "no" },
        placeholderEn: "Start typing the address…", placeholderEs: "Empiece a escribir la dirección…",
      },
    ],
  },
  {
    key: "household",
    titleEn: "Household members",
    titleEs: "Miembros del hogar",
    descriptionEn: "Everyone who needs coverage. The first person is you.",
    descriptionEs: "Todas las personas que necesitan cobertura. La primera persona es usted.",
    fields: [
      {
        key: "householdMembers", labelEn: "Household members", labelEs: "Miembros del hogar", type: "repeater", required: true, sensitive: true,
        rowFields: HOUSEHOLD_MEMBER_FIELDS,
        minRows: 1,
        maxRows: 8,
        rowLabelEn: "Household member", rowLabelEs: "Miembro del hogar",
      },
    ],
  },
  {
    key: "income",
    titleEn: "Household income",
    titleEs: "Ingreso del hogar",
    descriptionEn: "This is what determines how much financial help you qualify for.",
    descriptionEs: "Esto determina cuánta ayuda financiera puede recibir.",
    fields: [
      {
        key: "expectedAnnualHouseholdIncome",
        // Deliberately year-neutral: a {currentYear} token would bake a year into the
        // permanent CRM field name and go stale every January.
        labelEn: "What is your estimated total family income a year?",
        labelEs: "¿Cuál es su ingreso familiar total estimado al año?",
        type: "money", required: true, crm: custom("expected_annual_household_income"), crmLabel: "Estimated annual household income",
        helpEn: "Before taxes, for everyone in the household combined. An estimate is fine.",
        helpEs: "Antes de impuestos, sumando a todos en el hogar. Una estimación está bien.",
      },
    ],
  },
  {
    key: "medical",
    titleEn: "Doctors & prescriptions",
    titleEs: "Médicos y recetas",
    fields: [
      { key: "hasDoctorsToKeep", labelEn: "Are there doctors you want to keep seeing?", labelEs: "¿Hay médicos que quiere seguir viendo?", type: "select", required: true, crm: custom("has_doctors"), crmLabel: "Has doctors to keep", options: YES_NO },
      {
        key: "doctorsToKeep", labelEn: "Your doctors", labelEs: "Sus médicos", type: "repeater",
        showIf: { field: "hasDoctorsToKeep", equals: "yes" },
        rowFields: DOCTOR_FIELDS, minRows: 1, maxRows: 5,
        rowLabelEn: "Doctor", rowLabelEs: "Médico",
      },
      { key: "hasPrescriptions", labelEn: "Does anyone take prescription medications?", labelEs: "¿Alguien toma medicamentos recetados?", type: "select", required: true, crm: custom("has_prescriptions"), crmLabel: "Takes prescriptions", options: YES_NO },
      {
        key: "prescriptions", labelEn: "Medications", labelEs: "Medicamentos", type: "repeater",
        showIf: { field: "hasPrescriptions", equals: "yes" },
        rowFields: PRESCRIPTION_FIELDS, minRows: 1, maxRows: 10,
        rowLabelEn: "Medication", rowLabelEs: "Medicamento",
      },
      { key: "interestedInDental", labelEn: "Interested in dental coverage?", labelEs: "¿Le interesa cobertura dental?", type: "select", crm: custom("interested_dental"), crmLabel: "Interested in dental", options: YES_NO },
      { key: "interestedInVision", labelEn: "Interested in vision coverage?", labelEs: "¿Le interesa cobertura de visión?", type: "select", crm: custom("interested_vision"), crmLabel: "Interested in vision", options: YES_NO },
      {
        key: "additionalQuestions", labelEn: "Anything else you want Isaac to know?", labelEs: "¿Algo más que quiera que Isaac sepa?", type: "textarea", crm: custom("additional_questions"), crmLabel: "Client questions",
        placeholderEn: "Planned surgeries, ongoing treatment, questions…",
        placeholderEs: "Cirugías planeadas, tratamiento en curso, preguntas…",
      },
    ],
  },
  {
    key: "documents",
    titleEn: "Documents",
    titleEs: "Documentos",
    descriptionEn: "All optional, but uploading them helps us move faster.",
    descriptionEs: "Todos son opcionales, pero subirlos nos ayuda a avanzar más rápido.",
    fields: [
      { key: "docPhotoId", labelEn: "Photo ID (driver's license or state ID)", labelEs: "Identificación con foto (licencia o ID estatal)", type: "file", crm: custom("doc_photo_id"), crmLabel: "Photo ID", },
      { key: "docSsnCard", labelEn: "Social Security card", labelEs: "Tarjeta de seguro social", type: "file", crm: custom("doc_ssn_card"), crmLabel: "Social Security card", },
      { key: "docProofOfIncome", labelEn: "Proof of income (paystubs or tax return)", labelEs: "Comprobante de ingresos (talones de pago o declaración)", type: "file", crm: custom("doc_proof_of_income"), crmLabel: "Proof of income", },
      { key: "docCurrentInsuranceCard", labelEn: "Current insurance card", labelEs: "Tarjeta del seguro actual", type: "file", crm: custom("doc_current_insurance_card"), crmLabel: "Current insurance card", },
      { key: "docOther", labelEn: "Other documents", labelEs: "Otros documentos", type: "file", crm: custom("doc_other"), crmLabel: "Other documents", },
    ],
  },
  {
    key: "payment",
    titleEn: "Payment",
    titleEs: "Pago",
    descriptionEn: "Nothing is charged now. We keep this on file so your plan can be set up the moment you choose one.",
    descriptionEs: "No se cobra nada ahora. Guardamos esto para activar su plan en cuanto elija uno.",
    fields: [
      {
        key: "paymentMethod", labelEn: "How would you like to pay?", labelEs: "¿Cómo prefiere pagar?", type: "select", required: true, crm: custom("payment_method"), crmLabel: "Payment method",
        options: [
          { value: "Bank draft", labelEn: "Bank draft (checking or savings)", labelEs: "Débito bancario (corriente o ahorros)" },
          { value: "Credit card", labelEn: "Credit card", labelEs: "Tarjeta de crédito" },
          { value: "Debit card", labelEn: "Debit card", labelEs: "Tarjeta de débito" },
        ],
      },
      {
        key: "payorSameAsApplicant", labelEn: "Who is paying?", labelEs: "¿Quién paga?", type: "select", required: true, crm: custom("payor_same_as"), crmLabel: "Payor",
        options: [
          { value: "Primary applicant", labelEn: "Me (primary applicant)", labelEs: "Yo (solicitante principal)" },
          { value: "Other", labelEn: "Someone else", labelEs: "Otra persona" },
        ],
      },
      {
        key: "payorName", labelEn: "Name of the person paying", labelEs: "Nombre de quien paga", type: "text", required: true, crm: custom("payor_name"), crmLabel: "Payor name",
        showIf: { field: "payorSameAsApplicant", equals: "Other" },
      },
      {
        key: "payorRelationship", labelEn: "Their relationship to you", labelEs: "Su parentesco con usted", type: "select", required: true, crm: custom("payor_relationship"), crmLabel: "Payor relationship",
        showIf: { field: "payorSameAsApplicant", equals: "Other" },
        options: [
          { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
          { value: "Parent", labelEn: "Parent", labelEs: "Padre o madre" },
          { value: "Child", labelEn: "Child", labelEs: "Hijo(a)" },
          { value: "Other", labelEn: "Other", labelEs: "Otro" },
        ],
      },
      // Bank draft
      { key: "bankName", labelEn: "Bank name", labelEs: "Nombre del banco", type: "text", required: true, crm: custom("bank_name"), showIf: { field: "paymentMethod", equals: "Bank draft" } },
      { key: "routingNumber", labelEn: "Routing number", labelEs: "Número de ruta", type: "text", required: true, sensitive: true, digitsOnly: true, maxLength: 9, crm: custom("routing_number"), showIf: { field: "paymentMethod", equals: "Bank draft" } },
      { key: "accountNumber", labelEn: "Account number", labelEs: "Número de cuenta", type: "text", required: true, sensitive: true, digitsOnly: true, maxLength: 17, crm: custom("account_number"), showIf: { field: "paymentMethod", equals: "Bank draft" } },
      {
        key: "accountType", labelEn: "Account type", labelEs: "Tipo de cuenta", type: "select", required: true, crm: custom("account_type"), showIf: { field: "paymentMethod", equals: "Bank draft" },
        options: [
          { value: "Checking", labelEn: "Checking", labelEs: "Corriente" },
          { value: "Savings", labelEn: "Savings", labelEs: "Ahorros" },
        ],
      },
      // Card
      { key: "cardholderName", labelEn: "Name on the card", labelEs: "Nombre en la tarjeta", type: "text", required: true, crm: custom("cardholder_name"), crmLabel: "Cardholder name", showIf: { field: "paymentMethod", equals: ["Credit card", "Debit card"] } },
      // 19 digits, not 16 — Amex is 15 and some Visa/Discover cards run to 19.
      { key: "cardNumber", labelEn: "Card number", labelEs: "Número de tarjeta", type: "text", required: true, sensitive: true, digitsOnly: true, maxLength: 19, crm: custom("card_number"), showIf: { field: "paymentMethod", equals: ["Credit card", "Debit card"] } },
      { key: "cardExpiration", labelEn: "Expiration (MM/YY)", labelEs: "Vencimiento (MM/AA)", type: "text", required: true, sensitive: true, maxLength: 5, crm: custom("card_expiration"), crmLabel: "Card expiration", showIf: { field: "paymentMethod", equals: ["Credit card", "Debit card"] }, placeholderEn: "MM/YY", placeholderEs: "MM/AA" },
      { key: "cardCvv", labelEn: "Security code (CVV)", labelEs: "Código de seguridad (CVV)", type: "text", required: true, sensitive: true, digitsOnly: true, maxLength: 4, crm: custom("card_cvv"), crmLabel: "Card security code", showIf: { field: "paymentMethod", equals: ["Credit card", "Debit card"] } },
      { key: "cardBillingZip", labelEn: "Billing zip code", labelEs: "Código postal de facturación", type: "zip", required: true, digitsOnly: true, maxLength: 5, crm: custom("card_billing_zip"), crmLabel: "Card billing zip", showIf: { field: "paymentMethod", equals: ["Credit card", "Debit card"] } },
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
      {
        key: "marketplaceAccountExists", labelEn: "Has a HealthCare.gov account?", labelEs: "¿Tiene cuenta de HealthCare.gov?", type: "select", crm: custom("marketplace_account_exists"), crmLabel: "HealthCare.gov account",
        options: [
          { value: "Yes", labelEn: "Yes", labelEs: "Sí" },
          { value: "No", labelEn: "No", labelEs: "No" },
          { value: "Not sure", labelEn: "Not sure", labelEs: "No estoy seguro" },
        ],
      },
      { key: "marketplaceUsername", labelEn: "Marketplace username", labelEs: "Usuario del Marketplace", type: "text", sensitive: true, crm: custom("marketplace_username") },
      { key: "marketplaceApplicationId", labelEn: "Marketplace application ID", labelEs: "ID de solicitud del Marketplace", type: "text", crm: custom("marketplace_application_id") },
      { key: "planSelected", labelEn: "Plan selected", labelEs: "Plan seleccionado", type: "text", crm: custom("plan_selected") },
      { key: "carrierSelected", labelEn: "Carrier selected", labelEs: "Aseguradora seleccionada", type: "text", crm: custom("carrier_selected") },
      {
        key: "applicationStatus", labelEn: "Application status", labelEs: "Estado de la solicitud", type: "select", crm: custom("application_status"),
        options: [
          { value: "Not started", labelEn: "Not started", labelEs: "No iniciada" },
          { value: "In progress", labelEn: "In progress", labelEs: "En progreso" },
          { value: "Submitted", labelEn: "Submitted", labelEs: "Enviada" },
          { value: "Pending docs", labelEn: "Pending documents", labelEs: "Documentos pendientes" },
          { value: "Approved", labelEn: "Approved", labelEs: "Aprobada" },
          { value: "Enrolled", labelEn: "Enrolled", labelEs: "Inscrito" },
          { value: "Declined", labelEn: "Declined", labelEs: "Rechazada" },
        ],
      },
      { key: "agentNotes", labelEn: "Notes", labelEs: "Notas", type: "textarea", crm: custom("agent_notes"), crmLabel: "Agent notes", },
      { key: "agentNpn", labelEn: "Agent NPN", labelEs: "NPN del agente", type: "text", crm: custom("agent_npn") },
    ],
  },
];

/** Household member slot slugs in order, for CRM serialization (aca_member_1..8). */
export const MEMBER_SLUGS: AcaFieldSlug[] = [
  "aca_member_1",
  "aca_member_2",
  "aca_member_3",
  "aca_member_4",
  "aca_member_5",
  "aca_member_6",
  "aca_member_7",
  "aca_member_8",
];

export const MAX_HOUSEHOLD_MEMBERS = 8;

/** Sections a given role should see/step through (clients skip owner-only sections). */
export function visibleSections(isOwner: boolean): AcaSection[] {
  if (isOwner) return ACA_SECTIONS;
  return ACA_SECTIONS.filter((s) => !s.ownerOnly);
}

/** One row of a repeater. File sub-fields hold FileRef[]; everything else is a string. */
export type RepeaterRow = Record<string, string | FileRef[] | undefined>;

/** Build an empty row for a repeater field (every declared sub-field present and blank). */
export function emptyRow(field: AcaField): RepeaterRow {
  const row: RepeaterRow = {};
  for (const sub of field.rowFields ?? []) {
    row[sub.key] = sub.type === "file" ? [] : "";
  }
  return row;
}

/** Flat list of plain scalar fields (excludes repeaters and file uploads). */
export function allScalarFields(): AcaField[] {
  return ACA_SECTIONS.flatMap((s) => s.fields).filter(
    (f) => f.type !== "repeater" && f.type !== "file"
  );
}

/** All top-level file-upload fields, keyed for the files API / CRM media sync. */
export function allFileFields(): AcaField[] {
  return ACA_SECTIONS.flatMap((s) => s.fields).filter((f) => f.type === "file");
}

/** All repeater fields, in section order. */
export function allRepeaterFields(): AcaField[] {
  return ACA_SECTIONS.flatMap((s) => s.fields).filter((f) => f.type === "repeater");
}

export function fieldByKey(key: string): AcaField | undefined {
  for (const section of ACA_SECTIONS) {
    const f = section.fields.find((x) => x.key === key);
    if (f) return f;
  }
  return undefined;
}

/** A sub-field inside a repeater row, e.g. rowFieldByKey("householdMembers", "ssn"). */
export function rowFieldByKey(repeaterKey: string, rowFieldKey: string): AcaField | undefined {
  const repeater = fieldByKey(repeaterKey);
  if (!repeater || repeater.type !== "repeater") return undefined;
  return repeater.rowFields?.find((f) => f.key === rowFieldKey);
}

/**
 * True when a field's showIf condition is satisfied by the given data.
 * Inside a repeater, pass the ROW object so conditions resolve against sibling sub-fields.
 */
export function isFieldVisible(field: AcaField, data: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const current = data[field.showIf.field];
  const expected = field.showIf.equals;
  if (Array.isArray(expected)) return expected.includes(String(current ?? ""));
  return String(current ?? "") === expected;
}

/** A row counts as "filled" when any non-file sub-field has a value. */
export function isRowFilled(field: AcaField, row: RepeaterRow): boolean {
  for (const sub of field.rowFields ?? []) {
    if (sub.type === "file") continue;
    const v = row[sub.key];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}
