/**
 * Self-contained bilingual UI strings + label helpers for the shared intake frontend.
 *
 * Deliberately not next-intl: the intake form is rendered from a field config whose labels already
 * carry `labelEn`/`labelEs`, so the chrome around them uses the same two-key shape rather than
 * splitting copy across two systems. Ported from lib/aca-intake/ui-strings.ts.
 */

import type { IntakeField, IntakeOption, IntakeSection } from "./types";

export type IntakeLocale = "en" | "es";

export function pickLocale(locale: string): IntakeLocale {
  return locale === "es" ? "es" : "en";
}

/** Replace {currentYear}/{lastYear} so income labels never hard-code the year. */
export function applyYearTokens(text: string): string {
  if (!text.includes("{")) return text;
  const current = new Date().getFullYear();
  return text
    .replace(/\{currentYear\}/g, String(current))
    .replace(/\{lastYear\}/g, String(current - 1));
}

export function fieldLabel(field: IntakeField, locale: IntakeLocale): string {
  const raw = locale === "es" ? field.labelEs : field.labelEn;
  return applyYearTokens(raw);
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

export function rowLabel(field: IntakeField, locale: IntakeLocale): string {
  const raw = locale === "es" ? field.rowLabelEs : field.rowLabelEn;
  return raw ?? "";
}

type Dict = Record<IntakeLocale, string>;

export const UI = {
  // Dashboard
  dashboardTitle: { en: "Client Intake", es: "Registro de clientes" } as Dict,
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
  submitApplication: { en: "Submit my information", es: "Enviar mi información" } as Dict,
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
  intakeTitle: { en: "Health Insurance Application", es: "Solicitud de seguro de salud" } as Dict,
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

  // Repeaters
  remove: { en: "Remove", es: "Eliminar" } as Dict,
  addMember: { en: "Add another household member", es: "Agregar otro miembro del hogar" } as Dict,
  addDoctor: { en: "Add another doctor", es: "Agregar otro médico" } as Dict,
  addPrescription: { en: "Add another medication", es: "Agregar otro medicamento" } as Dict,
  addRow: { en: "Add another", es: "Agregar otro" } as Dict,
  canAddMore: { en: "You can add up to {n} more", es: "Puede agregar hasta {n} más" } as Dict,
  youLabel: { en: "You", es: "Usted" } as Dict,
  primaryFromStepOne: {
    en: "Taken from the first step — edit it there if something is wrong.",
    es: "Tomado del primer paso — edítelo allí si algo está mal.",
  } as Dict,
  needOneMember: {
    en: "at least one household member with their details",
    es: "al menos un miembro del hogar con sus datos",
  } as Dict,

  // File upload
  uploadFile: { en: "Upload file", es: "Subir archivo" } as Dict,
  takePhoto: { en: "Take a photo", es: "Tomar una foto" } as Dict,
  chooseFile: { en: "Choose a file", es: "Elegir un archivo" } as Dict,
  uploading: { en: "Uploading…", es: "Subiendo…" } as Dict,
  preparing: { en: "Preparing photo…", es: "Preparando foto…" } as Dict,
  noFiles: { en: "No files uploaded yet.", es: "Aún no hay archivos." } as Dict,
  uploadError: { en: "Upload failed. Try again.", es: "Error al subir. Intente de nuevo." } as Dict,
  fileTooLarge: {
    en: "That file is too large. Try taking a photo instead of attaching the original.",
    es: "Ese archivo es demasiado grande. Intente tomar una foto en lugar de adjuntar el original.",
  } as Dict,

  // Split DOB selects
  dobMonth: { en: "Month", es: "Mes" } as Dict,
  dobDay: { en: "Day", es: "Día" } as Dict,
  dobYear: { en: "Year", es: "Año" } as Dict,

  // Height selects
  heightFeet: { en: "Feet", es: "Pies" } as Dict,
  heightInches: { en: "Inches", es: "Pulgadas" } as Dict,
  feetUnit: { en: "ft", es: "pies" } as Dict,
  inchesUnit: { en: "in", es: "pulg." } as Dict,

  // Copy (view page)
  copy: { en: "Copy", es: "Copiar" } as Dict,
  copied: { en: "Copied", es: "Copiado" } as Dict,

  // Inline validation messages
  errRequired: { en: "This field is required.", es: "Este campo es obligatorio." } as Dict,
  errEmail: { en: "Enter a valid email address.", es: "Ingrese un correo electrónico válido." } as Dict,
  errPhone: { en: "Enter a valid 10-digit phone number.", es: "Ingrese un número de teléfono válido de 10 dígitos." } as Dict,
  errZip: { en: "Enter a valid 5-digit zip code.", es: "Ingrese un código postal válido de 5 dígitos." } as Dict,
  errSsn: { en: "Enter a valid 9-digit number.", es: "Ingrese un número válido de 9 dígitos." } as Dict,
  errDob: { en: "Enter a valid date of birth.", es: "Ingrese una fecha de nacimiento válida." } as Dict,
  errRouting: { en: "Routing numbers are 9 digits.", es: "Los números de ruta tienen 9 dígitos." } as Dict,
  errCard: { en: "Enter a valid card number.", es: "Ingrese un número de tarjeta válido." } as Dict,
  errCardExpiration: { en: "Enter a valid expiration date (MM/YY).", es: "Ingrese una fecha de vencimiento válida (MM/AA)." } as Dict,
  errCvv: { en: "Enter the 3 or 4 digit security code.", es: "Ingrese el código de seguridad de 3 o 4 dígitos." } as Dict,
  errStartDate: { en: "Pick one of the start dates in the list.", es: "Elija una de las fechas de inicio de la lista." } as Dict,
  errHeight: { en: "Pick feet and inches.", es: "Elija pies y pulgadas." } as Dict,
  errWeight: { en: "Enter the weight in pounds.", es: "Ingrese el peso en libras." } as Dict,
  errDate: { en: "Enter a real date.", es: "Ingrese una fecha real." } as Dict,
  errDatePast: { en: "This date can't be in the future.", es: "Esta fecha no puede ser futura." } as Dict,
  errExpired: {
    en: "This ID has expired. Please use one that hasn't.",
    es: "Esta identificación está vencida. Use una que esté vigente.",
  } as Dict,
  fixErrors: {
    en: "Please fix the highlighted fields before continuing.",
    es: "Corrija los campos resaltados antes de continuar.",
  } as Dict,
  pleaseComplete: { en: "Please complete:", es: "Por favor complete:" } as Dict,

  // View
  viewTitle: { en: "Client summary", es: "Resumen del cliente" } as Dict,
  editForm: { en: "Edit form", es: "Editar formulario" } as Dict,
  empty: { en: "—", es: "—" } as Dict,
  notProvided: { en: "Not provided", es: "No proporcionado" } as Dict,
  household: { en: "Household", es: "Hogar" } as Dict,

  // Impact presentation (agent's form)
  presentationTitle: { en: "Impact presentation", es: "Presentación de Impact" } as Dict,
  presentationBody: {
    en: "Opens in a new tab, in the client's language. Share that tab in CrankWheel.",
    es: "Se abre en una pestaña nueva, en el idioma del cliente. Comparta esa pestaña en CrankWheel.",
  } as Dict,
  presentationJoined: {
    en: "The client is connected. Start the presentation.",
    es: "El cliente está conectado. Comience la presentación.",
  } as Dict,
  presentationOpen: { en: "Open presentation", es: "Abrir presentación" } as Dict,
  backToPresentation: { en: "Back to the presentation", es: "Volver a la presentación" } as Dict,
  quoteTitle: { en: "Impact quote", es: "Cotización de Impact" } as Dict,
  quoteNeedsDob: {
    en: "Fill in the dates of birth (About you, Who else) to quote, or type the prices.",
    es: "Llene las fechas de nacimiento (Sobre usted, A quién más cubrir) para cotizar, o escriba los precios.",
  } as Dict,
  quoteFetch: { en: "Quote with Impact", es: "Cotizar con Impact" } as Dict,
  quoteFetching: { en: "Quoting…", es: "Cotizando…" } as Dict,
  quoteFailed: {
    en: "Impact didn't answer. Type the prices from Impact's quote page.",
    es: "Impact no respondió. Escriba los precios de la página de cotización de Impact.",
  } as Dict,
  quoteLive: { en: "The presentation shows these prices.", es: "La presentación muestra estos precios." } as Dict,
  quoteMonthly: { en: "Monthly price ($)", es: "Precio mensual ($)" } as Dict,
  planNote: {
    en: "Every plan includes every benefit. Only your annual share (PRA) changes, if you have a large medical bill.",
    es: "Todos los planes incluyen todos los beneficios. Solo cambia su parte anual (PRA), si tiene un gasto médico grande.",
  } as Dict,
  planPriceLater: {
    en: "Prices show once the dates of birth are filled in.",
    es: "Los precios aparecen cuando estén las fechas de nacimiento.",
  } as Dict,
  planMonthly: { en: "Monthly price:", es: "Precio mensual:" } as Dict,

  // Secure link — the panel the AGENT sees on the steps it covers
  capturePanelTitle: {
    en: "Client would rather not say it out loud?",
    es: "¿El cliente prefiere no decirlo en voz alta?",
  } as Dict,
  capturePanelBody: {
    en: "Send a private link and they type the numbers on their own phone. Only the last 4 digits show up here.",
    es: "Envíele un enlace privado y escribirá los números en su propio teléfono. Aquí solo aparecen los últimos 4 dígitos.",
  } as Dict,
  captureAskFor: { en: "Ask the client for:", es: "Pedirle al cliente:" } as Dict,
  captureNeedsType: { en: "Answer first:", es: "Responda primero:" } as Dict,
  captureCreate: { en: "Create secure link", es: "Crear enlace seguro" } as Dict,
  captureCreating: { en: "Creating…", es: "Creando…" } as Dict,
  captureWaiting: { en: "Waiting for the client…", es: "Esperando al cliente…" } as Dict,
  captureOpened: { en: "They opened it and are filling it in.", es: "Ya lo abrió y lo está llenando." } as Dict,
  captureAskingFor: { en: "Asking for:", es: "Solicitando:" } as Dict,
  captureReceived: { en: "Received:", es: "Recibido:" } as Dict,
  captureReplaced: {
    en: "This replaced a value you had typed.",
    es: "Esto reemplazó un valor que usted había escrito.",
  } as Dict,
  captureAnother: { en: "Create another link", es: "Crear otro enlace" } as Dict,
  captureCancel: { en: "Cancel link", es: "Cancelar enlace" } as Dict,
  captureCopy: { en: "Copy link", es: "Copiar enlace" } as Dict,
  captureCopied: { en: "Copied", es: "Copiado" } as Dict,
  captureSendText: { en: "Send by text", es: "Enviar por texto" } as Dict,
  captureSent: { en: "Sent", es: "Enviado" } as Dict,
  captureNoContact: {
    en: "No CRM contact on this intake, so copy the link and send it yourself.",
    es: "Esta solicitud no tiene contacto en el CRM: copie el enlace y envíelo usted.",
  } as Dict,
  captureError: {
    en: "Something went wrong with the link. Try again.",
    es: "Algo salió mal con el enlace. Intente de nuevo.",
  } as Dict,

  // Secure link — the page the CLIENT opens on their own phone
  secureTitle: { en: "Send your details securely", es: "Envíe sus datos de forma segura" } as Dict,
  secureTitleNamed: { en: "{name}, send your details securely", es: "{name}, envíe sus datos de forma segura" } as Dict,
  secureIntro: {
    en: "We are finishing your application and need this information. This is your private, secure link.",
    es: "Estamos terminando su solicitud y necesitamos esta información. Este es su enlace privado y seguro.",
  } as Dict,
  secureLinkNote: { en: "Secure and encrypted", es: "Seguro y cifrado" } as Dict,
  secureRoutingHelp: {
    en: "The 9 digits at the bottom left of a check.",
    es: "Los 9 dígitos en la parte inferior izquierda de un cheque.",
  } as Dict,
  secureBankName: { en: "Bank:", es: "Banco:" } as Dict,
  secureSend: { en: "Send securely", es: "Enviar de forma segura" } as Dict,
  secureSending: { en: "Sending…", es: "Enviando…" } as Dict,
  secureSubmitError: {
    en: "We couldn't send that. Please check the numbers and try again.",
    es: "No pudimos enviarlo. Revise los números e intente de nuevo.",
  } as Dict,
  secureDoneTitle: { en: "Sent. Thank you.", es: "Enviado. Gracias." } as Dict,
  secureDoneBody: {
    en: "We have what we needed. You can close this page.",
    es: "Ya tenemos lo que necesitábamos. Puede cerrar esta página.",
  } as Dict,
  secureFooter: {
    en: "This link works once, and only for your application.",
    es: "Este enlace funciona una sola vez y solo para su solicitud.",
  } as Dict,
  secureLooksGood: { en: "Looks good", es: "Se ve bien" } as Dict,
  secureDigitsLeft: { en: "{n} more digit(s) to go", es: "Faltan {n} dígito(s)" } as Dict,
} as const;

export function tr(dict: Dict, locale: IntakeLocale): string {
  return dict[locale];
}
