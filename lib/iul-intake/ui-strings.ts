/** Self-contained bilingual UI strings + label helpers for the intake frontend. */

import type { IntakeField, IntakeOption, IntakeSection } from "./fields";

export type IntakeLocale = "en" | "es";

export function pickLocale(locale: string): IntakeLocale {
  return locale === "es" ? "es" : "en";
}

export function fieldLabel(field: IntakeField, locale: IntakeLocale): string {
  const raw = locale === "es" ? field.labelEs : field.labelEn;
  return applyYearTokens(raw);
}

/** Replace {currentYear}/{lastYear} so income labels never hard-code the year. */
export function applyYearTokens(text: string): string {
  if (!text.includes("{")) return text;
  const current = new Date().getFullYear();
  return text
    .replace(/\{currentYear\}/g, String(current))
    .replace(/\{lastYear\}/g, String(current - 1));
}

export function fieldPlaceholder(field: IntakeField, locale: IntakeLocale): string | undefined {
  return locale === "es" ? field.placeholderEs : field.placeholderEn;
}

export function fieldHelp(field: IntakeField, locale: IntakeLocale): string | undefined {
  return locale === "es" ? field.helpEs : field.helpEn;
}

export function optionLabel(option: IntakeOption, locale: IntakeLocale): string {
  return locale === "es" ? option.labelEs : option.labelEn;
}

export function sectionTitle(section: IntakeSection, locale: IntakeLocale): string {
  return locale === "es" ? section.titleEs : section.titleEn;
}

export function sectionDescription(section: IntakeSection, locale: IntakeLocale): string | undefined {
  return locale === "es" ? section.descriptionEs : section.descriptionEn;
}

type Dict = Record<IntakeLocale, string>;

export const UI = {
  // Dashboard
  dashboardTitle: { en: "IUL Client Intake", es: "Registro de clientes IUL" } as Dict,
  dashboardSubtitle: {
    en: "Start a secure data-collection form, fill it yourself, or send the client a link.",
    es: "Inicie un formulario seguro, complételo usted mismo o envíe un enlace al cliente.",
  } as Dict,
  newIntake: { en: "New intake", es: "Nuevo registro" } as Dict,
  clientName: { en: "Client name", es: "Nombre del cliente" } as Dict,
  firstName: { en: "First name", es: "Nombre" } as Dict,
  lastName: { en: "Last name", es: "Apellido" } as Dict,
  preferredLanguage: { en: "Preferred language", es: "Idioma preferido" } as Dict,
  email: { en: "Email", es: "Correo electrónico" } as Dict,
  phone: { en: "Phone", es: "Teléfono" } as Dict,
  startIntake: { en: "Start intake", es: "Iniciar registro" } as Dict,
  creating: { en: "Creating…", es: "Creando…" } as Dict,
  search: { en: "Search clients…", es: "Buscar clientes…" } as Dict,
  allStatuses: { en: "All statuses", es: "Todos los estados" } as Dict,
  statusDraft: { en: "Draft", es: "Borrador" } as Dict,
  statusInProgress: { en: "In progress", es: "En progreso" } as Dict,
  statusCompleted: { en: "Completed", es: "Completado" } as Dict,
  updated: { en: "Updated", es: "Actualizado" } as Dict,
  edit: { en: "Edit", es: "Editar" } as Dict,
  view: { en: "View", es: "Ver" } as Dict,
  copyLink: { en: "Copy link", es: "Copiar enlace" } as Dict,
  linkCopied: { en: "Link copied!", es: "¡Enlace copiado!" } as Dict,
  resetLink: { en: "Reset link", es: "Restablecer enlace" } as Dict,
  deleteForm: { en: "Delete", es: "Eliminar" } as Dict,
  deleteConfirm: {
    en: "Delete this intake form? This permanently removes the saved form data. The CRM contact is not affected. This cannot be undone.",
    es: "¿Eliminar este formulario? Esto elimina permanentemente los datos guardados del formulario. El contacto del CRM no se ve afectado. Esta acción no se puede deshacer.",
  } as Dict,
  prevPage: { en: "Previous", es: "Anterior" } as Dict,
  nextPage: { en: "Next", es: "Siguiente" } as Dict,
  pageOf: { en: "Page {page} of {total}", es: "Página {page} de {total}" } as Dict,
  sendLink: { en: "Send link", es: "Enviar enlace" } as Dict,
  linkSent: { en: "Link sent!", es: "¡Enlace enviado!" } as Dict,
  resetConfirm: {
    en: "Reset this link? The old link will stop working and anyone who already opened it will lose access. A new link will be copied for you to send.",
    es: "¿Restablecer este enlace? El enlace anterior dejará de funcionar y quien ya lo haya abierto perderá el acceso. Se copiará un nuevo enlace para que lo envíe.",
  } as Dict,
  linkReset: { en: "New link copied!", es: "¡Nuevo enlace copiado!" } as Dict,
  fillMyself: { en: "Fill it myself", es: "Llenarlo yo mismo" } as Dict,
  noSessions: { en: "No intakes yet. Start one above.", es: "Aún no hay registros. Inicie uno arriba." } as Dict,
  backToPresentation: { en: "Back to presentation", es: "Volver a la presentación" } as Dict,
  navPresentation: { en: "Presentation", es: "Presentación" } as Dict,
  navIntake: { en: "Client Intake", es: "Registro de clientes" } as Dict,
  navForm: { en: "Form", es: "Formulario" } as Dict,
  navSummary: { en: "Summary", es: "Resumen" } as Dict,
  // Search-first start flow
  findClient: { en: "Find or add a client", es: "Buscar o agregar un cliente" } as Dict,
  searchCrm: { en: "Search your CRM by name, email, or phone", es: "Busque en su CRM por nombre, correo o teléfono" } as Dict,
  searchBtn: { en: "Search", es: "Buscar" } as Dict,
  searching: { en: "Searching…", es: "Buscando…" } as Dict,
  noMatches: { en: "No matching contacts in your CRM.", es: "No hay contactos coincidentes en su CRM." } as Dict,
  startForThis: { en: "Start intake", es: "Iniciar registro" } as Dict,
  createNew: { en: "Not in CRM? Create a new contact", es: "¿No está en el CRM? Crear un nuevo contacto" } as Dict,
  createAndStart: { en: "Create contact & start", es: "Crear contacto e iniciar" } as Dict,
  startError: {
    en: "Enter a name, email, or phone to start.",
    es: "Ingrese un nombre, correo o teléfono para iniciar.",
  } as Dict,

  // Form
  loading: { en: "Loading…", es: "Cargando…" } as Dict,
  loadError: { en: "Could not load this form.", es: "No se pudo cargar este formulario." } as Dict,
  saving: { en: "Saving…", es: "Guardando…" } as Dict,
  saved: { en: "Saved", es: "Guardado" } as Dict,
  saveError: { en: "Save failed — retrying", es: "Error al guardar — reintentando" } as Dict,
  next: { en: "Next", es: "Siguiente" } as Dict,
  back: { en: "Back", es: "Atrás" } as Dict,
  step: { en: "Step", es: "Paso" } as Dict,
  of: { en: "of", es: "de" } as Dict,
  finish: { en: "Finish & sync to CRM", es: "Finalizar y enviar al CRM" } as Dict,
  submitApplication: { en: "Submit application", es: "Enviar solicitud" } as Dict,
  finishing: { en: "Finishing…", es: "Finalizando…" } as Dict,
  submitting: { en: "Submitting…", es: "Enviando…" } as Dict,
  nextIssue: { en: "Next issue", es: "Siguiente problema" } as Dict,
  stepsNeedAttention: {
    en: "step(s) still need attention.",
    es: "paso(s) aún necesitan atención.",
  } as Dict,
  completed: {
    en: "Completed and synced to the CRM contact.",
    es: "Completado y sincronizado con el contacto del CRM.",
  } as Dict,
  // Client thank-you (shown after a client submits and is locked out of editing)
  thankYouTitle: { en: "Thank you!", es: "¡Gracias!" } as Dict,
  thankYouBody: {
    en: "Your information has been submitted. We're reviewing it and will reach out to you shortly. There's nothing else you need to do.",
    es: "Su información ha sido enviada. La estamos revisando y nos pondremos en contacto con usted en breve. No necesita hacer nada más.",
  } as Dict,
  // Admin re-open controls
  allowClientEdit: { en: "Allow client to edit", es: "Permitir que el cliente edite" } as Dict,
  lockClientEdit: { en: "Lock client edits", es: "Bloquear edición del cliente" } as Dict,
  clientEditEnabled: { en: "Client editing enabled", es: "Edición del cliente habilitada" } as Dict,
  missingFields: {
    en: "Please complete the required fields before finishing.",
    es: "Complete los campos requeridos antes de finalizar.",
  } as Dict,
  intakeTitle: { en: "IUL Application Intake", es: "Registro de solicitud IUL" } as Dict,
  formSubtitle: {
    en: "Just a few quick steps — your progress saves automatically as you go.",
    es: "Solo unos pasos rápidos — su progreso se guarda automáticamente.",
  } as Dict,
  secureNote: {
    en: "Your information is encrypted.",
    es: "Su información está cifrada.",
  } as Dict,
  required: { en: "required", es: "requerido" } as Dict,
  reveal: { en: "Reveal", es: "Mostrar" } as Dict,
  hide: { en: "Hide", es: "Ocultar" } as Dict,
  choose: { en: "Choose…", es: "Elegir…" } as Dict,

  // Beneficiaries
  beneficiary: { en: "Beneficiary", es: "Beneficiario" } as Dict,
  addBeneficiary: { en: "Add beneficiary", es: "Agregar beneficiario" } as Dict,
  remove: { en: "Remove", es: "Eliminar" } as Dict,
  benFirstName: { en: "First name", es: "Nombre" } as Dict,
  benLastName: { en: "Last name", es: "Apellido" } as Dict,
  benRelationship: { en: "Relationship", es: "Parentesco" } as Dict,
  benPercent: { en: "Percentage", es: "Porcentaje" } as Dict,
  benDob: { en: "Date of birth", es: "Fecha de nacimiento" } as Dict,
  benSsn: { en: "SSN", es: "SSN" } as Dict,

  // File upload
  uploadFile: { en: "Upload file", es: "Subir archivo" } as Dict,
  uploading: { en: "Uploading…", es: "Subiendo…" } as Dict,
  noFiles: { en: "No files uploaded yet.", es: "Aún no hay archivos." } as Dict,
  uploadError: { en: "Upload failed. Try again.", es: "Error al subir. Intente de nuevo." } as Dict,
  fileHint: { en: "Images or PDF, up to 15 MB.", es: "Imágenes o PDF, hasta 15 MB." } as Dict,

  // Split DOB selects
  dobMonth: { en: "Month", es: "Mes" } as Dict,
  dobDay: { en: "Day", es: "Día" } as Dict,
  dobYear: { en: "Year", es: "Año" } as Dict,
  // Height selects
  heightFeet: { en: "ft", es: "pies" } as Dict,
  heightInches: { en: "in", es: "pulg" } as Dict,

  // Metric helpers (height / weight)
  preferCm: { en: "Prefer centimeters?", es: "¿Prefiere centímetros?" } as Dict,
  preferKg: { en: "Prefer kilograms?", es: "¿Prefiere kilogramos?" } as Dict,
  cmUnit: { en: "cm", es: "cm" } as Dict,
  kgUnit: { en: "kg", es: "kg" } as Dict,
  lbsUnit: { en: "lbs", es: "lbs" } as Dict,

  // Copy (view page)
  copy: { en: "Copy", es: "Copiar" } as Dict,
  copied: { en: "Copied", es: "Copiado" } as Dict,

  // Inline validation messages
  errRequired: { en: "This field is required.", es: "Este campo es obligatorio." } as Dict,
  errEmail: { en: "Enter a valid email address.", es: "Ingrese un correo electrónico válido." } as Dict,
  errPhone: { en: "Enter a valid 10-digit phone number.", es: "Ingrese un número de teléfono válido de 10 dígitos." } as Dict,
  errZip: { en: "Enter a valid 5-digit zip code.", es: "Ingrese un código postal válido de 5 dígitos." } as Dict,
  errSsn: { en: "Enter a valid 9-digit number.", es: "Ingrese un número válido de 9 dígitos." } as Dict,
  errRouting: {
    en: "Enter a valid 9-digit routing number.",
    es: "Ingrese un número de ruta válido de 9 dígitos.",
  } as Dict,

  /* Live counter under a fixed-length digit field — same wording as the Final Expense wizard. */
  digitsRemaining: { en: "{n} more digit(s) to go", es: "Faltan {n} dígito(s)" } as Dict,
  looksGood: { en: "Looks good", es: "Se ve bien" } as Dict,
  valueOnFile: {
    en: "Already saved — tap to replace it.",
    es: "Ya está guardado — toque para reemplazarlo.",
  } as Dict,

  /* ── Secure capture: the page the CLIENT opens on their own phone ── */
  captureTitle: {
    en: "Send your details securely",
    es: "Envíe sus datos de forma segura",
  } as Dict,
  captureTitleNamed: {
    en: "{name}, send your details securely",
    es: "{name}, envíe sus datos de forma segura",
  } as Dict,
  captureIntro: {
    en: "We are finalizing your application and we need this information. This is your secure link.",
    es: "Estamos finalizando su solicitud y necesitamos esta información. Este es su enlace seguro.",
  } as Dict,
  captureSecureNote: {
    en: "Secure and encrypted",
    es: "Seguro y cifrado",
  } as Dict,
  captureSsnLabel: {
    en: "Social Security number or ITIN",
    es: "Número de seguro social o ITIN",
  } as Dict,
  captureRoutingLabel: { en: "Routing number", es: "Número de ruta" } as Dict,
  captureRoutingHelp: {
    en: "The 9 digits at the bottom-left of a check.",
    es: "Los 9 dígitos en la parte inferior izquierda de un cheque.",
  } as Dict,
  captureAccountLabel: { en: "Account number", es: "Número de cuenta" } as Dict,
  captureAccountTypeLabel: { en: "Account type", es: "Tipo de cuenta" } as Dict,
  captureSend: { en: "Send securely", es: "Enviar de forma segura" } as Dict,
  captureSending: { en: "Sending…", es: "Enviando…" } as Dict,
  captureSubmitError: {
    en: "We could not send that. Please check the numbers and try again.",
    es: "No pudimos enviarlo. Revise los números e intente de nuevo.",
  } as Dict,
  captureDoneTitle: { en: "Sent. Thank you.", es: "Enviado. Gracias." } as Dict,
  captureDoneBody: {
    en: "We have everything we need. You can close this page — nothing else is required from you.",
    es: "Ya tenemos todo lo que necesitamos. Puede cerrar esta página — no se requiere nada más de usted.",
  } as Dict,
  captureFooter: {
    en: "This link works once and only for your application.",
    es: "Este enlace funciona una sola vez y solo para su solicitud.",
  } as Dict,

  /* ── Secure capture: the panel the AGENT sees inside the form ── */
  capturePanelTitle: {
    en: "Client would rather not say it out loud?",
    es: "¿El cliente prefiere no decirlo en voz alta?",
  } as Dict,
  capturePanelBody: {
    en: "Send them a private link and they can type their SSN and bank details on their own phone. You will see the last 4 digits appear here.",
    es: "Envíele un enlace privado y podrá escribir su SSN y datos bancarios en su propio teléfono. Aquí verá aparecer los últimos 4 dígitos.",
  } as Dict,
  captureCreate: { en: "Create secure link", es: "Crear enlace seguro" } as Dict,
  captureCreating: { en: "Creating…", es: "Creando…" } as Dict,
  captureWaiting: {
    en: "Waiting for the client…",
    es: "Esperando al cliente…",
  } as Dict,
  captureOpened: {
    en: "They opened it — filling it in now.",
    es: "Ya lo abrió — lo está llenando.",
  } as Dict,
  captureReceived: {
    en: "Received — SSN and bank details are in.",
    es: "Recibido — el SSN y los datos bancarios ya están.",
  } as Dict,
  captureReplaced: {
    en: "This replaced the value you had entered.",
    es: "Esto reemplazó el valor que usted había ingresado.",
  } as Dict,
  captureCancel: { en: "Cancel link", es: "Cancelar enlace" } as Dict,
  captureFieldWaiting: {
    en: "Waiting for the client to send this.",
    es: "Esperando a que el cliente envíe esto.",
  } as Dict,
  captureError: {
    en: "Something went wrong with the link. Try again.",
    es: "Algo salió mal con el enlace. Intente de nuevo.",
  } as Dict,

  /* ── Routing-number lookup ── */
  routingLookupOpen: {
    en: "Look up the routing number",
    es: "Buscar el número de ruta",
  } as Dict,
  routingLookupTitle: {
    en: "Find the routing number",
    es: "Buscar el número de ruta",
  } as Dict,
  routingLookupBank: { en: "Bank name", es: "Nombre del banco" } as Dict,
  /**
   * Not just "State". The ACH routing number follows the state where the account was OPENED, not
   * where the client lives now — somebody who moved from California keeps the California number,
   * and a label saying "State" gets the wrong answer nearly every time.
   */
  routingLookupState: {
    en: "State where the account was opened",
    es: "Estado donde abrió la cuenta",
  } as Dict,
  routingLookupCity: { en: "City (optional)", es: "Ciudad (opcional)" } as Dict,
  routingLookupSearch: { en: "Find routing number", es: "Buscar número de ruta" } as Dict,
  routingLookupSearching: { en: "Searching…", es: "Buscando…" } as Dict,
  routingLookupNone: {
    en: "No match. Ask the client to read it from a check or their banking app.",
    es: "Sin resultados. Pídale al cliente que lo lea de un cheque o de su app bancaria.",
  } as Dict,
  routingLookupConfirm: {
    en: "Read it to the client and confirm before selecting:",
    es: "Léaselo al cliente y confirme antes de seleccionar:",
  } as Dict,
  /**
   * How sure the lookup is, in words the agent can say out loud.
   *
   * The distinction is worth the extra strings. "This bank uses one number nationwide" is a
   * sentence that ends the question; "several banks match" tells the agent to keep asking. A
   * single unlabelled list would make both look equally certain, and the confident-sounding wrong
   * answer is exactly what fails a draft.
   */
  routingLookupSureCurated: {
    en: "Verified number for this bank and state.",
    es: "Número verificado para este banco y estado.",
  } as Dict,
  routingLookupSureSingle: {
    en: "This bank uses one routing number nationwide.",
    es: "Este banco usa un solo número de ruta en todo el país.",
  } as Dict,
  routingLookupSureCandidates: {
    en: "More than one number is possible — have the client confirm which is theirs.",
    es: "Hay más de un número posible — que el cliente confirme cuál es el suyo.",
  } as Dict,
  bankNameHint: { en: "Bank on this number", es: "Banco de este número" } as Dict,
  routingLookupAchNote: {
    en: "ACH number — the one used for premium drafts, not wire transfers.",
    es: "Número ACH — el que se usa para cobrar la prima, no para transferencias bancarias.",
  } as Dict,
  errPercent: { en: "Enter a percentage between 0 and 100.", es: "Ingrese un porcentaje entre 0 y 100." } as Dict,
  errDob: { en: "Enter a valid date of birth.", es: "Ingrese una fecha de nacimiento válida." } as Dict,
  errAge: { en: "Enter a valid age.", es: "Ingrese una edad válida." } as Dict,
  benTotalWarning: {
    en: "Beneficiary percentages should add up to 100%.",
    es: "Los porcentajes de los beneficiarios deben sumar 100%.",
  } as Dict,
  fixErrors: {
    en: "Please fix the highlighted fields before continuing.",
    es: "Corrija los campos resaltados antes de continuar.",
  } as Dict,
  pleaseComplete: { en: "Please complete:", es: "Por favor complete:" } as Dict,
  benNeedTwo: {
    en: "at least 2 beneficiaries — each with name, relationship, and %",
    es: "al menos 2 beneficiarios — cada uno con nombre, parentesco y %",
  } as Dict,

  // View
  viewTitle: { en: "Client summary", es: "Resumen del cliente" } as Dict,
  editForm: { en: "Edit form", es: "Editar formulario" } as Dict,
  empty: { en: "—", es: "—" } as Dict,
  notProvided: { en: "Not provided", es: "No proporcionado" } as Dict,
} as const;

export function tr(dict: Dict, locale: IntakeLocale): string {
  return dict[locale];
}
