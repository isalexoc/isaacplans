export const translations = {
  es: {
    // Header
    terms: {
      title: {
        en: "Terms of Service",
        es: "Términos de Servicio",
      },
      updated: {
        en: "Effective Date: September 19, 2024",
        es: "Fecha de vigencia: 19 de septiembre de 2024",
      },
      intro: {
        en: "By using this site and submitting your information, you agree to the following:",
        es: "Al utilizar este sitio y enviar su información, usted acepta lo siguiente:",
      },
      points: {
        use: {
          en: "Your information will be used to respond to your inquiry and provide insurance-related services.",
          es: "Su información será utilizada para responder a su consulta y brindar servicios relacionados con seguros.",
        },
        sms: {
          en: "By checking the consent box, you agree to receive SMS messages from Isaac Plans. Message and data rates may apply. You may opt-out at any time by replying STOP.",
          es: "Al marcar la casilla de consentimiento, acepta recibir mensajes SMS de Isaac Plans. Pueden aplicarse tarifas por mensajes y datos. Puede cancelar en cualquier momento respondiendo STOP.",
        },
        accuracy: {
          en: "You agree to provide accurate information. False information may result in service denial.",
          es: "Usted se compromete a proporcionar información precisa. La información falsa puede resultar en la denegación del servicio.",
        },
        thirdParty: {
          en: "We may refer you to third-party providers. We are not responsible for their content or policies.",
          es: "Podemos referirlo a proveedores externos. No somos responsables de su contenido ni de sus políticas.",
        },
        changes: {
          en: "We may update these terms at any time. Continued use constitutes acceptance of updates.",
          es: "Podemos actualizar estos términos en cualquier momento. El uso continuo constituye aceptación de los cambios.",
        },
      },
      contact: {
        en: "If you have questions about these terms, please contact us at info@isaacplans.com.",
        es: "Si tiene preguntas sobre estos términos, contáctenos en info@isaacplans.com.",
      },
    },

    nav: {
      home: "Inicio",
      services: "Servicios",
      about: "Acerca de",
      coverage: "Cobertura",
      contact: "Contacto",
    },
    header: {
      phone: process.env.NEXT_PUBLIC_PHONE_NUMBER,
      cta: "Cotización Gratis",
    },
    // Hero
    hero: {
      badge: "Licenciado en 9+ Estados",
      name: "Isaac Orraiz",
      title: "Su Agente de Seguros",
      subtitle: "de Confianza",
      description:
        "Especializado en seguros ACA (Obamacare). Obtenga cobertura personalizada que se adapte a sus necesidades y presupuesto con orientación experta en cada paso.",
      cta1: "Cotización Gratis",
      cta2: "Agendar Consulta",
      stats: {
        states: "Estados con Licencia",
        clients: "Clientes Atendidos",
        satisfaction: "Tasa de Satisfacción",
      },
      onPicUp: {
        title: "ACA Certificado",
        des: "Cobertura Experta",
      },
      onPicDown: {
        title: "Especialista en Salud",
        des: "Todos los planes",
      },
    },
    // Services
    services: {
      title: "Servicios Integrales de Seguros",
      subtitle:
        "Especialista en planes del mercado ACA, brindo orientación experta para ayudarle a navegar el complejo mundo de los seguros de salud.",
      items: {
        aca: {
          title: "Seguro de Salud ACA (Obamacare)",
          description:
            "Planes integrales de seguro de salud bajo la Ley de Cuidado de Salud Asequible con subsidios y créditos fiscales.",
          features: [
            "Créditos Fiscales Premium",
            "Reducciones de Costos Compartidos",
            "Beneficios Esenciales de Salud",
            "Condiciones Preexistentes Cubiertas",
          ],
        },
        medicare: {
          title: "Planes Medicare",
          description:
            "Soluciones completas de Medicare incluyendo Partes A, B, C y D con selección personalizada de planes.",
          features: [
            "Medicare Advantage",
            "Suplementos Medicare",
            "Parte D Medicamentos",
            "Inscripción Anual",
          ],
        },
        family: {
          title: "Cobertura Familiar",
          description:
            "Soluciones de seguro personalizadas para familias con niños, asegurando protección integral.",
          features: [
            "Cuidado Pediátrico",
            "Cobertura de Maternidad",
            "Deducibles Familiares",
            "Cuidado Preventivo",
          ],
        },
        comparison: {
          title: "Comparación de Planes",
          description:
            "Análisis lado a lado de planes para ayudarle a elegir la mejor cobertura para sus necesidades específicas.",
          features: [
            "Análisis de Costos",
            "Comparación de Redes",
            "Revisión de Beneficios",
            "Recomendaciones Personalizadas",
          ],
        },
        support: {
          title: "Soporte Continuo",
          description:
            "Asistencia durante todo el año con reclamos, renovaciones y cualquier pregunta relacionada con seguros.",
          features: [
            "Asistencia con Reclamos",
            "Guía de Renovación",
            "Soporte 24/7",
            "Actualizaciones de Póliza",
          ],
        },
        optimization: {
          title: "Optimización de Costos",
          description:
            "Encuentre los planes más rentables mientras mantiene la cobertura que necesita.",
          features: [
            "Cálculo de Subsidios",
            "Proyecciones de Costos",
            "Análisis de Ahorros",
            "Planificación de Presupuesto",
          ],
        },
      },
    },
    // About
    about: {
      title: "Su Profesional de Seguros Dedicado",
      description1:
        "Con experiencia en la industria de seguros de salud, me especializo en ayudar a individuos y familias a navegar el complejo mundo de los seguros ACA. Tengo licencia en ACA (Salud, Obama Care), Vida, Dental y Visión en más de 9 estados.",
      description2:
        "Estar licenciado en múltiples estados me permite servir a clientes a nivel nacional, asegurando que reciba orientación experta sin importar su ubicación. Me mantengo actualizado con todos los cambios regulatorios y nuevas ofertas de planes para brindarle la información y opciones más actualizadas.",
      certifications: "Certificaciones y Credenciales",
      certs: [
        "Agente de Seguros Licenciado",
        "Licencia ACA (Salud, Obama Care)",
        "Licencia en Seguro de Vida",
        "Licencia en Seguro Dental",
        "Licencia en Seguro de Visión",
      ],
      achievements: {
        states: {
          title: "9+ Certificaciones Estatales",
          description:
            "Licenciado para servir clientes en múltiples estados de EE.UU.",
        },
        clients: {
          title: "Clientes Satisfechos",
          description:
            "Ayudando a individuos y familias a encontrar la cobertura correcta",
        },
        experience: {
          title: "Experiencia",
          description: "Mucha experiencia en la industria de seguros de salud",
        },
        education: {
          title: "Educación Continua",
          description:
            "Manteniéndome actualizado con las últimas regulaciones y planes",
        },
      },
    },
    // Coverage
    coverage: {
      title: "Cobertura Nacional",
      subtitle:
        "Licenciado y certificado para servir clientes en más de 20 estados de Estados Unidos. Donde quiera que esté, puedo ayudarle a encontrar la cobertura de seguro adecuada.",
      description:
        "Experiencia y licencias en ACA (Salud, Obama Care), Vida, Dental y Visión en múltiples estados, ofrezco servicios profesionales de seguros especializados.",
    },
    // Contact
    contact: {
      title: "Obtenga Su Cotización Gratuita de Seguro",
      subtitle:
        "¿Listo para encontrar la cobertura de seguro perfecta? Contácteme hoy para una consulta personalizada y cotización gratuita adaptada a sus necesidades específicas.",
      form: {
        smsConsent: `Al marcar esta casilla, doy mi consentimiento para recibir mensajes de texto relacionados con mis servicios de seguros de Isaac Plans. Puedes responder “STOP” en cualquier momento para darte de baja. Pueden aplicarse tarifas de mensajes y datos. La frecuencia de los mensajes puede variar. Envía AYUDA al (${process.env.NEXT_PUBLIC_PHONE_NUMBER}) para recibir asistencia. Para más información, visita nuestra Política de Privacidad y Términos de Servicio.`,

        title: "Solicite Su Cotización",
        name: "Nombre Completo *",
        email: "Correo Electrónico *",
        phone: "Número de Teléfono *",
        insuranceType: "Tipo de Seguro *",
        message: "Mensaje",
        messagePlaceholder:
          "Cuénteme sobre sus necesidades de seguro, situación actual, o cualquier pregunta específica que tenga...",
        submit: "Obtener Mi Cotización Gratis",
        types: {
          aca: "Seguro de Salud ACA",
          medicare: "Planes Medicare",
          family: "Cobertura Familiar",
          individual: "Planes Individuales",
          other: "Otro / No Estoy Seguro",
        },
      },
      info: {
        title: "Póngase en Contacto",
        description:
          "Estoy aquí para ayudarle a navegar el mercado de seguros y encontrar la cobertura que es adecuada para usted. No dude en comunicarse con cualquier pregunta.",
        phone: {
          title: "Teléfono",
          details: process.env.NEXT_PUBLIC_PHONE_NUMBER,
          description: "Llame para asistencia inmediata",
        },
        email: {
          title: "Correo Electrónico",
          details: "info@isaacplans.com",
          description: "Envíenos sus preguntas",
        },
        coverage: {
          title: "Área de Servicio",
          details: "9+ Estados a Nivel Nacional",
          description: "Licenciado en múltiples estados",
        },
        hours: {
          title: "Horarios",
          details: "Lun-Vie 8AM-6PM",
          description: "Citas de fin de semana disponibles",
        },
        cta: {
          title: "¿Listo para Comenzar?",
          description:
            "Llame ahora para asistencia inmediata o para programar su consulta gratuita.",
          button: process.env.NEXT_PUBLIC_PHONE_NUMBER,
        },
      },
    },
    // Footer
    footer: {
      description:
        "Su socio de seguros de confianza especializado en cobertura ACA y Medicare en más de 9 estados. Servicio profesional y personalizado en el que puede confiar.",
      services: "Servicios",
      resources: "Recursos",
      company: "Empresa",
      follow: "Síguenos",
      rights: "Todos los derechos reservados.",
      links: {
        guide: "Guía de Seguros",
        faq: "Preguntas Frecuentes",
        blog: "Blog",
        regulations: "Regulaciones Estatales",
        privacy: "Política de Privacidad",
        terms: "Términos de Servicio",
        disclaimer: "Descargo de Responsabilidad",
      },
    },
  },
  en: {
    // Header
    nav: {
      home: "Home",
      services: "Services",
      about: "About",
      coverage: "Coverage",
      contact: "Contact",
    },
    header: {
      phone: process.env.NEXT_PUBLIC_PHONE_NUMBER,
      cta: "Free Quote",
    },
    // Hero
    hero: {
      badge: "Licensed in 9+ States",
      name: "Isaac Orraiz",
      title: "Your Trusted",
      subtitle: "Insurance Agent",
      description:
        "Specializing in ACA (Obamacare) insurance. Get personalized coverage that fits your needs and budget with expert guidance every step of the way.",
      cta1: "Get Free Quote",
      cta2: "Schedule Consultation",
      stats: {
        states: "Licensed States",
        clients: "Clients Served",
        satisfaction: "Satisfaction Rate",
      },
      onPicUp: {
        title: "ACA Certified",
        des: "The Right Plan",
      },
      onPicDown: {
        title: "Health Specialist",
        des: "All plans",
      },
    },
    // Services
    services: {
      title: "Comprehensive Insurance Services",
      subtitle:
        "ACA marketplace plans coverage, I provide expert guidance to help you navigate the complex world of health insurance.",
      items: {
        aca: {
          title: "ACA Health Insurance (Obamacare)",
          description:
            "Comprehensive health insurance plans under the Affordable Care Act with subsidies and tax credits.",
          features: [
            "Premium Tax Credits",
            "Cost-Sharing Reductions",
            "Essential Health Benefits",
            "Pre-existing Conditions Covered",
          ],
        },
        medicare: {
          title: "Medicare Plans",
          description:
            "Complete Medicare solutions including Parts A, B, C, and D with personalized plan selection.",
          features: [
            "Medicare Advantage",
            "Medicare Supplements",
            "Part D Prescription",
            "Annual Enrollment",
          ],
        },
        family: {
          title: "Family Coverage",
          description:
            "Tailored insurance solutions for families with children, ensuring comprehensive protection.",
          features: [
            "Pediatric Care",
            "Maternity Coverage",
            "Family Deductibles",
            "Preventive Care",
          ],
        },
        comparison: {
          title: "Plan Comparison",
          description:
            "Side-by-side plan analysis to help you choose the best coverage for your specific needs.",
          features: [
            "Cost Analysis",
            "Network Comparison",
            "Benefit Review",
            "Personalized Recommendations",
          ],
        },
        support: {
          title: "Ongoing Support",
          description:
            "Year-round assistance with claims, renewals, and any insurance-related questions.",
          features: [
            "Claims Assistance",
            "Renewal Guidance",
            "24/7 Support",
            "Policy Updates",
          ],
        },
        optimization: {
          title: "Cost Optimization",
          description:
            "Find the most cost-effective plans while maintaining the coverage you need.",
          features: [
            "Subsidy Calculation",
            "Cost Projections",
            "Savings Analysis",
            "Budget Planning",
          ],
        },
      },
    },
    // About
    terms: {
      title: {
        en: "Terms of Service",
        es: "Términos de Servicio",
      },
      updated: {
        en: "Effective Date: September 19, 2024",
        es: "Fecha de vigencia: 19 de septiembre de 2024",
      },
      intro: {
        en: "By using this site and submitting your information, you agree to the following:",
        es: "Al utilizar este sitio y enviar su información, usted acepta lo siguiente:",
      },
      points: {
        use: {
          en: "Your information will be used to respond to your inquiry and provide insurance-related services.",
          es: "Su información será utilizada para responder a su consulta y brindar servicios relacionados con seguros.",
        },
        sms: {
          en: "By checking the consent box, you agree to receive SMS messages from Isaac Plans. Message and data rates may apply. You may opt-out at any time by replying STOP.",
          es: "Al marcar la casilla de consentimiento, acepta recibir mensajes SMS de Isaac Plans. Pueden aplicarse tarifas por mensajes y datos. Puede cancelar en cualquier momento respondiendo STOP.",
        },
        accuracy: {
          en: "You agree to provide accurate information. False information may result in service denial.",
          es: "Usted se compromete a proporcionar información precisa. La información falsa puede resultar en la denegación del servicio.",
        },
        thirdParty: {
          en: "We may refer you to third-party providers. We are not responsible for their content or policies.",
          es: "Podemos referirlo a proveedores externos. No somos responsables de su contenido ni de sus políticas.",
        },
        changes: {
          en: "We may update these terms at any time. Continued use constitutes acceptance of updates.",
          es: "Podemos actualizar estos términos en cualquier momento. El uso continuo constituye aceptación de los cambios.",
        },
      },
      contact: {
        en: "If you have questions about these terms, please contact us at info@isaacplans.com.",
        es: "Si tiene preguntas sobre estos términos, contáctenos en info@isaacplans.com.",
      },
    },
    about: {
      title: "Your Dedicated Insurance Professional",
      description1:
        "With experience in the health insurance industry, I specialize in helping individuals and families navigate the complex world of insurance. I am licensed in ACA (Health, Obama Care), Life, Dental, and Vision insurance across 9+ states.",
      description2:
        "Being licensed in multiple states allows me to serve clients nationwide, ensuring you receive expert guidance regardless of your location. I stay current with all regulatory changes and new plan offerings to provide you with the most up-to-date information and options.",
      certifications: "Certifications & Credentials",
      certs: [
        "Licensed Insurance Agent",
        "ACA License (Health, Obama Care)",
        "Life Insurance License",
        "Dental Insurance License",
        "Vision Insurance License",
      ],
      achievements: {
        states: {
          title: "9+ State Certifications",
          description: "Licensed to serve clients across multiple US states",
        },
        clients: {
          title: "Satisfied Clients",
          description:
            "Helping individuals and families find the right coverage",
        },
        experience: {
          title: "Experience",
          description:
            "Over a decade of expertise in health insurance industry",
        },
        education: {
          title: "Continuous Education",
          description: "Staying current with latest regulations and plans",
        },
      },
    },
    // Coverage
    coverage: {
      title: "Nationwide Coverage",
      subtitle:
        "Licensed and certified to serve clients in over 20 states across the United States. Wherever you are, I can help you find the right insurance coverage.",
      description:
        "With experience and licenses in ACA (Health, Obama Care), Life, Dental, and Vision across multiple states, I offer specialized professional insurance services.",
    },
    // Contact
    contact: {
      title: "Get Your Free Insurance Quote",
      subtitle:
        "Ready to find the perfect insurance coverage? Contact me today for a personalized consultation and free quote tailored to your specific needs.",
      form: {
        smsConsent: `By checking this box, I consent to receive text messages related to my insurance services from Isaac Plans. You can reply “STOP” at any time to opt out. Message and data rates may apply. Message frequency may vary. Text HELP to (${process.env.NEXT_PUBLIC_PHONE_NUMBER}) for assistance. For more information, visit our Privacy Policy and Terms of Service.`,

        title: "Request Your Quote",
        name: "Full Name *",
        email: "Email Address *",
        phone: "Phone Number *",
        insuranceType: "Insurance Type *",
        message: "Message",
        messagePlaceholder:
          "Tell me about your insurance needs, current situation, or any specific questions you have...",
        submit: "Get My Free Quote",
        types: {
          aca: "ACA Health Insurance",
          medicare: "Medicare Plans",
          family: "Family Coverage",
          individual: "Individual Plans",
          other: "Other / Not Sure",
        },
      },
      info: {
        title: "Get In Touch",
        description:
          "I'm here to help you navigate the insurance marketplace and find the coverage that's right for you. Don't hesitate to reach out with any questions.",
        phone: {
          title: "Phone",
          details: process.env.NEXT_PUBLIC_PHONE_NUMBER,
          description: "Call for immediate assistance",
        },
        email: {
          title: "Email",
          details: "info@isaacplans.com",
          description: "Send us your questions",
        },
        coverage: {
          title: "Service Area",
          details: "9+ States Nationwide",
          description: "Licensed across the US",
        },
        hours: {
          title: "Hours",
          details: "Mon-Fri 8AM-6PM",
          description: "Weekend appointments available",
        },
        cta: {
          title: "Ready to Get Started?",
          description:
            "Call now for immediate assistance or to schedule your free consultation.",
          button: process.env.NEXT_PUBLIC_PHONE_NUMBER,
        },
      },
    },
    // Footer
    footer: {
      description:
        "Your trusted insurance partner specializing in ACA and Medicare coverage across 9+ states. Professional, personalized service you can count on.",
      services: "Services",
      resources: "Resources",
      company: "Company",
      follow: "Follow Us",
      rights: "All rights reserved.",
      links: {
        guide: "Insurance Guide",
        faq: "FAQ",
        blog: "Blog",
        regulations: "State Regulations",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        disclaimer: "Disclaimer",
      },
    },
  },
};
