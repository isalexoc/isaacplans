/**
 * Section builders shared across the intake configs.
 *
 * Short Term Medical, Dental & Vision, Hospital Indemnity and Health Coverage Alternative ask the
 * same questions — who you are, where you live, who else to cover, when you want it to start, and
 * how you're paying — so they share one builder and differ only in the coverage step. Life
 * Insurance is genuinely different (beneficiaries, health history, a coverage amount) and composes
 * these building blocks itself rather than taking the whole set.
 *
 * Every CRM custom-field slug is prefixed per line of business. GHL custom fields are global to
 * the location, so a shared `middle_name` would let one line's intake overwrite what another
 * captured on the same contact — the same reasoning that keeps the three original intakes on
 * separate tables.
 */

import type { IntakeField, IntakeOption, IntakeSection, NativeContactField, RepeaterRow } from "@/lib/intake-core/types";

export const native = (field: NativeContactField) => ({ kind: "native" as const, field });
export const custom = (slug: string) => ({ kind: "custom" as const, slug });

export const YES_NO: IntakeOption[] = [
  { value: "yes", labelEn: "Yes", labelEs: "Sí" },
  { value: "no", labelEn: "No", labelEs: "No" },
];

export const SEX_OPTIONS: IntakeOption[] = [
  { value: "Male", labelEn: "Male", labelEs: "Masculino" },
  { value: "Female", labelEn: "Female", labelEs: "Femenino" },
];

export const MARITAL_OPTIONS: IntakeOption[] = [
  { value: "Single", labelEn: "Single", labelEs: "Soltero(a)" },
  { value: "Married", labelEn: "Married", labelEs: "Casado(a)" },
  { value: "Domestic partnership", labelEn: "Domestic partnership", labelEs: "Unión de hecho" },
  { value: "Divorced", labelEn: "Divorced", labelEs: "Divorciado(a)" },
  { value: "Widowed", labelEn: "Widowed", labelEs: "Viudo(a)" },
];

export const DEPENDENT_RELATIONSHIP_OPTIONS: IntakeOption[] = [
  { value: "Spouse", labelEn: "Spouse", labelEs: "Cónyuge" },
  { value: "Domestic partner", labelEn: "Domestic partner", labelEs: "Pareja de hecho" },
  { value: "Son", labelEn: "Son", labelEs: "Hijo" },
  { value: "Daughter", labelEn: "Daughter", labelEs: "Hija" },
  { value: "Stepchild", labelEn: "Stepchild", labelEs: "Hijastro(a)" },
  { value: "Other dependent", labelEn: "Other dependent", labelEs: "Otro dependiente" },
];

export const COVERAGE_TYPE_OPTIONS: IntakeOption[] = [
  { value: "Individual", labelEn: "Just me", labelEs: "Solo yo" },
  { value: "Individual + spouse", labelEn: "Me and my spouse", labelEs: "Mi cónyuge y yo" },
  { value: "Individual + children", labelEn: "Me and my children", labelEs: "Mis hijos y yo" },
  { value: "Family", labelEn: "My whole family", labelEs: "Toda mi familia" },
];

const PAYMENT_METHOD_OPTIONS: IntakeOption[] = [
  { value: "Bank draft", labelEn: "Bank draft (checking or savings)", labelEs: "Débito bancario (cheques o ahorros)" },
  { value: "Credit card", labelEn: "Credit card", labelEs: "Tarjeta de crédito" },
  { value: "Debit card", labelEn: "Debit card", labelEs: "Tarjeta de débito" },
];

const APPLICATION_STATUS_OPTIONS: IntakeOption[] = [
  { value: "Not started", labelEn: "Not started", labelEs: "No iniciada" },
  { value: "Submitted", labelEn: "Submitted to carrier", labelEs: "Enviada a la aseguradora" },
  { value: "Pending requirements", labelEn: "Pending requirements", labelEs: "Pendiente de requisitos" },
  { value: "Approved", labelEn: "Approved", labelEs: "Aprobada" },
  { value: "Declined", labelEn: "Declined", labelEs: "Rechazada" },
];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Terse one-line CRM rendering for a covered person, mirroring ACA's `aca_member_N` format. */
export function formatPersonRow(row: RepeaterRow, index: number): string {
  const parts: string[] = [];
  const name = [str(row.firstName), str(row.lastName)].filter(Boolean).join(" ");
  if (name) parts.push(name);
  if (str(row.relationship)) parts.push(str(row.relationship));
  if (str(row.dateOfBirth)) parts.push(`DOB ${str(row.dateOfBirth)}`);
  if (str(row.sex)) parts.push(str(row.sex));
  if (str(row.ssn)) parts.push(`SSN ${str(row.ssn)}`);
  else if (str(row.noSsnReason)) parts.push(`No SSN (${str(row.noSsnReason)})`);
  return parts.length ? `${index + 1}. ${parts.join(", ")}` : "";
}

// ── Reusable sections ────────────────────────────────────────────────────────

/** "About you" — the primary applicant. `p` is the line's slug prefix. */
export function personalSection(p: string): IntakeSection {
  return {
    key: "personal",
    titleEn: "About you",
    titleEs: "Sobre usted",
    descriptionEn: "Details about the primary applicant.",
    descriptionEs: "Datos del solicitante principal.",
    fields: [
      { key: "firstName", labelEn: "First name", labelEs: "Primer nombre", type: "text", required: true, crm: native("firstName") },
      { key: "middleName", labelEn: "Middle name", labelEs: "Segundo nombre", type: "text", crm: custom(`${p}_middle_name`), crmLabel: "Middle name" },
      { key: "lastName", labelEn: "Last name", labelEs: "Primer apellido", type: "text", required: true, crm: native("lastName") },
      { key: "secondLastName", labelEn: "Second last name", labelEs: "Segundo apellido", type: "text" },
      { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true, crm: native("dateOfBirth") },
      { key: "sex", labelEn: "Sex", labelEs: "Sexo", type: "select", required: true, options: SEX_OPTIONS, crm: custom(`${p}_sex`), crmLabel: "Sex" },
      {
        key: "ssn", labelEn: "Social Security number", labelEs: "Número de seguro social", type: "ssn", required: true,
        sensitive: true, digitsOnly: true, maxLength: 9, crm: custom(`${p}_ssn`), crmLabel: "SSN",
        helpEn: "Carriers require this to verify identity. It is encrypted and never shown back to you in full.",
        helpEs: "Las aseguradoras lo requieren para verificar su identidad. Se guarda encriptado y nunca se le muestra completo.",
      },
      { key: "maritalStatus", labelEn: "Marital status", labelEs: "Estado civil", type: "select", options: MARITAL_OPTIONS, crm: custom(`${p}_marital_status`), crmLabel: "Marital status" },
      { key: "phone", labelEn: "Phone", labelEs: "Teléfono", type: "tel", required: true, crm: native("phone") },
      { key: "altPhone", labelEn: "Another phone number", labelEs: "Otro número de teléfono", type: "tel", crm: custom(`${p}_alt_phone`), crmLabel: "Alternate phone" },
      { key: "email", labelEn: "Email", labelEs: "Correo electrónico", type: "email", required: true, crm: native("email") },
    ],
  };
}

/** "Home address" with Google-Places-backed autocomplete on line 1. */
export function residenceSection(p: string): IntakeSection {
  return {
    key: "residence",
    titleEn: "Home address",
    titleEs: "Dirección de residencia",
    descriptionEn: "Where you actually live — carriers price by county.",
    descriptionEs: "Donde vive realmente — las aseguradoras cotizan por condado.",
    fields: [
      {
        key: "address1", labelEn: "Street address", labelEs: "Dirección", type: "address", required: true,
        crm: native("address1"),
        addressTargets: { city: "city", state: "state", zip: "postalCode", county: "county" },
      },
      { key: "address2", labelEn: "Apartment, suite, unit", labelEs: "Apartamento, suite, unidad", type: "text" },
      { key: "city", labelEn: "City", labelEs: "Ciudad", type: "text", required: true, crm: native("city") },
      { key: "state", labelEn: "State", labelEs: "Estado", type: "text", required: true, maxLength: 2, crm: native("state"), placeholderEn: "e.g. VA", placeholderEs: "ej. VA" },
      { key: "postalCode", labelEn: "ZIP code", labelEs: "Código postal", type: "zip", required: true, digitsOnly: true, maxLength: 5, crm: native("postalCode") },
      { key: "county", labelEn: "County", labelEs: "Condado", type: "text", crm: custom(`${p}_county`), crmLabel: "County" },
      {
        key: "mailingSameAsHome", labelEn: "Is your mailing address the same?", labelEs: "¿Su dirección postal es la misma?",
        type: "select", required: true, options: YES_NO, crm: custom(`${p}_mailing_same`), crmLabel: "Mailing same as home",
      },
      {
        key: "mailingAddress", labelEn: "Mailing address", labelEs: "Dirección postal", type: "address", fullAddress: true,
        showIf: { field: "mailingSameAsHome", equals: "no" }, crm: custom(`${p}_mailing_address`), crmLabel: "Mailing address",
      },
    ],
  };
}

/** "Who else to cover" — gated repeater, so a single applicant never sees an empty row. */
export function dependentsSection(p: string, maxRows = 6): IntakeSection {
  const rowFields: IntakeField[] = [
    { key: "relationship", labelEn: "Relationship to you", labelEs: "Parentesco con usted", type: "select", required: true, options: DEPENDENT_RELATIONSHIP_OPTIONS },
    { key: "firstName", labelEn: "First name", labelEs: "Primer nombre", type: "text", required: true },
    { key: "lastName", labelEn: "Last name", labelEs: "Apellido", type: "text", required: true },
    { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true },
    { key: "sex", labelEn: "Sex", labelEs: "Sexo", type: "select", required: true, options: SEX_OPTIONS },
    { key: "hasSsn", labelEn: "Do they have a Social Security number?", labelEs: "¿Tiene número de seguro social?", type: "select", required: true, options: YES_NO },
    { key: "ssn", labelEn: "Social Security number", labelEs: "Número de seguro social", type: "ssn", sensitive: true, digitsOnly: true, maxLength: 9, showIf: { field: "hasSsn", equals: "yes" } },
    {
      key: "noSsnReason", labelEn: "Why no SSN?", labelEs: "¿Por qué no tiene SSN?", type: "select",
      showIf: { field: "hasSsn", equals: "no" },
      options: [
        { value: "Not eligible for an SSN", labelEn: "Not eligible for an SSN", labelEs: "No elegible para un SSN" },
        { value: "Applied but not received", labelEn: "Applied but not received yet", labelEs: "Solicitado pero aún no recibido" },
        { value: "Religious objection", labelEn: "Religious objection", labelEs: "Objeción religiosa" },
      ],
    },
  ];

  return {
    key: "dependents",
    titleEn: "Who else to cover",
    titleEs: "A quién más cubrir",
    descriptionEn: "Add anyone who should be on the plan with you.",
    descriptionEs: "Agregue a quienes deban estar en el plan con usted.",
    fields: [
      {
        key: "hasDependents", labelEn: "Is anyone else being covered?", labelEs: "¿Se va a cubrir a alguien más?",
        type: "select", required: true, options: YES_NO, crm: custom(`${p}_has_dependents`), crmLabel: "Has dependents",
      },
      {
        key: "dependents", labelEn: "People to cover", labelEs: "Personas a cubrir", type: "repeater",
        sensitive: true, minRows: 1, maxRows,
        showIf: { field: "hasDependents", equals: "yes" },
        rowLabelEn: "Person", rowLabelEs: "Persona",
        rowFields,
        crmSlots: Array.from({ length: maxRows }, (_, i) => `${p}_dependent_${i + 1}`),
        rowFormat: formatPersonRow,
      },
    ],
  };
}

/** "Coverage" step for the four ancillary lines. `includeTobacco` is medically underwritten only. */
export function coverageSection(
  p: string,
  opts: { includeTobacco?: boolean; titleEn?: string; titleEs?: string } = {}
): IntakeSection {
  const fields: IntakeField[] = [
    {
      key: "requestedEffectiveDate", labelEn: "When would you like coverage to start?", labelEs: "¿Cuándo desea que empiece la cobertura?",
      type: "date", required: true, crm: custom(`${p}_effective_date`), crmLabel: "Requested effective date",
    },
    {
      key: "coverageType", labelEn: "Who needs to be covered?", labelEs: "¿Quién necesita cobertura?",
      type: "select", required: true, options: COVERAGE_TYPE_OPTIONS, crm: custom(`${p}_coverage_type`), crmLabel: "Coverage type",
    },
    {
      key: "currentlyInsured", labelEn: "Do you have coverage right now?", labelEs: "¿Tiene cobertura actualmente?",
      type: "select", required: true, options: YES_NO, crm: custom(`${p}_currently_insured`), crmLabel: "Currently insured",
    },
    {
      key: "currentCarrier", labelEn: "Who is your current carrier?", labelEs: "¿Cuál es su aseguradora actual?",
      type: "text", showIf: { field: "currentlyInsured", equals: "yes" }, crm: custom(`${p}_current_carrier`), crmLabel: "Current carrier",
    },
  ];

  if (opts.includeTobacco) {
    fields.push({
      key: "tobaccoUse", labelEn: "Have you used tobacco or nicotine in the last 12 months?",
      labelEs: "¿Ha usado tabaco o nicotina en los últimos 12 meses?",
      type: "select", required: true, options: YES_NO, crm: custom(`${p}_tobacco`), crmLabel: "Tobacco use",
    });
  }

  fields.push({
    key: "additionalQuestions", labelEn: "Anything else we should know?", labelEs: "¿Algo más que debamos saber?",
    type: "textarea", crm: custom(`${p}_additional_questions`), crmLabel: "Additional questions",
  });

  return {
    key: "coverage",
    titleEn: opts.titleEn ?? "Coverage",
    titleEs: opts.titleEs ?? "Cobertura",
    descriptionEn: "What you want and when you want it to begin.",
    descriptionEs: "Qué desea y cuándo desea que comience.",
    fields,
  };
}

/** Optional document uploads. Both go to the CRM media library via the files route. */
export function documentsSection(p: string): IntakeSection {
  return {
    key: "documents",
    titleEn: "Documents",
    titleEs: "Documentos",
    descriptionEn: "Optional — a photo from your phone is fine.",
    descriptionEs: "Opcional — una foto desde su teléfono es suficiente.",
    fields: [
      { key: "docPhotoId", labelEn: "Photo ID", labelEs: "Identificación con foto", type: "file", crm: custom(`${p}_doc_photo_id`), crmLabel: "Photo ID" },
      { key: "docInsuranceCard", labelEn: "Current insurance card", labelEs: "Tarjeta de seguro actual", type: "file", crm: custom(`${p}_doc_insurance_card`), crmLabel: "Current insurance card" },
    ],
  };
}

/**
 * "Payment" — bank/card branches keyed off the method. The routing/card field KEYS are load
 * bearing: `fieldFormatError` in lib/intake-core/validation.ts keys its Luhn-ish checks off
 * `routingNumber`, `cardNumber`, `cardExpiration` and `cardCvv` by name, because those are plain
 * `text` fields rather than their own types.
 */
export function paymentSection(p: string): IntakeSection {
  const CARD = ["Credit card", "Debit card"];
  return {
    key: "payment",
    titleEn: "Payment",
    titleEs: "Pago",
    descriptionEn: "Nothing is charged until your coverage is approved and you confirm.",
    descriptionEs: "No se cobra nada hasta que su cobertura sea aprobada y usted confirme.",
    fields: [
      { key: "paymentMethod", labelEn: "How would you like to pay?", labelEs: "¿Cómo desea pagar?", type: "select", required: true, options: PAYMENT_METHOD_OPTIONS, crm: custom(`${p}_payment_method`), crmLabel: "Payment method" },
      { key: "payorSameAsApplicant", labelEn: "Are you the one paying?", labelEs: "¿Usted es quien paga?", type: "select", required: true, options: YES_NO, crm: custom(`${p}_payor_same`), crmLabel: "Payor same as applicant" },
      { key: "payorName", labelEn: "Who is paying?", labelEs: "¿Quién paga?", type: "text", showIf: { field: "payorSameAsApplicant", equals: "no" }, crm: custom(`${p}_payor_name`), crmLabel: "Payor name" },
      { key: "payorRelationship", labelEn: "Their relationship to you", labelEs: "Su parentesco con usted", type: "text", showIf: { field: "payorSameAsApplicant", equals: "no" }, crm: custom(`${p}_payor_relationship`), crmLabel: "Payor relationship" },

      { key: "bankName", labelEn: "Bank name", labelEs: "Nombre del banco", type: "text", showIf: { field: "paymentMethod", equals: "Bank draft" }, crm: custom(`${p}_bank_name`), crmLabel: "Bank name" },
      { key: "routingNumber", labelEn: "Routing number", labelEs: "Número de ruta", type: "text", sensitive: true, digitsOnly: true, maxLength: 9, showIf: { field: "paymentMethod", equals: "Bank draft" }, crm: custom(`${p}_routing_number`), crmLabel: "Routing number" },
      { key: "accountNumber", labelEn: "Account number", labelEs: "Número de cuenta", type: "text", sensitive: true, digitsOnly: true, maxLength: 17, showIf: { field: "paymentMethod", equals: "Bank draft" }, crm: custom(`${p}_account_number`), crmLabel: "Account number" },
      {
        key: "accountType", labelEn: "Account type", labelEs: "Tipo de cuenta", type: "select",
        showIf: { field: "paymentMethod", equals: "Bank draft" }, crm: custom(`${p}_account_type`), crmLabel: "Account type",
        options: [
          { value: "Checking", labelEn: "Checking", labelEs: "Cheques" },
          { value: "Savings", labelEn: "Savings", labelEs: "Ahorros" },
        ],
      },

      { key: "cardholderName", labelEn: "Name on card", labelEs: "Nombre en la tarjeta", type: "text", showIf: { field: "paymentMethod", equals: CARD }, crm: custom(`${p}_cardholder_name`), crmLabel: "Cardholder name" },
      { key: "cardNumber", labelEn: "Card number", labelEs: "Número de tarjeta", type: "text", sensitive: true, digitsOnly: true, maxLength: 19, showIf: { field: "paymentMethod", equals: CARD }, crm: custom(`${p}_card_number`), crmLabel: "Card number" },
      { key: "cardExpiration", labelEn: "Expiration (MM/YY)", labelEs: "Vencimiento (MM/AA)", type: "text", maxLength: 5, showIf: { field: "paymentMethod", equals: CARD }, crm: custom(`${p}_card_expiration`), crmLabel: "Card expiration" },
      { key: "cardCvv", labelEn: "Security code", labelEs: "Código de seguridad", type: "text", sensitive: true, digitsOnly: true, maxLength: 4, showIf: { field: "paymentMethod", equals: CARD }, crm: custom(`${p}_card_cvv`), crmLabel: "Card CVV" },
      { key: "cardBillingZip", labelEn: "Billing ZIP code", labelEs: "Código postal de facturación", type: "zip", digitsOnly: true, maxLength: 5, showIf: { field: "paymentMethod", equals: CARD }, crm: custom(`${p}_card_billing_zip`), crmLabel: "Card billing ZIP" },
    ],
  };
}

/** Agent-only working notes. Never blocks a client submission (`ownerOnly` sections are skipped). */
export function agentSection(p: string): IntakeSection {
  return {
    key: "agent",
    titleEn: "Agent notes",
    titleEs: "Notas del agente",
    descriptionEn: "Only you see this section.",
    descriptionEs: "Solo usted ve esta sección.",
    ownerOnly: true,
    fields: [
      { key: "carrierSelected", labelEn: "Carrier selected", labelEs: "Aseguradora seleccionada", type: "text", crm: custom(`${p}_carrier_selected`), crmLabel: "Carrier selected" },
      { key: "planSelected", labelEn: "Plan selected", labelEs: "Plan seleccionado", type: "text", crm: custom(`${p}_plan_selected`), crmLabel: "Plan selected" },
      { key: "applicationStatus", labelEn: "Application status", labelEs: "Estado de la solicitud", type: "select", options: APPLICATION_STATUS_OPTIONS, crm: custom(`${p}_application_status`), crmLabel: "Application status" },
      { key: "policyNumber", labelEn: "Policy number", labelEs: "Número de póliza", type: "text", crm: custom(`${p}_policy_number`), crmLabel: "Policy number" },
      { key: "agentNotes", labelEn: "Notes", labelEs: "Notas", type: "textarea", crm: custom(`${p}_agent_notes`), crmLabel: "Agent notes" },
      { key: "agentNpn", labelEn: "Agent NPN", labelEs: "NPN del agente", type: "text", crm: custom(`${p}_agent_npn`), crmLabel: "Agent NPN" },
    ],
  };
}

/** The full ancillary question set, in wizard order. */
export function ancillarySections(
  p: string,
  opts: { includeTobacco?: boolean; coverageTitleEn?: string; coverageTitleEs?: string } = {}
): IntakeSection[] {
  return [
    personalSection(p),
    residenceSection(p),
    dependentsSection(p),
    coverageSection(p, {
      includeTobacco: opts.includeTobacco,
      titleEn: opts.coverageTitleEn,
      titleEs: opts.coverageTitleEs,
    }),
    documentsSection(p),
    paymentSection(p),
    agentSection(p),
  ];
}
