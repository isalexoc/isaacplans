/**
 * Impact Health Sharing's state notices, WORD FOR WORD, for the applications agents take on the
 * platform. Nothing in the texts below was written, paraphrased or translated here: each one is
 * exactly as Impact publishes it (copied programmatically from the pages, never retyped).
 *
 *  - English: https://www.impacthealthsharing.com/disclosures (fetched 2026-11-23).
 *  - Spanish: https://www.impacthealthsharing.com/es/disclosures (fetched 2026-11-23), Impact's own
 *    Spanish page. It is older than the English one (its footer still says © 2022 and "No está
 *    disponible en NJ., RI. y WA.") and has no Spanish notice for Massachusetts, Montana, Tennessee,
 *    Utah or West Virginia: a Spanish form shows those in English. Its New Jersey text is shorter
 *    than the English one; each language shows its own page's text.
 *  - Impact's English footer: "Not available in RI and WA." Hence IMPACT_UNAVAILABLE_STATES: an
 *    agent's application with a home address there is blocked on the form and refused by the
 *    complete route (app/api/intake/[lob]/[token]/complete/route.ts). Isaac's own are unchanged.
 *
 * Shown near the submit step of an AGENT's application (components/intake/impact-state-notice.tsx),
 * by its home state (`state`, the residence step: lib/intake-configs/_shared.ts). A state Impact's
 * list doesn't name gets its "All States Not Listed Below." notice. Montana's notice says the
 * organization "does not use insurance agents or pay commissions to insurance agents": a question
 * for counsel before agents enroll Montana residents (the plan's Phase 0 already lists Montana).
 *
 * Updating: copy both pages again (never retype), bump IMPACT_NOTICES_VERSION, and have counsel
 * confirm. Pure (one import, ./availability.ts): the notice component and the offline tests use it.
 * The intake form loads the component only for an agent's application (next/dynamic), so these
 * texts never ship with Isaac's intakes; the availability rules live in ./availability.ts.
 */

import { IMPACT_UNAVAILABLE_STATES, normalizeStateCode } from "./availability";

export { IMPACT_UNAVAILABLE_STATES, impactUnavailableIn, normalizeStateCode } from "./availability";

/** The day the texts below were copied from Impact's pages. */
export const IMPACT_NOTICES_VERSION = "2026-11-23";

export const IMPACT_NOTICES_SOURCES = {
  en: "https://www.impacthealthsharing.com/disclosures",
  es: "https://www.impacthealthsharing.com/es/disclosures",
} as const;

export type NoticeLocale = "en" | "es";

/** A link inside a notice: `label` is the words of a paragraph that link to `href`. */
export type NoticeLink = { label: string; href: string };

/** One notice as published: its heading (the statute) and its paragraphs. */
export type NoticeText = {
  title: string;
  paragraphs: readonly string[];
  links?: readonly NoticeLink[];
};

/** A state's notice in English, and in Spanish where Impact's Spanish page has one (else null). */
export type StateNotice = { en: NoticeText; es: NoticeText | null };

/** "All States Not Listed Below.": Impact's notice for every state the list doesn't name. */
export const DEFAULT_STATE_NOTICE: StateNotice = {
  en: {
    title: "All States Not Listed Below.",
    paragraphs: [
      "NOTICE: Impact Health Sharing is not insurance or an insurance policy, nor is it offered through an insurance company. Neither is Impact Health Sharing a discount healthcare program nor a discount health card program. Whether anyone chooses to assist you with your medical bills will be totally voluntary, as neither Impact Health Sharing nor any other member is liable for, or may be compelled to make the payment of your medical bill. As such, Impact Health Sharing should never be considered insurance. Whether you receive any amounts for medical expenses, and whether or not Impact Health Sharing continues to operate, you are always personally responsible for the payment of your own medical bills. Impact Health Sharing is not subject to the regulatory requirements or consumer protections of your particular State’s Insurance Code or Statutes.",
    ],
  },
  es: {
    title: "Todos los estados no estan enumerados a continuación.",
    paragraphs: [
      "AVISO: Impact Health Sharing no es un seguro ni una póliza de seguro, ni se ofrece a través de una compañía de seguros. Impact Health Sharing no es un programa de atención médica con descuento ni un programa de tarjeta de salud con descuento. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario, ya que ni Impact Health Sharing ni ningún otro miembro es responsable ni puede verse obligado a realizar el pago de su factura médica. Como tal, Impact Health Sharing nunca debe considerarse un seguro. Ya sea que reciba algún monto por gastos médicos y si Impact Health Sharing continúa operando o no, usted siempre es personalmente responsable del pago de sus propias facturas médicas. Impact Health Sharing no está sujeto a los requisitos reglamentarios ni a las protecciones del consumidor del Código de Seguros o los Estatutos de su Estado en particular.",
    ],
  },
};

/** Impact's notice per state (two-letter code), each in the language(s) Impact publishes it in. */
export const STATE_NOTICES: Readonly<Record<string, StateNotice>> = {
  AK: {
    en: {
      title: "Alaska Statute 21.03.021(k)",
      paragraphs: [
        "Notice: The organization coordinating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. Participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive a payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Alaska Estatuto 21.03.021(k)",
      paragraphs: [
        "Aviso: La organización que coordina el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. La participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe un pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  AL: {
    en: {
      title: "Alabama Code Title 22-6A-2",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Alabama Código Derecho 22-6A-2",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe algún pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  AR: {
    en: {
      title: "Arkansas Code 23-60-104.2",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company and neither its guidelines nor plan of operation is an insurance policy. If anyone chooses to assist you with your medical bills, it will be totally voluntary because participants are not compelled by law to contribute toward your medical bills. Participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive a payment for medical expenses or if this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Arkansas Código 23-60-104.2",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de funcionamiento constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas, será totalmente voluntario porque los participantes no están obligados por ley a contribuir con sus facturas médicas. La participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe un pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  AZ: {
    en: {
      title: "Arizona Statute 20-122",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company and the ministry’s guidelines and plan of operation are not an insurance policy. Whether anyone chooses to assist you with your medical bills will be completely voluntary because participants are not compelled by law to contribute toward your medical bills. Therefore, participation in the ministry or a subscription to any of its documents should not be considered to be insurance. Regardless of whether you receive any payment for medical expenses or whether this ministry continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Arizona Estatuto 20-122",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y las directrices y el plan de operaciones del ministerio no son una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será completamente voluntario porque los participantes no están obligados por ley a contribuir con sus facturas médicas. Por lo tanto, la participación en el ministerio o la suscripción de cualquiera de sus documentos no debe considerarse como un seguro. Independientemente de si recibe algún pago por gastos médicos o si este ministerio sigue funcionando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  FL: {
    en: {
      title: "Florida Statute 624.1265",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor its plan of operation is an insurance policy. Membership is not offered through an insurance company, and the organization is not subject to the regulatory requirements or consumer protections of the Florida Insurance Code. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant is compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payments for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Florida Estatuto 624.1265",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de funcionamiento constituyen una póliza de seguro. La membresía no se ofrece a través de una compañía de seguros y la organización no está sujeta a los requisitos reglamentarios ni a las protecciones al consumidor del Código de Seguros de Florida. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante está obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe pagos por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  GA: {
    en: {
      title: "Georgia Statute 33-1-20",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Georgia Estatuto 33-1-20",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe algún pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  ID: {
    en: {
      title: "Idaho Statute 41-121",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Idaho Estatuto 41-121",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe algún pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  IL: {
    en: {
      title: "Illinois Statute 215-5/4-Class 1-b",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation constitute or create an insurance policy. Any assistance you receive with your medical bills will be totally voluntary. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Whether or not you receive any payments for medical expenses and whether or not this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Illinois Estatuto 215-5/4-Class 1-b",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros, y ni sus directrices ni su plan de operaciones constituyen ni crean una póliza de seguro. Cualquier asistencia que reciba con sus facturas médicas será totalmente voluntaria. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Ya sea que reciba o no algún pago por gastos médicos y ya sea que esta organización continúe operando o no, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  IN: {
    en: {
      title: "Indiana Code 27-1-2.1",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor its plan of operation is an insurance policy. Any assistance you receive with your medical bills will be totally voluntary. Neither the organization nor any other participant can be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Whether or not you receive any payments for medical expenses and whether or not this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Indiana Código 27-1-2.1",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de funcionamiento constituyen una póliza de seguro. Cualquier asistencia que reciba con sus facturas médicas será totalmente voluntaria. Ni la organización ni ningún otro participante pueden verse obligados por ley a contribuir a sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Ya sea que reciba o no algún pago por gastos médicos y ya sea que esta organización continúe operando o no, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  KY: {
    en: {
      title: "Kentucky Revised Statute 304.1-120 (7)",
      paragraphs: [
        "Notice: Under Kentucky law, the religious organization facilitating the sharing of medical expenses is not an insurance company, and its guidelines, plan of operation, or any other document of the religious organization do not constitute or create an insurance policy. Participation in the religious organization or a subscription to any of its documents shall not be considered insurance. Any assistance you receive with your medical bills will be totally voluntary. Neither the organization or any participant shall be compelled by law to contribute toward your medical bills. Whether or not you receive any payments for medical expenses, and whether or not this organization continues to operate, you shall be personally responsible for the payment of your medical bills.",
      ],
    },
    es: {
      title: "Kentucky Estatuto Revisado 304.1-120 (7)",
      paragraphs: [
        "Aviso: Según la ley de Kentucky, la organización religiosa que facilita el reparto de los gastos médicos no es una compañía de seguros, y sus pautas, plan de operaciones o cualquier otro documento de la organización religiosa no constituye ni crea una póliza de seguro. No se considerará seguro la participación en la organización religiosa ni la suscripción de alguno de sus documentos. Cualquier asistencia que reciba con sus facturas médicas será totalmente voluntaria. Ni la organización ni ningún participante estarán obligados por ley a contribuir a sus facturas médicas. Ya sea que reciba o no pagos por gastos médicos, y ya sea que esta organización continúe operando o no, usted será personalmente responsable del pago de sus facturas médicas.",
      ],
    },
  },
  LA: {
    en: {
      title: "Louisiana Revised Statute Title 22-318,319",
      paragraphs: [
        "Notice: The ministry facilitating the sharing of medical expenses is not an insurance company. Neither the guidelines nor the plan of operation of the ministry constitutes an insurance policy. Financial assistance for the payment of medical expenses is strictly voluntary. Participation in the ministry or a subscription to any publication issued by the ministry shall not be considered as enrollment in any health insurance plan or as a waiver of your responsibility to pay your medical expenses.",
      ],
    },
    es: {
      title: "Louisiana Derecho Revisado del Estatuto 22-318,319",
      paragraphs: [
        "Aviso: El ministerio que facilita el reparto de los gastos médicos no es una compañía de seguros. Ni los lineamientos ni el plan de operación del ministerio constituyen una póliza de seguro. La ayuda económica para el pago de los gastos médicos es estrictamente voluntaria. La participación en el ministerio o la suscripción a cualquier publicación emitida por el ministerio no se considerará como inscripción en ningún plan de seguro médico ni como una renuncia a su responsabilidad de pagar sus gastos médicos.",
      ],
    },
  },
  MA: {
    en: {
      title: "Massachusetts",
      paragraphs: [
        "The organization coordinating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills.",
      ],
    },
    es: null,
  },
  MD: {
    en: {
      title: "Maryland Article 48, Section 1-202(4)",
      paragraphs: [
        "Notice: This publication is not issued by an insurance company nor is it offered through an insurance company. It does not guarantee or promise that your medical bills will be published or assigned to others for payment. No other subscriber will be compelled to contribute toward the cost of your medical bills. Therefore, this publication should never be considered a substitute for an insurance policy. This activity is not regulated by the State Insurance Administration, and your liabilities are not covered by the Life and Health Guaranty Fund. Whether or not you receive any payments for medical expenses and whether or not this entity continues to operate, you are always liable for any unpaid bills.",
      ],
    },
    es: {
      title: "Maryland Artículo 48, Sección 1-202(4)",
      paragraphs: [
        "Aviso: Esta publicación no es emitida por una compañía de seguros ni se ofrece a través de una compañía de seguros. No garantiza ni promete que sus facturas médicas se publicarán o asignarán a terceros para su pago. Ningún otro suscriptor estará obligado a contribuir al costo de sus facturas médicas. Por lo tanto, esta publicación nunca debe considerarse un sustituto de una póliza de seguro. Esta actividad no está regulada por la Administración de Seguros del Estado, y sus responsabilidades no están cubiertas por el Fondo de Garantía de Vida y Salud. Ya sea que reciba o no pagos por gastos médicos y ya sea que esta entidad continúe operando o no, usted siempre es responsable por sus facturas que no han sido pagadas.",
      ],
    },
  },
  ME: {
    en: {
      title: "Maine Revised Statute Title 24-A, §704, sub-§3",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. Participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Maine Derecho Revisado del Estatuto 24-A, §704, sub-§3",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de funcionamiento constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. La participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  MI: {
    en: {
      title: "Michigan Section 550.1867",
      paragraphs: [
        "Notice: Impact Health Sharing that operates this health care sharing organization is not an insurance company and the financial assistance provided through the ministry is not insurance and is not provided through an insurance company. Whether any participant in the ministry chooses to assist another participant who has financial or medical needs is totally voluntary. A participant will not be compelled by law to contribute toward the financial or medical needs of another participant. This document is not a contract of insurance or a promise to pay for the financial or medical needs of a participant by the ministry. A participant who receives assistance from the ministry for his or her financial or medical needs remains personally responsible for the payment of all of his or her medical bills and other obligations incurred in meeting his or her financial or medical needs.",
      ],
    },
    es: {
      title: "Michigan Sección 550.1867",
      paragraphs: [
        "Aviso: Impact Health Sharing que opera esta organización de atención médica compartida no es una compañía de seguros y la asistencia financiera proporcionada a través del ministerio no es un seguro y no se proporciona a través de una compañía de seguros. Si cualquier participante en el ministerio elige ayudar a otro participante que tiene necesidades financieras o médicas es totalmente voluntario. Un participante no estará obligado por ley a contribuir con las necesidades financieras o médicas de otro participante. Este documento no es un contrato de seguro o una promesa de pago por las necesidades financieras o médicas de un participante por parte del ministerio. Un participante que recibe asistencia del ministerio para sus necesidades financieras o médicas sigue siendo personalmente responsable del pago de todas sus facturas médicas y otras obligaciones contraídas para satisfacer sus necesidades financieras o médicas.",
      ],
    },
  },
  MO: {
    en: {
      title: "Missouri Section 376.1750",
      paragraphs: [
        "Notice: This publication is not an insurance company nor is it offered through an insurance company. Whether anyone chooses to assist you with your medical bills will be totally voluntary, as no other subscriber or member will be compelled to contribute toward your medical bills. As such, this publication should never be considered to be insurance. Whether you receive any payments for medical expenses and whether or not this publication continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Missouri Sección 376.1750",
      paragraphs: [
        "Aviso: Esta publicación no es una compañía de seguros ni se ofrece a través de una compañía de seguros. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario, ya que ningún otro suscriptor o miembro estará obligado a contribuir con sus facturas médicas. Como tal, esta publicación nunca debe considerarse como un seguro. Independientemente de que reciba pagos por gastos médicos y de que esta publicación siga funcionando o no, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  MS: {
    en: {
      title: "Mississippi Title 83-77-1",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payment of medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Mississippi Derecho 83-77-1",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe algún pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  MT: {
    en: {
      title: "Montana - Revised Statute Chapter SECTIONS 33-1-102 AND 33-1-201",
      paragraphs: [
        "NOTICE: The organization facilitating the sharing of medical expenses is not an insurance company and does not use insurance agents or pay commissions to insurance agents. The organization's guidelines and plan of operation are not an insurance policy. Without health care insurance, there is no guarantee that you, a fellow member, or any other person who is a party to the organization's agreement will be protected in the event of illness or emergency. Regardless of whether you receive any payment for medical expenses or whether the organization terminates, withdraws from the faith-based agreement, or continues to operate, you are always personally responsible for the payment of your own medical bills. If your participation in the organization ends, state law may subject you to a waiting period before you are able to apply for health insurance coverage.",
      ],
    },
    es: null,
  },
  NC: {
    en: {
      title: "North Carolina Statute 58-49-12",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company and neither its guidelines nor its plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be voluntary. No other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payment for medical expenses or whether this organization continues to operate, you are always personally liable for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "North Carolina Estatuto 58-49-12",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de funcionamiento constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será voluntario. Ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe algún pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  NE: {
    en: {
      title: "Nebraska Revised Statute Chapter 44-311",
      paragraphs: [
        "IMPORTANT NOTICE. This organization is not an insurance company, and its product should never be considered insurance. If you join this organization instead of purchasing health insurance, you will be considered uninsured. By the terms of this agreement, whether anyone chooses to assist you with your medical bills as a participant of this organization will be totally voluntary, and neither the organization nor any participant can be compelled by law to contribute toward your medical bills. Regardless of whether you receive payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills. This organization is not regulated by the Nebraska Department of Insurance. You should review this organization’s guidelines carefully to be sure you understand any limitations that may affect your personal medical and financial needs",
      ],
    },
    es: {
      title: "Nebraska Estatuto Revisado Capítulo 44-311",
      paragraphs: [
        "NOTICIA IMPORTANTE. Esta organización no es una compañía de seguros y su producto nunca debe considerarse un seguro. Si se une a esta organización en lugar de comprar un seguro médico, se considerará que no tiene seguro. Según los términos de este acuerdo, si alguien elige ayudarlo con sus facturas médicas como participante de esta organización será totalmente voluntario, y ni la organización ni ningún participante pueden ser obligados por ley a contribuir con sus facturas médicas. Independientemente de si recibe pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas. Esta organización no está regulada por el Departamento de Seguros de Nebraska. Debe revisar las pautas de esta organización cuidadosamente para asegurarse de comprender cualquier limitación que pueda afectar sus necesidades médicas y financieras personales.",
      ],
    },
  },
  NH: {
    en: {
      title: "New Hampshire Section 126-V:1",
      paragraphs: [
        "IMPORTANT NOTICE: This organization is not an insurance company, and its product should never be considered insurance. If you join this organization instead of purchasing health insurance, you will be considered uninsured. By the terms of this agreement, whether anyone chooses to assist you with your medical bills as a participant of this organization will be totally voluntary, and neither the organization nor any participant can be compelled by law to contribute toward your medical bills. Regardless of whether you receive payment for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills. This organization is not regulated by the New Hampshire Insurance Department. You should review this organization’s guidelines carefully to be sure you understand any limitations that may affect your personal medical and financial needs.",
      ],
    },
    es: {
      title: "New Hampshire Sección 126-V:1",
      paragraphs: [
        "AVISO IMPORTANTE: Esta organización no es una compañía de seguros y su producto nunca debe considerarse un seguro. Si se une a esta organización en lugar de comprar un seguro médico, se considerará que no tiene seguro. Según los términos de este acuerdo, si alguien elige ayudarlo con sus facturas médicas como participante de esta organización será totalmente voluntario, y ni la organización ni ningún participante pueden ser obligados por ley a contribuir con sus facturas médicas. Independientemente de si recibe pago por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas. Esta organización no está regulada por el Departamento de Seguros de New Hampshire. Debe revisar las pautas de esta organización detenidamente para asegurarse de comprender cualquier limitación que pueda afectar sus necesidades médicas y financieras personales.",
      ],
    },
  },
  NJ: {
    en: {
      title: "New Jersey Information",
      paragraphs: [
        "Impact Health Sharing is available to New Jersey residents, but with one important caveat: Impact is not insurance, and due to a New Jersey state law, members may be required to pay a Shared Responsibility Payment (SRP) when filing their state taxes.",
        "What is the NJ Shared Responsibility Payment (SRP)?",
        "The New Jersey Health Insurance Market Preservation Act requires every New Jersey resident to obtain health insurance, have a valid exemption, or make a Shared Responsibility Payment (SRP). The law requires you and your family to have Minimum Essential Coverage (MEC) throughout the year, qualify for an exemption, or remit an SRP when you file your New Jersey Income Tax return.",
        "In the meantime, it's important to note that New Jersey-based Impact members do not qualify for an exemption. The amount of the SRP is generally based on your income and family size and is capped at the statewide average annual premium for Bronze Health Plans in New Jersey. To calculate the SRP visit the New Jersey state calculations page or check with your tax filer. Learn more here.",
      ],
      links: [
        { label: "Learn more here", href: "https://www.nj.gov/treasury/njhealthinsurancemandate/responsibilitypayment.shtml" },
      ],
    },
    es: {
      title: "New Jersey",
      paragraphs: [
        "Ten en cuenta que en Nueva Jersey, si no cuentas con un seguro de salud, podrías deber un impuesto llamado Pago por Responsabilidad Compartida (en inglés: Shared Responsibility Payment o SRP).",
        "Más Información",
      ],
      links: [
        { label: "Más Información", href: "https://www.impacthealthsharing.com/knowledge/new-jersey?hsLang=es" },
      ],
    },
  },
  PA: {
    en: {
      title: "Pennsylvania 40 Penn. Statute Section 23(b)",
      paragraphs: [
        "Notice: This publication is not an insurance company nor is it offered through an insurance company. This publication does not guarantee or promise that your medical bills will be published or assigned to others for payment. Whether anyone chooses to pay your medical bills will be totally voluntary. As such, this publication should never be considered a substitute for insurance. Whether you receive any payments for medical expenses and whether or not this publication continues to operate, you are always liable for any unpaid bills.",
      ],
    },
    es: {
      title: "Pennsylvania 40 Penn. Estatuto Sección 23(b)",
      paragraphs: [
        "Aviso: Esta publicación no es una compañía de seguros ni se ofrece a través de una compañía de seguros. Esta publicación no garantiza ni promete que sus facturas médicas se publicarán o asignarán a terceros para su pago. Si alguien decide pagar sus facturas médicas será totalmente voluntario. Como tal, esta publicación nunca debe considerarse un sustituto del seguro. Ya sea que reciba algún pago por gastos médicos y si esta publicación continúa funcionando o no, usted siempre es responsable por sus facturas que no han sido pagadas.",
      ],
    },
  },
  SD: {
    en: {
      title: "South Dakota Statute Title 58-1-3.3",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payments for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "South Dakota Derecho Del Estatuto 58-1-3.3",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario porque ningún otro participante estará obligado por ley a contribuir con sus facturas médicas. Como tal, la participación en la organización o la suscripción de cualquiera de sus documentos nunca debe considerarse como un seguro. Independientemente de si recibe pagos por gastos médicos o si esta organización continúa operando, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  TN: {
    en: {
      title: "Tennessee Public Chapter No. 526 HB 1163",
      paragraphs: [
        "The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payments for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: null,
  },
  TX: {
    en: {
      title: "Texas Code Title 8, K, 1681.001",
      paragraphs: [
        "Impact Health Sharing is not insurance or an insurance policy nor is it offered through an insurance company. Neither is Impact Health Sharing a discount health care or discount health card program. Whether anyone chooses to assist you with your medical bills will be totally voluntary, as no other member will be compelled by law to contribute toward your medical bills. Whether you receive any amounts for medical expenses and whether or not Impact Health Sharing continues to operate, you are always personally responsible for the payment of your own medical bills. Impact Health Sharing is not subject to the regulatory requirements or consumer protections of your particular State's Insurance Code or Statutes. Membership in the health care sharing organization does not provide creditable coverage, and, therefore, future insurance coverage you obtain may limit or exclude benefits for your preexisting conditions. Complaints concerning this health care sharing organization may be reported to the Texas Office of the Attorney General.",
      ],
    },
    es: {
      title: "Texas Código Derecho 8, K, 1681.001",
      paragraphs: [
        "Impact Health Sharing no es un seguro ni una póliza de seguro ni se ofrece a través de una compañía de seguros. Impact Health Sharing tampoco es un programa de atención médica con descuento o tarjeta de salud con descuento. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario, ya que la ley no obligará a ningún otro miembro a contribuir con sus facturas médicas. Ya sea que reciba algún monto por gastos médicos y si Impact Health Sharing continúa operando o no, usted siempre es personalmente responsable del pago de sus propias facturas médicas. Impact Health Sharing no está sujeto a los requisitos reglamentarios ni a las protecciones del consumidor del Código de Seguros o los Estatutos de su Estado en particular. La afiliación a la organización de atención médica compartida no brinda cobertura acreditable y, por lo tanto, la cobertura de seguro futura que obtenga puede limitar o excluir los beneficios para sus condiciones preexistentes. Las quejas relacionadas con esta organización de atención médica compartida pueden presentarse ante la Oficina del Fiscal General de Texas.",
      ],
    },
  },
  UT: {
    en: {
      title: "Utah 31A-1-103",
      paragraphs: [
        "Notice: the health care sharing ministry is not an insurance company; nothing the health care sharing ministry offers or provides is an insurance policy, including the health care sharing ministry's guidelines or plan of operations; participation in the health care sharing ministry is entirely voluntary and no participant is compelled by law to contribute to another participant's expenses; participation in the health care sharing ministry or subscription to any of the health care sharing ministry's services is not insurance; and each participant is always personally responsible for the participant's expenses regardless of whether the participant receives payment for the expenses through the health care sharing ministry or whether this health care sharing ministry continues to operate.",
      ],
    },
    es: null,
  },
  VA: {
    en: {
      title: "Virginia Code 38.2-6300-6301",
      paragraphs: [
        "Notice: This publication is not insurance, and is not offered through an insurance company. Whether anyone chooses to assist you with your medical bills will be totally voluntary, as no other member will be compelled by law to contribute toward your medical bills. As such, this publication should never be considered to be insurance. Whether you receive any payments for medical expenses and whether or not this publication continues to operate, you are always personally responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Virginia Código 38.2-6300-6301",
      paragraphs: [
        "Aviso: Esta publicación no es un seguro y no se ofrece a través de una compañía de seguros. Si alguien elige ayudarlo con sus facturas médicas será totalmente voluntario, ya que la ley no obligará a ningún otro miembro a contribuir con sus facturas médicas. Como tal, esta publicación nunca debe considerarse como un seguro. Independientemente de que reciba pagos por gastos médicos y de que esta publicación siga funcionando o no, usted siempre es personalmente responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  WI: {
    en: {
      title: "Wisconsin Statute 600.01 (1) (b) (9)",
      paragraphs: [
        "ATTENTION: This publication is not issued by an insurance company, nor is it offered through an insurance company. This publication does not guarantee or promise that your medical bills will be published or assigned to others for payment. Whether anyone chooses to pay your medical bills is entirely voluntary. This publication should never be considered a substitute for an insurance policy. Whether or not you receive any payments for medical expenses, and whether or not this publication continues to operate, you are responsible for the payment of your own medical bills.",
      ],
    },
    es: {
      title: "Wisconsin Estatuto 600.01 (1) (b) (9)",
      paragraphs: [
        "ATENCIÓN: Esta publicación no es emitida por una compañía de seguros, ni se ofrece a través de una compañía de seguros. Esta publicación no garantiza ni promete que sus facturas médicas se publicarán o asignarán a terceros para su pago. Si alguien elige pagar sus facturas médicas es totalmente voluntario. Esta publicación nunca debe considerarse un sustituto de una póliza de seguro. Ya sea que reciba o no pagos por gastos médicos, y ya sea que esta publicación siga funcionando o no, usted es responsable del pago de sus propias facturas médicas.",
      ],
    },
  },
  WV: {
    en: {
      title: "West Virginia WV SB375 HB4809",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Whether anyone chooses to assist you with your medical bills will be totally voluntary because no other participant will be compelled by law to contribute toward your medical bills. As such, participation in the organization or a subscription to any of its documents should never be considered to be insurance. Regardless of whether you receive any payments for medical expenses or whether this organization continues to operate, you are always personally responsible for the payment of your own medical bills. Complaints concerning this health care sharing ministry may be reported to the Attorney General of your state.",
      ],
    },
    es: null,
  },
  WY: {
    en: {
      title: "Wyoming 26.1.104 (a)(v)(C)",
      paragraphs: [
        "Notice: The organization facilitating the sharing of medical expenses is not an insurance company, and neither its guidelines nor plan of operation is an insurance policy. Any assistance with your medical bills is completely voluntary. No other participant is compelled by law or otherwise to contribute toward your medical bills. Participation in the organization or a subscription to any of its documents shall not be considered to be health insurance and is not subject to the regulatory requirements or consumer protections of the Wyoming insurance code. You are personally responsible for payment of your medical bills regardless of any financial sharing you may receive from the organization for medical expenses. You are also responsible for payment of your medical bills if the organization ceases to exist or ceases to facilitate the sharing of medical expenses.",
      ],
    },
    es: {
      title: "Wyoming 26.1.104 (a)(v)(C)",
      paragraphs: [
        "Aviso: La organización que facilita el reparto de los gastos médicos no es una compañía de seguros y ni sus directrices ni su plan de operaciones constituyen una póliza de seguro. Cualquier asistencia con sus facturas médicas es completamente voluntaria. Ningún otro participante está obligado por ley o de otra manera a contribuir con sus facturas médicas. La participación en la organización o la suscripción a cualquiera de sus documentos no se considerará un seguro de salud y no está sujeta a los requisitos reglamentarios ni a la protección del consumidor del código de seguros de Wyoming. Usted es personalmente responsable del pago de sus facturas médicas, independientemente de cualquier participación financiera que pueda recibir de la organización para gastos médicos. También es responsable del pago de sus facturas médicas si la organización deja de existir o deja de facilitar el reparto de los gastos médicos.",
      ],
    },
  },
};

export type ApplicableNotice = {
  version: string;
  /** The state the notice was picked for; null when the application doesn't say (yet). */
  state: string | null;
  /** Impact's "All States Not Listed Below." notice. */
  general: boolean;
  /** The language shown: the form's when Impact publishes the notice in it, else English. */
  language: NoticeLocale;
  text: NoticeText;
};

/**
 * The notice an application shows for its home state, in the form's language when Impact publishes
 * it in that language (else in English). Null where Impact isn't available: that application is
 * blocked instead.
 */
export function impactNoticeFor(state: unknown, locale: NoticeLocale): ApplicableNotice | null {
  const code = normalizeStateCode(state);
  if (code !== null && IMPACT_UNAVAILABLE_STATES.includes(code)) return null;
  const listed = code !== null ? STATE_NOTICES[code] : undefined;
  const notice = listed ?? DEFAULT_STATE_NOTICE;
  const localized = locale === "es" ? notice.es : notice.en;
  return {
    version: IMPACT_NOTICES_VERSION,
    state: code,
    general: !listed,
    language: localized ? locale : "en",
    text: localized ?? notice.en,
  };
}
