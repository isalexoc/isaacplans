/* lib/translations-aca.ts */
export const translations = {
  es: {
    hero: {
      badge: "The Affordable Care Act",
      name: "Isaac Orraiz - Agente de Seguros",
      title: "Seguro de Salud al Alcance de Todos",
      description:
        "¿Le resulta confuso la Ley de Atención Médica Asequible y sus requisitos? le ofrezco asistencia personalizada para que explore sus opciones sin problemas y obtenga la cobertura más asequible y completa.",
      testimonials: [
        {
          name: "James Rodriguez",
          text: "No tenía idea de por dónde empezar con el seguro de salud, pero Isaac hizo que todo el proceso fuera sencillo. Respondió todas mis preguntas y se aseguró de que obtuviera la cobertura que necesitaba. ¡Muy recomendable!",
        },
        {
          name: "Jessica Thompson",
          text: "Gracias a Isaac, me inscribí en un excelente plan ACA que cubre a mis doctores y medicamentos. Incluso me recordó cuándo era momento de renovarlo. ¡Un servicio verdaderamente profesional y atento!",
        },
      ],
      happyClient: {
        title: "Cliente feliz",
        subtitle: "¡Más de 3000 clientes atendidos!",
      },
    },

    definition: {
      description:
        "La Ley de Cuidado de Salud a Bajo Precio (ACA, por sus siglas en inglés), también conocida como Obamacare, es una amplia reforma sanitaria promulgada en marzo de 2010. Su objetivo es poner un seguro de salud asequible al alcance de más personas, ampliar el programa Medicaid y fomentar métodos innovadores de prestación de atención médica para reducir los costos. Gracias a la ACA, millones de personas que antes no tenían cobertura ahora tienen acceso a servicios de salud de calidad.",
      title: "Que es the Affordable Care Act (Obamacare)?",
    },

    about: {
      badge: "Sobre Nosotros",
      headline: "¡Ayudándole a Gestionar sus Necesidades de ACA!",
      description:
        "Soy Isaac Orraiz, un agente de seguros de salud licenciado especializado en planes ACA (Obamacare). Ayudo a individuos y familias a obtener cobertura asequible adaptada a sus necesidades, incluyendo dental, visión, indemnización hospitalaria, planes contra cáncer, planes contra derrames y más. Proporciono orientación experta en cada paso.",
      name: "Isaac Orraiz",
      role: "Agente de Seguros",
      credentialLabel: "NPN",
      credential: "21592068",
      cta: "Solicitar Información",
    },
    eligibility: {
      headlineBeforeBold: "¿Quiénes",
      headlineBold: "Califican?",
      intro:
        "Para ser elegible e inscribirse en cobertura de salud a través del Mercado de Seguros Médicos, usted debe:",
      bullets: [
        "Vivir en Estados Unidos",
        "Ser ciudadano o nacional estadounidense (o estar legalmente presente)",
        "No estar encarcelado",
      ],
      note: "No hay un límite de ingresos para usar el Mercado de Seguros Médicos. Las protecciones para el paciente bajo la ACA garantizan que las aseguradoras no puedan negar cobertura por género o por una condición preexistente; no existen límites vitalicios ni anuales en los beneficios esenciales de salud, y los adultos jóvenes pueden permanecer en el plan de sus padres hasta los 26 años.",
      image: "eligibility_family_flag", // id de Cloudinary
    },
    enroll: {
      headlineBeforeBold: "Cómo Inscribirse en un",
      headlineBold: "Plan del Mercado de Seguros Médicos",
      intro:
        "La inscripción en un plan del Mercado de Seguros Médicos puede realizarse durante el periodo anual de inscripción abierta o un periodo especial de inscripción provocado por eventos de vida como mudarse o tener un bebé. Así es como puede empezar:",
      step1:
        "<strong>Programe una consulta gratuita</strong> conmigo para identificar las opciones del Mercado en su estado.",
      step2:
        "<strong>Permítame completar el proceso de inscripción</strong> y el papeleo por usted, paso a paso.",
      subHeading: "Durante el periodo de inscripción, usted puede:",
      bullets: [
        "Elegir un plan por primera vez",
        "Continuar con su plan actual",
        "Hacer cambios a su plan actual",
        "Elegir un nuevo plan para reemplazar su plan actual",
      ],
      note: "Nota: Si experimenta un evento de vida o los ingresos de su hogar están por debajo de cierta cantidad, podría calificar para un periodo especial de inscripción.",
      image: "enrollment_couple_consult", // mismo ID de Cloudinary
    },
    tiers: {
      titleBeforeBold: "Tipos",
      titleBold: "de Planes",
      intro:
        "El Mercado de Seguros Médicos ofrece una gama de planes categorizados en cuatro niveles metálicos: Bronce, Plata, Oro y Platino. Cada nivel representa un grado distinto de costos compartidos:",
      plans: [
        {
          name: "Planes Bronce",
          color: "#cd7f32",
          bullets: [
            "Primas más bajas",
            "Costos de bolsillo más altos",
            "Adecuado si desea pagar primas bajas pero costos más altos cuando necesite atención",
          ],
        },
        {
          name: "Planes Plata",
          color: "#c0c0c0",
          bullets: [
            "Primas y costos de bolsillo moderados",
            "Elegible para ahorros adicionales si califica para reducciones de costos compartidos",
          ],
        },
        {
          name: "Planes Oro",
          color: "#ffd700",
          bullets: [
            "Primas altas",
            "Bajos costos de bolsillo",
            "Ideal si espera necesitar atención con frecuencia",
          ],
        },
        {
          name: "Planes Platino",
          color: "#e5e4e2",
          bullets: [
            "Primas más altas",
            "Costos de bolsillo más bajos",
            "Mejor si necesita mucha atención y puede pagar primas mensuales más altas",
          ],
        },
      ],
    },
    otherPlans: {
      title: "Más Opciones…",
      options: [
        {
          name: "Planes de Organización de Proveedores Preferidos (PPO)",
          description:
            "Los planes PPO ofrecen flexibilidad para elegir proveedores de atención médica. Puede consultar cualquier proveedor dentro de la red sin remisión, pero la atención fuera de la red costará más.",
        },
        {
          name: "Planes de Punto de Servicio (POS)",
          description:
            "Los planes POS combinan características de los planes HMO y PPO. Necesita una remisión de su médico de atención primaria para ver especialistas, pero puede recibir atención fuera de la red a un costo mayor.",
        },
        {
          name: "Planes de Organización para el Mantenimiento de la Salud (HMO)",
          description:
            "Los planes HMO le exigen usar proveedores dentro de la red y obtener remisiones de un médico de atención primaria. Suelen tener primas y costos de bolsillo más bajos.",
        },
        {
          name: "Planes de Organización de Proveedores Exclusivos (EPO)",
          description:
            "Los planes EPO solo cubren atención dentro de la red excepto en emergencias. No necesita remisiones para ver especialistas; son más flexibles que los HMO pero sin beneficios fuera de la red.",
        },
      ],
    },
    faq: {
      label: "Más Información",
      titleBeforeBold: "Preguntas",
      titleBold: "Importantes",
      image: "faq_clipboard_consult", // mismo ID
      items: [
        {
          q: "¿Qué Presupuesto Debo Destinar al Seguro de Salud?",
          a: "Debe elegir los planes Bronce o Plata si necesita ahorrar dinero, o los planes Oro o Platino si cuenta con un mayor presupuesto y espera necesitar atención médica con frecuencia.",
        },
        {
          q: "¿Puedo Seguir Atendiéndome con Mi Médico Preferido?",
          a: "Sí, por supuesto. Solo asegúrese de que sus médicos y hospitales preferidos estén dentro de la red para evitar altos costos de bolsillo.",
        },
        {
          q: "Necesidades de Medicamentos Recetados",
          a: "Elija un plan que cubra eficazmente sus medicamentos. Si no está seguro de qué plan elegir, puede programar una consulta gratuita con uno de nuestros expertos.",
        },
        {
          q: "Necesito Ayuda para Pagar el Seguro de Salud",
          a: "Existen subsidios a las primas para ingresos entre el 100 % y el 400 % del nivel federal de pobreza; puede verificar su elegibilidad en el Mercado de Seguros Médicos.",
        },
        {
          q: "¿Cómo Me Inscribo?",
          a: "Para obtener información detallada y asistencia personalizada, programe una cita conmigo hoy mismo. Le guiaré durante el proceso y le ayudaré a encontrar un plan que se adapte a sus necesidades y presupuesto.",
        },
      ],
    },
    ctaBanner: {
      message: "¿Busca un asesor ACA de primera clase?",
      button: "Programar una consulta",
    },
    ctaButton: {
      title: "Obtén ayuda experta ACA",
      subtitle: "Agente autorizado, sin compromiso",
    },
    calendar: {
      title: "Agende su cita ACA por teléfono",
      backButton: "← Volver",
    },
    selfEnroll: {
      title: "¿Prefiere inscribirse usted mismo?",
      subtitle:
        "Utilice nuestro portal seguro de HealthSherpa para comparar planes e inscribirse en minutos.",
      cta: "Comenzar Auto-Inscripción",
      disclaimer:
        "Disponible en la mayoría de los estados. En los mercados estatales puede ser redirigido al sitio oficial.",
    },
  },

  en: {
    hero: {
      badge: "The Affordable Care Act",
      name: "Isaac Orraiz - Insurance Agent",
      title: "Health Insurance Within Everyone’s Reach",
      description:
        "Is the Affordable Care Act and its requirements confusing? I offer personalized assistance to help you explore your options with ease and get the most affordable and comprehensive coverage.",
      testimonials: [
        {
          name: "James Rodriguez",
          text: "I had no idea where to start with health insurance, but Isaac made the whole process simple. He answered all my questions and made sure I got the coverage I needed. Highly recommended!",
        },
        {
          name: "Jessica Thompson",
          text: "Thanks to Isaac, I enrolled in a great ACA plan that covers my doctors and prescriptions. He even reminded me when it was time to renew. Truly professional and attentive service!",
        },
      ],
      happyClient: {
        title: "Happy Client",
        subtitle: "Over 3,000 clients served!",
      },
    },
    definition: {
      title: "What is the Affordable Care Act (Obamacare)?",
      description:
        "The Affordable Care Act (ACA), also known as Obamacare, is a comprehensive health-care reform law enacted in March 2010. Its goal is to put affordable health insurance within reach of more people, expand the Medicaid program, and foster innovative methods of delivering medical care to reduce costs. Thanks to the ACA, millions of previously uninsured individuals now have access to quality health care.",
    },

    about: {
      badge: "About Me",
      headline: "Helping You To Manage Your ACA Needs!",
      description:
        "I am Isaac Orraiz, a licensed health-insurance agent specializing in ACA (The Affordable Care Act) plans. I help individuals and families get affordable coverage tailored to their needs, including dental, vision, hospital indemnity, cancer plans, stroke plans and more. I provide expert guidance every step of the way.",
      name: "Isaac Orraiz",
      role: "Insurance Agent",
      credentialLabel: "NPN",
      credential: "21592068",
      cta: "Request Information",
    },
    eligibility: {
      headlineBeforeBold: "Who",
      headlineBold: "Qualifies?",
      intro:
        "To be eligible to enroll in health coverage through the Health Insurance Marketplace, you must:",
      bullets: [
        "Live in the United States",
        "Be a U.S. citizen or national (or be lawfully present)",
        "Not be incarcerated",
      ],
      note: "There is no income limit to use the Health Insurance Marketplace. Special patient protections under the ACA ensure that insurers cannot refuse coverage based on gender or a pre-existing condition, there are no lifetime or annual limits on essential health benefits, and young adults can stay on their family's insurance plan until age 26.",
      image: "eligibility_family_flag", // cloudinary public-id (swap if needed)
    },
    enroll: {
      headlineBeforeBold: "How to Enroll in a",
      headlineBold: "Health Insurance Marketplace Plan",
      intro:
        "Enrollment in a Health Insurance Marketplace plan can be done during the annual open enrollment period or a special enrollment period triggered by life events like moving or having a baby. Here’s how to get started:",
      step1:
        "<strong>Schedule a free consultation</strong> with me to identify the Marketplace options in your state.",
      step2:
        "<strong>Let me complete the enrollment process</strong> and paperwork for you, step by step.",
      subHeading: "During the enrollment period, you can:",
      bullets: [
        "Choose a plan for the first time",
        "Continue with your current plan",
        "Make changes to your current plan",
        "Choose a new plan to replace your current one",
      ],
      note: "Note: If you experience a life event or your household income is below a certain amount, you may qualify for a special enrollment period.",
      image: "enrollment_couple_consult", // cloudinary ID from screenshot
    },
    tiers: {
      titleBeforeBold: "Types",
      titleBold: "of Plans",
      intro:
        "The Health Insurance Marketplace offers a range of plans categorized into four metal tiers: Bronze, Silver, Gold, and Platinum. Each tier represents a different level of cost-sharing:",
      plans: [
        {
          name: "Bronze Plans",
          color: "#cd7f32",
          bullets: [
            "Lowest premiums",
            "Highest out-of-pocket costs",
            "Suitable if you want to pay lower premiums but higher costs when you need care",
          ],
        },
        {
          name: "Silver Plans",
          color: "#c0c0c0",
          bullets: [
            "Moderate premiums and out-of-pocket costs",
            "Eligible for extra savings if you qualify for cost-sharing reductions",
          ],
        },
        {
          name: "Gold Plans",
          color: "#ffd700",
          bullets: [
            "High premiums",
            "Low out-of-pocket costs",
            "Ideal if you expect to need frequent care",
          ],
        },
        {
          name: "Platinum Plans",
          color: "#e5e4e2",
          bullets: [
            "Highest premiums",
            "Lowest out-of-pocket costs",
            "Best if you need a lot of care and can afford higher monthly premiums",
          ],
        },
      ],
    },
    otherPlans: {
      title: "More Options…",
      options: [
        {
          name: "Preferred Provider Organization (PPO) Plans",
          description:
            "PPO plans offer flexibility in choosing healthcare providers. You can see any in-network provider without a referral, but out-of-network care will cost more.",
        },
        {
          name: "Point-of-Service (POS) Plans",
          description:
            "POS plans combine features of HMO and PPO plans. You need a referral from a primary-care physician to see specialists, but you can receive care out-of-network at higher costs.",
        },
        {
          name: "Health Maintenance Organization (HMO) Plans",
          description:
            "HMO plans require you to use in-network providers and get referrals from a primary-care physician. These plans typically have lower premiums and out-of-pocket costs.",
        },
        {
          name: "Exclusive Provider Organization (EPO) Plans",
          description:
            "EPO plans only cover in-network care except in emergencies. No referrals are needed to see specialists, making them more flexible than HMOs but without out-of-network benefits.",
        },
      ],
    },
    faq: {
      label: "More Info",
      titleBeforeBold: "Important",
      titleBold: "Questions",
      image: "faq_clipboard_consult", // Cloudinary ID
      items: [
        {
          q: "What Should I Budget for Health Insurance?",
          a: "You should choose the Bronze or Silver plans if you need to save money, or the Gold or Platinum plans if you have a larger budget and expect to need frequent healthcare services.",
        },
        {
          q: "Can I Work with My Preferred Doctor?",
          a: "Yes, absolutely. Please ensure that your preferred doctors and hospitals are in-network to avoid high out-of-pocket costs.",
        },
        {
          q: "Prescription Drug Needs",
          a: "Choose a plan that effectively covers your medication requirements. If you are unsure which plan to choose, you can schedule a free consultation call with one of our experts below.",
        },
        {
          q: "I Need Help Paying for Health Insurance",
          a: "Premium subsidies are available for incomes between 100% and 400% of the federal poverty level; you can check your eligibility on the Health Insurance Marketplace.",
        },
        {
          q: "How do I Sign Up?",
          a: "For detailed information and personalized assistance, schedule an appointment with me today. I can guide you through the process and ensure you find a plan that fits your needs and budget.",
        },
      ],
    },
    ctaBanner: {
      message: "Looking for a First-Class ACA Consultant?",
      button: "Schedule A Consultation",
    },
    ctaButton: {
      title: "Get Expert ACA Help",
      subtitle: "Licensed agent—no obligation",
    },
    calendar: {
      title: "Book Your ACA Phone Appointment",
      backButton: "← Go Back",
    },
    selfEnroll: {
      title: "Prefer to self-enroll?",
      subtitle:
        "Use our secure HealthSherpa portal to compare plans and enroll in minutes.",
      cta: "Start Self-Enrollment",
      disclaimer:
        "Available in most states. In state-based marketplaces you may be redirected to the official state site.",
    },
  },
} as const;
