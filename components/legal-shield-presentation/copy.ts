/**
 * The Legal Shield sales deck's words: Isaac's "Plan Preferencial + IDShield" deck, verbatim, plus
 * the price slide and the "3 pasos" slide he asked for (2026-11-24). Spanish only, in "tú" like the
 * PDF. The associate's name is "Ysmael Orraiz" (no accent: Isaac confirmed).
 *
 * LegalShield is not insurance: `pnpm test:staff-access` scans this file for insurance words and
 * for any mention of the plans this deck never sells (the basic and top tiers).
 *
 * Content lives in code, like the Impact deck: a wording change is a code change.
 */

import { LS_ADVISOR_NAME, LS_BRAND_NAME, LS_DECK_DISCLAIMER_ES, LS_PHONE_DISPLAY } from "@/lib/legal-shield/constants";

export type LsIcon =
  | "scale"
  | "fingerprint"
  | "chart"
  | "chat"
  | "docSearch"
  | "mail"
  | "scroll"
  | "house"
  | "heart"
  | "car"
  | "carFront"
  | "gavel"
  | "bank"
  | "phone"
  | "percent"
  | "pen"
  | "card"
  | "globe"
  | "share"
  | "eyeOff"
  | "shieldCheck"
  | "refresh"
  | "infinity"
  | "dollar"
  | "calendar"
  | "mapPin"
  | "user"
  | "family"
  | "book";

/** A line of text where `**…**` marks a gold highlight (as the PDF does). */
export type Rich = string;

export type Row = { icon: LsIcon; title: string; body: Rich };

export const LS_DECK = {
  brand: LS_BRAND_NAME,
  agentName: LS_ADVISOR_NAME,
  phone: LS_PHONE_DISPLAY,
  whatsappPill: `${LS_ADVISOR_NAME} · WhatsApp`,
  disclaimer: LS_DECK_DISCLAIMER_ES,

  cover: {
    kicker: "Plan Preferencial + IDShield",
    title: ["Protegemos", "y empoderamos"],
    titleGold: "a tu familia",
    preparedFor: "Preparado para",
    pill: "Tu guía del plan",
  },

  dual: {
    kicker: "Tu plan dual",
    title: "Dos protecciones,",
    titleGold: "una membresía",
    cards: [
      {
        icon: "scale" as LsIcon,
        title: "LegalShield",
        body: "Un bufete en tu estado para tus asuntos legales personales. Acceso 24/7 en emergencias cubiertas.",
      },
      {
        icon: "fingerprint" as LsIcon,
        title: "IDShield",
        body: "Vigilamos tu información personal. Si te roban la identidad, la restauramos.",
      },
      {
        icon: "chart" as LsIcon,
        title: "Solo con los dos",
        body: "Asesoría de crédito: especialistas te explican tu puntaje y tu abogado te orienta sobre crédito y préstamos.",
        highlight: true,
      },
    ],
    covers: "Cubre a **ti, tu cónyuge y tus hijos dependientes.**",
  },

  legal1: {
    kicker: "Plan legal · 1 de 2",
    title: "Tu abogado",
    titleGold: "para el día a día",
    rows: [
      { icon: "chat", title: "Consultas legales", body: "Por teléfono, incluso asuntos que ya tenías" },
      { icon: "docSearch", title: "Revisión de documentos", body: "Hasta **25 páginas** cada uno" },
      { icon: "mail", title: "Cartas y llamadas", body: "En tu nombre, con la firma del bufete" },
      { icon: "scroll", title: "Testamento y poderes", body: "Testamento, testamento vital y poder notarial" },
      { icon: "house", title: "Compra de tu casa", body: "Revisión de documentos hipotecarios, 1 vez al año" },
      { icon: "heart", title: "Asuntos familiares", body: "Adopción, cambio de nombre, separación y divorcio **sin oposición**" },
    ] as Row[],
  },

  legal2: {
    kicker: "Plan legal · 2 de 2",
    title: "Cuando más",
    titleGold: "lo necesitas",
    rows: [
      { icon: "car", title: "Multas de tránsito", body: "**2 por persona** al año · $79 si el abogado va a corte" },
      { icon: "carFront", title: "Tu vehículo", body: "Licencia de conducir y daños a la propiedad" },
      { icon: "gavel", title: "Defensa en juicios civiles", body: "Si te demandan en un caso cubierto" },
      { icon: "bank", title: "Auditoría del IRS", body: "Representación si auditan tu declaración" },
      { icon: "phone", title: "Emergencia 24/7", body: "Para emergencias legales cubiertas" },
      { icon: "percent", title: "25% de descuento", body: "En servicios legales adicionales" },
      { icon: "pen", title: "Notario y firma digital", body: "**5** notarizaciones en línea al año · firmas ilimitadas" },
    ] as Row[],
  },

  id1: {
    kicker: "IDShield · 1 de 2",
    title: "Vigilamos",
    titleGold: "tu información",
    rows: [
      { icon: "card", title: "Tu crédito", body: "Alertas sobre **12** señales de robo de identidad" },
      { icon: "bank", title: "Tus cuentas financieras", body: "Seguimiento de la actividad de tus cuentas" },
      { icon: "globe", title: "Internet y dark web", body: "Buscamos tu información personal en línea" },
      { icon: "share", title: "Tu reputación", body: "Revisamos tus redes sociales por contenido dañino" },
      { icon: "eyeOff", title: "Tu privacidad", body: "Pedimos que borren tus datos de sitios que los venden" },
      { icon: "shieldCheck", title: "Seguridad digital", body: "Antivirus, VPN y gestor de contraseñas" },
    ] as Row[],
  },

  id2: {
    kicker: "IDShield · 2 de 2",
    title: "Si te roban",
    titleGold: "la identidad",
    rows: [
      { icon: "refresh", title: "Restauración completa", body: "Un especialista resuelve tu caso contigo" },
      { icon: "infinity", title: "Servicio ilimitado garantizado", body: "El tiempo que haga falta, hasta recuperarla" },
      { icon: "dollar", title: "Hasta $3 millones", body: "Protección contra fraude de identidad" },
    ] as Row[],
  },

  facts: {
    kicker: "Bueno saber",
    title: "Datos",
    titleGold: "importantes",
    items: [
      { icon: "calendar" as LsIcon, text: "**Asuntos familiares:** disponibles 180 días después de activar tu plan." },
      { icon: "car" as LsIcon, text: "**Multas:** disponibles 10 días después de activar tu plan." },
      { icon: "user" as LsIcon, text: "Algunos servicios cubren solo al titular o a su cónyuge." },
      { icon: "mapPin" as LsIcon, text: "En Nueva York, algunos servicios tienen costo adicional." },
    ],
    askTitle: "¿Dudas o un asunto legal?",
    askBody: "Escríbeme y te ayudo a usar tu plan.",
    cta: "Escríbeme por WhatsApp",
  },

  price: {
    kicker: "Tu plan completo",
    title: "¿Cuánto cuesta",
    titleGold: "y qué incluye?",
    monthly: "Mensual",
    yearly: "Anual",
    perMonth: "/mes",
    perYear: "/año",
    yearlyEquivalent: "equivale a {perMonth} al mes",
    yearlySaves: "ahorras {savings} al año",
    includes: {
      preferido:
        "**Plan Legal Preferencial.** Ideal para familias: habla con un abogado sobre asuntos legales personales ilimitados, para ti, tu cónyuge y tus hijos dependientes.",
      idshield:
        "**IDShield Familiar (3 agencias).** Protección de identidad para ti, tu cónyuge o pareja y tus dependientes, con monitoreo de las 3 agencias de crédito.",
    },
    stateNote: "Los beneficios y los precios pueden variar según tu estado.",
  },

  next: {
    kicker: "Próximos pasos",
    title: "Aplicar es",
    titleGold: "muy fácil",
    steps: [
      {
        n: "Paso 1 · Hoy",
        title: "Confirmamos tu información",
        body: "Revisamos juntos que tus datos estén completos y bien escritos.",
      },
      {
        n: "Paso 2",
        title: "Revisión y aprobación",
        body: "Enviamos tu solicitud a LegalShield para que la revise.",
      },
      {
        n: "Paso 3",
        title: "Recibes la decisión y comienza tu plan",
        body: "Te avisamos el resultado y ya puedes llamar a tu bufete.",
      },
    ],
    cta: "Confirmar mis datos",
  },
} as const;
