import type { IntakeField, IntakeLobConfig, IntakeOption, IntakeSection } from "@/lib/intake-core/types";
import { isValidSsnLast4, passesLuhn } from "@/lib/intake-core/validation";
import { LS_ADVISOR_NAME, NOT_INSURANCE_LINE_ES } from "@/lib/legal-shield/constants";
import { asBilling, asPackage, lsQuoteSentence } from "@/lib/legal-shield/plans";

/**
 * Legal Shield: the membership application Isaac's dad, Ysmael Orraiz (a LegalShield Independent
 * Associate), fills with his clients, Impact-style: dashboard → client form → screen share → deck →
 * "Confirmar mis datos" → this form → he enrolls the client on LegalShield's site.
 *
 * LegalShield is NOT insurance. Every section here is written fresh: the shared builders in
 * _shared.ts say "aseguradora", "cobertura", "póliza", "NPN", and none of that may reach this form.
 * `pnpm test:staff-access` scans every label for those words.
 *
 * The order follows LegalShield's own enrollment screens, so Ysmael copies the summary top to
 * bottom: the plan, personal information (email, name, address, mobile phone, birth date, last
 * four of the SSN), preferred language and accessibility, family (optional), payment.
 *
 * Isaac's decisions (2026-11-24): one offer only (the Preferred legal plan + IDShield Family 3B),
 * SSN last 4 only, card number and CVV kept encrypted like the other numbers, links sent from
 * Ysmael's own WhatsApp, Spanish only, nothing written to new GHL custom fields.
 */

const YES_NO: IntakeOption[] = [
  { value: "yes", labelEn: "Yes", labelEs: "Sí" },
  { value: "no", labelEn: "No", labelEs: "No" },
];

const BILLING_OPTIONS: IntakeOption[] = [
  {
    value: "mensual",
    labelEn: "Monthly",
    labelEs: "Pago mensual",
    descriptionEn: "Charged every month.",
    descriptionEs: "Se cobra cada mes.",
  },
  {
    value: "anual",
    labelEn: "Yearly",
    labelEs: "Pago anual",
    descriptionEn: "One payment a year: 10% off the legal plan.",
    descriptionEs: "Un solo pago al año: 10% menos en el plan legal.",
  },
];

const PACKAGE_OPTIONS: IntakeOption[] = [
  {
    value: "preferido_idshield",
    labelEn: "Preferred + IDShield Family 3B",
    labelEs: "Preferencial + IDShield Familiar (3 agencias)",
    descriptionEn: "The full package ($74.90 a month).",
    descriptionEs: "El paquete completo ($74.90 al mes).",
  },
  {
    value: "solo_preferido",
    labelEn: "Preferred legal plan only",
    labelEs: "Solo el Plan Legal Preferencial",
    descriptionEn: "Without IDShield ($39.95 a month).",
    descriptionEs: "Sin IDShield ($39.95 al mes).",
  },
];

/** The plan. The client confirms the payment schedule; only Ysmael sees the package switch. */
const plan: IntakeSection = {
  key: "plan",
  titleEn: "Your plan",
  titleEs: "Su plan",
  descriptionEn: "The plan you chose with your advisor.",
  descriptionEs: "El plan que escogió con su asesor.",
  callout: {
    tone: "info",
    titleEn: "Legal services membership",
    titleEs: "Membresía de servicios legales",
    bodyEn:
      "This is not insurance. Benefits and prices vary by state; your advisor confirms them before you enroll.",
    bodyEs:
      "Esto no es un seguro. Los beneficios y los precios varían según el estado; su asesor se los confirma antes de inscribirle.",
  },
  fields: [
    {
      key: "lsBilling",
      labelEn: "How would you like to pay?",
      labelEs: "¿Cómo desea pagar?",
      type: "select",
      display: "cards",
      required: true,
      options: BILLING_OPTIONS,
      liveNote: (data) => ({
        tone: "info",
        title: "Su plan",
        text: lsQuoteSentence(asPackage(data.lsPackage), asBilling(data.lsBilling)),
      }),
    },
    {
      key: "lsPackage",
      labelEn: "Package (only you see this)",
      labelEs: "Paquete (solo usted ve esto)",
      type: "select",
      display: "cards",
      // The client never sees or writes this: dropping IDShield is the advisor's answer to a budget
      // objection. The client's form still shows the resulting price in the note above.
      ownerOnly: true,
      options: PACKAGE_OPTIONS,
    },
  ],
};

/** "Información personal", in the order of LegalShield's screen. */
const personal: IntakeSection = {
  key: "personal",
  titleEn: "Personal information",
  titleEs: "Información personal",
  descriptionEn: "The member's details, as on their ID.",
  descriptionEs: "Los datos del titular, como aparecen en su identificación.",
  fields: [
    { key: "email", labelEn: "Email", labelEs: "Correo electrónico", type: "email", required: true, crm: { kind: "native", field: "email" } },
    { key: "firstName", labelEn: "First name", labelEs: "Nombre", type: "text", required: true, crm: { kind: "native", field: "firstName" } },
    { key: "lastName", labelEn: "Last name", labelEs: "Apellido", type: "text", required: true, crm: { kind: "native", field: "lastName" } },
    {
      key: "address1",
      labelEn: "Street address",
      labelEs: "Dirección",
      type: "address",
      required: true,
      crm: { kind: "native", field: "address1" },
      addressTargets: { city: "city", state: "state", zip: "postalCode" },
    },
    { key: "address2", labelEn: "Apartment, suite, unit", labelEs: "Apartamento, suite, unidad", type: "text" },
    { key: "city", labelEn: "City", labelEs: "Ciudad", type: "text", required: true, crm: { kind: "native", field: "city" } },
    {
      key: "state",
      labelEn: "State",
      labelEs: "Estado",
      type: "text",
      required: true,
      maxLength: 2,
      placeholderEn: "e.g. VA",
      placeholderEs: "ej. VA",
      crm: { kind: "native", field: "state" },
    },
    {
      key: "postalCode",
      labelEn: "ZIP code",
      labelEs: "Código postal",
      type: "zip",
      required: true,
      digitsOnly: true,
      maxLength: 5,
      crm: { kind: "native", field: "postalCode" },
    },
    { key: "phone", labelEn: "Mobile phone", labelEs: "Teléfono móvil", type: "tel", required: true, crm: { kind: "native", field: "phone" } },
    { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true, crm: { kind: "native", field: "dateOfBirth" } },
    {
      key: "ssnLast4",
      labelEn: "Last 4 of your Social Security number",
      labelEs: "Últimos 4 dígitos del Seguro Social",
      type: "text",
      sensitive: true,
      digitsOnly: true,
      maxLength: 4,
      isValid: (value) => isValidSsnLast4(value),
      helpEn: "Only the last four digits. Stored encrypted.",
      helpEs: "Solo los últimos cuatro dígitos. Se guardan encriptados.",
    },
  ],
};

const LANGUAGE_OPTIONS: IntakeOption[] = [
  { value: "Español", labelEn: "Spanish", labelEs: "Español" },
  { value: "Inglés", labelEn: "English", labelEs: "Inglés" },
  { value: "Otro", labelEn: "Another language", labelEs: "Otro idioma" },
];

const ACCESSIBILITY_OPTIONS: IntakeOption[] = [
  { value: "Ninguna", labelEn: "None", labelEs: "Ninguna" },
  { value: "Discapacidad visual", labelEn: "Visual impairment", labelEs: "Discapacidad visual" },
  { value: "Discapacidad auditiva", labelEn: "Hearing impairment", labelEs: "Discapacidad auditiva" },
  { value: "Visual y auditiva", labelEn: "Both", labelEs: "Visual y auditiva" },
];

/** "Idioma preferido" and "Adaptaciones de accesibilidad" (LegalShield's two checkboxes, as one question). */
const preferences: IntakeSection = {
  key: "preferences",
  titleEn: "Language and accessibility",
  titleEs: "Idioma y accesibilidad",
  descriptionEn: "How LegalShield should communicate with you.",
  descriptionEs: "Cómo prefiere que LegalShield se comunique con usted.",
  fields: [
    {
      key: "preferredLanguage",
      labelEn: "Preferred language",
      labelEs: "Idioma preferido",
      type: "select",
      display: "cards",
      required: true,
      options: LANGUAGE_OPTIONS,
    },
    {
      key: "preferredLanguageOther",
      labelEn: "Which language?",
      labelEs: "¿Cuál idioma?",
      type: "text",
      required: true,
      showIf: { field: "preferredLanguage", equals: "Otro" },
    },
    {
      key: "accessibility",
      labelEn: "How can we serve you better?",
      labelEs: "¿Cómo podemos servirle mejor?",
      type: "select",
      display: "cards",
      options: ACCESSIBILITY_OPTIONS,
      helpEn: "Accessibility accommodations, if you need any.",
      helpEs: "Adaptaciones de accesibilidad, si las necesita.",
    },
  ],
};

const childFields: IntakeField[] = [
  { key: "firstName", labelEn: "First name", labelEs: "Nombre", type: "text", required: true },
  { key: "lastName", labelEn: "Last name", labelEs: "Apellido", type: "text", required: true },
  { key: "dateOfBirth", labelEn: "Date of birth", labelEs: "Fecha de nacimiento", type: "dob", required: true },
];

/** "Información familiar (opcional)": the spouse and the dependent children who may use the plan. */
const family: IntakeSection = {
  key: "family",
  titleEn: "Family (optional)",
  titleEs: "Familia (opcional)",
  descriptionEn: "Add the family members who will be able to use the membership.",
  descriptionEs: "Agregue a los familiares que podrán usar la membresía.",
  fields: [
    {
      key: "hasSpouse",
      labelEn: "Add your spouse?",
      labelEs: "¿Desea agregar a su cónyuge?",
      type: "select",
      required: true,
      options: YES_NO,
    },
    { key: "spouseFirstName", labelEn: "Spouse's first name", labelEs: "Nombre del cónyuge", type: "text", required: true, showIf: { field: "hasSpouse", equals: "yes" } },
    { key: "spouseLastName", labelEn: "Spouse's last name", labelEs: "Apellido del cónyuge", type: "text", required: true, showIf: { field: "hasSpouse", equals: "yes" } },
    { key: "spouseDateOfBirth", labelEn: "Spouse's date of birth", labelEs: "Fecha de nacimiento del cónyuge", type: "dob", required: true, showIf: { field: "hasSpouse", equals: "yes" } },
    {
      key: "hasDependents",
      labelEn: "Add dependent children?",
      labelEs: "¿Desea agregar hijos dependientes?",
      type: "select",
      required: true,
      options: YES_NO,
    },
    {
      key: "dependents",
      labelEn: "Dependent children",
      labelEs: "Hijos dependientes",
      type: "repeater",
      minRows: 1,
      maxRows: 8,
      showIf: { field: "hasDependents", equals: "yes" },
      rowLabelEn: "Dependent",
      rowLabelEs: "Dependiente",
      rowFields: childFields,
    },
  ],
};

const CARD = "Tarjeta";
const BANK = "Débito bancario";

/** "Credit card" / "Bank draft", LegalShield's two payment tabs. */
const payment: IntakeSection = {
  key: "payment",
  titleEn: "Payment",
  titleEs: "Pago",
  descriptionEn: "Your advisor uses this only to enroll you in LegalShield.",
  descriptionEs: "Su asesor usa estos datos solo para inscribirle en LegalShield.",
  callout: {
    tone: "info",
    titleEn: "Not insurance",
    titleEs: "No es un seguro",
    bodyEn: "This is not insurance. It is a legal services membership. Your numbers are stored encrypted.",
    bodyEs: `${NOT_INSURANCE_LINE_ES} Sus números se guardan encriptados.`,
  },
  fields: [
    {
      key: "paymentMethod",
      labelEn: "How will you pay?",
      labelEs: "¿Con qué va a pagar?",
      type: "select",
      required: true,
      options: [
        { value: CARD, labelEn: "Credit or debit card", labelEs: "Tarjeta de crédito o débito" },
        { value: BANK, labelEn: "Bank draft", labelEs: "Débito bancario (cuenta)" },
      ],
    },
    // The keys below are the engine's payment keys on purpose: its validators key off them.
    {
      key: "cardNumber",
      labelEn: "Card number",
      labelEs: "Número de tarjeta",
      type: "text",
      required: true,
      sensitive: true,
      digitsOnly: true,
      maxLength: 19,
      isValid: (value) => passesLuhn(value),
      showIf: { field: "paymentMethod", equals: CARD },
    },
    {
      key: "cardExpiration",
      labelEn: "Expiration (MM/YY)",
      labelEs: "Vencimiento (MM/AA)",
      type: "text",
      required: true,
      maxLength: 5,
      showIf: { field: "paymentMethod", equals: CARD },
    },
    {
      key: "cardCvv",
      labelEn: "Security code",
      labelEs: "Código de seguridad",
      type: "text",
      required: true,
      sensitive: true,
      digitsOnly: true,
      maxLength: 4,
      showIf: { field: "paymentMethod", equals: CARD },
    },
    { key: "cardholderName", labelEn: "Name on card", labelEs: "Nombre en la tarjeta", type: "text", required: true, showIf: { field: "paymentMethod", equals: CARD } },
    {
      key: "cardBillingZip",
      labelEn: "Billing ZIP code",
      labelEs: "Código postal de facturación",
      type: "zip",
      required: true,
      digitsOnly: true,
      maxLength: 5,
      showIf: { field: "paymentMethod", equals: CARD },
    },
    {
      key: "routingNumber",
      labelEn: "Routing number",
      labelEs: "Número de ruta",
      type: "text",
      required: true,
      sensitive: true,
      digitsOnly: true,
      maxLength: 9,
      showIf: { field: "paymentMethod", equals: BANK },
    },
    {
      key: "accountNumber",
      labelEn: "Account number",
      labelEs: "Número de cuenta",
      type: "text",
      required: true,
      sensitive: true,
      digitsOnly: true,
      maxLength: 17,
      showIf: { field: "paymentMethod", equals: BANK },
    },
    {
      key: "accountType",
      labelEn: "Account type",
      labelEs: "Tipo de cuenta",
      type: "select",
      required: true,
      options: [
        { value: "Checking", labelEn: "Checking", labelEs: "Cheques" },
        { value: "Savings", labelEn: "Savings", labelEs: "Ahorros" },
      ],
      showIf: { field: "paymentMethod", equals: BANK },
    },
    { key: "bankName", labelEn: "Bank name", labelEs: "Nombre del banco", type: "text", showIf: { field: "paymentMethod", equals: BANK } },
    {
      key: "accountHolderName",
      labelEn: "Name on the account",
      labelEs: "Nombre del titular de la cuenta",
      type: "text",
      required: true,
      showIf: { field: "paymentMethod", equals: BANK },
    },
  ],
};

/** The associate's own notes. Never shown to (or sent to, or writable by) the client. */
const agent: IntakeSection = {
  key: "agent",
  titleEn: "Associate notes",
  titleEs: "Notas del asociado",
  descriptionEn: "Only you see this section.",
  descriptionEs: "Solo usted ve esta sección.",
  ownerOnly: true,
  fields: [
    {
      key: "applicationStatus",
      labelEn: "Application status",
      labelEs: "Estado de la solicitud",
      type: "select",
      display: "cards",
      options: [
        { value: "No enviada", labelEn: "Not submitted", labelEs: "No enviada" },
        { value: "Enviada a LegalShield", labelEn: "Submitted to LegalShield", labelEs: "Enviada a LegalShield" },
        { value: "Activa", labelEn: "Active", labelEs: "Activa" },
        { value: "Cancelada", labelEn: "Canceled", labelEs: "Cancelada" },
      ],
    },
    { key: "memberNumber", labelEn: "Member number", labelEs: "Número de miembro", type: "text" },
    { key: "agentNotes", labelEn: "Notes", labelEs: "Notas", type: "textarea" },
  ],
};

export const legalShieldIntake: IntakeLobConfig = {
  lob: "legal-shield",
  label: "Legal Shield",
  formTitle: {
    en: "LegalShield membership application",
    es: "Solicitud de membresía de LegalShield",
  },
  slugPrefix: "ls",
  cookieName: "ls_intake_device",
  // Unused while self-start is off; kept so a future public "apply" has an owner to point at.
  ownerEnvVar: "LEGAL_SHIELD_DEFAULT_OWNER_USER_ID",
  // Spanish only: the same slug in both locales, like the funnel (/en/legal-shield/* 308s to /es).
  intakeSlug: { en: "legal-shield/intake", es: "legal-shield/intake" },
  intakeRoute: "/legal-shield/intake",
  sections: [plan, personal, preferences, family, payment, agent],
  secureCapture: {
    groups: [
      {
        key: "ssnLast4",
        labelEn: "SSN (last 4)",
        labelEs: "Seguro Social (últimos 4)",
        fieldKeys: ["ssnLast4"],
        sections: ["personal"],
      },
      {
        key: "card",
        labelEn: "Card",
        labelEs: "Tarjeta",
        fieldKeys: ["cardNumber", "cardExpiration", "cardCvv", "cardholderName", "cardBillingZip"],
        requires: "paymentMethod",
        requiresEquals: CARD,
        sections: ["payment"],
      },
      {
        key: "bank",
        labelEn: "Bank account",
        labelEs: "Cuenta bancaria",
        // The bank name is filled from the routing number on arrival.
        fieldKeys: ["routingNumber", "accountNumber", "accountType", "accountHolderName"],
        requires: "paymentMethod",
        requiresEquals: BANK,
        sections: ["payment"],
      },
    ],
  },
  brandLogo: {
    src: "/images/legal-shield/red-de-apoyo-lockup.png",
    alt: "Red de Apoyo Latino USA",
    width: 480,
    height: 160,
  },
  presentation: {
    pathname: "/legal-shield/intake/[token]/presentation",
    // CrankWheel stays off until each agent has their own presenter (chunk C).
    meetings: false,
    titleEn: "LegalShield presentation",
    titleEs: "Presentación de LegalShield",
    bodyEn: "Opens in a new tab. Share that tab with the client.",
    bodyEs: "Se abre en una pestaña nueva. Comparta esa pestaña con el cliente.",
    joinedEn: "The client is connected. Start the presentation.",
    joinedEs: "El cliente está conectado. Comience la presentación.",
    openEn: "Open presentation",
    openEs: "Abrir presentación",
    agentToggles: [
      {
        fieldKey: "lsPackage",
        onValue: "preferido_idshield",
        offValue: "solo_preferido",
        labelEn: "IDShield Family 3B in the price",
        labelEs: "IDShield Familiar 3B en el precio",
        hintEn:
          "Only you see this. Turn it off when the client can't afford the package: the price slide keeps only the Preferred legal plan ($39.95). In the presentation: Shift+I.",
        hintEs:
          "Solo usted ve esto. Apáguelo si el cliente no puede pagar el paquete: la lámina de precio queda solo con el Plan Legal Preferencial ($39.95). En la presentación: Shift+I.",
      },
    ],
  },
  linkDelivery: {
    kind: "whatsapp",
    agentName: LS_ADVISOR_NAME,
    product: { en: "your LegalShield membership application", es: "su solicitud de membresía de LegalShield" },
  },
  selfStart: false,
  adminOversight: true,
  contactTags: ["legal_shield_intake"],
  contactSearchTags: ["legal_shield", "legal_shield_intake"],
  crmSync: "completion-fill-blanks",
  crmCustomFields: false,
  keepSensitiveAfterSync: true,
  // Under the intake path, so the private-pages rule covers it; no "seguro" (it also means insurance).
  secureSlug: { en: "legal-shield/intake/privado", es: "legal-shield/intake/privado" },
  fixedLocale: "es",
  noCrmWording: true,
  notifyOwnerByEmail: true,
  summaryDateFormat: "mdy",
  initialData: { lsPackage: "preferido_idshield" },
};
