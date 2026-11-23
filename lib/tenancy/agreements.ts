/**
 * The agreements an agent accepts before the agent area opens: the platform's Terms of Service
 * ("tos") and the Data Processing Agreement ("dpa"). Each is versioned and identified by the
 * sha256 of its exact text, and acceptance is recorded per version in `agent_agreements`
 * (lib/tenancy/agreements-store.ts) with the time, IP and browser.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 * │ DRAFTS, PENDING ISAAC'S COUNSEL. These texts were written for the pilot (test agents, fake │
 * │ data) and have not been reviewed by a lawyer. "[OPERATOR LEGAL NAME]" is a placeholder for │
 * │ the LLC's legal name. Counsel's final wording replaces them before any real agent signs.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Changing a text: change it, give the document a NEW `version`, and update its `sha256` (the
 * offline test prints the new value). The version is what an acceptance is stored under, so an
 * edited text under an old version could never be accepted again; `pnpm test:tenancy` fails until
 * both move together. Every agent is then asked to accept the new version before they continue
 * (`agreementsSatisfied`); their clients' links keep working meanwhile.
 *
 * Pure (Node's crypto, no server-only import) so the offline tests can import it. Never import it
 * from a client component: the pages pass the text down.
 */

import { createHash } from "crypto";

export type AgreementLocale = "en" | "es";
export const AGREEMENT_DOC_IDS = ["tos", "dpa"] as const;
export type AgreementDocId = (typeof AGREEMENT_DOC_IDS)[number];

export type AgreementDocument = {
  id: AgreementDocId;
  /** Bumped on every change to the text. */
  version: string;
  /** The sha256 of `agreementCanonicalText` (checked by the offline test). */
  sha256: string;
  title: Record<AgreementLocale, string>;
  /** Plain text; paragraphs separated by a blank line. */
  body: Record<AgreementLocale, string>;
};

const TOS_EN = `DRAFT, pending legal review.

1. What this is. [OPERATOR LEGAL NAME] (the "Operator") gives you, free of charge, tools to present Impact Health Sharing to your clients and to collect their applications: a guide page at your own address, a presentation, a quote tool and an application form. Paid leads, if they are offered later, come under separate terms.

2. Your account. One account per person. Keep your sign-in private; you are responsible for what is done with it. You are an independent business, not an employee or agent of the Operator.

3. Your business. You represent Impact Health Sharing as an independent business owner (IBO) under your own ACN Business ID. You follow ACN's policies and procedures, the laws of the states where you work, and any license rules that apply to you. Your pages show only your own name, contact details and IBO number.

4. Your clients. You collect your clients' information with their permission and only for their application. How the Operator handles that information is set out in the Data Processing Agreement, which is part of these terms.

5. Fair use. Do not describe health sharing as insurance. Do not make false or misleading statements. Do not use the platform for other products, to send spam, or to reach another agent's clients or data. Do not try to get around its security.

6. What you add. You confirm you have the right to use the name, photo and links you add to your profile. The Operator may remove anything unlawful or misleading.

7. A pilot. The platform is offered as it is, during a pilot. Features may change. The Operator may pause or end your access, for example if these terms are broken, and will tell you when it can.

8. Leaving. You can stop at any time. When your account ends, your public pages stop working and your clients' information is handled as the Data Processing Agreement says.

9. Liability. As far as the law allows, the Operator is not responsible for indirect or lost-profit losses, and its total responsibility is limited to what you paid for the service, which is nothing while it is free.

10. Changes. When these terms change, you will be asked to accept the new version before you continue.`;

const TOS_ES = `BORRADOR, pendiente de revisión legal.

1. Qué es esto. [OPERATOR LEGAL NAME] (el "Operador") le ofrece, sin costo, herramientas para presentar Impact Health Sharing a sus clientes y recibir sus solicitudes: una página guía con su propia dirección, una presentación, un cotizador y un formulario de solicitud. Los prospectos de pago, si se ofrecen más adelante, tendrán sus propios términos.

2. Su cuenta. Una cuenta por persona. Mantenga privado su acceso; usted responde por lo que se haga con él. Usted es un negocio independiente, no un empleado ni agente del Operador.

3. Su negocio. Usted representa a Impact Health Sharing como dueño de negocio independiente (IBO) con su propio número de negocio de ACN. Usted cumple las políticas y procedimientos de ACN, las leyes de los estados donde trabaja y las reglas de licencia que le apliquen. Sus páginas muestran solo su propio nombre, sus datos de contacto y su número de IBO.

4. Sus clientes. Usted recibe la información de sus clientes con su permiso y solo para su solicitud. Cómo trata el Operador esa información está en el Acuerdo de Tratamiento de Datos, que forma parte de estos términos.

5. Buen uso. No presente el plan compartido de salud como un seguro. No haga afirmaciones falsas o engañosas. No use la plataforma para otros productos, para enviar spam ni para llegar a los clientes o datos de otro agente. No intente burlar su seguridad.

6. Lo que usted agrega. Usted confirma que tiene derecho a usar el nombre, la foto y los enlaces que agrega a su perfil. El Operador puede quitar cualquier cosa ilegal o engañosa.

7. Un piloto. La plataforma se ofrece tal como está, durante un piloto. Las funciones pueden cambiar. El Operador puede pausar o terminar su acceso, por ejemplo si no se cumplen estos términos, y le avisará cuando pueda.

8. Salida. Usted puede dejar de usarla en cualquier momento. Cuando su cuenta termina, sus páginas públicas dejan de funcionar y la información de sus clientes se trata como indica el Acuerdo de Tratamiento de Datos.

9. Responsabilidad. En la medida que la ley lo permita, el Operador no responde por pérdidas indirectas ni por ganancias perdidas, y su responsabilidad total se limita a lo que usted pagó por el servicio, que es nada mientras sea gratuito.

10. Cambios. Cuando estos términos cambien, se le pedirá aceptar la nueva versión antes de continuar.`;

const DPA_EN = `DRAFT, pending legal review.

1. Roles. You decide why and how your clients' information is collected: the client relationship is yours. [OPERATOR LEGAL NAME] (the "Operator") handles that information only on your behalf, as your processor and service provider, to run the platform for you.

2. The information. Your clients' names, contact details, dates of birth, household members, addresses and plan choices, and the sensitive details they give: Social Security or ITIN numbers, ID numbers and bank account details.

3. Only to serve you. The Operator uses your clients' information only to provide the platform to you. It never sells it, never markets to your clients, and never adds them to its own CRM or contact lists. Joining the platform doesn't add you to them either: your account details (name and email) are kept by the sign-in service. If you had an account on the Operator's own website before you joined, the contact record it made back then stays as it was and is no longer updated; ask and the Operator deletes it.

4. Who can see it. In the platform, only you can see your clients' information. The Operator's staff do not look at it, except to give you support when you ask for it, and then only what that request needs. "Sign in as" (impersonation) of your account by the Operator is refused for your clients' information.

5. Security. Sensitive numbers are encrypted when stored. Your clients reach their application only through their own private link; you reach it only through your sign-in. Every reveal of a sensitive number and every refused attempt is logged, with field names only, never the values.

6. Sub-processors. To run the platform the Operator uses: Vercel (hosting), Neon (database), Clerk (sign-in), Upstash QStash (background jobs), Google (address suggestions while your client types an address) and its email provider (notices to you). Impact Health Sharing's own price service receives a date of birth and a household size, nothing else, to price a plan. The Operator will tell you before it adds or replaces a sub-processor.

7. Breach notice. If the Operator learns of a security incident that affects your clients' information, it will tell you without undue delay, and within 48 hours at the latest, with what it knows, and will help you with any notices you must give.

8. Deletion. Sensitive numbers are removed from an application once you mark it entered with Impact, or 30 days after it is completed. When you leave the platform, your pages stop working, you get 30 days to export what you need (except the sensitive numbers), and then your clients' information is deleted. The access log is kept.

9. Your part. You collect only what an application needs, you tell your clients who you are, and you keep what you export safe.

10. Changes. When this agreement changes, you will be asked to accept the new version before you continue.`;

const DPA_ES = `BORRADOR, pendiente de revisión legal.

1. Funciones. Usted decide por qué y cómo se recibe la información de sus clientes: la relación con el cliente es suya. [OPERATOR LEGAL NAME] (el "Operador") trata esa información solo en su nombre, como su encargado y proveedor de servicio, para operar la plataforma para usted.

2. La información. Nombres, datos de contacto, fechas de nacimiento, miembros del hogar, direcciones y planes elegidos de sus clientes, y los datos sensibles que ellos den: números de Seguro Social o ITIN, números de identificación y datos de cuentas bancarias.

3. Solo para servirle a usted. El Operador usa la información de sus clientes solo para darle la plataforma. Nunca la vende, nunca les hace mercadeo a sus clientes y nunca los agrega a su propio CRM o listas de contactos. Unirse a la plataforma tampoco lo agrega a usted: los datos de su cuenta (nombre y correo) los guarda el servicio de acceso. Si usted ya tenía una cuenta en el sitio web propio del Operador antes de unirse, el registro de contacto que se creó entonces queda como estaba y ya no se actualiza; si lo pide, el Operador lo borra.

4. Quién puede verla. En la plataforma, solo usted puede ver la información de sus clientes. El personal del Operador no la mira, salvo para darle soporte cuando usted lo pida, y entonces solo lo que ese pedido necesite. "Entrar como" usted (suplantación) por parte del Operador se rechaza para la información de sus clientes.

5. Seguridad. Los números sensibles se guardan cifrados. Sus clientes llegan a su solicitud solo por su propio enlace privado; usted llega solo con su acceso. Cada vez que se muestra un número sensible y cada intento rechazado queda registrado, solo con el nombre del campo, nunca el valor.

6. Subencargados. Para operar la plataforma el Operador usa: Vercel (alojamiento), Neon (base de datos), Clerk (acceso), Upstash QStash (tareas en segundo plano), Google (sugerencias de dirección mientras su cliente escribe una dirección) y su proveedor de correo (avisos para usted). El servicio de precios de Impact Health Sharing recibe una fecha de nacimiento y el tamaño del hogar, nada más, para cotizar un plan. El Operador le avisará antes de agregar o cambiar un subencargado.

7. Aviso de incidentes. Si el Operador sabe de un incidente de seguridad que afecte la información de sus clientes, se lo dirá sin demora indebida, y a más tardar en 48 horas, con lo que sepa, y le ayudará con los avisos que usted deba dar.

8. Eliminación. Los números sensibles se borran de una solicitud cuando usted la marca como ingresada en Impact, o 30 días después de completada. Cuando usted deja la plataforma, sus páginas dejan de funcionar, tiene 30 días para exportar lo que necesite (salvo los números sensibles) y luego se borra la información de sus clientes. El registro de accesos se conserva.

9. Su parte. Usted recibe solo lo que una solicitud necesita, les dice a sus clientes quién es usted y guarda con cuidado lo que exporte.

10. Cambios. Cuando este acuerdo cambie, se le pedirá aceptar la nueva versión antes de continuar.`;

export const AGREEMENTS: Readonly<Record<AgreementDocId, AgreementDocument>> = {
  tos: {
    id: "tos",
    version: "2026-11-23-draft",
    sha256: "c3c917dc277f00d77a880294c62acec19e4c3f920344c85c61b63f4949412fab",
    title: { en: "Terms of Service", es: "Términos de servicio" },
    body: { en: TOS_EN, es: TOS_ES },
  },
  dpa: {
    id: "dpa",
    version: "2026-11-23-draft-2",
    sha256: "23e54ea3fd4b86e4ac29c33a7591a2ece369f61f23fa832841e7c92706694d0a",
    title: { en: "Data Processing Agreement", es: "Acuerdo de tratamiento de datos" },
    body: { en: DPA_EN, es: DPA_ES },
  },
};

/** Exactly what the hash covers: the id, the version, and both languages' title and text. */
export function agreementCanonicalText(doc: Pick<AgreementDocument, "id" | "version" | "title" | "body">): string {
  return JSON.stringify([doc.id, doc.version, doc.title.en, doc.body.en, doc.title.es, doc.body.es]);
}

export function agreementSha256(doc: Pick<AgreementDocument, "id" | "version" | "title" | "body">): string {
  return createHash("sha256").update(agreementCanonicalText(doc), "utf8").digest("hex");
}

/** What an acceptance must name: one document, its version and the hash of its text. */
export type AgreementRef = { doc: AgreementDocId; version: string; sha256: string };

/** The versions an agent must have accepted today, hashed from the texts themselves. */
export function currentAgreementRefs(
  docs: Readonly<Record<AgreementDocId, AgreementDocument>> = AGREEMENTS
): AgreementRef[] {
  return AGREEMENT_DOC_IDS.map((id) => ({ doc: id, version: docs[id].version, sha256: agreementSha256(docs[id]) }));
}

/** A stored acceptance (`agent_agreements`), as read back. */
export type AcceptedAgreement = { doc: string; version: string; sha256: string };

/** The current documents this agent has not accepted (same version AND same text). */
export function missingAgreements(
  accepted: readonly AcceptedAgreement[],
  current: readonly AgreementRef[] = currentAgreementRefs()
): AgreementDocId[] {
  return current
    .filter((ref) => !accepted.some((a) => a.doc === ref.doc && a.version === ref.version && a.sha256 === ref.sha256))
    .map((ref) => ref.doc);
}

export function agreementsSatisfied(
  accepted: readonly AcceptedAgreement[],
  current: readonly AgreementRef[] = currentAgreementRefs()
): boolean {
  return missingAgreements(accepted, current).length === 0;
}

/**
 * Has the agent accepted every document, at some version? The bar for client data to reach the
 * agent at all: their public guide, its Apply and the new applications it starts
 * (lib/tenancy/pages.ts, the start route). An agent who never accepted the DPA gets no public page.
 * A newer version waiting for acceptance doesn't take the guide down (the agent is bound by the
 * version they accepted until they accept the next); operating still needs the current versions
 * (`agreementsSatisfied`, the operator gate).
 */
export function agreementsOnRecord(
  accepted: readonly AcceptedAgreement[],
  docs: readonly AgreementDocId[] = AGREEMENT_DOC_IDS
): boolean {
  return docs.every((doc) => accepted.some((a) => a.doc === doc && Boolean(a.version) && /^[0-9a-f]{64}$/.test(a.sha256)));
}

/**
 * The accept button's request names exactly the documents on screen. Accepted only when it lists
 * every current document, each at its current version and hash: an agent whose page was opened
 * before a text changed gets "reload" rather than agreeing to words they never saw.
 */
export function acceptanceMatchesCurrent(
  submitted: unknown,
  current: readonly AgreementRef[] = currentAgreementRefs()
): submitted is AgreementRef[] {
  if (!Array.isArray(submitted) || submitted.length !== current.length) return false;
  return current.every((ref) =>
    submitted.some(
      (s) =>
        s !== null &&
        typeof s === "object" &&
        (s as Record<string, unknown>).doc === ref.doc &&
        (s as Record<string, unknown>).version === ref.version &&
        (s as Record<string, unknown>).sha256 === ref.sha256
    )
  );
}

/** Paragraphs for display. */
export function agreementParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
