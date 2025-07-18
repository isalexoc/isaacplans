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
      nav: {
        services: {
          label: "Servicios",
          links: [
            {
              title: "ACA Obamacare",
              icon: "Stethoscope",
              href: "",
              description:
                "Cobertura médica asequible bajo el Mercado de Seguros ACA.",
            },
            {
              title: "Dental y Visión",
              icon: "Eye",
              href: "",
              description:
                "Planes que cubren exámenes dentales y cuidado visual.",
            },
            {
              title: "Indemnización Hospitalaria",
              icon: "Hospital",
              href: "",
              description:
                "Beneficios diarios en efectivo durante hospitalizaciones.",
            },
            {
              title: "Seguro de Vida",
              icon: "HeartPulse",
              href: "",
              description:
                "Protección financiera para tus seres queridos tras tu fallecimiento.",
            },
            {
              title: "Planes contra el Cáncer",
              icon: "Radiation",
              href: "",
              description:
                "Cobertura adicional para gastos relacionados con el cáncer.",
            },
            {
              title: "Planes contra Derrames Cerebrales",
              icon: "Activity",
              href: "",
              description:
                "Cobertura para recuperación y apoyo financiero tras un derrame cerebral.",
            },
          ],
        },

        resources: {
          label: "Recursos",
          links: [
            {
              title: "Preguntas Frecuentes",
              icon: "HelpCircle",
              href: "",
              description:
                "Respuestas a las preguntas más comunes sobre nuestros servicios.",
            },
            {
              title: "Blog de Seguros",
              icon: "BookOpen",
              href: "",
              description:
                "Artículos educativos sobre salud, seguros y bienestar.",
            },
            {
              title: "Testimonios de Clientes",
              icon: "MessageCircle",
              href: "",
              description:
                "Historias reales de personas satisfechas con nuestra ayuda.",
            },
            {
              title: "Guías del Consumidor",
              icon: "FileText",
              href: "",
              description:
                "Material descargable para ayudarte a tomar decisiones informadas.",
            },
            {
              title: "Cobertura y Opciones",
              icon: "ShieldCheck",
              href: "",
              description:
                "Explora lo que cubren nuestros planes y cómo pueden ayudarte.",
            },
            {
              title: "Glosario de Términos",
              icon: "Landmark",
              href: "",
              description:
                "Conoce el significado de los términos comunes en seguros.",
            },
            {
              title: "Videos Educativos",
              icon: "Film",
              href: "",
              description:
                "Material audiovisual para comprender mejor tus opciones.",
            },
            {
              title: "Calculadora de Subsidios",
              icon: "Calculator",
              href: "",
              description:
                "Herramienta para estimar el apoyo financiero disponible para ti.",
            },
            {
              title: "Asistencia Personalizada",
              icon: "UserCheck",
              href: "",
              description:
                "Contáctanos para recibir orientación gratuita y personalizada.",
            },
            {
              title: "Documentos Descargables",
              icon: "Download",
              href: "",
              description:
                "Accede a formularios, guías y folletos informativos.",
            },
            {
              title: "Comparador de Planes",
              icon: "GitCompareArrows",
              href: "",
              description:
                "Compara beneficios, precios y coberturas entre distintos planes.",
            },
            {
              title: "Boletín Informativo",
              icon: "Mail",
              href: "",
              description:
                "Suscríbete para recibir noticias sobre salud y seguros.",
            },
            {
              title: "Herramientas de Elegibilidad",
              icon: "SearchCheck",
              href: "",
              description:
                "Verifica si calificas para subsidios o programas especiales.",
            },
            {
              title: "Historias de Éxito",
              icon: "Smile",
              href: "",
              description:
                "Descubre cómo nuestros servicios han cambiado vidas.",
            },
            {
              title: "Apoyo en Renovaciones",
              icon: "Repeat",
              href: "",
              description: "Te ayudamos a renovar tu cobertura año tras año.",
            },
            {
              title: "Guías para Nuevos Usuarios",
              icon: "Compass",
              href: "",
              description: "Primeros pasos para elegir tu plan de salud ideal.",
            },
            {
              title: "Consejos para Ahorrar",
              icon: "PiggyBank",
              href: "",
              description: "Recomendaciones para reducir tus gastos médicos.",
            },
            {
              title: "Apoyo para Familias",
              icon: "Users",
              href: "",
              description:
                "Recursos útiles para el cuidado de tus seres queridos.",
            },
            {
              title: "Cobertura para Estudiantes",
              icon: "BookUser",
              href: "",
              description:
                "Planes ideales para jóvenes y estudiantes universitarios.",
            },
            {
              title: "Protección Laboral",
              icon: "Briefcase",
              href: "",
              description:
                "Cobertura para trabajadores independientes o contratistas.",
            },
            {
              title: "Actualizaciones Regulatorias",
              icon: "Gavel",
              href: "",
              description:
                "Información sobre cambios en leyes de salud y cobertura.",
            },
            {
              title: "Información para Inmigrantes",
              icon: "Globe2",
              href: "",
              description:
                "Recursos para inmigrantes legales que buscan cobertura.",
            },
            {
              title: "Guía de Reclamaciones",
              icon: "FileCheck2",
              href: "",
              description:
                "Aprende cómo presentar una reclamación y qué esperar del proceso.",
            },
          ],
        },
        about: {
          label: "Nosotros",
          bio: "Soluciones de seguros personalizadas para proteger tu salud, familia y tranquilidad.",
          links: [
            {
              title: "Nuestra Misión y Visión",
              icon: "FileCheck2",
              href: "",
              description:
                "Descubre nuestro compromiso con una cobertura de salud accesible y asequible.",
            },
            {
              title: "Por Qué Elegirnos",
              icon: "ThumbsUp",
              href: "",
              description:
                "Conoce lo que nos diferencia: atención personalizada y opciones de planes integrales.",
            },
            {
              title: "Conoce al Fundador",
              icon: "UserCheck",
              href: "",
              description:
                "Conoce a Isaac Orraiz, agente de seguros licenciado y comprometido con el bienestar de las familias.",
            },

            {
              title: "Contacto y Soporte",
              icon: "PhoneCall",
              href: "",
              description:
                "Contáctanos para recibir atención personalizada o resolver tus dudas sobre seguros.",
            },
          ],
        },
        contact: {
          label: "Contacto",
        },
      },
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
      ctas: {
        cta1: {
          title: "Cotización Gratis",
          message: "Solo toma 10 segundos",
        },
      },
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
        phone: process.env.NEXT_PUBLIC_PHONE_NUMBER,
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
        role: "Agente de Seguros",
        call: `Llamar: ${process.env.NEXT_PUBLIC_PHONE_NUMBER}`,
        addContact: "Agregar Contacto",
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
      nav: {
        services: {
          label: "Services",
          links: [
            {
              title: "ACA Obamacare",
              icon: "Stethoscope",
              href: "",
              description:
                "Affordable health coverage under the ACA Marketplace.",
            },
            {
              title: "Dental & Vision",
              icon: "Eye",
              href: "",
              description:
                "Plans that help cover dental checkups and vision care.",
            },
            {
              title: "Hospital Indemnity",
              icon: "Hospital",
              href: "",
              description:
                "Daily cash benefits during hospital stays to offset costs.",
            },
            {
              title: "Life Insurance",
              icon: "HeartPulse",
              href: "",
              description:
                "Financial protection for your loved ones after you’re gone.",
            },
            {
              title: "Cancer Plans",
              icon: "Radiation",
              href: "",
              description:
                "Supplemental coverage to support cancer-related expenses.",
            },
            {
              title: "Stroke Plans",
              icon: "Activity",
              href: "",
              description:
                "Coverage to help with recovery and financial gaps after a stroke.",
            },
          ],
        },

        resources: {
          label: "Resources",
          links: [
            {
              title: "Frequently Asked Questions",
              icon: "HelpCircle",
              href: "",
              description:
                "Answers to the most common questions about our services.",
            },
            {
              title: "Insurance Blog",
              icon: "BookOpen",
              href: "",
              description:
                "Educational articles on health, insurance, and wellness.",
            },
            {
              title: "Client Testimonials",
              icon: "MessageCircle",
              href: "",
              description: "Real stories from people satisfied with our help.",
            },
            {
              title: "Consumer Guides",
              icon: "FileText",
              href: "",
              description:
                "Downloadable material to help you make informed decisions.",
            },
            {
              title: "Coverage and Options",
              icon: "ShieldCheck",
              href: "",
              description:
                "Explore what our plans cover and how they can help you.",
            },
            {
              title: "Glossary of Terms",
              icon: "Landmark",
              href: "",
              description:
                "Learn the meaning of common insurance-related terms.",
            },
            {
              title: "Educational Videos",
              icon: "Film",
              href: "",
              description:
                "Visual material to better understand your coverage options.",
            },
            {
              title: "Subsidy Calculator",
              icon: "Calculator",
              href: "",
              description:
                "Tool to estimate the financial support available to you.",
            },
            {
              title: "Personalized Assistance",
              icon: "UserCheck",
              href: "",
              description: "Contact us for free, personalized guidance.",
            },
            {
              title: "Downloadable Documents",
              icon: "Download",
              href: "",
              description: "Access forms, guides, and informational brochures.",
            },
            {
              title: "Plan Comparison Tool",
              icon: "GitCompareArrows",
              href: "",
              description:
                "Compare benefits, costs, and coverages across plans.",
            },
            {
              title: "Newsletter",
              icon: "Mail",
              href: "",
              description:
                "Subscribe to receive updates on insurance and health.",
            },
            {
              title: "Eligibility Tools",
              icon: "SearchCheck",
              href: "",
              description:
                "Check if you qualify for subsidies or special programs.",
            },
            {
              title: "Success Stories",
              icon: "Smile",
              href: "",
              description: "Read how our services have changed lives.",
            },
            {
              title: "Renewal Support",
              icon: "Repeat",
              href: "",
              description: "We help you renew your coverage year after year.",
            },
            {
              title: "Guides for New Users",
              icon: "Compass",
              href: "",
              description: "First steps to choosing your ideal health plan.",
            },
            {
              title: "Money-Saving Tips",
              icon: "PiggyBank",
              href: "",
              description: "Recommendations to reduce medical service costs.",
            },
            {
              title: "Family Support",
              icon: "Users",
              href: "",
              description: "Useful resources to care for your loved ones.",
            },
            {
              title: "Student Coverage",
              icon: "BookUser",
              href: "",
              description: "Ideal plans for youth and college students.",
            },
            {
              title: "Workplace Protection",
              icon: "Briefcase",
              href: "",
              description: "Coverage options for freelancers or contractors.",
            },
            {
              title: "Regulatory Updates",
              icon: "Gavel",
              href: "",
              description:
                "Information on changes to health and coverage laws.",
            },
            {
              title: "Information for Immigrants",
              icon: "Globe2",
              href: "",
              description: "Resources for legal immigrants seeking coverage.",
            },
            {
              title: "Claims Guide",
              icon: "FileCheck2",
              href: "",
              description:
                "Learn how to file a claim and what to expect from the process.",
            },
          ],
        },
        about: {
          label: "About Us",
          bio: "Personalized insurance solutions to protect your health, family, and peace of mind.",
          links: [
            {
              title: "Our Mission & Vision",
              icon: "FileCheck2",
              href: "",
              description:
                "Discover our commitment to accessible, affordable health coverage.",
            },
            {
              title: "Why Choose Us",
              icon: "ThumbsUp",
              href: "",
              description:
                "Learn what sets us apart — from personalized service to comprehensive plan options.",
            },
            {
              title: "Meet the Founder",
              icon: "UserCheck",
              href: "",
              description:
                "Get to know Isaac Orraiz, a licensed insurance agent passionate about helping families thrive.",
            },

            {
              title: "Contact & Support",
              icon: "PhoneCall",
              href: "",
              description:
                "Reach out for personalized help or get answers to your insurance questions today.",
            },
          ],
        },
        contact: {
          label: "Contact",
        },
      },
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
      ctas: {
        cta1: {
          title: "Get Free Quote",
          message: "It only takes 10 seconds",
        },
      },
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
        phone: process.env.NEXT_PUBLIC_PHONE_NUMBER,
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
        role: "Insurance Agent",
        call: `Call: ${process.env.NEXT_PUBLIC_PHONE_NUMBER}`,
        addContact: "Add Contact",
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
