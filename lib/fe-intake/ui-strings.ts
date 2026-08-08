/** Self-contained bilingual UI strings + label helpers for the Final Expense intake frontend. */

import type { FeField, FeOption, FeSection } from "./fields";

export type FeLocale = "en" | "es";

export function pickLocale(locale: string): FeLocale {
  return locale === "es" ? "es" : "en";
}

export function fieldLabel(field: FeField, locale: FeLocale): string {
  return locale === "es" ? field.labelEs : field.labelEn;
}

export function fieldPlaceholder(field: FeField, locale: FeLocale): string | undefined {
  return locale === "es" ? field.placeholderEs : field.placeholderEn;
}

export function fieldHelp(field: FeField, locale: FeLocale): string | undefined {
  return locale === "es" ? field.helpEs : field.helpEn;
}

export function fieldNote(field: FeField, locale: FeLocale): string | undefined {
  return locale === "es" ? field.noteEs : field.noteEn;
}

export function optionLabel(option: FeOption, locale: FeLocale): string {
  return locale === "es" ? option.labelEs : option.labelEn;
}

export function sectionTitle(section: FeSection, locale: FeLocale): string {
  return locale === "es" ? section.titleEs : section.titleEn;
}

export function rowLabel(field: FeField, locale: FeLocale): string {
  const raw = locale === "es" ? field.rowLabelEs : field.rowLabelEn;
  return raw ?? "";
}

/** Replace the `{drug}` token in a medication row's question with the drug name already typed
 * a screen earlier — "What is Lisinopril for?" instead of a generic "What is it for?". */
export function applyDrugToken(text: string, drugName: string, locale: FeLocale): string {
  if (!text.includes("{drug}")) return text;
  const fallback = drugName.trim() || (locale === "es" ? "esto" : "it");
  return text.replace(/\{drug\}/g, fallback);
}

type Dict = Record<FeLocale, string>;

export const UI = {
  // Dashboard
  dashboardTitle: { en: "Final Expense Client Intake", es: "Registro de clientes de gastos finales" } as Dict,
  dashboardSubtitle: {
    en: "Start a secure data-collection form, fill it yourself, or send the client a link.",
    es: "Inicie un formulario seguro, complételo usted mismo o envíe un enlace al cliente.",
  } as Dict,
  firstName: { en: "First name", es: "Nombre" } as Dict,
  lastName: { en: "Last name", es: "Apellido" } as Dict,
  preferredLanguage: { en: "Preferred language", es: "Idioma preferido" } as Dict,
  email: { en: "Email", es: "Correo electrónico" } as Dict,
  phone: { en: "Phone", es: "Teléfono" } as Dict,
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
  noSessions: { en: "No intakes yet. Start one above.", es: "Aún no hay registros. Inicie uno arriba." } as Dict,
  navIntake: { en: "Final Expense Client Intake", es: "Registro de clientes de gastos finales" } as Dict,
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

  // Form chrome
  loading: { en: "Loading…", es: "Cargando…" } as Dict,
  loadError: { en: "Could not load this form.", es: "No se pudo cargar este formulario." } as Dict,
  saving: { en: "Saving…", es: "Guardando…" } as Dict,
  saved: { en: "Saved", es: "Guardado" } as Dict,
  saveError: { en: "Save failed — retrying", es: "Error al guardar — reintentando" } as Dict,
  next: { en: "Next", es: "Siguiente" } as Dict,
  back: { en: "Back", es: "Atrás" } as Dict,
  needHelp: { en: "Need help?", es: "¿Necesita ayuda?" } as Dict,
  submitApplication: { en: "Submit my information", es: "Enviar mi información" } as Dict,
  submitting: { en: "Submitting…", es: "Enviando…" } as Dict,
  // Pre-submit review screen
  reviewTitle: { en: "That's everything!", es: "¡Eso es todo!" } as Dict,
  reviewBody: {
    en: "Send your information securely to your agent — it only takes a second.",
    es: "Envíe su información de forma segura a su agente — solo toma un segundo.",
  } as Dict,

  // Client completion screen (after submitting, and when returning to a submitted form)
  thankYouTitle: { en: "Thank you — you're all done!", es: "Gracias — ¡ya terminó!" } as Dict,
  thankYouBody: {
    en: "We have everything we need to start working on your coverage.",
    es: "Tenemos todo lo que necesitamos para comenzar a trabajar en su cobertura.",
  } as Dict,
  nextStepsTitle: { en: "What happens next", es: "Qué sigue" } as Dict,
  nextStep1: {
    en: "A licensed agent for your state will call you shortly.",
    es: "Un agente con licencia en su estado lo llamará en breve.",
  } as Dict,
  nextStep2: {
    en: "Together you'll confirm your details and sign your application.",
    es: "Juntos confirmarán sus datos y firmará su solicitud.",
  } as Dict,
  nextStep3: {
    en: "You'll set up your monthly payment to activate your coverage.",
    es: "Configurará su pago mensual para activar su cobertura.",
  } as Dict,
  readyTitle: { en: "Please have this ready for the call", es: "Tenga esto listo para la llamada" } as Dict,
  readyBody: {
    en: "Your bank routing number and account number. You'll find both on a check or in your banking app.",
    es: "Su número de ruta bancaria y número de cuenta. Encontrará ambos en un cheque o en su aplicación bancaria.",
  } as Dict,
  noCards: {
    en: "Bank account only — credit and debit cards are not accepted.",
    es: "Solo cuenta bancaria — no se aceptan tarjetas de crédito ni de débito.",
  } as Dict,
  doneQuestions: { en: "Questions before then? Call us at", es: "¿Preguntas antes? Llámenos al" } as Dict,

  // Optional banking capture, offered on the completion screen
  bankingPrompt: {
    en: "Have your banking information handy right now?",
    es: "¿Tiene su información bancaria a la mano ahora?",
  } as Dict,
  bankingPromptBody: {
    en: "Add it here and your agent can finalize everything on the call — no scrambling for a checkbook.",
    es: "Agréguela aquí y su agente podrá finalizar todo en la llamada — sin buscar la chequera.",
  } as Dict,
  bankingAddNow: { en: "Yes, add it now", es: "Sí, agregarla ahora" } as Dict,
  bankingLater: { en: "I'll do it on the call", es: "Lo haré en la llamada" } as Dict,
  bankingTitle: { en: "Payment information", es: "Información de pago" } as Dict,
  choose: { en: "Choose…", es: "Elegir…" } as Dict,
  bankingIntro: {
    en: "Bank account only — credit and debit cards are not accepted. This is encrypted and goes straight to your agent.",
    es: "Solo cuenta bancaria — no se aceptan tarjetas de crédito ni de débito. Esto va cifrado directamente a su agente.",
  } as Dict,
  bankingSave: { en: "Save payment information", es: "Guardar información de pago" } as Dict,
  bankingSaving: { en: "Saving…", es: "Guardando…" } as Dict,
  bankingSaved: {
    en: "Got it — your payment information is saved. Your agent will confirm everything on the call.",
    es: "Listo — su información de pago está guardada. Su agente confirmará todo en la llamada.",
  } as Dict,
  bankingIncomplete: {
    en: "Please fill in the bank name, routing number, account number, and account type.",
    es: "Complete el nombre del banco, número de ruta, número de cuenta y tipo de cuenta.",
  } as Dict,
  bankingError: {
    en: "We couldn't save that. Please try again, or share it with your agent on the call.",
    es: "No pudimos guardar eso. Intente de nuevo o compártalo con su agente en la llamada.",
  } as Dict,
  // Admin re-open controls
  allowClientEdit: { en: "Allow client to edit", es: "Permitir que el cliente edite" } as Dict,
  lockClientEdit: { en: "Lock client edits", es: "Bloquear edición del cliente" } as Dict,
  reveal: { en: "Reveal", es: "Mostrar" } as Dict,
  hide: { en: "Hide", es: "Ocultar" } as Dict,
  addMedication: { en: "Add another medication?", es: "¿Agregar otro medicamento?" } as Dict,
  notProvided: { en: "Not provided", es: "No proporcionado" } as Dict,

  // Beneficiaries — explicit intro → add → review-roster flow
  beneficiariesIntroTitle: {
    en: "Now let's add your beneficiaries",
    es: "Ahora agreguemos sus beneficiarios",
  } as Dict,
  // "Beneficiary" is industry jargon many clients have never heard — lead with what it means in
  // plain terms, and frame it as the people they're protecting rather than a form field.
  beneficiariesWhatIs: {
    en: "These are the people you want to protect — the ones who receive the money from your policy.",
    es: "Estas son las personas que usted quiere proteger — quienes reciben el dinero de su póliza.",
  } as Dict,
  beneficiariesPlainly: {
    en: "In insurance this person is called a \"beneficiary.\" It simply means whoever you choose to receive the payment — usually a spouse, a son or daughter, or whoever would handle your final arrangements.",
    es: "En seguros, a esta persona se le llama \"beneficiario\". Simplemente significa quien usted elija para recibir el pago — normalmente un cónyuge, un hijo o hija, o quien se encargue de sus arreglos finales.",
  } as Dict,
  beneficiariesTwoRequired: {
    en: "You need at least two. We'll add them one at a time — just a name and their relationship to you.",
    es: "Necesita al menos dos. Los agregaremos uno a la vez — solo un nombre y su relación con usted.",
  } as Dict,
  addFirstBeneficiary: { en: "Add first beneficiary", es: "Agregar primer beneficiario" } as Dict,
  addSecondBeneficiary: { en: "Add second beneficiary", es: "Agregar segundo beneficiario" } as Dict,
  addAnotherBeneficiary: { en: "Add another beneficiary", es: "Agregar otro beneficiario" } as Dict,
  yourBeneficiaries: { en: "Your beneficiaries", es: "Sus beneficiarios" } as Dict,
  beneficiaryCount: { en: "{added} of {min} added", es: "{added} de {min} agregados" } as Dict,
  firstBeneficiaryAdded: {
    en: "Nice — that's your first one. Add one more to continue.",
    es: "Bien — ese es el primero. Agregue uno más para continuar.",
  } as Dict,
  beneficiariesDone: {
    en: "You're all set. Add another beneficiary if you'd like, or continue.",
    es: "Todo listo. Agregue otro beneficiario si lo desea, o continúe.",
  } as Dict,
  continueBtn: { en: "Continue", es: "Continuar" } as Dict,
  remove: { en: "Remove", es: "Eliminar" } as Dict,
  editForm: { en: "Edit form", es: "Editar formulario" } as Dict,
  empty: { en: "—", es: "—" } as Dict,
  viewTitle: { en: "Client summary", es: "Resumen del cliente" } as Dict,
  copy: { en: "Copy", es: "Copiar" } as Dict,
  copied: { en: "Copied", es: "Copiado" } as Dict,

  // Inline validation messages
  errRequired: { en: "This field is required.", es: "Este campo es obligatorio." } as Dict,
  errEmail: { en: "Enter a valid email address.", es: "Ingrese un correo electrónico válido." } as Dict,
  errPhone: { en: "Enter a valid 10-digit phone number.", es: "Ingrese un número de teléfono válido de 10 dígitos." } as Dict,
  errZip: { en: "Enter a valid 5-digit zip code.", es: "Ingrese un código postal válido de 5 dígitos." } as Dict,
  errSsn: { en: "Enter a valid 9-digit number.", es: "Ingrese un número válido de 9 dígitos." } as Dict,
  errDob: { en: "Enter a valid date of birth.", es: "Ingrese una fecha de nacimiento válida." } as Dict,
  errRange: {
    en: "Please enter a value between {min} and {max}.",
    es: "Ingrese un valor entre {min} y {max}.",
  } as Dict,
  errRouting: { en: "Routing numbers are 9 digits.", es: "Los números de ruta tienen 9 dígitos." } as Dict,

  // Live feedback for fixed-length numeric entry (phone, SSN, zip) — tells the client why Next
  // isn't lit yet instead of leaving them staring at a disabled button.
  digitsRemaining: { en: "{n} more digit(s) to go", es: "Faltan {n} dígito(s)" } as Dict,
  looksGood: { en: "Looks good", es: "Se ve bien" } as Dict,
  ssnOnFile: {
    en: "Already saved — tap to replace it.",
    es: "Ya guardado — toque para reemplazarlo.",
  } as Dict,

  // Medication search — its own strings; the dashboard's CRM-contact copy leaked in here before.
  notListed: { en: "Not listed — type it in", es: "No aparece — escríbalo" } as Dict,
  searchMedication: { en: "Search for a medication…", es: "Busque un medicamento…" } as Dict,
  drugSearching: { en: "Searching medications…", es: "Buscando medicamentos…" } as Dict,
  drugNoMatches: {
    en: "No medications found. Tap \"Not listed\" below to type it in yourself.",
    es: "No se encontraron medicamentos. Toque \"No aparece\" abajo para escribirlo.",
  } as Dict,

  // Split date-of-birth selects
  dobMonth: { en: "Month", es: "Mes" } as Dict,
  dobDay: { en: "Day", es: "Día" } as Dict,
  dobYear: { en: "Year", es: "Año" } as Dict,

  // Split height selects
  heightFeet: { en: "Feet", es: "Pies" } as Dict,
  heightInches: { en: "Inches", es: "Pulgadas" } as Dict,
} as const;

export function tr(dict: Dict, locale: FeLocale): string {
  return dict[locale];
}
