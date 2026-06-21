/** Self-contained bilingual UI strings + label helpers for the intake frontend. */

import type { IntakeField, IntakeOption, IntakeSection } from "./fields";

export type IntakeLocale = "en" | "es";

export function pickLocale(locale: string): IntakeLocale {
  return locale === "es" ? "es" : "en";
}

export function fieldLabel(field: IntakeField, locale: IntakeLocale): string {
  return locale === "es" ? field.labelEs : field.labelEn;
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
  finishing: { en: "Finishing…", es: "Finalizando…" } as Dict,
  completed: {
    en: "Completed and synced to the CRM contact.",
    es: "Completado y sincronizado con el contacto del CRM.",
  } as Dict,
  missingFields: {
    en: "Please complete the required fields before finishing.",
    es: "Complete los campos requeridos antes de finalizar.",
  } as Dict,
  intakeTitle: { en: "IUL Application Intake", es: "Registro de solicitud IUL" } as Dict,
  secureNote: {
    en: "Your information is encrypted and saved automatically.",
    es: "Su información está cifrada y se guarda automáticamente.",
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

  // View
  viewTitle: { en: "Client summary", es: "Resumen del cliente" } as Dict,
  editForm: { en: "Edit form", es: "Editar formulario" } as Dict,
  empty: { en: "—", es: "—" } as Dict,
  notProvided: { en: "Not provided", es: "No proporcionado" } as Dict,
} as const;

export function tr(dict: Dict, locale: IntakeLocale): string {
  return dict[locale];
}
