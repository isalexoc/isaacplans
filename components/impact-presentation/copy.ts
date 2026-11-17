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

/** The agent on the credential slide. The IBO number is not here: it comes from env (public repo). */
export const AGENT = {
  name: "Isaac Orraiz",
  whatsapp: "(540) 681-3507",
  /** The same number for wa.me links. */
  whatsappDigits: "15406813507",
  site: "isaacplans.com",
  photo: "/images/impact/presentation/agent-isaac.jpg",
  languages: "Español · English",
} as const;

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
    facts: { representative: string; licensed: (states: number) => string; bilingual: string; support: string };
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
    whatsappText: string;
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
      bilingual: "Atención personalizada en español y en inglés",
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
    specialist: { what: "Especialista", sub: "urgencias y ambulatorio" },
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
  guide: {
    intro: "Una presentación de 2 minutos. Toque «Comenzar» y avance a su ritmo.",
    start: "Comenzar",
    next: "Siguiente",
    back: "Atrás",
    stepOf: (n, total) => `${n} de ${total}`,
    apply: "Aplicar ahora",
    applyNote: "Toma unos minutos desde su teléfono o computadora. Su progreso se guarda solo.",
    questions: "¿Preguntas?",
    whatsappText: "Hola Isaac, vi la presentación de Impact y tengo una pregunta.",
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
      bilingual: "Personal service in English and Spanish",
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
    specialist: { what: "Specialist", sub: "urgent care & outpatient" },
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
  guide: {
    intro: "A 2-minute presentation. Tap “Start” and go at your own pace.",
    start: "Start",
    next: "Next",
    back: "Back",
    stepOf: (n, total) => `${n} of ${total}`,
    apply: "Apply now",
    applyNote: "Takes a few minutes from your phone or computer. Your progress saves on its own.",
    questions: "Questions?",
    whatsappText: "Hi Isaac, I saw the Impact presentation and I have a question.",
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
