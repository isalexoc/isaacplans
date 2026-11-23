/**
 * Every word of the Impact sales presentation, in both languages.
 *
 * Isaac's deck, built as one HTML file in a cloud Claude session (`Impact_Presentacion.html`) and
 * kept in code at his choice, so a wording change is an edit here. Both dictionaries share one
 * shape; the type keeps them from drifting apart.
 *
 * Impact's figures (members, dollars shared, provider fees, PRA rules) are Impact's own marketing
 * numbers as of 2026-11. Re-check them against impacthealthsharing.com when they change.
 */

export type DeckLocale = "en" | "es";

/*
 * No agent's identity lives here: the browser code of every client page (the product domain's
 * included) imports this file. Every screen takes an `AgentPublicProfile` (lib/tenancy/profile.ts);
 * Isaac's own comes from `ISAAC_AGENT` in lib/tenancy/isaac-agent.ts, which only server code imports.
 */

/** A language an agent serves clients in. */
export type AgentLanguage = "en" | "es";

/** The English pronoun copy may use for an agent; without one the sentence is worded around it. */
export type AgentPronoun = "he" | "she";

/** Impact's telehealth partner, named on the benefits slide. */
export const TELEHEALTH_NAME = "Doctegrity";

type Item = { title: string; body: string };

export type DeckCopy = {
  notInsurance: string;
  welcome: {
    hello: (firstName: string) => string;
    title: string;
    lead: string;
    tags: [string, string, string];
  };
  agent: {
    authorized: string;
    role: string;
    status: string;
    active: string;
    languages: string;
    kicker: string;
    title: string;
    facts: {
      representative: string;
      /** Shown only for a licensed agent. 0 states drops the number. */
      licensed: (states: number) => string;
      /** The languages the agent serves clients in; null (no line) when none are set. */
      service: (languages: readonly AgentLanguage[]) => string | null;
      support: string;
    };
  };
  what: {
    kicker: string;
    title: string;
    lead: string;
    stats: { members: string; shared: string; years: string; yearsUnit: string; days: string };
    photoCaption: string;
  };
  benefits: {
    kicker: string;
    title: string;
    wellness: Item;
    doctor: Item;
    telehealth: { title: string; before: string; after: string };
  };
  benefits2: { title: string; dentalVision: Item; prescriptions: Item; rewards: Item };
  more: {
    kicker: string;
    title: string;
    items: [Item, Item, Item, Item, Item, Item];
  };
  fees: {
    kicker: string;
    title: string;
    telehealth: { what: string; sub: string };
    wellness: { what: string; sub: string };
    primary: { what: string; sub: string };
    specialist: { what: string; sub: string };
    urgentCare: { what: string; sub: string };
    emergency: [string, string];
    howLabel: string;
    how: string;
  };
  card: { kicker: string; title: string; front: string; back: string; sample: string };
  next: {
    kicker: string;
    title: string;
    steps: [
      { n: string; title: string; body: string },
      { n: string; title: string; body: string },
      { n: string; title: string; body: string },
    ];
    cta: string;
    disclaimer: string;
  };
  /** The Member Center (impact.mysharable.com), drawn as an illustration (portal-mockup.tsx). */
  portal: {
    kicker: string;
    title: string;
    lead: string;
    features: { title: string; body: string }[];
  };
  /** "Your options": the four programs at this household's prices (lib/impact-quote). */
  quote: {
    kicker: string;
    title: string;
    household: (members: 1 | 2 | 3, age: number | null) => string;
    allIncludedTitle: string;
    allIncluded: [string, string, string, string, string, string];
    recommended: string;
    perMonth: string;
    perDay: (amount: string) => string;
    pra: string;
    then: string;
    max: string;
    note: string;
    fee: string;
    /** On the deck's quote questions when Impact's price service doesn't answer. */
    retry: string;
    names: Record<"esencial" | "plus" | "premium" | "total", { name: string; tagline: string }>;
    senior: string;
    under18: string;
    membersQuestion: string;
    members: [string, string, string];
    dobQuestion: string;
    see: string;
    change: string;
    /** Impact's prices didn't come: write to the agent on WhatsApp instead. */
    error: (firstName: string, pronoun: AgentPronoun | null) => string;
  };
  /** The self-serve guide (`/impact`): the same story, walked alone, ending in "Apply now". */
  guide: {
    intro: string;
    start: string;
    next: string;
    back: string;
    stepOf: (n: number, total: number) => string;
    apply: string;
    applyNote: string;
    questions: string;
    whatsappText: (firstName: string) => string;
    /** Under the Next button while the quote screen still has no prices. */
    quoteFirst: string;
    steps: [
      { n: string; title: string; body: string },
      { n: string; title: string; body: string },
      { n: string; title: string; body: string },
    ];
  };
};

const ES: DeckCopy = {
  notInsurance: "Impact no es un seguro.",
  welcome: {
    hello: (name) => `¡Bienvenido(a), ${name}!`,
    title: "Una forma diferente de cuidar su salud",
    lead: "Cobertura médica accesible para usted y su familia, con la libertad de escoger a sus propios médicos.",
    tags: ["Sin fines de lucro", "Red abierta", "Inscripción todo el año"],
  },
  agent: {
    authorized: "AUTORIZADO",
    role: "Representante Autorizado",
    status: "Estado",
    active: "● Activo",
    languages: "Idiomas",
    kicker: "Su asesor personal",
    title: "Le acompaño en cada paso",
    facts: {
      representative: "Representante autorizado de Impact Health Sharing",
      licensed: (n) => (n > 0 ? `Agente de salud licenciado en ${n} estados` : "Agente de salud licenciado"),
      service: (languages) =>
        languages.includes("es") && languages.includes("en")
          ? "Atención personalizada en español y en inglés"
          : languages.includes("es")
            ? "Atención personalizada en español"
            : languages.includes("en")
              ? "Atención personalizada en inglés"
              : null,
      support: "Le ayudo antes, durante y después de su inscripción",
    },
  },
  what: {
    kicker: "¿Qué es Impact?",
    title: "Personas ayudando a personas",
    lead: "Impact Health Sharing es una comunidad sin fines de lucro 501(c)(3) donde los miembros se unen para compartir sus gastos médicos elegibles. Sin intermediarios, sin redes que lo limiten y sin fines de lucro.",
    stats: {
      members: "miembros y creciendo",
      shared: "en gastos médicos compartidos y ahorrados",
      years: "de precios estables",
      yearsUnit: "años",
      days: "días al año para inscribirse",
    },
    photoCaption: "Hecho para las personas, no para las ganancias.",
  },
  benefits: {
    kicker: "Sus beneficios",
    title: "Lo que incluye su membresía",
    wellness: {
      title: "Chequeo anual de bienestar gratis",
      body: "Una visita de wellness al año por miembro (6+ años), más hasta $150 en laboratorios de rutina. Sin deducible.",
    },
    doctor: {
      title: "Usted escoge su médico",
      body: "Red abierta en todo el país: su médico primario, especialistas y hospitales de su preferencia.",
    },
    telehealth: {
      title: "Telemedicina 24/7 gratis",
      before: "Consultas ilimitadas con médicos licenciados por teléfono o video, a cualquier hora, a través de ",
      after: ".",
    },
  },
  benefits2: {
    title: "Y además, sin costo extra",
    dentalVision: {
      title: "Dental y visión incluidos",
      body: "Ahorros en dentista y óptica disponibles desde el primer día, incluidos en su membresía sin costo extra.",
    },
    prescriptions: {
      title: "Medicinas a menor costo",
      body: "Genéricos a $0 (de $10 o menos) y descuentos en miles de medicamentos de marca en todo el país.",
    },
    rewards: {
      title: "Premios por vida saludable",
      body: "Gimnasio, masajes, suplementos y más: le ayudan a bajar su PRA hasta $150 al mes por hogar.",
    },
  },
  more: {
    kicker: "Protección completa",
    title: "Cuando más lo necesita, está protegido",
    items: [
      {
        title: "Hospitalización y cirugías",
        body: "Emergencias, hospitalización, procedimientos y tratamientos por accidentes o enfermedades nuevas.",
      },
      { title: "Maternidad", body: "Hasta $150,000 por embarazo (embarazos que comienzan después de unirse)." },
      {
        title: "Salud mental y teleterapia",
        body: "Teleterapia a corto plazo gratis: 3 sesiones al mes por tema, más terapia ambulatoria.",
      },
      {
        title: "Wellness Concierge",
        body: "Impact coordina el pago directo a su médico por su visita de bienestar. Sin papeleo.",
      },
      { title: "Sin máximo de por vida", body: "Sin límite de por vida ni por evento. Hasta $500,000 al año por miembro." },
      {
        title: "Impact maneja las facturas",
        body: "El médico envía la factura a Impact; Impact negocia y paga. Usted no tiene que hacer reclamos.",
      },
    ],
  },
  fees: {
    kicker: "Sus copagos",
    title: "Usted sabe cuánto paga en cada visita",
    telehealth: { what: "Telemedicina 24/7", sub: "y teleterapia" },
    wellness: { what: "Chequeo anual", sub: "+ $150 en laboratorios" },
    primary: { what: "Médico primario", sub: "y pruebas de alergia" },
    specialist: { what: "Especialista", sub: "y servicios ambulatorios" },
    urgentCare: { what: "Urgent Care", sub: "centros de urgencia, sin cita" },
    emergency: ["Emergencia u", "hospitalización"],
    howLabel: "¿Cómo funciona?",
    how: "Paga su copago fijo en la visita y su médico le envía la factura a Impact. Luego aplica su PRA y, después, el 90/10 con tope de $5,000 al año.",
  },
  card: {
    kicker: "Su tarjeta de miembro",
    title: "Así le llegará su identificación",
    front: "FRENTE",
    back: "REVERSO",
    sample: "EJEMPLO",
  },
  next: {
    kicker: "Próximos pasos",
    title: "Comenzar es muy fácil",
    steps: [
      {
        n: "PASO 1 · HOY",
        title: "Confirmamos sus datos",
        body: "Revisamos juntos que su información esté completa y bien escrita.",
      },
      { n: "PASO 2", title: "Revisión y aprobación", body: "Impact revisa su solicitud y le confirmamos el resultado." },
      {
        n: "PASO 3",
        title: "¡Bienvenido a Impact!",
        body: "Recibe su tarjeta de miembro y sus beneficios comienzan el:",
      },
    ],
    cta: "Confirmar mis datos",
    disclaimer:
      "Impact Health Sharing es una organización sin fines de lucro 501(c)(3). No es un seguro. Divulgaciones por estado: impacthealthsharing.com/disclosures",
  },
  portal: {
    kicker: "Su portal de miembro",
    title: "Todo su plan, en su teléfono",
    lead: "En el Member Center de Impact usted ve y controla su membresía las 24 horas, desde el teléfono o la computadora.",
    features: [
      { title: "Su tarjeta digital", body: "Véala, imprímala o guárdela en PDF cuando la necesite." },
      {
        title: "Sus facturas",
        body: "Envíe una factura con una foto y siga cada una: enviada, en proceso o completada, con su explicación.",
      },
      { title: "Telemedicina y medicinas", body: "Consulte a un médico 24/7 y compare precios de medicinas en farmacias." },
      { title: "Pagos y bienestar", body: "Pague su aporte, active el pago automático y envíe sus recibos de premios de bienestar." },
      { title: "Personas ayudando a personas", body: "Vea a quién ayuda su aporte y envíe mensajes de ánimo a otros miembros." },
    ],
  },
  quote: {
    kicker: "Su cotización",
    title: "Elija su plan",
    household: (members, age) =>
      [members === 1 ? "1 persona" : members === 2 ? "2 personas" : "3 personas o más", age !== null ? `Mayor: ${age} años` : ""]
        .filter(Boolean)
        .join(" · "),
    allIncludedTitle: "Todos los planes incluyen todos los beneficios",
    allIncluded: ["Telemedicina $0", "Chequeo anual $0", "Dental y visión", "Medicinas", "Red abierta", "Maternidad"],
    recommended: "★ RECOMENDADO",
    perMonth: "/mes",
    perDay: (amount) => `≈ ${amount} al día`,
    pra: "Su parte anual",
    then: "Luego",
    max: "Máximo al año",
    note: "Lo único que cambia es su parte anual (PRA) si tiene un gasto médico grande. Los beneficios y los copagos son los mismos en los cuatro planes.",
    fee: "+ $79 de inscripción, una sola vez por familia",
    retry: "No pudimos traer los precios. Intente de nuevo en un momento.",
    names: {
      esencial: { name: "Esencial", tagline: "El menor aporte mensual" },
      plus: { name: "Plus", tagline: "Protección con ahorro" },
      premium: { name: "Premium", tagline: "El balance perfecto" },
      total: { name: "Total", tagline: "Máxima tranquilidad" },
    },
    senior: "Programa Senior de Impact (65+): una membresía por persona, con Medicare partes A y B.",
    under18:
      "Para menores de 18 años, un adulto crea una «membresía de tutor» y la paga. El precio es el mismo para todas las edades hasta los 18.",
    membersQuestion: "¿Cuántas personas va a cubrir?",
    members: ["Solo yo", "2 personas", "3 o más"],
    dobQuestion: "Fecha de nacimiento de la persona mayor",
    see: "Ver mis precios",
    change: "Cambiar mis datos",
    error: (name) => `No pudimos traer los precios ahora. Escríbale a ${name} por WhatsApp y le envía su cotización.`,
  },
  guide: {
    intro: "Una presentación de 2 minutos. Toque «Comenzar» y avance a su ritmo.",
    start: "Comenzar",
    next: "Siguiente",
    back: "Atrás",
    stepOf: (n, total) => `${n} de ${total}`,
    apply: "Aplicar ahora",
    applyNote: "Toma unos minutos desde su teléfono o computadora. Su progreso se guarda solo.",
    questions: "¿Preguntas?",
    whatsappText: (name) => `Hola ${name}, vi la presentación de Impact y tengo una pregunta.`,
    quoteFirst: "Primero toque «Ver mis precios» para continuar.",
    steps: [
      {
        n: "PASO 1 · HOY",
        title: "Llene su solicitud",
        body: "Unos minutos desde su teléfono o computadora. Su progreso se guarda solo.",
      },
      {
        n: "PASO 2",
        title: "Revisión y aprobación",
        body: "Revisamos su solicitud con usted, la enviamos a Impact y le confirmamos el resultado.",
      },
      {
        n: "PASO 3",
        title: "¡Bienvenido a Impact!",
        body: "Recibe su tarjeta de miembro y sus beneficios comienzan el:",
      },
    ],
  },
};

const EN: DeckCopy = {
  notInsurance: "Impact is not insurance.",
  welcome: {
    hello: (name) => `Welcome, ${name}!`,
    title: "A different way to healthcare",
    lead: "Affordable healthcare for you and your family — with the freedom to see the doctors you choose.",
    tags: ["Nonprofit", "No network restrictions", "Enroll year-round"],
  },
  agent: {
    authorized: "AUTHORIZED",
    role: "Authorized Representative",
    status: "Status",
    active: "● Active",
    languages: "Languages",
    kicker: "Your personal advisor",
    title: "I'll guide you every step of the way",
    facts: {
      representative: "Authorized Impact Health Sharing representative",
      licensed: (n) => (n > 0 ? `Licensed health agent in ${n} states` : "Licensed health agent"),
      service: (languages) =>
        languages.includes("en") && languages.includes("es")
          ? "Personal service in English and Spanish"
          : languages.includes("en")
            ? "Personal service in English"
            : languages.includes("es")
              ? "Personal service in Spanish"
              : null,
      support: "Support before, during and after enrollment",
    },
  },
  what: {
    kicker: "What is Impact?",
    title: "People helping people",
    lead: "Impact Health Sharing is a 501(c)(3) nonprofit community where members come together to share eligible medical expenses. No middlemen, no restrictive networks, no profit-driven agenda.",
    stats: {
      members: "members and growing",
      shared: "in medical bills shared & saved",
      years: "of rate stability",
      yearsUnit: "yrs",
      days: "days a year to enroll",
    },
    photoCaption: "Built for people, not profits.",
  },
  benefits: {
    kicker: "Your benefits",
    title: "What your membership includes",
    wellness: {
      title: "Free annual wellness visit",
      body: "One wellness visit per member per year (age 6+), plus up to $150 in routine labs. No PRA applies.",
    },
    doctor: {
      title: "Choose your own doctor",
      body: "No network restrictions nationwide — your primary doctor, specialists and hospitals of choice.",
    },
    telehealth: {
      title: "Free 24/7 telehealth",
      before: "Unlimited visits with licensed doctors by phone or video, any time, through ",
      after: ".",
    },
  },
  benefits2: {
    title: "Plus, at no extra cost",
    dentalVision: {
      title: "Dental & vision included",
      body: "Dental and vision savings available from day one — included at no extra cost.",
    },
    prescriptions: {
      title: "Prescription savings",
      body: "$0 generics ($10 or less) and discounts on thousands of brand-name medications nationwide.",
    },
    rewards: {
      title: "Wellness Rewards",
      body: "Gym, massages, supplements and more can lower your PRA by up to $150/month per household.",
    },
  },
  more: {
    kicker: "Comprehensive protection",
    title: "Protected when it matters most",
    items: [
      {
        title: "Hospital & surgery",
        body: "Emergencies, hospital stays, procedures and treatment for new accidents and illnesses.",
      },
      { title: "Maternity", body: "Up to $150,000 per pregnancy (pregnancies that begin after joining)." },
      {
        title: "Mental health & teletherapy",
        body: "Free short-term teletherapy: 3 sessions per month, per topic, plus outpatient therapy.",
      },
      {
        title: "Wellness Concierge",
        body: "Impact coordinates payment directly with your provider for your wellness visit. No paperwork.",
      },
      { title: "No lifetime maximum", body: "No lifetime or per-event limit. Up to $500,000 per member per year." },
      {
        title: "Impact handles the bills",
        body: "Your provider bills Impact; Impact reprices and pays. No claim forms for you.",
      },
    ],
  },
  fees: {
    kicker: "Your provider fees",
    title: "Know exactly what you pay at each visit",
    telehealth: { what: "24/7 Telehealth", sub: "and teletherapy" },
    wellness: { what: "Annual wellness visit", sub: "+ $150 in labs" },
    primary: { what: "Primary care", sub: "and allergy tests" },
    specialist: { what: "Specialist", sub: "and outpatient services" },
    urgentCare: { what: "Urgent care", sub: "walk-in clinics" },
    emergency: ["ER or", "hospital stay"],
    howLabel: "How it works:",
    how: "pay the flat fee at the visit and your provider bills Impact. Then your PRA applies, and after that it's 90/10 with a $5,000 annual cap.",
  },
  card: {
    kicker: "Your member ID card",
    title: "Here's what your ID card looks like",
    front: "FRONT",
    back: "BACK",
    sample: "SAMPLE",
  },
  next: {
    kicker: "Next steps",
    title: "Getting started is easy",
    steps: [
      {
        n: "STEP 1 · TODAY",
        title: "We confirm your details",
        body: "Together we make sure your information is complete and correct.",
      },
      { n: "STEP 2", title: "Review & approval", body: "Impact reviews your application and we confirm the result with you." },
      { n: "STEP 3", title: "Welcome to Impact!", body: "You receive your ID card and your benefits start on:" },
    ],
    cta: "Confirm my details",
    disclaimer:
      "Impact Health Sharing is a 501(c)(3) nonprofit. It is not insurance. State disclosures: impacthealthsharing.com/disclosures",
  },
  portal: {
    kicker: "Your member portal",
    title: "Your whole plan, on your phone",
    lead: "In Impact's Member Center you see and manage your membership 24/7, from your phone or computer.",
    features: [
      { title: "Your digital ID card", body: "See it, print it or save it as a PDF whenever you need it." },
      { title: "Your bills", body: "Send a bill with a photo and follow each one: submitted, processing or completed, with its explanation." },
      { title: "Telehealth & prescriptions", body: "See a doctor 24/7 and compare prescription prices across pharmacies." },
      { title: "Payments & wellness", body: "Pay your share, turn on AutoPay and send your Wellness Rewards receipts." },
      { title: "People helping people", body: "See whose bills your share helps and send encouragement to other members." },
    ],
  },
  quote: {
    kicker: "Your quote",
    title: "Choose your plan",
    household: (members, age) =>
      [members === 1 ? "1 person" : members === 2 ? "2 people" : "3 or more people", age !== null ? `Oldest: ${age}` : ""]
        .filter(Boolean)
        .join(" · "),
    allIncludedTitle: "Every plan includes every benefit",
    allIncluded: ["$0 telehealth", "$0 annual checkup", "Dental & vision", "Prescriptions", "No network limits", "Maternity"],
    recommended: "★ RECOMMENDED",
    perMonth: "/mo",
    perDay: (amount) => `≈ ${amount} a day`,
    pra: "Your annual share",
    then: "Then",
    max: "Annual max",
    note: "The only difference is your annual share (PRA) if you have a large medical bill. Benefits and provider fees are the same in all four plans.",
    fee: "+ $79 enrollment fee, once per family",
    retry: "We couldn't get the prices. Please try again in a moment.",
    names: {
      esencial: { name: "Essential", tagline: "Lowest monthly share" },
      plus: { name: "Plus", tagline: "Protection with savings" },
      premium: { name: "Premium", tagline: "The perfect balance" },
      total: { name: "Total", tagline: "Maximum peace of mind" },
    },
    senior: "Impact Senior Program (65+): one membership per person, with Medicare Parts A and B.",
    under18:
      "For anyone under 18, an adult sets up a “Guardian Membership” and pays for it. Pricing is the same for all ages up to 18.",
    membersQuestion: "How many people will be covered?",
    members: ["Just me", "2 people", "3 or more"],
    dobQuestion: "Date of birth of the oldest person",
    see: "See my prices",
    change: "Change my answers",
    error: (name, pronoun) =>
      pronoun
        ? `We couldn't get the prices right now. Message ${name} on WhatsApp and ${pronoun}'ll send your quote.`
        : `We couldn't get the prices right now. Message ${name} on WhatsApp for your quote.`,
  },
  guide: {
    intro: "A 2-minute presentation. Tap “Start” and go at your own pace.",
    start: "Start",
    next: "Next",
    back: "Back",
    stepOf: (n, total) => `${n} of ${total}`,
    apply: "Apply now",
    applyNote: "Takes a few minutes from your phone or computer. Your progress saves on its own.",
    questions: "Questions?",
    whatsappText: (name) => `Hi ${name}, I saw the Impact presentation and I have a question.`,
    quoteFirst: "First tap “See my prices” to continue.",
    steps: [
      {
        n: "STEP 1 · TODAY",
        title: "Fill out your application",
        body: "A few minutes from your phone or computer. Your progress saves on its own.",
      },
      {
        n: "STEP 2",
        title: "Review & approval",
        body: "We review your application with you, send it to Impact and confirm the result.",
      },
      { n: "STEP 3", title: "Welcome to Impact!", body: "You receive your member ID card and your benefits start on:" },
    ],
  },
};

export const DECK_COPY: Record<DeckLocale, DeckCopy> = { en: EN, es: ES };
